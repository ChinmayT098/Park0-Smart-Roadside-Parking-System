import os
import uvicorn
import random
from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta, date
from typing import List, Dict, Any, Optional
import json
import asyncio

# Import database and models
from backend.database import get_async_db, async_db, sync_db, get_next_sequence_value
from backend.models import clean_doc, clean_docs
from backend import schemas, auth
from backend.detector import AICameraDetector, VEHICLE_LENGTHS
from backend.timezone import get_ist_now, get_ist_date_str, IST

app = FastAPI(title="Park0 API", description="AI-powered Smart Roadside Parking Management API (Multi-Collection MongoDB Atlas)")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local development ease
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

from backend.cleanup_invalid_vehicles import cleanup_invalid_vehicle_records

# Global map of active camera detectors: {shop_id: AICameraDetector}
active_detectors: Dict[int, AICameraDetector] = {}
detectors_lock = asyncio.Lock()

@app.on_event("startup")
async def startup_db_cleanup():
    """Purges any legacy invalid 'Scanning...' vehicle records on backend startup."""
    try:
        cleanup_invalid_vehicle_records()
    except Exception as e:
        print(f"[Startup Cleanup Warning] {e}")


async def get_shop_occupied_length(db, shop: dict) -> float:
    """
    Calculates current occupied length for a shop using MongoDB data.
    Occupied length = MAX(Latest AI camera log occupied length, sum of active booked vehicles)
    """
    shop_id = shop["id"]
    # 1. Get occupied length from active camera detector if running
    detector = active_detectors.get(shop_id)
    camera_occupied = 0.0
    if detector and detector.is_running:
        camera_occupied = detector.latest_stats["occupied_length"]
    else:
        # Fallback to database camera log (if recorded within the last 5 minutes)
        latest_log = await db["camera_logs"].find_one({"shop_id": shop_id}, sort=[("timestamp", -1)])
        if latest_log:
            log_time = latest_log["timestamp"]
            if log_time.tzinfo is None:
                log_time = log_time.replace(tzinfo=IST)
            if (get_ist_now() - log_time) < timedelta(minutes=5):
                camera_occupied = latest_log.get("occupied_length", 0.0)

    # 2. Get sum of active bookings
    active_bookings = await db["bookings"].find({
        "shop_id": shop_id,
        "status": "active"
    }).to_list(1000)
    
    bookings_occupied = sum([b.get("vehicle_length", 0.0) for b in active_bookings])

    # Return max to prevent double-allocating or missing undetected/newly-parked vehicles
    return max(camera_occupied, bookings_occupied)


# --- AUTH ROUTES (MULTI-COLLECTION) ---

@app.post("/api/auth/register", response_model=schemas.UserResponse)
async def register(user_data: schemas.UserCreate, db = Depends(get_async_db)):
    # Check if email exists in any collection ('users', 'owners', 'admins')
    existing_user = await auth.find_user_by_email(db, user_data.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = auth.get_password_hash(user_data.password)
    
    # Target collection based on role: 'customer' -> users, 'owner' -> owners, 'admin' -> admins
    if user_data.role == "owner":
        target_collection = "owners"
    elif user_data.role == "admin":
        target_collection = "admins"
    else:
        target_collection = "users"
        
    user_id = await get_next_sequence_value(target_collection)
    
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "password_hash": hashed_password,
        "name": user_data.name,
        "phone": user_data.phone,
        "role": user_data.role,
        "created_at": get_ist_now()
    }
    await db[target_collection].insert_one(user_doc)
    return clean_doc(user_doc)

@app.post("/api/auth/login", response_model=schemas.Token)
async def login(login_data: schemas.UserLogin, db = Depends(get_async_db)):
    user = await auth.find_user_by_email(db, login_data.email)
    if not user or not auth.verify_password(login_data.password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    access_token = auth.create_access_token(data={"sub": user["email"], "role": user["role"]})
    cleaned_user = clean_doc(user)
    return {"access_token": access_token, "token_type": "bearer", "user": cleaned_user}

@app.get("/api/auth/me", response_model=schemas.UserResponse)
async def get_me(current_user: dict = Depends(auth.get_current_user)):
    return current_user


# --- SHOP PORTAL ROUTES ---

@app.post("/api/shops", response_model=schemas.ShopResponse)
async def create_shop(shop_data: schemas.ShopCreate, current_user: dict = Depends(auth.require_role("owner")), db = Depends(get_async_db)):
    shop_id = await get_next_sequence_value("shops")
    shop_doc = {
        "id": shop_id,
        "owner_id": current_user["id"],
        "name": shop_data.name,
        "address": shop_data.address,
        "latitude": shop_data.latitude,
        "longitude": shop_data.longitude,
        "total_length": shop_data.total_length,
        "price_per_hour": shop_data.price_per_hour,
        "is_enabled": True,
        "created_at": get_ist_now()
    }
    await db["shops"].insert_one(shop_doc)
    return clean_doc(shop_doc)

@app.get("/api/shops", response_model=List[schemas.ShopResponse])
async def list_shops(db = Depends(get_async_db)):
    shops = await db["shops"].find({"is_enabled": True}).to_list(1000)
    return clean_docs(shops)

@app.get("/api/owner/shops", response_model=List[schemas.ShopResponse])
async def list_owner_shops(current_user: dict = Depends(auth.require_role("owner")), db = Depends(get_async_db)):
    shops = await db["shops"].find({"owner_id": current_user["id"]}).to_list(1000)
    return clean_docs(shops)

@app.put("/api/shops/{shop_id}/status", response_model=schemas.ShopResponse)
async def update_shop_status(shop_id: int, status_data: schemas.ShopStatusUpdate, current_user: dict = Depends(auth.require_role("owner")), db = Depends(get_async_db)):
    shop = await db["shops"].find_one({"id": shop_id})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    if shop["owner_id"] != current_user["id"] and current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db["shops"].update_one({"id": shop_id}, {"$set": {"is_enabled": status_data.is_enabled}})
    shop["is_enabled"] = status_data.is_enabled
    return clean_doc(shop)


# --- CUSTOMER PARKING EXPLORE ---

@app.get("/api/shops/nearby")
async def get_nearby_shops(lat: float, lng: float, db = Depends(get_async_db)):
    """Returns all active parking shops, computing their actual live remaining parking space."""
    shops = await db["shops"].find({"is_enabled": True}).to_list(1000)
    results = []
    for s in shops:
        occupied = await get_shop_occupied_length(db, s)
        remaining = max(0.0, s["total_length"] - occupied)
        
        # Determine capacity rating color
        pct = (occupied / s["total_length"]) * 100 if s["total_length"] > 0 else 100
        if pct >= 90:
            status = "Red"   # Full
        elif pct >= 70:
            status = "Yellow" # Nearly Full
        else:
            status = "Green"  # Available

        # Simple distance calculation (Haversine approximation for ordering)
        dist = ((s["latitude"] - lat)**2 + (s["longitude"] - lng)**2)**0.5
        
        results.append({
            "id": s["id"],
            "name": s["name"],
            "address": s["address"],
            "latitude": s["latitude"],
            "longitude": s["longitude"],
            "total_length": s["total_length"],
            "occupied_length": round(occupied, 2),
            "remaining_length": round(remaining, 2),
            "price_per_hour": s["price_per_hour"],
            "status": status,
            "distance": round(dist * 111, 2)  # Approx in KM
        })
    # Sort by nearest
    results.sort(key=lambda x: x["distance"])
    return results


# --- BOOKING LOGIC ---

@app.post("/api/bookings", response_model=schemas.BookingResponse)
async def create_booking(booking_data: schemas.BookingCreate, current_user: dict = Depends(auth.get_current_user), db = Depends(get_async_db)):
    shop = await db["shops"].find_one({"id": booking_data.shop_id})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    if not shop.get("is_enabled", True):
        raise HTTPException(status_code=400, detail="This parking location is currently disabled")

    # Get length corresponding to requested vehicle type
    requested_length = VEHICLE_LENGTHS.get(booking_data.vehicle_type)
    if not requested_length:
        raise HTTPException(status_code=400, detail="Invalid vehicle type selected")

    # CORE BOOKING LOGIC: Verify occupied length + requested length <= total shop length
    occupied = await get_shop_occupied_length(db, shop)
    remaining = shop["total_length"] - occupied
    
    if remaining < requested_length:
        # Suggest nearby parking locations that have enough space
        nearby = await get_nearby_shops(shop["latitude"], shop["longitude"], db)
        suggestions = [n for n in nearby if n["id"] != shop["id"] and n["remaining_length"] >= requested_length][:3]
        
        raise HTTPException(
            status_code=400, 
            detail={
                "message": f"Insufficient space! Needs {requested_length}m, only {round(remaining, 2)}m available.",
                "suggestions": suggestions
            }
        )

    # Simulated checkout creation (payments success mock)
    now_ist = get_ist_now()
    payment_id = f"pay_{now_ist.strftime('%Y%m%d%H%M%S')}_{random.randint(1000, 9999)}"
    price = shop["price_per_hour"] * 2.0
    
    booking_id = await get_next_sequence_value("bookings")
    booking_doc = {
        "id": booking_id,
        "customer_id": current_user["id"],
        "shop_id": shop["id"],
        "vehicle_type": booking_data.vehicle_type,
        "vehicle_length": requested_length,
        "start_time": now_ist,
        "end_time": None,
        "status": "active",
        "total_price": price,
        "payment_status": "paid",  # Auto paid for simulation
        "payment_id": payment_id,
        "created_at": now_ist
    }
    await db["bookings"].insert_one(booking_doc)
    
    # Add revenue to owner wallet transaction
    wallet_id = await get_next_sequence_value("wallet_transactions")
    wallet_doc = {
        "id": wallet_id,
        "owner_id": shop["owner_id"],
        "amount": price,
        "type": "earnings",
        "status": "completed",
        "created_at": now_ist
    }
    await db["wallet_transactions"].insert_one(wallet_doc)
    
    response_doc = clean_doc(booking_doc)
    response_doc["shop"] = clean_doc(shop)
    return response_doc

@app.post("/api/bookings/{booking_id}/cancel", response_model=schemas.BookingResponse)
async def cancel_booking(booking_id: int, current_user: dict = Depends(auth.get_current_user), db = Depends(get_async_db)):
    booking = await db["bookings"].find_one({"id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Verify owner or customer
    if booking["customer_id"] != current_user["id"]:
        shop = await db["shops"].find_one({"id": booking["shop_id"]})
        if not shop or shop["owner_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")

    if booking["status"] != "active":
        raise HTTPException(status_code=400, detail="Only active bookings can be cancelled")

    end_time = get_ist_now()
    await db["bookings"].update_one(
        {"id": booking_id},
        {"$set": {"status": "cancelled", "end_time": end_time}}
    )
    booking["status"] = "cancelled"
    booking["end_time"] = end_time

    # Reverse earnings in wallet if cancelled early
    shop = await db["shops"].find_one({"id": booking["shop_id"]})
    wallet_id = await get_next_sequence_value("wallet_transactions")
    refund_doc = {
        "id": wallet_id,
        "owner_id": shop["owner_id"],
        "amount": -booking["total_price"],
        "type": "withdrawal",
        "status": "completed",
        "created_at": get_ist_now()
    }
    await db["wallet_transactions"].insert_one(refund_doc)
    
    response_doc = clean_doc(booking)
    response_doc["shop"] = clean_doc(shop)
    return response_doc

@app.get("/api/bookings/active", response_model=List[schemas.BookingResponse])
async def get_active_bookings(current_user: dict = Depends(auth.get_current_user), db = Depends(get_async_db)):
    bookings = await db["bookings"].find({
        "customer_id": current_user["id"],
        "status": "active"
    }).to_list(1000)
    
    res = []
    for b in bookings:
        b_clean = clean_doc(b)
        shop = await db["shops"].find_one({"id": b["shop_id"]})
        b_clean["shop"] = clean_doc(shop)
        res.append(b_clean)
    return res

@app.get("/api/bookings/history", response_model=List[schemas.BookingResponse])
async def get_booking_history(current_user: dict = Depends(auth.get_current_user), db = Depends(get_async_db)):
    bookings = await db["bookings"].find({
        "customer_id": current_user["id"]
    }).sort("created_at", -1).to_list(1000)
    
    res = []
    for b in bookings:
        b_clean = clean_doc(b)
        shop = await db["shops"].find_one({"id": b["shop_id"]})
        b_clean["shop"] = clean_doc(shop)
        res.append(b_clean)
    return res


# --- SHOP OWNER PORTAL ANALYTICS & WALLET ---

@app.get("/api/owner/dashboard", response_model=schemas.OwnerDashboardResponse)
async def get_owner_dashboard(current_user: dict = Depends(auth.require_role("owner")), db = Depends(get_async_db)):
    shops = await db["shops"].find({"owner_id": current_user["id"]}).to_list(1000)
    shop_ids = [s["id"] for s in shops]
    
    txs = await db["wallet_transactions"].find({"owner_id": current_user["id"]}).to_list(1000)
    balance = sum([t["amount"] for t in txs if t.get("status") == "completed"])
    
    now_ist = get_ist_now()
    today = now_ist.date()
    start_of_month = now_ist.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    def get_tx_date(t):
        dt = t.get("created_at")
        if dt is None:
            return None
        if isinstance(dt, str):
            dt = datetime.fromisoformat(dt)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=IST)
        else:
            dt = dt.astimezone(IST)
        return dt.date()

    def get_tx_dt(t):
        dt = t.get("created_at")
        if dt is None:
            return None
        if isinstance(dt, str):
            dt = datetime.fromisoformat(dt)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=IST)
        else:
            dt = dt.astimezone(IST)
        return dt

    today_earnings = sum([t["amount"] for t in txs if get_tx_date(t) == today and t.get("type") == "earnings"])
    monthly_earnings = sum([t["amount"] for t in txs if get_tx_dt(t) and get_tx_dt(t) >= start_of_month and t.get("type") == "earnings"])
    
    active_bookings_count = 0
    total_len = 0.0
    occupied_len = 0.0
    
    if shop_ids:
        active_bookings_count = await db["bookings"].count_documents({
            "shop_id": {"$in": shop_ids},
            "status": "active"
        })
        
        for s in shops:
            total_len += s["total_length"]
            occupied_len += await get_shop_occupied_length(db, s)
            
    remaining_len = max(0.0, total_len - occupied_len)
    occupancy = (occupied_len / total_len * 100) if total_len > 0 else 0
    
    analytics = []
    for i in range(7):
        day_obj = now_ist - timedelta(days=6-i)
        day = day_obj.strftime("%a")
        day_date = day_obj.date()
        day_earnings = sum([t["amount"] for t in txs if get_tx_date(t) == day_date and t.get("type") == "earnings"])
        analytics.append({"name": day, "revenue": day_earnings, "occupancy": random.randint(20, 85) if shop_ids else 0})

    recent_txs = await db["wallet_transactions"].find({
        "owner_id": current_user["id"]
    }).sort("created_at", -1).limit(5).to_list(5)

    return {
        "today_earnings": today_earnings,
        "monthly_earnings": monthly_earnings,
        "active_bookings": active_bookings_count,
        "occupancy_percent": round(occupancy, 1),
        "total_length": total_len,
        "occupied_length": round(occupied_len, 2),
        "remaining_length": round(remaining_len, 2),
        "wallet_balance": round(balance, 2),
        "recent_transactions": clean_docs(recent_txs),
        "analytics": analytics
    }

@app.post("/api/owner/wallet/withdraw")
async def withdraw_earnings(withdrawal_data: schemas.WalletWithdraw, current_user: dict = Depends(auth.require_role("owner")), db = Depends(get_async_db)):
    txs = await db["wallet_transactions"].find({"owner_id": current_user["id"]}).to_list(1000)
    balance = sum([t["amount"] for t in txs if t.get("status") == "completed"])
    
    if withdrawal_data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than zero")
    if balance < withdrawal_data.amount:
        raise HTTPException(status_code=400, detail="Insufficient wallet balance")
        
    wallet_id = await get_next_sequence_value("wallet_transactions")
    withdrawal_doc = {
        "id": wallet_id,
        "owner_id": current_user["id"],
        "amount": -withdrawal_data.amount,
        "type": "withdrawal",
        "status": "completed",
        "created_at": get_ist_now()
    }
    await db["wallet_transactions"].insert_one(withdrawal_doc)
    return {"message": "Withdrawal successful", "withdrawn": withdrawal_data.amount, "new_balance": balance - withdrawal_data.amount}


# --- ADMIN PORTAL ROUTES ---

@app.get("/api/admin/dashboard", response_model=schemas.AdminDashboardResponse)
async def get_admin_dashboard(current_user: dict = Depends(auth.require_role("admin")), db = Depends(get_async_db)):
    customers = await db["users"].count_documents({})
    owners = await db["owners"].count_documents({})
    shops = await db["shops"].count_documents({})
    bookings = await db["bookings"].count_documents({})
    
    txs = await db["wallet_transactions"].find({}).to_list(5000)
    total_rev = sum([t["amount"] for t in txs if t.get("type") == "earnings" and t.get("status") == "completed"])
    
    active_b = await db["bookings"].count_documents({"status": "active"})
    recent_logs = await db["camera_logs"].find({}).sort("timestamp", -1).limit(10).to_list(10)
    
    return {
        "total_customers": customers,
        "total_owners": owners,
        "total_shops": shops,
        "total_bookings": bookings,
        "total_revenue": round(total_rev, 2),
        "active_bookings_count": active_b,
        "recent_logs": clean_docs(recent_logs)
    }

@app.get("/api/admin/users")
async def get_all_users(current_user: dict = Depends(auth.require_role("admin")), db = Depends(get_async_db)):
    users = await db["users"].find({}).to_list(1000)
    owners = await db["owners"].find({}).to_list(1000)
    admins = await db["admins"].find({}).to_list(1000)
    all_users = clean_docs(users) + clean_docs(owners) + clean_docs(admins)
    return all_users


# --- PARK0 VEHICLE RECORDS (plate-confirmed vehicles only) ---

@app.get("/api/owner/vehicles/{shop_id}", response_model=List[schemas.VehicleResponse])
async def get_shop_vehicles(
    shop_id: int,
    current_user: dict = Depends(auth.require_role("owner")),
    db = Depends(get_async_db)
):
    """
    Returns all confirmed Park0 vehicle records for a shop for today.

    IMPORTANT: This endpoint ONLY returns vehicles that have a valid,
    confirmed registration number from the ANPR/OCR pipeline.
    Vehicles tracked by ByteTrack that never had a plate confirmed will
    NEVER appear here — they are never written to the vehicles collection.
    """
    # Verify shop belongs to this owner
    shop = await db["shops"].find_one({"id": shop_id})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    if shop["owner_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    today_str = get_ist_date_str()

    # Query: only records with a real registration_number, for this shop, today.
    # The DB constraint (set at insert time in detector.py) guarantees that no
    # placeholder values exist, but we add a server-side filter as a second layer.
    vehicles = await db["vehicles"].find({
        "shop_id": shop_id,
        "date": today_str,
        # Explicit guard: never return records with missing/empty registration
        "registration_number": {"$exists": True, "$ne": "", "$ne": None}
    }).sort("park0_vehicle_id", 1).to_list(1000)

    # Final application-layer filter to strip any legacy edge-case records
    from backend.anpr import is_valid_plate
    valid_vehicles = [v for v in vehicles if is_valid_plate(v.get("registration_number"))]

    return clean_docs(valid_vehicles)


@app.get("/api/owner/vehicles/{shop_id}/stats", response_model=schemas.VehicleStatsResponse)
async def get_shop_vehicle_stats(
    shop_id: int,
    current_user: dict = Depends(auth.require_role("owner")),
    db = Depends(get_async_db)
):
    """
    Returns vehicle counts for the Shopkeeper Dashboard stat cards.

    All counts are derived exclusively from confirmed, plate-identified vehicles.
    Unidentified ByteTrack detections do NOT contribute to any counter here.
    """
    shop = await db["shops"].find_one({"id": shop_id})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    if shop["owner_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    today_str = get_ist_date_str()

    from backend.anpr import is_valid_plate

    all_today = await db["vehicles"].find({
        "shop_id": shop_id,
        "date": today_str,
        "registration_number": {"$exists": True, "$ne": "", "$ne": None}
    }).to_list(1000)

    # Application-layer validation guard
    valid = [v for v in all_today if is_valid_plate(v.get("registration_number"))]

    total_today = len(valid)
    currently_active = sum(1 for v in valid if v.get("status") == "active")
    exited_today = sum(1 for v in valid if v.get("status") == "exited")

    return {
        "total_today": total_today,
        "currently_active": currently_active,
        "exited_today": exited_today
    }


# --- WEBSOCKET LIVE CAMERA STREAM & STATS SYNC ---

@app.websocket("/api/ws/camera/{shop_id}")
async def websocket_camera_endpoint(websocket: WebSocket, shop_id: int):
    print(f"[WebSocket] Incoming connection request for shop {shop_id}")
    await websocket.accept()
    print(f"[WebSocket] Connection accepted for shop {shop_id}")
    
    # 1. Verify shop exists in MongoDB
    shop = await async_db["shops"].find_one({"id": shop_id})
    if not shop:
        print(f"[WebSocket] Shop {shop_id} not found in MongoDB. Closing connection.")
        await websocket.send_text(json.dumps({"error": "Shop not found"}))
        await websocket.close()
        return
    
    total_len = shop["total_length"]
    
    detector = None
    async with detectors_lock:
        if shop_id not in active_detectors:
            # Instantiate camera detector
            print(f"[WebSocket] Creating new AICameraDetector for shop {shop_id}")
            detector = AICameraDetector(shop_id, total_len)
            detector.start()
            active_detectors[shop_id] = detector
        else:
            print(f"[WebSocket] Reusing active AICameraDetector for shop {shop_id}")
            detector = active_detectors[shop_id]
            
    detector.add_client(websocket)
    print(f"[WebSocket] Client added to detector for shop {shop_id}. Total clients: {len(detector.clients)}")
    
    try:
        while detector.is_running:
            # Wait for frame sent by the client
            data = await websocket.receive_text()
            payload = json.loads(data)
            frame_b64 = payload.get("image")
            
            if frame_b64:
                # Process the frame and get updated stats
                stats = detector.process_frame(frame_b64)
                
                # Send the computed stats back
                await websocket.send_text(json.dumps({
                    "stats": stats
                }))
    except WebSocketDisconnect:
        print(f"[WebSocket] Client disconnected from shop {shop_id}")
    except Exception as e:
        import traceback
        print(f"[WebSocket] Error in camera WebSocket loop for shop {shop_id}: {e}")
        traceback.print_exc()
    finally:
        detector.remove_client(websocket)
        print(f"[WebSocket] Client removed from detector for shop {shop_id}. Remaining clients: {len(detector.clients)}")
        # If no clients are listening anymore, stop the camera to save resources
        async with detectors_lock:
            if len(detector.clients) == 0:
                detector.stop()
                if shop_id in active_detectors:
                    del active_detectors[shop_id]
                print(f"[WebSocket] Closed camera feed for shop {shop_id} as no clients are listening.")

if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)

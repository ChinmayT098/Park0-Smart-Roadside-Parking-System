from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime

# --- Auth Schemas ---
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone: Optional[str] = None
    role: str  # customer, owner, admin

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: EmailStr
    name: str
    phone: Optional[str]
    role: str
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None

# --- Shop Schemas ---
class ShopCreate(BaseModel):
    name: str
    address: str
    latitude: float
    longitude: float
    total_length: float
    price_per_hour: float

class ShopResponse(BaseModel):
    id: int
    owner_id: int
    name: str
    address: str
    latitude: float
    longitude: float
    total_length: float
    price_per_hour: float
    is_enabled: bool
    created_at: datetime

    class Config:
        from_attributes = True

class ShopStatusUpdate(BaseModel):
    is_enabled: bool

# --- Booking Schemas ---
class BookingCreate(BaseModel):
    shop_id: int
    vehicle_type: str  # Bike, Scooter, Car, SUV, Auto Rickshaw, Van
    vehicle_length: float
    payment_method: str  # razorpay, upi

class BookingResponse(BaseModel):
    id: int
    customer_id: int
    shop_id: int
    vehicle_type: str
    vehicle_length: float
    start_time: datetime
    end_time: Optional[datetime]
    status: str
    total_price: float
    payment_status: str
    payment_id: Optional[str]
    created_at: datetime
    shop: Optional[ShopResponse] = None

    class Config:
        from_attributes = True

# --- Camera Log Schemas ---
class CameraLogResponse(BaseModel):
    id: int
    shop_id: int
    detected_vehicles: Optional[List[Dict[str, Any]]]
    occupied_length: float
    remaining_length: float
    timestamp: datetime

    class Config:
        from_attributes = True

# --- Wallet & Transaction Schemas ---
class WalletWithdraw(BaseModel):
    amount: float

class WalletTransactionResponse(BaseModel):
    id: int
    owner_id: int
    amount: float
    type: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class OwnerDashboardResponse(BaseModel):
    today_earnings: float
    monthly_earnings: float
    active_bookings: int
    occupancy_percent: float
    total_length: float
    occupied_length: float
    remaining_length: float
    wallet_balance: float
    recent_transactions: List[WalletTransactionResponse]
    analytics: List[Dict[str, Any]]

# --- Admin Schemas ---
class AdminDashboardResponse(BaseModel):
    total_customers: int
    total_owners: int
    total_shops: int
    total_bookings: int
    total_revenue: float
    active_bookings_count: int
    recent_logs: List[CameraLogResponse]

# --- Park0 Vehicle Record Schemas ---
class VehicleResponse(BaseModel):
    """
    Represents a persisted Park0 vehicle record.
    A record is ONLY created when a valid registration number has been
    confirmed through the ANPR/OCR pipeline.
    Fields like registration_number are guaranteed to be a real plate value —
    never null, "Scanning...", or any placeholder string.
    """
    id: int
    park0_vehicle_id: int         # Daily sequential ID (e.g. 1, 2, 3 …)
    shop_id: int
    track_id: Optional[int]       # ByteTrack ID at time of last detection
    registration_number: str      # Always a validated, non-placeholder plate
    vehicle_type: str             # Car | Bike | Bus | Truck
    status: str                   # "active" | "exited"
    first_detected_at: datetime
    last_detected_at: datetime
    date: str                     # YYYY-MM-DD (local shop date)

    class Config:
        from_attributes = True

class VehicleStatsResponse(BaseModel):
    """Dashboard stats derived exclusively from confirmed persisted vehicles."""
    total_today: int        # All valid vehicle records for today
    currently_active: int   # Vehicles with status == "active"
    exited_today: int       # Vehicles with status == "exited"

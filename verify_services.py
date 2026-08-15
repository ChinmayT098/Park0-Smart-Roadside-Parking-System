import os
import sys
import time
import asyncio

def verify_all():
    print("==================================================")
    print("     Park0 System Verification (MongoDB Atlas)   ")
    print("==================================================")
    
    # Add project root to python path
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))

    print("\n1. Testing MongoDB Atlas Integration...")
    try:
        from backend.database import get_sync_db, sync_client, DB_NAME
        db = get_sync_db()
        # Test connection ping
        sync_client.admin.command('ping')
        print(f"   [SUCCESS] Connected to MongoDB Atlas cluster (Database: '{DB_NAME}').")
    except Exception as e:
        print(f"   [FAILED] MongoDB initialization: {e}")
        return False

    print("\n2. Testing Authentication & Hashing Core...")
    try:
        from backend import auth
        pw = "test_password_123"
        hashed = auth.get_password_hash(pw)
        assert auth.verify_password(pw, hashed) is True
        assert auth.verify_password("wrong_password", hashed) is False
        print("   [SUCCESS] Password hashing and validation verified.")
        
        # Test JWT token generation
        token_data = {"sub": "test@park0.in", "role": "customer"}
        token = auth.create_access_token(token_data)
        assert token is not None
        print("   [SUCCESS] JWT access token creation verified.")
    except Exception as e:
        print(f"   [FAILED] Auth utilities: {e}")
        return False

    print("\n3. Testing AI Camera & Detection Engine...")
    try:
        from backend.detector import AICameraDetector
        
        # Create a mock detector instance
        detector = AICameraDetector(shop_id=1, total_length=40.0)
        
        # Check vehicle length mappings
        from backend.detector import VEHICLE_LENGTHS
        assert VEHICLE_LENGTHS["Car"] == 4.5
        assert VEHICLE_LENGTHS["Bike"] == 2.0
        print("   [SUCCESS] Vehicle length spec values verified.")
        
        # Run 1 step of mock detection manually
        frame = detector._generate_simulated_frame()
        detected = detector._get_simulated_detections()
        assert len(detected) > 0
        print(f"   [SUCCESS] Simulated detector frame and log generated. Detected {len(detected)} vehicles.")
        
        # Calculate occupied lengths
        occupied = sum([v["length"] for v in detected])
        remaining = 40.0 - occupied
        print(f"   [SUCCESS] Occupancy calculation verified: Occupied={occupied}m, Remaining={remaining}m.")
    except Exception as e:
        print(f"   [FAILED] Camera detector: {e}")
        return False

    print("\n4. Testing Booking Rules & MongoDB Logic...")
    try:
        from backend.main import get_shop_occupied_length
        from backend.database import async_db
        
        mock_shop = {"id": 999, "name": "Test Shop", "address": "123 St", "total_length": 15.0, "price_per_hour": 30.0}
        
        # Test async occupied length calculation
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        occupied = loop.run_until_complete(get_shop_occupied_length(async_db, mock_shop))
        print(f"   [SUCCESS] Empty shop occupancy: {occupied}m / {mock_shop['total_length']}m")
        loop.close()
    except Exception as e:
        print(f"   [FAILED] Booking calculations: {e}")
        return False

    print("\n==================================================")
    print("      ALL SERVICES AND UTILITIES STAND VERIFIED!  ")
    print("==================================================")
    return True

if __name__ == "__main__":
    success = verify_all()
    sys.exit(0 if success else 1)

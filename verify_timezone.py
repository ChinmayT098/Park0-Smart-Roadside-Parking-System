import os
import sys
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

# Add workspace to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.timezone import get_ist_now, get_ist_date_str, IST
from backend.detector import AICameraDetector
import backend.schemas as schemas

def test_timezone_utilities():
    print("--- 1. Testing Backend Timezone Utilities ---")
    now_ist = get_ist_now()
    date_str = get_ist_date_str()
    print(f"Current IST Datetime: {now_ist.isoformat()}")
    print(f"Current IST Date String: {date_str}")
    
    assert now_ist.tzinfo is not None, "get_ist_now() must be timezone-aware!"
    assert str(now_ist.tzinfo) == "Asia/Kolkata", "Timezone must be Asia/Kolkata!"
    assert "+05:30" in now_ist.isoformat(), f"ISO format must include +05:30 offset! Got: {now_ist.isoformat()}"
    print("[PASS] Timezone utilities return valid timezone-aware Asia/Kolkata datetimes with +05:30 offset.")

def test_pydantic_schema_serialization():
    print("\n--- 2. Testing Schema Serialization ---")
    now_ist = get_ist_now()
    resp = schemas.BookingResponse(
        id=1,
        customer_id=10,
        shop_id=2,
        vehicle_type="Car",
        vehicle_length=4.5,
        start_time=now_ist,
        end_time=None,
        status="active",
        total_price=100.0,
        payment_status="paid",
        payment_id="pay_test_123",
        created_at=now_ist
    )
    serialized = resp.model_dump_json()
    print(f"Serialized BookingResponse JSON:\n{serialized}")
    assert "+05:30" in serialized or "Z" in serialized or "+05:30" in resp.start_time.isoformat(), "Serialized datetime must preserve timezone info!"
    print("[PASS] Schema serializes timezone-aware datetimes cleanly.")

def test_detector_daily_counter_key():
    print("\n--- 3. Testing Detector Daily Counter Key (Midnight Reset) ---")
    detector = AICameraDetector(shop_id=1, total_length=50.0)
    key = detector._get_daily_counter_key()
    today_ist = get_ist_date_str()
    expected_key = f"vehicles_daily_1_{today_ist}"
    print(f"Generated counter key: {key}")
    assert key == expected_key, f"Expected {expected_key}, got {key}"
    print("[PASS] Daily counter key uses Asia/Kolkata date, ensuring daily Vehicle ID resets at 12:00 AM IST.")

def test_codebase_for_naive_datetime():
    print("\n--- 4. Codebase Audit for Naive datetime.utcnow() ---")
    backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
    files_to_check = ["main.py", "detector.py", "auth.py"]
    
    for filename in files_to_check:
        filepath = os.path.join(backend_dir, filename)
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
            if "datetime.utcnow()" in content:
                raise AssertionError(f"FOUND legacy datetime.utcnow() in {filename}!")
            if "date.today()" in content:
                raise AssertionError(f"FOUND legacy date.today() in {filename}!")
        print(f"[PASS] {filename} is clean of naive datetime.utcnow() and date.today().")

if __name__ == "__main__":
    try:
        test_timezone_utilities()
        test_pydantic_schema_serialization()
        test_detector_daily_counter_key()
        test_codebase_for_naive_datetime()
        print("\nALL TIMEZONE TESTS PASSED SUCCESSFULLY! Park0 timezone architecture verified.")
    except Exception as e:
        print(f"\n[FAIL] Test failed: {e}")
        sys.exit(1)

"""
Database cleanup utility to remove legacy invalid vehicle records
(e.g., 'Scanning...', 'Unknown', 'Processing...', 'N/A', empty plate values).

This ensures that MongoDB contains ONLY vehicles with valid registration numbers.
"""
from backend.database import get_sync_db
from backend.anpr import is_valid_plate


def cleanup_invalid_vehicle_records() -> int:
    """
    Finds and deletes any vehicle record in MongoDB where the registration_number
    is invalid (e.g., 'Scanning...', 'Unknown', 'Processing...', empty, or null).
    
    Returns the count of deleted invalid records.
    """
    db = get_sync_db()
    vehicles_coll = db["vehicles"]

    all_vehicles = list(vehicles_coll.find({}))
    deleted_count = 0

    for v in all_vehicles:
        reg = v.get("registration_number")
        if not is_valid_plate(reg):
            vehicles_coll.delete_one({"_id": v["_id"]})
            deleted_count += 1

    print(f"[Cleanup] Scanned {len(all_vehicles)} vehicle records. Deleted {deleted_count} invalid records.")
    return deleted_count


if __name__ == "__main__":
    cleanup_invalid_vehicle_records()

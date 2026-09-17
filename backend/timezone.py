from datetime import datetime, timezone, timedelta
from typing import Any, Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

# Single Source of Truth timezone for Park0 user-facing operations (Asia/Kolkata / IST / UTC+05:30)
try:
    IST = ZoneInfo("Asia/Kolkata")
    # Quick sanity check on current system
    datetime.now(IST)
except (ZoneInfoNotFoundError, Exception):
    # Fallback for Windows environments without tzdata package
    IST = timezone(timedelta(hours=5, minutes=30), name="Asia/Kolkata")

def get_ist_now() -> datetime:
    """Returns current timezone-aware datetime in Asia/Kolkata timezone."""
    return datetime.now(IST)

def get_ist_date_str() -> str:
    """Returns today's date string (YYYY-MM-DD) in Asia/Kolkata timezone."""
    return datetime.now(IST).strftime("%Y-%m-%d")

def to_ist(val: Any) -> Optional[datetime]:
    """
    Converts a datetime object or ISO datetime string into a timezone-aware Asia/Kolkata datetime object.
    
    Handles:
    1. PyMongo naive datetimes (which represent UTC) by attaching timezone.utc first before astimezone(IST).
    2. Timezone-aware datetimes by converting to IST via astimezone(IST).
    3. ISO-8601 string representations.
    """
    if val is None:
        return None
    
    dt: Optional[datetime] = None
    if isinstance(val, str):
        try:
            dt = datetime.fromisoformat(val)
        except Exception:
            return None
    elif isinstance(val, datetime):
        dt = val
    else:
        return None
    
    if dt.tzinfo is None:
        # PyMongo naive datetime represents UTC
        dt = dt.replace(tzinfo=timezone.utc)
        
    return dt.astimezone(IST)


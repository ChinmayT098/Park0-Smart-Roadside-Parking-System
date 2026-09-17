from datetime import datetime, timezone, timedelta
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

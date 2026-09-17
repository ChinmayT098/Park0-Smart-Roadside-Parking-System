from datetime import datetime
from typing import Dict, Any, Optional, List
from backend.timezone import to_ist

def ensure_ist_datetimes(val: Any) -> Any:
    """
    Recursively converts datetime objects (or dicts/lists containing them)
    into timezone-aware IST datetimes using backend.timezone.to_ist.
    """
    if isinstance(val, datetime):
        return to_ist(val)
    elif isinstance(val, dict):
        return {k: ensure_ist_datetimes(v) for k, v in val.items()}
    elif isinstance(val, list):
        return [ensure_ist_datetimes(v) for v in val]
    return val

def clean_doc(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Helper function to format MongoDB document for FastAPI Pydantic responses."""
    if not doc:
        return None
    # Remove raw MongoDB ObjectId if present, as Pydantic uses numeric 'id'
    doc_copy = dict(doc)
    if "_id" in doc_copy:
        del doc_copy["_id"]
    return ensure_ist_datetimes(doc_copy)

def clean_docs(docs: list) -> list:
    """Helper function to format a list of MongoDB documents."""
    return [clean_doc(d) for d in docs if d is not None]


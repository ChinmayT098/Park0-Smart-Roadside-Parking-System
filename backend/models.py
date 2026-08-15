from datetime import datetime
from typing import Dict, Any, Optional

def clean_doc(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Helper function to format MongoDB document for FastAPI Pydantic responses."""
    if not doc:
        return None
    # Remove raw MongoDB ObjectId if present, as Pydantic uses numeric 'id'
    doc_copy = dict(doc)
    if "_id" in doc_copy:
        del doc_copy["_id"]
    return doc_copy

def clean_docs(docs: list) -> list:
    """Helper function to format a list of MongoDB documents."""
    return [clean_doc(d) for d in docs if d is not None]

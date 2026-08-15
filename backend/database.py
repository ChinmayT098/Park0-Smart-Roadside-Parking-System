import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import pymongo
from pymongo import ReturnDocument

# Load environment variables from .env
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "park0_db")

# Async MongoDB Motor Client for FastAPI endpoints
async_client = AsyncIOMotorClient(MONGODB_URL)
async_db = async_client[DB_NAME]

# Sync PyMongo Client for synchronous utilities & scripts
sync_client = pymongo.MongoClient(MONGODB_URL)
sync_db = sync_client[DB_NAME]

def get_async_db():
    """Dependency provider returning the async MongoDB database instance."""
    return async_db

def get_sync_db():
    """Helper returning the sync MongoDB database instance."""
    return sync_db

async def get_next_sequence_value(sequence_name: str) -> int:
    """Generates an auto-incrementing integer ID for MongoDB collections asynchronously."""
    counter = await async_db["counters"].find_one_and_update(
        {"_id": sequence_name},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER
    )
    return counter["seq"]

def get_next_sequence_value_sync(sequence_name: str) -> int:
    """Generates an auto-incrementing integer ID for MongoDB collections synchronously."""
    counter = sync_db["counters"].find_one_and_update(
        {"_id": sequence_name},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER
    )
    return counter["seq"]

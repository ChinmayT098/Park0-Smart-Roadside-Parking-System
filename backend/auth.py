import os
from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from backend.database import get_async_db, get_sync_db
from backend.models import clean_doc
from backend.schemas import TokenData

# Configuration
SECRET_KEY = os.getenv("JWT_SECRET", "super-secret-park0-key-change-in-prod")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days for development ease

# Password hashing configuration
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies that a plain password matches its hashed form."""
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        import hashlib
        h = hashlib.sha256(plain_password.encode()).hexdigest()
        return h == hashed_password

def get_password_hash(password: str) -> str:
    """Generates a secure hash for a password."""
    try:
        return pwd_context.hash(password)
    except Exception:
        import hashlib
        return hashlib.sha256(password.encode()).hexdigest()

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Creates a JWT access token containing the user details."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def find_user_by_email(db, email: str) -> Optional[dict]:
    """Helper to search for a user across 'users', 'owners', and 'admins' collections."""
    user = await db["users"].find_one({"email": email})
    if user:
        return user
    user = await db["owners"].find_one({"email": email})
    if user:
        return user
    user = await db["admins"].find_one({"email": email})
    return user

async def get_current_user(token: str = Depends(oauth2_scheme), db = Depends(get_async_db)) -> dict:
    """Dependency that decodes token and retrieves user from 'users', 'owners', or 'admins' collections."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = TokenData(email=email, role=payload.get("role"))
    except JWTError:
        raise credentials_exception
    
    user = await find_user_by_email(db, token_data.email)
    if user is None:
        raise credentials_exception
    return clean_doc(user)

def require_role(role: str):
    """Dependency generator to restrict access to specific roles ('customer', 'owner', 'admin')."""
    async def dependency(user: dict = Depends(get_current_user)):
        user_role = user.get("role")
        if user_role != role and user_role != "admin":  # Admins bypass role checks
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this resource",
            )
        return user
    return dependency

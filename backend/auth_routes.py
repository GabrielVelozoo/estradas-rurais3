from fastapi import APIRouter, HTTPException, Depends, Response, Cookie, Request, status
from fastapi.responses import JSONResponse
from typing import List
from datetime import datetime, timezone, timedelta

from auth_models import (
    LoginRequest, LoginResponse, UserCreate, UserResponse, 
    User, UserInDB, UserUpdate
)
from auth_utils import (
    hash_password, verify_password, create_access_token, 
    prepare_user_for_mongo, parse_user_from_mongo
)
from auth_middleware import get_current_user, get_current_admin_user

router = APIRouter()

# Database dependency - remove type annotation to avoid FastAPI validation
async def get_db(request: Request):
    return request.app.state.db

@router.post("/auth/login", response_model=LoginResponse)
async def login(
    login_data: LoginRequest, 
    response: Response,
    db = Depends(get_db)
):
    """Login endpoint - authenticates user and sets secure cookie"""
    
    # Find user by username
    user_data = await db.users.find_one({"username": login_data.username})
    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    # Parse user data
    user_data = parse_user_from_mongo(user_data)
    user_in_db = UserInDB(**user_data)
    
    # Verify password
    if not verify_password(login_data.password, user_in_db.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    # Check if user is active
    if not user_in_db.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    # Create access token
    access_token = create_access_token(
        data={"sub": user_in_db.id, "username": user_in_db.username}
    )
    
    # Set secure cookie (7 days expiration)
    # Detectar ambiente: produção precisa de Secure=True e SameSite=None
    import os
    is_production = "emergent.host" in os.environ.get("CORS_ORIGINS", "")
    
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=is_production,  # True em produção, False em dev/preview
        samesite="none" if is_production else "lax",  # none para produção, lax para dev
        max_age=7 * 24 * 60 * 60  # 7 days in seconds
    )
    
    # Return user data (without password hash)
    user_response = UserResponse(**user_in_db.dict())
    return LoginResponse(message="Login successful", user=user_response)

@router.post("/auth/logout")
async def logout(response: Response):
    """Logout endpoint - clears authentication cookie"""
    response.delete_cookie("access_token")
    return {"message": "Logout successful"}

@router.get("/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current authenticated user information"""
    return UserResponse(**current_user.dict())

@router.post("/admin/users", response_model=UserResponse)
async def create_user(
    user_data: UserCreate,
    current_admin: User = Depends(get_current_admin_user),
    db = Depends(get_db)
):
    """Create a new user (admin only)"""
    
    # Check if user already exists
    existing_user = await db.users.find_one({"username": user_data.username})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this username already exists"
        )
    
    # Hash password
    password_hash = hash_password(user_data.password)
    
    # Create user object
    user_dict = user_data.dict(exclude={"password"})
    user_obj = UserInDB(**user_dict, password_hash=password_hash)
    
    # Prepare for MongoDB
    user_mongo_data = prepare_user_for_mongo(user_obj.dict())
    
    # Insert into database
    result = await db.users.insert_one(user_mongo_data)
    if not result.inserted_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user"
        )
    
    # Return user data (without password hash)
    return UserResponse(**user_obj.dict())

@router.get("/admin/users", response_model=List[UserResponse])
async def list_users(
    current_admin: User = Depends(get_current_admin_user),
    db = Depends(get_db)
):
    """List all users (admin only)"""
    
    users_data = await db.users.find().to_list(length=None)
    users = []
    
    for user_data in users_data:
        user_data = parse_user_from_mongo(user_data)
        user = UserResponse(**user_data)
        users.append(user)
    
    return users

@router.put("/admin/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    update_data: UserUpdate,
    current_admin: User = Depends(get_current_admin_user),
    db = Depends(get_db)
):
    """Update a user (admin only)"""
    
    # Find user
    user_data = await db.users.find_one({"id": user_id})
    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Prepare update data
    update_dict = update_data.dict(exclude_unset=True)
    
    # Hash new password if provided
    if "password" in update_dict:
        update_dict["password_hash"] = hash_password(update_dict.pop("password"))
    
    # Add updated timestamp
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Update user
    await db.users.update_one(
        {"id": user_id},
        {"$set": update_dict}
    )
    
    # Get updated user
    updated_user_data = await db.users.find_one({"id": user_id})
    updated_user_data = parse_user_from_mongo(updated_user_data)
    
    return UserResponse(**updated_user_data)

@router.delete("/admin/users/{user_id}")
async def delete_user(
    user_id: str,
    current_admin: User = Depends(get_current_admin_user),
    db = Depends(get_db)
):
    """Delete a user (admin only)"""
    
    # Prevent admin from deleting themselves
    if user_id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )
    
    # Delete user
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return {"message": "User deleted successfully"}
# backend/municipio_info_routes.py
from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Dict, Optional
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import logging
import os

from municipio_info_models import (
    MunicipioInfo,
    MunicipioInfoCreate,
    MunicipioInfoUpdate,
    MunicipioLideranca,
    MunicipioLiderancaCreate,
    MunicipioLiderancaUpdate
)
from auth_middleware import get_current_user, get_current_admin_user
from auth_models import User
from pedidos_csv_service import get_pedidos_service

logger = logging.getLogger(__name__)
router = APIRouter()

# MongoDB connection
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(MONGO_URL)
db = client.get_database("estradas_rurais")
municipio_info_collection = db.get_collection("municipio_info")
municipio_liderancas_collection = db.get_collection("municipio_liderancas")

# ============================================================================
# MunicipioInfo Routes (Manual Data - Admin Only for Write)
# ============================================================================

@router.get("/municipio-info/{municipio_id}", response_model=Optional[MunicipioInfo])
async def get_municipio_info(
    municipio_id: int,
    current_user: User = Depends(get_current_user)
):
    """Get manual information for a municipality (all users can read)."""
    info = await municipio_info_collection.find_one({"municipio_id": municipio_id})
    
    if not info:
        # Return None if not found (frontend will handle empty state)
        return None
    
    return MunicipioInfo(**info)


@router.post("/municipio-info", response_model=MunicipioInfo, status_code=status.HTTP_201_CREATED)
async def create_municipio_info(
    info_data: MunicipioInfoCreate,
    current_user: User = Depends(get_current_admin_user)
):
    """Create manual information for a municipality (Admin only)."""
    # Check if info already exists for this municipality
    existing = await municipio_info_collection.find_one({"municipio_id": info_data.municipio_id})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Informações já existem para o município ID {info_data.municipio_id}"
        )
    
    # Create new info
    new_info = MunicipioInfo(**info_data.dict())
    info_dict = new_info.dict()
    
    # Convert datetime to ISO string for MongoDB
    info_dict["created_at"] = info_dict["created_at"].isoformat()
    info_dict["updated_at"] = info_dict["updated_at"].isoformat()
    
    await municipio_info_collection.insert_one(info_dict)
    logger.info(f"Admin {current_user.username} created info for municipality {info_data.municipio_id}")
    
    return new_info


@router.put("/municipio-info/{municipio_id}", response_model=MunicipioInfo)
async def update_municipio_info(
    municipio_id: int,
    update_data: MunicipioInfoUpdate,
    current_user: User = Depends(get_current_admin_user)
):
    """Update manual information for a municipality (Admin only)."""
    existing = await municipio_info_collection.find_one({"municipio_id": municipio_id})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Informações não encontradas para o município ID {municipio_id}"
        )
    
    # Prepare update data (only non-None fields)
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await municipio_info_collection.update_one(
        {"municipio_id": municipio_id},
        {"$set": update_dict}
    )
    
    # Fetch and return updated document
    updated = await municipio_info_collection.find_one({"municipio_id": municipio_id})
    logger.info(f"Admin {current_user.username} updated info for municipality {municipio_id}")
    
    return MunicipioInfo(**updated)


# ============================================================================
# MunicipioLiderancas Routes (Admin Only for Write)
# ============================================================================

@router.get("/municipio-liderancas/{municipio_id}", response_model=List[MunicipioLideranca])
async def get_municipio_liderancas(
    municipio_id: int,
    current_user: User = Depends(get_current_user)
):
    """Get all lideranças for a municipality (all users can read)."""
    cursor = municipio_liderancas_collection.find({"municipio_id": municipio_id})
    liderancas = await cursor.to_list(length=None)
    
    return [MunicipioLideranca(**lideranca) for lideranca in liderancas]


@router.post("/municipio-liderancas", response_model=MunicipioLideranca, status_code=status.HTTP_201_CREATED)
async def create_municipio_lideranca(
    lideranca_data: MunicipioLiderancaCreate,
    current_user: User = Depends(get_current_admin_user)
):
    """Create a new liderança for a municipality (Admin only)."""
    new_lideranca = MunicipioLideranca(**lideranca_data.dict())
    lideranca_dict = new_lideranca.dict()
    
    # Convert datetime to ISO string for MongoDB
    lideranca_dict["created_at"] = lideranca_dict["created_at"].isoformat()
    lideranca_dict["updated_at"] = lideranca_dict["updated_at"].isoformat()
    
    await municipio_liderancas_collection.insert_one(lideranca_dict)
    logger.info(f"Admin {current_user.username} created liderança for municipality {lideranca_data.municipio_id}")
    
    return new_lideranca


@router.put("/municipio-liderancas/{lideranca_id}", response_model=MunicipioLideranca)
async def update_municipio_lideranca(
    lideranca_id: str,
    update_data: MunicipioLiderancaUpdate,
    current_user: User = Depends(get_current_admin_user)
):
    """Update a liderança (Admin only)."""
    existing = await municipio_liderancas_collection.find_one({"id": lideranca_id})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Liderança não encontrada: {lideranca_id}"
        )
    
    # Prepare update data
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await municipio_liderancas_collection.update_one(
        {"id": lideranca_id},
        {"$set": update_dict}
    )
    
    updated = await municipio_liderancas_collection.find_one({"id": lideranca_id})
    logger.info(f"Admin {current_user.username} updated liderança {lideranca_id}")
    
    return MunicipioLideranca(**updated)


@router.delete("/municipio-liderancas/{lideranca_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_municipio_lideranca(
    lideranca_id: str,
    current_user: User = Depends(get_current_admin_user)
):
    """Delete a liderança (Admin only)."""
    result = await municipio_liderancas_collection.delete_one({"id": lideranca_id})
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Liderança não encontrada: {lideranca_id}"
        )
    
    logger.info(f"Admin {current_user.username} deleted liderança {lideranca_id}")
    return None


# ============================================================================
# Pedidos Routes (CSV Data - Read Only, with Admin Refresh)
# ============================================================================

@router.get("/pedidos", response_model=List[Dict])
async def get_pedidos(
    municipio: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """
    Get pedidos from Google Sheets CSV.
    
    - If municipio is provided, filter by municipality (case/accent-insensitive)
    - Returns cached data (15 min TTL) unless force refresh is used
    """
    service = get_pedidos_service()
    
    if municipio:
        pedidos = await service.get_pedidos_by_municipio(municipio)
    else:
        pedidos = await service.get_all_pedidos()
    
    return pedidos


@router.post("/pedidos/refresh", response_model=Dict)
async def refresh_pedidos(
    current_user: User = Depends(get_current_admin_user)
):
    """
    Force refresh of pedidos data from Google Sheets (Admin only).
    Bypasses cache and fetches fresh data.
    """
    service = get_pedidos_service()
    pedidos = await service.get_all_pedidos(force_refresh=True)
    cache_info = service.get_cache_info()
    
    logger.info(f"Admin {current_user.username} forced refresh of pedidos data")
    
    return {
        "message": "Dados atualizados com sucesso",
        "total_rows": len(pedidos),
        "cache_info": cache_info
    }


@router.get("/pedidos/cache-info", response_model=Dict)
async def get_cache_info(
    current_user: User = Depends(get_current_user)
):
    """Get cache status information."""
    service = get_pedidos_service()
    return service.get_cache_info()

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
    MunicipioLiderancaUpdate,
)
from auth_middleware import get_current_user, get_current_admin_user
from auth_models import User
from pedidos_csv_service import get_pedidos_service

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/test-municipio")
async def test_municipio():
    """Test route to verify router is working"""
    return {"message": "Municipio info router is working"}

# ===== MongoDB =====
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "test_database")

client = AsyncIOMotorClient(MONGO_URL)
db = client.get_database(DB_NAME)
municipio_info_collection = db.get_collection("municipio_info")
municipio_liderancas_collection = db.get_collection("municipio_liderancas")

# Garante índice único por municipio_id (idempotente)
async def _ensure_indexes():
    try:
        await municipio_info_collection.create_index("municipio_id", unique=True)
    except Exception:
        # se o índice já existe, ignoramos
        pass

# =====================================================================
# MunicipioInfo (dados manuais) - leitura para todos, escrita só admin
# =====================================================================

@router.get("/municipio-info/{municipio_id}")
async def get_municipio_info(municipio_id: int):
    """
    Retorna as informações manuais de um município.
    Se não existir, retorna None para o frontend lidar com estado vazio.
    """
    try:
        doc = await municipio_info_collection.find_one({"municipio_id": municipio_id})
        if not doc:
            return None
        # Pydantic converte ISO -> datetime automaticamente
        return MunicipioInfo(**doc)
    except Exception as e:
        logger.exception("Error fetching municipio info")
        return {"error": str(e), "municipio_id": municipio_id}

@router.post(
    "/municipio-info/upsert",
    response_model=MunicipioInfo,
    status_code=status.HTTP_200_OK,
)
async def upsert_municipio_info(
    info_data: MunicipioInfoCreate,
    current_user: User = Depends(get_current_admin_user),
):
    """
    Upsert por municipio_id:
      - cria se não existir
      - atualiza se existir (todos os campos enviados)
    """
    await _ensure_indexes()

    try:
        existing = await municipio_info_collection.find_one(
            {"municipio_id": info_data.municipio_id}
        )
        now_iso = datetime.now(timezone.utc).isoformat()

        if existing:
            update_dict = info_data.dict()
            update_dict["updated_at"] = now_iso

            await municipio_info_collection.update_one(
                {"municipio_id": info_data.municipio_id},
                {"$set": update_dict},
            )
            updated = await municipio_info_collection.find_one(
                {"municipio_id": info_data.municipio_id}
            )
            logger.info(
                "Admin %s upsert:update municipio %s",
                current_user.username,
                info_data.municipio_id,
            )
            return MunicipioInfo(**updated)

        # criar novo registro
        new_info = MunicipioInfo(**info_data.dict())
        doc = new_info.dict()
        # datas como string ISO no Mongo
        doc["created_at"] = doc["created_at"].isoformat()
        doc["updated_at"] = doc["updated_at"].isoformat()

        await municipio_info_collection.insert_one(doc)
        logger.info(
            "Admin %s upsert:create municipio %s",
            current_user.username,
            info_data.municipio_id,
        )
        return new_info
    except Exception as e:
        logger.exception("Error in upsert municipio info")
        raise HTTPException(status_code=500, detail=str(e))

@router.post(
    "/municipio-info",
    response_model=MunicipioInfo,
    status_code=status.HTTP_201_CREATED,
)
async def create_municipio_info(
    info_data: MunicipioInfoCreate,
    current_user: User = Depends(get_current_admin_user),
):
    """
    Cria manualmente (mantido para compatibilidade).
    Se já existir registro para o municipio_id, retorna 400.
    """
    await _ensure_indexes()

    existing = await municipio_info_collection.find_one(
        {"municipio_id": info_data.municipio_id}
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Informações já existem para o município ID {info_data.municipio_id}",
        )

    new_info = MunicipioInfo(**info_data.dict())
    info_dict = new_info.dict()
    info_dict["created_at"] = info_dict["created_at"].isoformat()
    info_dict["updated_at"] = info_dict["updated_at"].isoformat()

    await municipio_info_collection.insert_one(info_dict)
    logger.info(
        "Admin %s created info for municipality %s",
        current_user.username,
        info_data.municipio_id,
    )
    return new_info

@router.put("/municipio-info/{municipio_id}", response_model=MunicipioInfo)
async def update_municipio_info(
    municipio_id: int,
    update_data: MunicipioInfoUpdate,
    current_user: User = Depends(get_current_admin_user),
):
    """
    Atualiza os campos informados. Se não existir, cria (comportamento upsert).
    """
    await _ensure_indexes()

    existing = await municipio_info_collection.find_one({"municipio_id": municipio_id})
    now_iso = datetime.now(timezone.utc).isoformat()

    if not existing:
        base = MunicipioInfoCreate(
            municipio_id=municipio_id, **update_data.dict()
        )
        new_info = MunicipioInfo(**base.dict())
        doc = new_info.dict()
        doc["created_at"] = doc["created_at"].isoformat()
        doc["updated_at"] = doc["updated_at"].isoformat()
        await municipio_info_collection.insert_one(doc)
        logger.info(
            "Admin %s upsert(create) via PUT municipio %s",
            current_user.username,
            municipio_id,
        )
        return new_info

    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    update_dict["updated_at"] = now_iso

    await municipio_info_collection.update_one(
        {"municipio_id": municipio_id}, {"$set": update_dict}
    )
    updated = await municipio_info_collection.find_one({"municipio_id": municipio_id})
    logger.info(
        "Admin %s updated info for municipality %s",
        current_user.username,
        municipio_id,
    )
    return MunicipioInfo(**updated)

# =====================================================================
# MunicipioLiderancas (Admin para escrever; todos para ler)
# =====================================================================

@router.get(
    "/municipio-liderancas/{municipio_id}",
    response_model=List[MunicipioLideranca],
)
async def get_municipio_liderancas(
    municipio_id: int, current_user: User = Depends(get_current_user)
):
    cursor = municipio_liderancas_collection.find({"municipio_id": municipio_id})
    liderancas = await cursor.to_list(length=None)
    return [MunicipioLideranca(**doc) for doc in liderancas]

@router.post(
    "/municipio-liderancas",
    response_model=MunicipioLideranca,
    status_code=status.HTTP_201_CREATED,
)
async def create_municipio_lideranca(
    lideranca_data: MunicipioLiderancaCreate,
    current_user: User = Depends(get_current_admin_user),
):
    new_lideranca = MunicipioLideranca(**lideranca_data.dict())
    doc = new_lideranca.dict()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["updated_at"] = doc["updated_at"].isoformat()

    await municipio_liderancas_collection.insert_one(doc)
    logger.info(
        "Admin %s created liderança for municipality %s",
        current_user.username,
        lideranca_data.municipio_id,
    )
    return new_lideranca

@router.put("/municipio-liderancas/{lideranca_id}", response_model=MunicipioLideranca)
async def update_municipio_lideranca(
    lideranca_id: str,
    update_data: MunicipioLiderancaUpdate,
    current_user: User = Depends(get_current_admin_user),
):
    existing = await municipio_liderancas_collection.find_one({"id": lideranca_id})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Liderança não encontrada: {lideranca_id}",
        )

    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()

    await municipio_liderancas_collection.update_one(
        {"id": lideranca_id}, {"$set": update_dict}
    )
    updated = await municipio_liderancas_collection.find_one({"id": lideranca_id})
    logger.info("Admin %s updated liderança %s", current_user.username, lideranca_id)
    return MunicipioLideranca(**updated)

@router.delete("/municipio-liderancas/{lideranca_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_municipio_lideranca(
    lideranca_id: str, current_user: User = Depends(get_current_admin_user)
):
    result = await municipio_liderancas_collection.delete_one({"id": lideranca_id})
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Liderança não encontrada: {lideranca_id}",
        )
    logger.info("Admin %s deleted liderança %s", current_user.username, lideranca_id)
    return None

# =====================================================================
# Pedidos (CSV) — leitura livre; refresh apenas admin
# =====================================================================

@router.get("/pedidos", response_model=List[Dict])
async def get_pedidos(
    municipio: Optional[str] = None, current_user: User = Depends(get_current_user)
):
    service = get_pedidos_service()
    if municipio:
        pedidos = await service.get_pedidos_by_municipio(municipio)
    else:
        pedidos = await service.get_all_pedidos()
    return pedidos

@router.post("/pedidos/refresh", response_model=Dict)
async def refresh_pedidos(current_user: User = Depends(get_current_admin_user)):
    service = get_pedidos_service()
    pedidos = await service.get_all_pedidos(force_refresh=True)
    cache_info = service.get_cache_info()
    logger.info("Admin %s forced refresh of pedidos data", current_user.username)
    return {
        "message": "Dados atualizados com sucesso",
        "total_rows": len(pedidos),
        "cache_info": cache_info,
    }

@router.get("/pedidos/cache-info", response_model=Dict)
async def get_cache_info(current_user: User = Depends(get_current_user)):
    service = get_pedidos_service()
    return service.get_cache_info()

from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
import uuid
from datetime import datetime, timezone

from auth_middleware import get_current_user
from auth_routes import get_db
from auth_models import UserResponse
from liderancas_v2_models import (
    PedidoLiderancaV2Create,
    PedidoLiderancaV2Update,
    PedidoLiderancaV2Response
)

router = APIRouter()


def _normalize_lideranca_v2(doc):
    """
    Normalizar documento do MongoDB para garantir que todos os campos existam
    """
    if not doc:
        return doc
    
    doc["id"] = str(doc.get("id", ""))
    doc["municipio_id"] = str(doc.get("municipio_id", ""))
    doc["municipio_nome"] = str(doc.get("municipio_nome", ""))
    doc["lideranca_nome"] = str(doc.get("lideranca_nome", ""))
    doc["titulo"] = str(doc.get("titulo", "") or "")
    doc["protocolo"] = str(doc.get("protocolo", "") or "")
    doc["lideranca_telefone"] = str(doc.get("lideranca_telefone", "") or "")
    doc["descricao"] = str(doc.get("descricao", "") or "")
    doc["status"] = doc.get("status") or None
    
    # Normalizar datas
    created_at = doc.get("created_at")
    if hasattr(created_at, "isoformat"):
        doc["created_at"] = created_at.isoformat()
    elif isinstance(created_at, str):
        doc["created_at"] = created_at
    else:
        doc["created_at"] = datetime.now(timezone.utc).isoformat()
    
    updated_at = doc.get("updated_at")
    if hasattr(updated_at, "isoformat"):
        doc["updated_at"] = updated_at.isoformat()
    elif isinstance(updated_at, str):
        doc["updated_at"] = updated_at
    else:
        doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    return doc


# -----------------------------
# CREATE
# -----------------------------
@router.post(
    "/liderancas",
    response_model=PedidoLiderancaV2Response,
    status_code=status.HTTP_201_CREATED,
)
async def create_pedido(
    pedido_data: PedidoLiderancaV2Create,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Criar um novo pedido de liderança V2.
    Dados compartilhados (sem filtro por user_id).
    """
    try:
        now = datetime.now(timezone.utc).isoformat()
        document = {
            "id": str(uuid.uuid4()),
            "municipio_id": pedido_data.municipio_id,
            "municipio_nome": pedido_data.municipio_nome,
            "lideranca_nome": pedido_data.lideranca_nome,
            "titulo": pedido_data.titulo or "",
            "protocolo": pedido_data.protocolo or "",
            "lideranca_telefone": pedido_data.lideranca_telefone or "",
            "descricao": pedido_data.descricao or "",
            "status": pedido_data.status,
            "created_at": now,
            "updated_at": now,
        }

        await db.pedidos_liderancas_v2.insert_one(document)
        return PedidoLiderancaV2Response(**document)

    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": str(ve)},
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": f"Falha ao salvar o pedido: {str(e)}"},
        )


# -----------------------------
# LIST (TODOS - sem filtro por user_id)
# -----------------------------
@router.get(
    "/liderancas",
    response_model=List[PedidoLiderancaV2Response],
    status_code=status.HTTP_200_OK,
)
async def list_pedidos(
    q: Optional[str] = Query(default=None, description="Busca geral"),
    municipio: Optional[str] = Query(default=None, description="Filtrar por município"),
    lideranca: Optional[str] = Query(default=None, description="Filtrar por liderança"),
    status_filter: Optional[str] = Query(default=None, alias="status", description="Filtrar por status"),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """
    Listar TODOS os pedidos de liderança V2 (dados compartilhados).
    Suporta filtros opcionais: q, municipio, lideranca, status.
    Ordenação: created_at DESC.
    """
    try:
        query = {}
        
        # Filtro de busca geral (acento-insensível via regex)
        if q:
            # Buscar em múltiplos campos
            query["$or"] = [
                {"protocolo": {"$regex": q, "$options": "i"}},
                {"titulo": {"$regex": q, "$options": "i"}},
                {"lideranca_nome": {"$regex": q, "$options": "i"}},
                {"municipio_nome": {"$regex": q, "$options": "i"}},
                {"descricao": {"$regex": q, "$options": "i"}},
            ]
        
        # Filtro por município
        if municipio:
            query["municipio_nome"] = {"$regex": municipio, "$options": "i"}
        
        # Filtro por liderança
        if lideranca:
            query["lideranca_nome"] = {"$regex": lideranca, "$options": "i"}
        
        # Filtro por status
        if status_filter:
            query["status"] = status_filter

        cursor = db.pedidos_liderancas_v2.find(query).sort("created_at", -1)
        raw_pedidos = await cursor.to_list(length=10000)

        return [PedidoLiderancaV2Response(**_normalize_lideranca_v2(doc)) for doc in raw_pedidos]

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao listar pedidos: {str(e)}",
        )


# -----------------------------
# GET BY ID
# -----------------------------
@router.get(
    "/liderancas/{pedido_id}",
    response_model=PedidoLiderancaV2Response,
    status_code=status.HTTP_200_OK,
)
async def get_pedido(
    pedido_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """Buscar um pedido específico por ID"""
    pedido = await db.pedidos_liderancas_v2.find_one({"id": pedido_id})
    
    if not pedido:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pedido não encontrado"
        )
    
    return PedidoLiderancaV2Response(**_normalize_lideranca_v2(pedido))


# -----------------------------
# UPDATE
# -----------------------------
@router.put(
    "/liderancas/{pedido_id}",
    response_model=PedidoLiderancaV2Response,
    status_code=status.HTTP_200_OK,
)
async def update_pedido(
    pedido_id: str,
    pedido_data: PedidoLiderancaV2Update,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """Atualizar um pedido existente"""
    
    # Verificar se o pedido existe
    existing = await db.pedidos_liderancas_v2.find_one({"id": pedido_id})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pedido não encontrado"
        )
    
    try:
        # Preparar dados para atualização (apenas campos não-nulos)
        update_data = {}
        for field, value in pedido_data.dict(exclude_unset=True).items():
            if value is not None:
                update_data[field] = value
        
        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nenhum campo para atualizar"
            )
        
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        result = await db.pedidos_liderancas_v2.update_one(
            {"id": pedido_id},
            {"$set": update_data}
        )
        
        if result.modified_count == 0:
            raise HTTPException(
                status_code=status.HTTP_304_NOT_MODIFIED,
                detail="Nenhuma alteração realizada"
            )
        
        updated = await db.pedidos_liderancas_v2.find_one({"id": pedido_id})
        return PedidoLiderancaV2Response(**_normalize_lideranca_v2(updated))
    
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(ve)
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao atualizar pedido: {str(e)}"
        )


# -----------------------------
# DELETE
# -----------------------------
@router.delete(
    "/liderancas/{pedido_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_pedido(
    pedido_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """Deletar um pedido"""
    result = await db.pedidos_liderancas_v2.delete_one({"id": pedido_id})
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pedido não encontrado"
        )
    
    return None

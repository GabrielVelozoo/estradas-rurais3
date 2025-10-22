from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
import uuid
from datetime import datetime, timezone

from auth_middleware import get_current_user
from auth_routes import get_db
from auth_models import UserResponse
from liderancas_models import (
    PedidoLiderancaCreate,
    PedidoLiderancaUpdate,
    PedidoLiderancaResponse
)

router = APIRouter()


def _normalize_lideranca(doc):
    """
    Normalizar documento do MongoDB para garantir que todos os campos existam
    e estejam no formato correto antes de criar PedidoLiderancaResponse
    """
    if not doc:
        return doc
    
    # Garantir que campos obrigatórios existam
    doc["id"] = str(doc.get("id", ""))
    doc["user_id"] = str(doc.get("user_id", ""))
    doc["municipio_id"] = int(doc.get("municipio_id", 0))
    doc["municipio_nome"] = str(doc.get("municipio_nome", ""))
    doc["pedido_titulo"] = str(doc.get("pedido_titulo", ""))
    doc["protocolo"] = str(doc.get("protocolo", "") or "")
    doc["nome_lideranca"] = str(doc.get("nome_lideranca", ""))
    doc["numero_lideranca"] = str(doc.get("numero_lideranca", ""))
    doc["descricao"] = str(doc.get("descricao", "") or "")
    
    # Normalizar datas (aceitar datetime object ou string)
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
    response_model=PedidoLiderancaResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_pedido(
    pedido_data: PedidoLiderancaCreate,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Criar um novo pedido de liderança.
    Mantemos user_id como metadado (quem criou), mas NÃO será usado para filtrar listagem.
    """
    try:
        now = datetime.now(timezone.utc).isoformat()
        document = {
            "id": str(uuid.uuid4()),
            "user_id": current_user.id,          # apenas informativo
            "municipio_id": pedido_data.municipio_id,
            "municipio_nome": pedido_data.municipio_nome,
            "pedido_titulo": pedido_data.pedido_titulo,
            "protocolo": pedido_data.protocolo or "",
            "nome_lideranca": pedido_data.nome_lideranca,
            "numero_lideranca": pedido_data.numero_lideranca,
            "descricao": pedido_data.descricao or "",
            "created_at": now,
            "updated_at": now,
        }

        await db.pedidos_liderancas.insert_one(document)
        return PedidoLiderancaResponse(**document)

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
# LIST (TODOS) — sem filtrar por user
# -----------------------------
@router.get(
    "/liderancas",
    response_model=List[PedidoLiderancaResponse],
    status_code=status.HTTP_200_OK,
)
async def list_pedidos(
    municipio_id: Optional[str] = Query(default=None),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),  # mantém auth, mas não limita por user_id
):
    """
    Listar TODOS os pedidos de liderança (visível para qualquer usuário autenticado).
    Filtro opcional por municipio_id (?municipio_id=...).
    """
    try:
        query = {}
        if municipio_id:
            query["municipio_id"] = municipio_id

        cursor = db.pedidos_liderancas.find(query).sort("created_at", -1)
        raw_pedidos = await cursor.to_list(length=10000)

        # Normalizar todos os documentos antes de criar o response
        normalized_docs = []
        for doc in raw_pedidos:
            normalized = _normalize_lideranca(doc)
            # Debug: log problematic documents
            if normalized.get('pedido_titulo') == '' or normalized.get('nome_lideranca') == '':
                print(f"DEBUG: Found problematic document: {normalized}")
            normalized_docs.append(PedidoLiderancaResponse(**normalized))
        return normalized_docs

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao listar pedidos: {str(e)}",
        )

# -----------------------------
# GET BY ID — sem filtrar por user
# -----------------------------
@router.get(
    "/liderancas/{pedido_id}",
    response_model=PedidoLiderancaResponse,
    status_code=status.HTTP_200_OK,
)
async def get_pedido(
    pedido_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """Buscar um pedido específico por ID (qualquer usuário autenticado pode ver)."""
    try:
        pedido = await db.pedidos_liderancas.find_one({"id": pedido_id})

        if not pedido:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Pedido não encontrado"
            )

        # Normalizar documento antes de criar response
        return PedidoLiderancaResponse(**_normalize_lideranca(pedido))

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao buscar pedido: {str(e)}",
        )

# -----------------------------
# UPDATE — sem filtrar por user
# -----------------------------
@router.put(
    "/liderancas/{pedido_id}",
    response_model=PedidoLiderancaResponse,
    status_code=status.HTTP_200_OK,
)
async def update_pedido(
    pedido_id: str,
    pedido_data: PedidoLiderancaUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """
    Atualizar um pedido existente por ID.
    Qualquer usuário autenticado pode atualizar (conforme solicitado).
    """
    try:
        existing_pedido = await db.pedidos_liderancas.find_one({"id": pedido_id})
        if not existing_pedido:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "Pedido não encontrado"},
            )

        update_data = {
            k: v
            for k, v in pedido_data.dict(exclude_unset=True).items()
            if v is not None
        }
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

        await db.pedidos_liderancas.update_one(
            {"id": pedido_id},
            {"$set": update_data},
        )

        updated_pedido = await db.pedidos_liderancas.find_one({"id": pedido_id})
        
        # Normalizar documento antes de criar response
        return PedidoLiderancaResponse(**_normalize_lideranca(updated_pedido))

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": f"Erro ao atualizar pedido: {str(e)}"},
        )

# -----------------------------
# DELETE — sem filtrar por user
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
    """
    Deletar um pedido por ID.
    Qualquer usuário autenticado pode deletar (conforme solicitado).
    """
    try:
        existing_pedido = await db.pedidos_liderancas.find_one({"id": pedido_id})
        if not existing_pedido:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Pedido não encontrado"
            )

        await db.pedidos_liderancas.delete_one({"id": pedido_id})
        return None

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao deletar pedido: {str(e)}",
        )

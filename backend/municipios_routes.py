# backend/municipios_routes.py
from fastapi import APIRouter, HTTPException, Query, status
from typing import List, Dict, Optional
from pathlib import Path
import json
import unicodedata
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

# Caminho do JSON (mantenha este caminho e nome de arquivo)
DATA_PATH = Path(__file__).parent / "data" / "municipios_parana.json"

def _strip_accents(s: str) -> str:
    """Remove acentos para comparação acento-insensível."""
    if not isinstance(s, str):
        return ""
    return "".join(
        c for c in unicodedata.normalize("NFD", s)
        if unicodedata.category(c) != "Mn"
    )

def _load_json() -> List[Dict]:
    """Carrega o JSON do disco e valida formato básico."""
    if not DATA_PATH.exists():
        msg = f"Arquivo não encontrado: {DATA_PATH}"
        logger.error(msg)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=msg)
    try:
        with open(DATA_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, list):
            raise ValueError("Conteúdo do JSON deve ser uma lista")
        # Validação rápida dos campos
        for i, item in enumerate(data):
            if not isinstance(item, dict) or "id" not in item or "nome" not in item:
                raise ValueError(f"Item inválido na posição {i}: esperado {{'id', 'nome'}}")
        return data
    except json.JSONDecodeError as e:
        msg = f"JSON inválido em {DATA_PATH}: {e}"
        logger.error(msg)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=msg)
    except Exception as e:
        msg = f"Falha ao ler {DATA_PATH}: {e}"
        logger.error(msg)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=msg)

def _filter_by_query(items: List[Dict], q: Optional[str]) -> List[Dict]:
    if not q:
        # Ordena por nome por padrão
        return sorted(items, key=lambda x: x.get("nome", ""))
    qn = _strip_accents(q).lower().strip()
    out = []
    for it in items:
        nome = it.get("nome", "")
        if _strip_accents(nome).lower().find(qn) != -1:
            out.append(it)
    return sorted(out, key=lambda x: x.get("nome", ""))

@router.get("/municipios", response_model=List[Dict])
async def get_municipios(q: Optional[str] = Query(None, description="Filtro por nome (acento-insensível)")):
    """
    Lista de municípios do PR.
    - Suporta `?q=` para busca acento-insensível (ex: `?q=sao` encontra 'São ...').
    """
    data = _load_json()
    return _filter_by_query(data, q)

@router.get("/municipios/{municipio_id}", response_model=Dict)
async def get_municipio_by_id(municipio_id: int):
    """Obtém um município pelo ID."""
    data = _load_json()
    for it in data:
        if int(it.get("id", -1)) == int(municipio_id):
            return it
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Município não encontrado")

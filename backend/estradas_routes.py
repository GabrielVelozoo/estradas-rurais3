# backend/estradas_routes.py
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Any, Dict
from datetime import datetime, timedelta
import requests, csv, io, os

from auth_middleware import get_current_user
from auth_models import UserResponse

router = APIRouter()

# ==============================
# Configurações
# ==============================
CSV_URL = os.getenv("ESTRADAS_SHEET_CSV_URL", "").strip()
CACHE_TTL_SECONDS = int(os.getenv("ESTRADAS_CACHE_TTL", "180"))

_cache: Dict[str, Any] = {"ts": None, "values": None}

def _cache_alive():
    ts = _cache["ts"]
    if not ts:
        return False
    return (datetime.utcnow() - ts) < timedelta(seconds=CACHE_TTL_SECONDS)

def _read_csv():
    if not CSV_URL:
        raise HTTPException(status_code=500, detail="ESTRADAS_SHEET_CSV_URL não configurado no .env")
    try:
        r = requests.get(CSV_URL, timeout=20)
        r.raise_for_status()
        f = io.StringIO(r.text)
        reader = csv.reader(f)
        data = [row[:9] for row in reader]  # 🔹 mantém até Coluna I (A:I)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao ler CSV: {e}")

@router.get("/api/estradas-rurais")
async def get_estradas_rurais(current_user: UserResponse = Depends(get_current_user)):
    """Retorna os dados de estradas rurais com coluna APROVADO incluída (A:I)."""
    if _cache_alive() and _cache["values"] is not None:
        return {"values": _cache["values"]}

    data = _read_csv()
    _cache["ts"] = datetime.utcnow()
    _cache["values"] = data
    return {"values": data}

# backend/municipio_info_models.py
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
import uuid

# ========= MunicipioInfo (1-1 com Municipios) =========

class MunicipioInfoBase(BaseModel):
    municipio_id: int
    prefeito_nome: Optional[str] = None
    prefeito_partido: Optional[str] = None
    prefeito_tel: Optional[str] = None
    vice_nome: Optional[str] = None
    vice_partido: Optional[str] = None
    vice_tel: Optional[str] = None
    votos_2014: Optional[int] = None
    votos_2018: Optional[int] = None
    votos_2022: Optional[int] = None

class MunicipioInfoCreate(MunicipioInfoBase):
    """Payload usado para criar/atualizar (upsert)."""
    pass

class MunicipioInfoUpdate(BaseModel):
    """Payload parcial para update (PUT)."""
    prefeito_nome: Optional[str] = None
    prefeito_partido: Optional[str] = None
    prefeito_tel: Optional[str] = None
    vice_nome: Optional[str] = None
    vice_partido: Optional[str] = None
    vice_tel: Optional[str] = None
    votos_2014: Optional[int] = None
    votos_2018: Optional[int] = None
    votos_2022: Optional[int] = None

class MunicipioInfo(MunicipioInfoBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        # Pydantic consegue parsear ISO8601 -> datetime automaticamente
        json_schema_extra = {
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "municipio_id": 1,
                "prefeito_nome": "João Silva",
                "prefeito_partido": "PMDB",
                "prefeito_tel": "(41) 99999-9999",
                "vice_nome": "Maria Santos",
                "vice_partido": "PSDB",
                "vice_tel": "(41) 98888-8888",
                "votos_2014": 15000,
                "votos_2018": 18000,
                "votos_2022": 21000,
                "created_at": "2025-01-15T10:00:00Z",
                "updated_at": "2025-01-15T10:00:00Z"
            }
        }

# ========= MunicipioLiderancas (1-N) =========

class MunicipioLiderancaBase(BaseModel):
    municipio_id: int
    nome: str
    cargo: str
    telefone: Optional[str] = None

class MunicipioLiderancaCreate(MunicipioLiderancaBase):
    pass

class MunicipioLiderancaUpdate(BaseModel):
    nome: Optional[str] = None
    cargo: Optional[str] = None
    telefone: Optional[str] = None

class MunicipioLideranca(MunicipioLiderancaBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        json_schema_extra = {
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174001",
                "municipio_id": 1,
                "nome": "Carlos Oliveira",
                "cargo": "Vereador",
                "telefone": "(41) 97777-7777",
                "created_at": "2025-01-15T10:00:00Z",
                "updated_at": "2025-01-15T10:00:00Z"
            }
        }

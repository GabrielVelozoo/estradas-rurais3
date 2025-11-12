# /app/backend/server.py
from fastapi import FastAPI, APIRouter, HTTPException, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List
import uuid
from datetime import datetime

# Auth / routes
from auth_routes import router as auth_router
from pedidos_routes import router as pedidos_router
from municipios_routes import router as municipios_router

# Rotas V2
from liderancas_v2_routes import router as liderancas_v2_router
from maquinarios_v2_routes import router as maquinarios_v2_router

# Rotas Informações Gerais
from municipio_info_routes import router as municipio_info_router

# Auth helpers
from auth_middleware import get_current_active_user
from auth_models import User
from auth_utils import hash_password, prepare_user_for_mongo

# -------------------------------------------------
# Configuração inicial
# -------------------------------------------------
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("backend")

# -------------------------------------------------
# MongoDB
# -------------------------------------------------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# App FastAPI
app = FastAPI()
app.state.db = db

# -------------------------------------------------
# CORS
# -------------------------------------------------
raw_origins = os.environ.get("CORS_ORIGINS", "*")
origins = [o.strip() for o in raw_origins.split(",") if o.strip()]
allow_credentials = not (len(origins) == 1 and origins[0] == "*")

logger.info(f"CORS allow_origins={origins if allow_credentials else ['*']}")
logger.info(f"CORS allow_credentials={allow_credentials}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if allow_credentials else ["*"],
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------
# Router base /api
# -------------------------------------------------
api_router = APIRouter(prefix="/api")


class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class StatusCheckCreate(BaseModel):
    client_name: str


@api_router.get("/")
async def root():
    return {"message": "Hello World"}


@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_obj = StatusCheck(**input.dict())
    await db.status_checks.insert_one(status_obj.dict())
    return status_obj


@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**s) for s in status_checks]


# -------------------------------------------------
# Estradas Rurais - Google Sheets A:I (inclui "APROVADO" na coluna I)
# -------------------------------------------------
@api_router.get("/estradas-rurais")
async def get_estradas_rurais(current_user: User = Depends(get_current_active_user)):
    """
    Retorna o mesmo formato do Google Sheets API:
    {
      "range": "...",
      "majorDimension": "ROWS",
      "values": [ ... ]
    }

    • Busca o range A:I (cabeçalho + dados).
    • valueRenderOption=FORMATTED_VALUE + dateTimeRenderOption=FORMATTED_STRING
      => datas já vêm em "dd/MM/yyyy HH:mm:ss" quando possível.
    • Coluna I deve conter "APROVADO" para o frontend aplicar o selo/estilo azul.
    """
    import aiohttp
    from urllib.parse import quote

    # Tenta pegar do .env; se não houver, usa fallback
    SHEET_ID = (
        os.environ.get("SHEET_ID", "").strip()
        or "1jaHnRgqRyMLjZVvaRSkG2kOyZ4kMEBgsPhwYIGVj490"
    )
    API_KEY = (
        os.environ.get("SHEETS_API_KEY", "").strip()
        or "AIzaSyBdd6E9Dz5W68XdhLCsLIlErt1ylwTt5Jk"
    )

    # Nome da aba (opcional). Se não setar, usamos A1:I direto.
    SHEET_TAB = os.environ.get("SHEET_TAB", "").strip()

    # 🔵 IMPORTANTE: agora inclui a Coluna I (APROVADO)
    RANGE_AI = "A1:I"

    # Monta o range final (com ou sem nome de aba)
    the_range = f"{SHEET_TAB}!{RANGE_AI}" if SHEET_TAB else RANGE_AI

    # Monta URL da API
    base = f"https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}/values/{quote(the_range)}"
    params = (
        "valueRenderOption=FORMATTED_VALUE&"
        "dateTimeRenderOption=FORMATTED_STRING&"
        "majorDimension=ROWS&"
        f"key={API_KEY}"
    )
    url = f"{base}?{params}"

    logger.info(f"[Sheets] GET {the_range}")

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers={"Cache-Control": "no-cache"}) as resp:
                text = await resp.text()
                if resp.status != 200:
                    # Log detalhado para debug (não vaza API key)
                    logger.error(f"[Sheets] {resp.status} range={the_range} body={text[:500]}")
                    raise HTTPException(
                        status_code=500,
                        detail="Erro interno ao buscar dados do Google Sheets",
                    )
                data = await resp.json()

        # Logs de amostra (aparecem no backend)
        values = data.get("values", [])
        sample_lens = [len(r) for r in values[:5]]
        logger.info(
            f"[Sheets] OK linhas={len(values)} amostra_colunas={sample_lens}"
        )

        # Retorna o payload CRU (frontend já espera o formato da API do Sheets)
        return data

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"[Sheets] exceção ao tentar range={the_range}: {e}")
        raise HTTPException(
            status_code=500, detail="Erro interno ao buscar dados do Google Sheets"
        )


# -------------------------------------------------
# Inclui routers
# -------------------------------------------------
app.include_router(api_router)
app.include_router(auth_router, prefix="/api")
app.include_router(pedidos_router, prefix="/api")

# Informações Gerais (must come before municipios to avoid route conflicts)
app.include_router(municipio_info_router, prefix="/api")

app.include_router(municipios_router, prefix="/api")

# V2 (ativas)
app.include_router(liderancas_v2_router, prefix="/api")
app.include_router(maquinarios_v2_router, prefix="/api")


# -------------------------------------------------
# Eventos
# -------------------------------------------------
@app.on_event("startup")
async def startup_event():
    """Cria índices e usuário admin padrão se não existir"""
    try:
        # Índices v1 antigos (se existirem)
        await db.pedidos_liderancas.create_index("id", unique=True)
        await db.pedidos_maquinarios_v2.create_index("id", unique=True)
        await db.users.create_index("username", unique=True)

        # Índices V2
        await db.pedidos_liderancas_v2.create_index("id", unique=True)
        await db.pedidos_liderancas_v2.create_index("created_at")
        await db.pedidos_liderancas_v2.create_index("municipio_nome")
        await db.pedidos_liderancas_v2.create_index("lideranca_nome")
        await db.pedidos_liderancas_v2.create_index("protocolo")

        await db.pedidos_maquinarios_v2.create_index("id", unique=True)
        await db.pedidos_maquinarios_v2.create_index("created_at")
        await db.pedidos_maquinarios_v2.create_index("municipio_nome")
        await db.pedidos_maquinarios_v2.create_index("itens.equipamento")

        logger.info("Índices criados/verificados.")

        # Usuário admin padrão
        admin_user = await db.users.find_one({"username": "gabriel"})
        if not admin_user:
            from auth_models import UserCreate, UserInDB

            admin_data = UserCreate(
                username="gabriel",
                role="admin",
                password="gggr181330",
                is_active=True,
            )
            password_hash = hash_password(admin_data.password)
            admin_obj = UserInDB(
                **admin_data.dict(exclude={"password"}),
                password_hash=password_hash,
            )
            admin_mongo_data = prepare_user_for_mongo(admin_obj.dict())
            await db.users.insert_one(admin_mongo_data)
            logger.info("Default admin user created: gabriel")
        else:
            logger.info("Admin user already exists")

    except Exception as e:
        logger.error(f"Error on startup: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

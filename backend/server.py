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
from datetime import datetime, timezone

# Import auth modules
from auth_routes import router as auth_router
from pedidos_routes import router as pedidos_router
# from liderancas_routes import router as liderancas_router
# from maquinarios_routes import router as maquinarios_router
from municipios_routes import router as municipios_router
# Import V2 modules
from liderancas_v2_routes import router as liderancas_v2_router
from maquinarios_v2_routes import router as maquinarios_v2_router
from auth_middleware import get_current_active_user
from auth_models import User
from auth_utils import hash_password, prepare_user_for_mongo

# Configurações iniciais
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# Conexão com MongoDB
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# Criação do app principal
app = FastAPI()
app.state.db = db

# ---------- LOGGING (antes de tudo) ----------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# ---------- CORS CONFIGURADO (antes das rotas) ----------
# Configuração de CORS para produção e desenvolvimento
raw_origins = os.environ.get("CORS_ORIGINS", "*")
origins = [o.strip() for o in raw_origins.split(",") if o.strip()]

# Se temos origens específicas, habilitar credentials
allow_credentials = not (len(origins) == 1 and origins[0] == "*")

# Log das origens configuradas para debug
logger.info(f"CORS configurado com origens: {origins}")
logger.info(f"CORS allow_credentials: {allow_credentials}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if allow_credentials else ["*"],
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Criação do router /api
api_router = APIRouter(prefix="/api")

# ---------- MODELOS AUXILIARES ----------
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

# ---------- ROTAS AUXILIARES ----------
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

@api_router.get("/estradas-rurais")
async def get_estradas_rurais(current_user: User = Depends(get_current_active_user)):
    """
    Busca dados do Google Sheets incluindo coluna H (Última edição).
    Usa FORMATTED_VALUE para pegar datas já formatadas.
    """
    import aiohttp
    try:
        # Incluir coluna H + formatação de datas
        url = (
            "https://sheets.googleapis.com/v4/spreadsheets/"
            "1jaHnRgqRyMLjZVvaRSkG2kOyZ4kMEBgsPhwYIGVj490/values/A:H"
            "?key=AIzaSyBdd6E9Dz5W68XdhLCsLIlErt1ylwTt5Jk"
            "&valueRenderOption=FORMATTED_VALUE"
            "&dateTimeRenderOption=FORMATTED_STRING"
        )
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    # Log detalhado para debug
                    if "values" in data and len(data["values"]) > 1:
                        header = data["values"][0] if len(data["values"]) > 0 else []
                        first_row = data["values"][1] if len(data["values"]) > 1 else []
                        
                        logger.info(f"✅ SHEETS - Colunas no header: {len(header)}")
                        logger.info(f"✅ SHEETS - Coluna H (header): {header[7] if len(header) > 7 else 'N/A'}")
                        logger.info(f"✅ SHEETS - Total de linhas: {len(data['values']) - 1}")
                        
                        if len(first_row) > 7:
                            logger.info(f"✅ SHEETS - Coluna H (primeira linha): '{first_row[7]}'")
                        else:
                            logger.warning(f"⚠️ SHEETS - Primeira linha só tem {len(first_row)} colunas")
                    
                    return data
                else:
                    logger.error(f"❌ SHEETS API status: {response.status}")
                    raise Exception(f"API request failed with status {response.status}")
    except Exception as e:
        logger.error(f"❌ Error fetching Google Sheets data: {e}")
        raise HTTPException(status_code=500, detail="Error fetching data from Google Sheets")

# ---------- INCLUSÃO DE ROTAS ----------
app.include_router(api_router)
app.include_router(auth_router, prefix="/api")
app.include_router(pedidos_router, prefix="/api")
# V1 Routes (desabilitadas - usando V2)
# app.include_router(liderancas_router, prefix="/api")
# app.include_router(maquinarios_router, prefix="/api")
app.include_router(municipios_router, prefix="/api")
# V2 Routes (ATIVAS)
app.include_router(liderancas_v2_router, prefix="/api")
app.include_router(maquinarios_v2_router, prefix="/api")

# ---------- EVENTOS DE INICIALIZAÇÃO ----------
@app.on_event("startup")
async def startup_event():
    """Cria índices e usuário admin padrão se não existir"""
    try:
        # Índices únicos (evita duplicatas)
        await db.pedidos_liderancas.create_index("id", unique=True)
        await db.pedidos_maquinarios_v2.create_index("id", unique=True)
        await db.users.create_index("username", unique=True)
        
        # Índices para V2 (novas coleções)
        await db.pedidos_liderancas_v2.create_index("id", unique=True)
        await db.pedidos_liderancas_v2.create_index("created_at")
        await db.pedidos_liderancas_v2.create_index("municipio_nome")
        await db.pedidos_liderancas_v2.create_index("lideranca_nome")
        await db.pedidos_liderancas_v2.create_index("protocolo")
        
        await db.pedidos_maquinarios_v2.create_index("id", unique=True)
        await db.pedidos_maquinarios_v2.create_index("created_at")
        await db.pedidos_maquinarios_v2.create_index("municipio_nome")
        await db.pedidos_maquinarios_v2.create_index("itens.equipamento")
        
        logger.info("Índices criados/verificados com sucesso")

        # Criação do usuário admin padrão
        admin_user = await db.users.find_one({"username": "gabriel"})
        if not admin_user:
            from auth_models import UserCreate, UserInDB
            from auth_utils import hash_password, prepare_user_for_mongo

            admin_data = UserCreate(
                username="gabriel",
                role="admin",
                password="gggr181330",
                is_active=True
            )

            password_hash = hash_password(admin_data.password)
            admin_obj = UserInDB(
                **admin_data.dict(exclude={"password"}),
                password_hash=password_hash
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

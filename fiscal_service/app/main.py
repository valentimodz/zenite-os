import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import nfe
from app.config import settings

# Configuração de Logs
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("fiscal_service")

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Microserviço FastAPI para emissão direta de NF-e (Modelo 55) com Certificado A1 integrado à SEFAZ-PA (SVRS)."
)

# Configuração de CORS para permitir requisições do frontend Zenite OS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Pode ser restrito ao domínio do Zenite em produção
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclusão dos roteadores
app.include_router(nfe.router)

@app.get("/health", tags=["Healthcheck"])
async def health_check():
    return {
        "status": "healthy",
        "service": settings.app_name,
        "version": settings.app_version,
        "sefaz_uf": settings.sefaz_uf,
        "sefaz_ambiente": "Homologação" if settings.sefaz_ambiente == 2 else "Produção"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=True)

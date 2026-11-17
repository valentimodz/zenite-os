import os
from pathlib import Path
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"
if _ENV_FILE.exists():
    load_dotenv(dotenv_path=_ENV_FILE, override=False)

class Settings(BaseSettings):
    app_name: str = "Zenite OS - Fiscal Microservice"
    app_version: str = "1.0.0"
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "8000"))
    
    # SEFAZ Configuration
    # 1: Produção, 2: Homologação
    sefaz_ambiente: int = int(os.getenv("SEFAZ_AMBIENTE", "2"))
    sefaz_uf: str = os.getenv("SEFAZ_UF", "PA")
    sefaz_codigo_uf: str = os.getenv("SEFAZ_CODIGO_UF", "15") # 15 é o código IBGE do Pará
    
    # Segurança
    app_secret_token: str = os.getenv("APP_SECRET_TOKEN", "zenite_fiscal_token")
    
    # Supabase (para persistência de XML/DANFE se necessário)
    supabase_url: str = os.getenv("SUPABASE_URL", "")
    supabase_service_role_key: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

    class Config:
        env_file = str(_ENV_FILE)
        extra = "allow"

settings = Settings()

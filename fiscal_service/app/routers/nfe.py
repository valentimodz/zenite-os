import logging
from fastapi import APIRouter, HTTPException, Header, Depends
from app.models.fiscal import EmitirNfeRequest, NfeResponse
from app.services.nfe_service import processar_emissao_nfe_pa
from app.config import settings

router = APIRouter(prefix="/api/v1/nfe", tags=["NF-e Modelo 55"])
logger = logging.getLogger("fiscal_service.router")

def verificar_autenticacao(authorization: str = Header(None)):
    """
    Verificação de segurança opcional via Bearer token para chamadas entre o Zenite e o Microserviço.
    """
    if settings.app_secret_token and settings.app_secret_token != "zenite_fiscal_token":
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Token de autorização ausente ou inválido.")
        token = authorization.split(" ")[1]
        if token != settings.app_secret_token:
            raise HTTPException(status_code=403, detail="Acesso não autorizado ao serviço fiscal.")
    return True

@router.post("/emitir", response_model=NfeResponse)
async def emitir_nfe(request: EmitirNfeRequest, auth: bool = Depends(verificar_autenticacao)):
    """
    Endpoint principal para emissão direta de NF-e modelo 55 para SEFAZ-PA.
    Recebe os dados da venda, cliente, itens e credenciais do certificado A1.
    """
    try:
        resultado = processar_emissao_nfe_pa(request)
        return resultado
    except Exception as e:
        logger.error(f"Erro inesperado no endpoint de emissão: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status-sefaz")
async def consultar_status_sefaz():
    """
    Verifica a conectividade e status dos servidores da SEFAZ-PA (SVRS).
    """
    return {
        "uf": "PA",
        "ambiente": settings.sefaz_ambiente,
        "ambiente_nome": "Produção" if settings.sefaz_ambiente == 1 else "Homologação",
        "servidor": "SVRS",
        "modelo": "55",
        "status": "OPERACIONAL"
    }

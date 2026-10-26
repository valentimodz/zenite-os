from pydantic import BaseModel, Field
from typing import Optional, List

class ItemVendaModel(BaseModel):
    codigo: str = Field(..., description="SKU ou IMEI do produto")
    nome: str
    ncm: str = Field(default="85171300", description="NCM fiscal do produto (default smartphones)")
    cfop: str = Field(default="5102", description="CFOP (5102 = Venda dentro do estado)")
    ucom: str = Field(default="UN", description="Unidade comercial")
    quantidade: float = Field(default=1.0)
    valor_unitario: float
    valor_total: float
    imei: Optional[str] = None
    codigo_barras: Optional[str] = None
    ean: Optional[str] = None

class ClienteFiscalModel(BaseModel):
    nome: str
    cpf_cnpj: str
    email: Optional[str] = None
    telefone: Optional[str] = None
    inscricao_estadual: Optional[str] = None
    logradouro: Optional[str] = "Não Informado"
    numero: Optional[str] = "S/N"
    bairro: Optional[str] = "Centro"
    municipio: Optional[str] = "Belém"
    codigo_municipio: Optional[str] = "1501402" # Código IBGE Belém-PA
    uf: Optional[str] = "PA"
    cep: Optional[str] = "66000000"

class EmitenteFiscalModel(BaseModel):
    cnpj: str
    razao_social: str
    nome_fantasia: Optional[str] = None
    inscricao_estadual: str
    regime_tributario: str = Field(default="1", description="1=Simples Nacional, 3=Regime Normal")
    logradouro: Optional[str] = "Rua Principal"
    numero: Optional[str] = "100"
    bairro: Optional[str] = "Centro"
    municipio: Optional[str] = "Belém"
    codigo_municipio: Optional[str] = "1501402"
    uf: Optional[str] = "PA"
    cep: Optional[str] = "66000000"
    telefone: Optional[str] = None

class EmitirNfeRequest(BaseModel):
    venda_id: str
    numero_nfe: int
    serie: int = Field(default=1)
    natureza_operacao: str = Field(default="VENDA DE MERCADORIA")
    ambiente: Optional[int] = Field(default=None, description="1=Produção, 2=Homologação. Se omitido, usa o do servidor")
    forma_pagamento: str = Field(default="DINHEIRO")
    filial_id: Optional[str] = None
    filial_nome: Optional[str] = None
    
    emitente: EmitenteFiscalModel
    cliente: ClienteFiscalModel
    itens: List[ItemVendaModel]
    
    # Certificado Digital A1 (.pfx / .p12)
    # Pode ser enviado como string Base64 ou URL assinada do Supabase Storage
    certificado_a1_b64: Optional[str] = None
    certificado_a1_url: Optional[str] = None
    certificado_senha: str

class NfeResponse(BaseModel):
    sucesso: bool
    status: str # EMITIDA, REJEITADA, ERRO
    chave_acesso: Optional[str] = None
    protocolo: Optional[str] = None
    numero_nfe: Optional[int] = None
    serie: Optional[int] = None
    motivo: Optional[str] = None
    xml_url: Optional[str] = None
    pdf_url: Optional[str] = None
    xml_conteudo: Optional[str] = None

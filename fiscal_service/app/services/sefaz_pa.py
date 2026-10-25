"""
Configurações dos WebServices da SEFAZ para o Estado do Pará (PA - Código IBGE 15).
A SEFAZ-PA utiliza a SEFAZ Virtual do Rio Grande do Sul (SVRS) para NF-e modelo 55.
"""

SEFAZ_PA_CONFIG = {
    "uf": "PA",
    "codigo_ibge_uf": "15",
    "servidor": "SVRS", # SEFAZ Virtual RS
    "modelo": "55",     # NF-e (Modelo 55)
    "versao": "4.00",
    "urls": {
        # Ambiente 1: Produção
        1: {
            "NfeAutorizacao": "https://nfe.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx",
            "NfeRetAutorizacao": "https://nfe.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx",
            "NfeInutilizacao": "https://nfe.svrs.rs.gov.br/ws/nfeinutilizacao/nfeinutilizacao4.asmx",
            "NfeConsultaProtocolo": "https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx",
            "NfeStatusServico": "https://nfe.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx",
            "RecepcaoEvento": "https://nfe.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx"
        },
        # Ambiente 2: Homologação
        2: {
            "NfeAutorizacao": "https://nfe-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx",
            "NfeRetAutorizacao": "https://nfe-homologacao.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx",
            "NfeInutilizacao": "https://nfe-homologacao.svrs.rs.gov.br/ws/nfeinutilizacao/nfeinutilizacao4.asmx",
            "NfeConsultaProtocolo": "https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx",
            "NfeStatusServico": "https://nfe-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx",
            "RecepcaoEvento": "https://nfe-homologacao.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx"
        }
    }
}

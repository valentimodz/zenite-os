import os
import io
import re
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.graphics.barcode import createBarcodeDrawing
from app.models.fiscal import EmitirNfeRequest

def _format_cnpj_cpf(val: str) -> str:
    if not val:
        return ""
    digits = re.sub(r'\D', '', str(val))
    if len(digits) == 14:
        return f"{digits[:2]}.{digits[2:5]}.{digits[5:8]}/{digits[8:12]}-{digits[12:]}"
    elif len(digits) == 11:
        return f"{digits[:3]}.{digits[3:6]}.{digits[6:9]}-{digits[9:]}"
    return val

def _format_cep(val: str) -> str:
    if not val:
        return ""
    digits = re.sub(r'\D', '', str(val))
    if len(digits) == 8:
        return f"{digits[:5]}-{digits[5:]}"
    return val

def _format_numero_nfe(num) -> str:
    try:
        s = f"{int(num):09d}"
        return f"{s[:3]}.{s[3:6]}.{s[6:]}"
    except Exception:
        return str(num).zfill(9)

def _format_chave(chave: str) -> str:
    clean = re.sub(r'\D', '', str(chave))
    # Divide em blocos de 4 dígitos
    return " ".join([clean[i:i+4] for i in range(0, len(clean), 4)])

def _format_moeda(val) -> str:
    try:
        f = float(val)
        return f"{f:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
    except Exception:
        return "0,00"

def gerar_danfe_pdf_bytes(req: EmitirNfeRequest, chave_acesso: str, protocolo: str) -> bytes:
    """
    Gera o Documento Auxiliar da Nota Fiscal Eletrônica (DANFE modelo 55) em PDF,
    rigorosamente conforme o leiaute oficial padrão nacional da Receita Federal e SEFAZ.
    """
    buffer = io.BytesIO()
    
    # Largura imprimível: 595.28 - 2*14 = 567.28 pt (usaremos 565 pt nas tabelas)
    PAGE_W = 565.0
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=15,
        leftMargin=15,
        topMargin=15,
        bottomMargin=15
    )
    
    styles = getSampleStyleSheet()
    
    # Estilos tipográficos oficiais da DANFE
    lbl = ParagraphStyle(
        'DanfeLabel',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=5.5,
        leading=6.5,
        textColor=colors.HexColor('#222222')
    )
    
    lbl_b = ParagraphStyle(
        'DanfeLabelBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=6.0,
        leading=7.0,
        textColor=colors.black
    )
    
    val = ParagraphStyle(
        'DanfeVal',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=8.5,
        textColor=colors.black
    )

    val_normal = ParagraphStyle(
        'DanfeValNormal',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.0,
        leading=8.0,
        textColor=colors.black
    )

    val_r = ParagraphStyle(
        'DanfeValRight',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.0,
        leading=8.0,
        alignment=2,
        textColor=colors.black
    )

    sec_hdr = ParagraphStyle(
        'DanfeSecHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=6.5,
        leading=7.5,
        textColor=colors.black
    )

    tbl_hdr = ParagraphStyle(
        'DanfeTblHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=5.5,
        leading=6.5,
        alignment=1,
        textColor=colors.black
    )

    tbl_val = ParagraphStyle(
        'DanfeTblVal',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=6.5,
        leading=7.5,
        textColor=colors.black
    )

    tbl_val_r = ParagraphStyle(
        'DanfeTblValRight',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=6.5,
        leading=7.5,
        alignment=2,
        textColor=colors.black
    )

    tbl_val_c = ParagraphStyle(
        'DanfeTblValCenter',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=6.5,
        leading=7.5,
        alignment=1,
        textColor=colors.black
    )

    elements = []

    # =========================================================================
    # 0. CANHOTO DO RECEBEDOR (TOPO DA FOLHA)
    # =========================================================================
    razao_social = req.emitente.razao_social.upper()
    num_formatado = _format_numero_nfe(req.numero_nfe)
    serie_formatada = str(req.serie)

    canhoto_data = [
        [
            Paragraph(f"RECEBI(EMOS) DE <b>{razao_social}</b> OS PRODUTOS CONSTANTES DA NOTA FISCAL ELETRÔNICA INDICADA AO LADO, BEM COMO ATESTAMOS QUE OS MESMOS FORAM EXAMINADOS, SERVINDO O ACEITE DA PRESENTE PARA TODOS OS EFEITOS LEGAIS.", lbl),
            Paragraph(f"<b>NF-e</b><br/><font size=6>Nº <b>{num_formatado}</b></font><br/>SÉRIE <b>{serie_formatada}</b>", ParagraphStyle('CanhotoNfe', parent=styles['Normal'], fontName='Helvetica', fontSize=7.0, leading=8.0, alignment=1))
        ],
        [
            Table([
                [
                    Paragraph("DATA DE RECEBIMENTO", lbl),
                    Paragraph("IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR", lbl)
                ],
                [
                    Paragraph("", lbl),
                    Paragraph("", lbl)
                ]
            ], colWidths=[130, 345], rowHeights=[10, 16]),
            ""
        ]
    ]

    t_canhoto = Table(canhoto_data, colWidths=[475, 90])
    t_canhoto.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 0.8, colors.black),
        ('SPAN', (1,0), (1,1)),
        ('LINEBEFORE', (1,0), (1,1), 0.8, colors.black),
        ('LINEBELOW', (0,0), (0,0), 0.5, colors.black),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('LEFTPADDING', (0,0), (-1,-1), 3),
        ('RIGHTPADDING', (0,0), (-1,-1), 3),
    ]))
    elements.append(t_canhoto)
    elements.append(Spacer(1, 4))

    # =========================================================================
    # 1. CABEÇALHO PRINCIPAL DA DANFE (EMITENTE, DANFE QUADRO, CÓDIGO DE BARRAS)
    # =========================================================================
    # Emitente (Col 1: 220 pt)
    nome_fantasia_txt = f"<b>{req.emitente.nome_fantasia.upper()}</b><br/>" if req.emitente.nome_fantasia else ""
    emitente_html = f"""{nome_fantasia_txt}<b>{razao_social}</b><br/>
<font size=6.5>
{req.emitente.logradouro}, {req.emitente.numero}{(' - ' + req.emitente.bairro) if req.emitente.bairro else ''}<br/>
{req.emitente.municipio} - {req.emitente.uf}<br/>
CEP: {_format_cep(req.emitente.cep)} {(' - FONE: ' + req.emitente.telefone) if req.emitente.telefone else ''}
</font>
"""
    col1_emitente = Paragraph(emitente_html, ParagraphStyle('EmitenteP', parent=styles['Normal'], fontName='Helvetica', fontSize=7.0, leading=8.5, alignment=1))

    # DANFE Quadro Central (Col 2: 95 pt)
    danfe_quadro_html = f"""<font size=11><b>DANFE</b></font><br/>
<font size=5.5>DOCUMENTO AUXILIAR<br/>DA NOTA FISCAL<br/>ELETRÔNICA</font><br/>
<font size=6.5><b>0 - ENTRADA<br/>1 - SAÍDA</b></font><br/>
<font size=9><b>[ 1 ]</b></font><br/>
<font size=6><b>Nº {num_formatado}</b><br/>
<b>SÉRIE {serie_formatada}</b><br/>
FOLHA 1/1</font>
"""
    col2_danfe = Paragraph(danfe_quadro_html, ParagraphStyle('DanfeBoxP', parent=styles['Normal'], fontName='Helvetica', fontSize=6.5, leading=8.0, alignment=1))

    # Código de Barras e Chave de Acesso (Col 3: 250 pt)
    clean_chave = re.sub(r'\D', '', str(chave_acesso))
    try:
        barcode_drawing = createBarcodeDrawing('Code128', value=clean_chave, width=240, height=32, humanReadable=False)
    except Exception:
        barcode_drawing = Paragraph(f"<b>{clean_chave}</b>", val)

    chave_formatada = _format_chave(clean_chave)

    col3_content = [
        [barcode_drawing],
        [Paragraph(f"<b>CHAVE DE ACESSO</b><br/><font size=7.5><b>{chave_formatada}</b></font>", ParagraphStyle('ChaveP', parent=styles['Normal'], fontName='Helvetica', fontSize=6.0, leading=7.5, alignment=1))],
        [Paragraph("Consulta de autenticidade no portal nacional da NF-e<br/><b>www.nfe.fazenda.gov.br/portal</b> ou no site da Sefaz Autorizadora", ParagraphStyle('ConsultaP', parent=styles['Normal'], fontName='Helvetica', fontSize=5.5, leading=7.0, alignment=1))]
    ]
    t_col3 = Table(col3_content, colWidths=[246])
    t_col3.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 1),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1),
        ('LEFTPADDING', (0,0), (-1,-1), 1),
        ('RIGHTPADDING', (0,0), (-1,-1), 1),
    ]))

    t_header = Table([[col1_emitente, col2_danfe, t_col3]], colWidths=[220, 95, 250])
    t_header.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 0.8, colors.black),
        ('LINEBEFORE', (1,0), (1,0), 0.8, colors.black),
        ('LINEBEFORE', (2,0), (2,0), 0.8, colors.black),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 3),
        ('RIGHTPADDING', (0,0), (-1,-1), 3),
    ]))
    elements.append(t_header)

    # Natureza da Operação e Protocolo
    data_emissao_str = datetime.now().strftime('%d/%m/%Y')
    hora_emissao_str = datetime.now().strftime('%H:%M:%S')
    data_hora_protocolo = f"{protocolo} - {data_emissao_str} {hora_emissao_str}"

    nat_data = [
        [
            Paragraph(f"NATUREZA DA OPERAÇÃO<br/><b>{req.natureza_operacao.upper()}</b>", ParagraphStyle('NatP', parent=styles['Normal'], fontName='Helvetica', fontSize=6.0, leading=7.5)),
            Paragraph(f"PROTOCOLO DE AUTORIZAÇÃO DE USO<br/><b>{data_hora_protocolo}</b>", ParagraphStyle('ProtP', parent=styles['Normal'], fontName='Helvetica', fontSize=6.0, leading=7.5))
        ]
    ]
    t_nat = Table(nat_data, colWidths=[315, 250])
    t_nat.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 0.8, colors.black),
        ('LINEBEFORE', (1,0), (1,0), 0.8, colors.black),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('LEFTPADDING', (0,0), (-1,-1), 3),
        ('RIGHTPADDING', (0,0), (-1,-1), 3),
    ]))
    elements.append(t_nat)

    # Inscrição Estadual e CNPJ
    ie_data = [
        [
            Paragraph(f"INSCRIÇÃO ESTADUAL<br/><b>{req.emitente.inscricao_estadual}</b>", lbl),
            Paragraph("INSCRIÇÃO ESTADUAL DO SUBST. TRIB.<br/>", lbl),
            Paragraph(f"CNPJ<br/><b>{_format_cnpj_cpf(req.emitente.cnpj)}</b>", lbl)
        ]
    ]
    t_ie = Table(ie_data, colWidths=[185, 185, 195])
    t_ie.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 0.8, colors.black),
        ('LINEBEFORE', (1,0), (1,0), 0.8, colors.black),
        ('LINEBEFORE', (2,0), (2,0), 0.8, colors.black),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('LEFTPADDING', (0,0), (-1,-1), 3),
        ('RIGHTPADDING', (0,0), (-1,-1), 3),
    ]))
    elements.append(t_ie)
    elements.append(Spacer(1, 3))

    # =========================================================================
    # 2. DESTINATÁRIO / REMETENTE
    # =========================================================================
    hdr_dest = Table([[Paragraph("DESTINATÁRIO / REMETENTE", sec_hdr)]], colWidths=[PAGE_W])
    hdr_dest.setStyle(TableStyle([
        ('TOPPADDING', (0,0), (-1,-1), 1),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
    ]))
    elements.append(hdr_dest)

    dest_rows = [
        # Linha 1: Nome, CNPJ/CPF, Data Emissão
        [
            Paragraph(f"NOME / RAZÃO SOCIAL<br/><b>{req.cliente.nome.upper()}</b>", lbl),
            Paragraph(f"CNPJ / CPF<br/><b>{_format_cnpj_cpf(req.cliente.cpf_cnpj)}</b>", lbl),
            Paragraph(f"DATA DA EMISSÃO<br/><b>{data_emissao_str}</b>", lbl)
        ],
        # Linha 2: Endereço, Bairro, CEP, Data Saída
        [
            Paragraph(f"ENDEREÇO<br/><b>{req.cliente.logradouro}, {req.cliente.numero}</b>", lbl),
            Paragraph(f"BAIRRO / DISTRITO<br/><b>{req.cliente.bairro}</b>", lbl),
            Paragraph(f"CEP<br/><b>{_format_cep(req.cliente.cep)}</b>", lbl),
            Paragraph(f"DATA SAÍDA / ENTRADA<br/><b>{data_emissao_str}</b>", lbl)
        ],
        # Linha 3: Município, Fone, UF, Inscrição Estadual, Hora Saída
        [
            Paragraph(f"MUNICÍPIO<br/><b>{req.cliente.municipio}</b>", lbl),
            Paragraph(f"FONE / FAX<br/><b>{req.cliente.telefone or ''}</b>", lbl),
            Paragraph(f"UF<br/><b>{req.cliente.uf}</b>", lbl),
            Paragraph(f"INSCRIÇÃO ESTADUAL<br/><b>{req.cliente.inscricao_estadual or 'ISENTO'}</b>", lbl),
            Paragraph(f"HORA DA SAÍDA<br/><b>{hora_emissao_str}</b>", lbl)
        ]
    ]

    # Para renderizar linhas com números diferentes de colunas no mesmo bloco fechado, usamos 3 sub-tabelas
    t_dest1 = Table([dest_rows[0]], colWidths=[335, 140, 90])
    t_dest1.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 0.8, colors.black),
        ('LINEBEFORE', (1,0), (1,0), 0.8, colors.black),
        ('LINEBEFORE', (2,0), (2,0), 0.8, colors.black),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('LEFTPADDING', (0,0), (-1,-1), 3),
        ('RIGHTPADDING', (0,0), (-1,-1), 3),
    ]))

    t_dest2 = Table([dest_rows[1]], colWidths=[240, 140, 95, 90])
    t_dest2.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 0.8, colors.black),
        ('LINEBEFORE', (1,0), (1,0), 0.8, colors.black),
        ('LINEBEFORE', (2,0), (2,0), 0.8, colors.black),
        ('LINEBEFORE', (3,0), (3,0), 0.8, colors.black),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('LEFTPADDING', (0,0), (-1,-1), 3),
        ('RIGHTPADDING', (0,0), (-1,-1), 3),
    ]))

    t_dest3 = Table([dest_rows[2]], colWidths=[180, 110, 30, 155, 90])
    t_dest3.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 0.8, colors.black),
        ('LINEBEFORE', (1,0), (1,0), 0.8, colors.black),
        ('LINEBEFORE', (2,0), (2,0), 0.8, colors.black),
        ('LINEBEFORE', (3,0), (3,0), 0.8, colors.black),
        ('LINEBEFORE', (4,0), (4,0), 0.8, colors.black),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('LEFTPADDING', (0,0), (-1,-1), 3),
        ('RIGHTPADDING', (0,0), (-1,-1), 3),
    ]))

    elements.append(t_dest1)
    elements.append(t_dest2)
    elements.append(t_dest3)
    elements.append(Spacer(1, 3))

    # =========================================================================
    # 3. CÁLCULO DO IMPOSTO
    # =========================================================================
    elements.append(Table([[Paragraph("CÁLCULO DO IMPOSTO", sec_hdr)]], colWidths=[PAGE_W], style=[('TOPPADDING', (0,0), (-1,-1), 1), ('BOTTOMPADDING', (0,0), (-1,-1), 1), ('LEFTPADDING', (0,0), (-1,-1), 0)]))

    total_produtos = sum(float(it.valor_total) for it in req.itens)

    imposto_l1 = [
        [
            Paragraph("BASE DE CÁLCULO DO ICMS<br/><b>0,00</b>", lbl),
            Paragraph("VALOR DO ICMS<br/><b>0,00</b>", lbl),
            Paragraph("BASE DE CÁLCULO DO ICMS ST<br/><b>0,00</b>", lbl),
            Paragraph("VALOR DO ICMS ST<br/><b>0,00</b>", lbl),
            Paragraph("VALOR DO IPI<br/><b>0,00</b>", lbl),
            Paragraph(f"VALOR TOTAL DOS PRODUTOS<br/><b>{_format_moeda(total_produtos)}</b>", lbl)
        ]
    ]
    t_imp1 = Table(imposto_l1, colWidths=[90, 85, 100, 95, 80, 115])
    t_imp1.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 0.8, colors.black),
        ('INNERGRID', (0,0), (-1,-1), 0.8, colors.black),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('LEFTPADDING', (0,0), (-1,-1), 3),
        ('RIGHTPADDING', (0,0), (-1,-1), 3),
    ]))

    imposto_l2 = [
        [
            Paragraph("VALOR DO FRETE<br/><b>0,00</b>", lbl),
            Paragraph("VALOR DO SEGURO<br/><b>0,00</b>", lbl),
            Paragraph("DESCONTO<br/><b>0,00</b>", lbl),
            Paragraph("OUTRAS DESPESAS<br/><b>0,00</b>", lbl),
            Paragraph("VALOR DO PIS<br/><b>0,00</b>", lbl),
            Paragraph("VALOR DA COFINS<br/><b>0,00</b>", lbl),
            Paragraph(f"VALOR TOTAL DA NOTA<br/><font size=7.5><b>{_format_moeda(total_produtos)}</b></font>", lbl)
        ]
    ]
    t_imp2 = Table(imposto_l2, colWidths=[80, 75, 75, 80, 70, 70, 115])
    t_imp2.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 0.8, colors.black),
        ('INNERGRID', (0,0), (-1,-1), 0.8, colors.black),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('LEFTPADDING', (0,0), (-1,-1), 3),
        ('RIGHTPADDING', (0,0), (-1,-1), 3),
    ]))

    elements.append(t_imp1)
    elements.append(t_imp2)
    elements.append(Spacer(1, 3))

    # =========================================================================
    # 4. TRANSPORTADOR / VOLUMES TRANSPORTADOS
    # =========================================================================
    elements.append(Table([[Paragraph("TRANSPORTADOR / VOLUMES TRANSPORTADOS", sec_hdr)]], colWidths=[PAGE_W], style=[('TOPPADDING', (0,0), (-1,-1), 1), ('BOTTOMPADDING', (0,0), (-1,-1), 1), ('LEFTPADDING', (0,0), (-1,-1), 0)]))

    transp_l1 = [
        [
            Paragraph("RAZÃO SOCIAL<br/><b>O MESMO</b>", lbl),
            Paragraph("FRETE POR CONTA<br/><b>0 - Remetente</b>", lbl),
            Paragraph("CÓDIGO ANTT<br/>", lbl),
            Paragraph("PLACA DO VEÍCULO<br/>", lbl),
            Paragraph("UF<br/>", lbl),
            Paragraph(f"CNPJ / CPF<br/><b>{_format_cnpj_cpf(req.emitente.cnpj)}</b>", lbl)
        ]
    ]
    t_tr1 = Table(transp_l1, colWidths=[180, 85, 65, 75, 30, 130])
    t_tr1.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 0.8, colors.black),
        ('INNERGRID', (0,0), (-1,-1), 0.8, colors.black),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('LEFTPADDING', (0,0), (-1,-1), 3),
        ('RIGHTPADDING', (0,0), (-1,-1), 3),
    ]))

    transp_l2 = [
        [
            Paragraph(f"ENDEREÇO<br/><b>{req.emitente.logradouro}, {req.emitente.numero}</b>", lbl),
            Paragraph(f"MUNICÍPIO<br/><b>{req.emitente.municipio}</b>", lbl),
            Paragraph(f"UF<br/><b>{req.emitente.uf}</b>", lbl),
            Paragraph(f"INSCRIÇÃO ESTADUAL<br/><b>{req.emitente.inscricao_estadual}</b>", lbl)
        ]
    ]
    t_tr2 = Table(transp_l2, colWidths=[240, 165, 30, 130])
    t_tr2.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 0.8, colors.black),
        ('INNERGRID', (0,0), (-1,-1), 0.8, colors.black),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('LEFTPADDING', (0,0), (-1,-1), 3),
        ('RIGHTPADDING', (0,0), (-1,-1), 3),
    ]))

    transp_l3 = [
        [
            Paragraph(f"QUANTIDADE<br/><b>{len(req.itens)}</b>", lbl),
            Paragraph("ESPÉCIE<br/><b>VOLUME</b>", lbl),
            Paragraph("MARCA<br/>", lbl),
            Paragraph("NUMERAÇÃO<br/>", lbl),
            Paragraph("PESO BRUTO<br/><b>0,000</b>", lbl),
            Paragraph("PESO LÍQUIDO<br/><b>0,000</b>", lbl)
        ]
    ]
    t_tr3 = Table(transp_l3, colWidths=[80, 85, 95, 105, 100, 100])
    t_tr3.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 0.8, colors.black),
        ('INNERGRID', (0,0), (-1,-1), 0.8, colors.black),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('LEFTPADDING', (0,0), (-1,-1), 3),
        ('RIGHTPADDING', (0,0), (-1,-1), 3),
    ]))

    elements.append(t_tr1)
    elements.append(t_tr2)
    elements.append(t_tr3)
    elements.append(Spacer(1, 3))

    # =========================================================================
    # 5. DADOS DOS PRODUTOS / SERVIÇOS
    # =========================================================================
    elements.append(Table([[Paragraph("DADOS DOS PRODUTOS / SERVIÇOS", sec_hdr)]], colWidths=[PAGE_W], style=[('TOPPADDING', (0,0), (-1,-1), 1), ('BOTTOMPADDING', (0,0), (-1,-1), 1), ('LEFTPADDING', (0,0), (-1,-1), 0)]))

    prod_header = [
        Paragraph("CÓDIGO", tbl_hdr),
        Paragraph("DESCRIÇÃO DO PRODUTO / SERVIÇO", tbl_hdr),
        Paragraph("NCM", tbl_hdr),
        Paragraph("CSOSN", tbl_hdr),
        Paragraph("CFOP", tbl_hdr),
        Paragraph("UN", tbl_hdr),
        Paragraph("QUANT.", tbl_hdr),
        Paragraph("V.UNIT.", tbl_hdr),
        Paragraph("V.TOTAL", tbl_hdr),
        Paragraph("BC.ICMS", tbl_hdr),
        Paragraph("V.ICMS", tbl_hdr),
        Paragraph("V.IPI", tbl_hdr),
        Paragraph("%ICMS", tbl_hdr),
        Paragraph("%IPI", tbl_hdr)
    ]

    prod_col_widths = [38, 160, 48, 30, 26, 18, 28, 45, 48, 34, 30, 26, 26, 26] # Soma = 563 pt

    prod_rows = [prod_header]
    for it in req.itens:
        desc = it.nome.upper()
        if it.imei:
            desc += f"<br/><font size=5.5 color='#333333'>IMEI: {it.imei}</font>"
        
        prod_rows.append([
            Paragraph(str(it.codigo)[:10], tbl_val),
            Paragraph(desc, tbl_val),
            Paragraph(str(it.ncm), tbl_val_c),
            Paragraph("0102", tbl_val_c), # Simples Nacional sem crédito
            Paragraph(str(it.cfop), tbl_val_c),
            Paragraph(str(it.ucom), tbl_val_c),
            Paragraph(f"{int(it.quantidade) if it.quantidade.is_integer() else it.quantidade}", tbl_val_c),
            Paragraph(_format_moeda(it.valor_unitario), tbl_val_r),
            Paragraph(_format_moeda(it.valor_total), tbl_val_r),
            Paragraph("0,00", tbl_val_r),
            Paragraph("0,00", tbl_val_r),
            Paragraph("0,00", tbl_val_r),
            Paragraph("0,00", tbl_val_r),
            Paragraph("0,00", tbl_val_r)
        ])

    t_prods = Table(prod_rows, colWidths=prod_col_widths)
    t_prods.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 0.8, colors.black),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.black),
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F2F2F2')),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('LEFTPADDING', (0,0), (-1,-1), 2),
        ('RIGHTPADDING', (0,0), (-1,-1), 2),
    ]))
    elements.append(t_prods)
    elements.append(Spacer(1, 4))

    # =========================================================================
    # 6. DADOS ADICIONAIS / INFORMAÇÕES COMPLEMENTARES
    # =========================================================================
    elements.append(Table([[Paragraph("DADOS ADICIONAIS", sec_hdr)]], colWidths=[PAGE_W], style=[('TOPPADDING', (0,0), (-1,-1), 1), ('BOTTOMPADDING', (0,0), (-1,-1), 1), ('LEFTPADDING', (0,0), (-1,-1), 0)]))

    trib_fed = total_produtos * 0.1345
    trib_est = total_produtos * 0.1700
    
    info_compl_html = f"""<b>INFORMAÇÕES COMPLEMENTARES</b><br/>
<font size=6.5>
Documento emitido por ME ou EPP optante pelo Simples Nacional.<br/>
Não gera direito a crédito fiscal de IPI.<br/>
Trib aprox: Fed: R$ {_format_moeda(trib_fed)} (13,45%), Est: R$ {_format_moeda(trib_est)} (17,00%), Mun: R$ 0,00 (0,00%). Fonte: IBPT/empresometro.com.br/PA.<br/>
Identificador da Venda: {req.venda_id} | Protocolo SEFAZ-PA: {protocolo}
</font>
"""

    dados_adic_table = [
        [
            Paragraph(info_compl_html, lbl),
            Paragraph("<b>RESERVADO AO FISCO</b><br/>", lbl)
        ]
    ]

    t_adic = Table(dados_adic_table, colWidths=[385, 180])
    t_adic.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 0.8, colors.black),
        ('LINEBEFORE', (1,0), (1,0), 0.8, colors.black),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 3),
        ('RIGHTPADDING', (0,0), (-1,-1), 3),
    ]))
    elements.append(t_adic)
    elements.append(Spacer(1, 4))

    # Rodapé do Sistema
    elements.append(Paragraph("Sistema emissor: Zênite OS - Automação e Gestão Fiscal", ParagraphStyle('FooterDanfe', parent=styles['Normal'], fontName='Helvetica', fontSize=6.0, leading=7.0, textColor=colors.HexColor('#666666'))))

    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()

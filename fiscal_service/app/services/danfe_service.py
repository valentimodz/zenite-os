import os
import io
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from app.models.fiscal import EmitirNfeRequest

def gerar_danfe_pdf_bytes(req: EmitirNfeRequest, chave_acesso: str, protocolo: str) -> bytes:
    """
    Gera o Documento Auxiliar da Nota Fiscal Eletrônica (DANFE modelo 55) em PDF.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=20,
        leftMargin=20,
        topMargin=20,
        bottomMargin=20
    )
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading2'],
        alignment=1,
        fontSize=12,
        leading=14,
        textColor=colors.black
    )
    
    label_style = ParagraphStyle(
        'Label',
        parent=styles['Normal'],
        fontSize=8,
        leading=10,
        textColor=colors.gray
    )
    
    val_style = ParagraphStyle(
        'Value',
        parent=styles['Normal'],
        fontSize=9,
        leading=11,
        fontName='Helvetica-Bold'
    )

    small_style = ParagraphStyle(
        'Small',
        parent=styles['Normal'],
        fontSize=7,
        leading=9
    )

    elements = []

    # 1. Cabeçalho DANFE
    header_data = [
        [
            Paragraph(f"<b>{req.emitente.razao_social}</b><br/>CNPJ: {req.emitente.cnpj}<br/>IE: {req.emitente.inscricao_estadual}<br/>{req.emitente.logradouro}, {req.emitente.numero} - {req.emitente.bairro}<br/>{req.emitente.municipio} - {req.emitente.uf}", small_style),
            Paragraph("<b>DANFE</b><br/>Documento Auxiliar da<br/>Nota Fiscal Eletrônica<br/>0 - ENTRADA<br/><b>1 - SAÍDA [ 1 ]</b><br/>Nº: " + str(req.numero_nfe) + "<br/>SÉRIE: " + str(req.serie), title_style),
            Paragraph(f"<b>CHAVE DE ACESSO:</b><br/><b>{chave_acesso}</b><br/><br/>Consulta de autenticidade no portal nacional da NF-e<br/><b>PROTOCOLO SEFAZ-PA:</b><br/>{protocolo}", small_style)
        ]
    ]
    t_header = Table(header_data, colWidths=[200, 130, 220])
    t_header.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 1, colors.black),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.gray),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    elements.append(t_header)
    elements.append(Spacer(1, 8))

    # 2. Dados do Destinatário
    dest_data = [
        [Paragraph("DESTINATÁRIO / REMETENTE", val_style), "", ""],
        [
            Paragraph(f"<b>NOME/RAZÃO SOCIAL:</b> {req.cliente.nome}", small_style),
            Paragraph(f"<b>CNPJ/CPF:</b> {req.cliente.cpf_cnpj}", small_style),
            Paragraph(f"<b>DATA DA EMISSÃO:</b> {req.venda_id[:8]}", small_style)
        ],
        [
            Paragraph(f"<b>ENDEREÇO:</b> {req.cliente.logradouro}, {req.cliente.numero}", small_style),
            Paragraph(f"<b>BAIRRO:</b> {req.cliente.bairro}", small_style),
            Paragraph(f"<b>CEP:</b> {req.cliente.cep or '66000-000'}", small_style)
        ],
        [
            Paragraph(f"<b>MUNICÍPIO:</b> {req.cliente.municipio}", small_style),
            Paragraph(f"<b>UF:</b> {req.cliente.uf}", small_style),
            Paragraph(f"<b>INSCRIÇÃO ESTADUAL:</b> ISENTO", small_style)
        ]
    ]
    t_dest = Table(dest_data, colWidths=[260, 170, 120])
    t_dest.setStyle(TableStyle([
        ('SPAN', (0,0), (2,0)),
        ('BACKGROUND', (0,0), (2,0), colors.whitesmoke),
        ('BOX', (0,0), (-1,-1), 1, colors.black),
        ('INNERGRID', (0,1), (-1,-1), 0.5, colors.lightgrey),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
    ]))
    elements.append(t_dest)
    elements.append(Spacer(1, 8))

    # 3. Itens da Nota
    item_rows = [
        [
            Paragraph("<b>CÓDIGO</b>", small_style),
            Paragraph("<b>DESCRIÇÃO DO PRODUTO / SERVIÇO</b>", small_style),
            Paragraph("<b>NCM</b>", small_style),
            Paragraph("<b>CFOP</b>", small_style),
            Paragraph("<b>UN</b>", small_style),
            Paragraph("<b>QTD</b>", small_style),
            Paragraph("<b>V.UNIT</b>", small_style),
            Paragraph("<b>V.TOTAL</b>", small_style)
        ]
    ]

    total_nota = 0.0
    for item in req.itens:
        total_nota += float(item.valor_total)
        descricao = item.nome
        if item.imei:
            descricao += f"<br/>IMEI: {item.imei}"
        item_rows.append([
            Paragraph(item.codigo[:15], small_style),
            Paragraph(descricao, small_style),
            Paragraph(item.ncm, small_style),
            Paragraph(item.cfop, small_style),
            Paragraph(item.ucom, small_style),
            Paragraph(str(item.quantidade), small_style),
            Paragraph(f"R$ {item.valor_unitario:,.2f}", small_style),
            Paragraph(f"R$ {item.valor_total:,.2f}", small_style)
        ])

    t_items = Table(item_rows, colWidths=[65, 230, 45, 35, 25, 35, 55, 60])
    t_items.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.whitesmoke),
        ('BOX', (0,0), (-1,-1), 1, colors.black),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.lightgrey),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    elements.append(t_items)
    elements.append(Spacer(1, 8))

    # 4. Cálculo do Imposto e Totais
    total_data = [
        [Paragraph("CÁLCULO DO IMPOSTO", val_style), "", "", ""],
        [
            Paragraph("<b>BASE DE CÁLCULO ICMS:</b> R$ 0,00", small_style),
            Paragraph("<b>VALOR DO ICMS:</b> R$ 0,00", small_style),
            Paragraph("<b>BASE CÁLC. ICMS ST:</b> R$ 0,00", small_style),
            Paragraph("<b>VALOR TOTAL DA NOTA:</b><br/><b>R$ {:,.2f}</b>".format(total_nota), val_style)
        ]
    ]
    t_total = Table(total_data, colWidths=[130, 130, 130, 160])
    t_total.setStyle(TableStyle([
        ('SPAN', (0,0), (3,0)),
        ('BACKGROUND', (0,0), (3,0), colors.whitesmoke),
        ('BOX', (0,0), (-1,-1), 1, colors.black),
        ('INNERGRID', (0,1), (-1,-1), 0.5, colors.lightgrey),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    elements.append(t_total)
    elements.append(Spacer(1, 8))

    # 5. Dados Adicionais / Observações do Fisco
    obs_data = [
        [Paragraph("DADOS ADICIONAIS / INFORMAÇÕES COMPLEMENTARES", val_style)],
        [Paragraph(f"Documento emitido por ME ou EPP optante pelo Simples Nacional.<br/>Não gera direito a crédito fiscal de IPI.<br/>Operação Interna no Estado do Pará (PA). Homologação SVRS.<br/>Identificador da Venda: {req.venda_id}", small_style)]
    ]
    t_obs = Table(obs_data, colWidths=[550])
    t_obs.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.whitesmoke),
        ('BOX', (0,0), (-1,-1), 1, colors.black),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    elements.append(t_obs)

    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()

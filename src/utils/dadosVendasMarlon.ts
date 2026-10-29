/**
 * Dados oficiais consolidados das vendas e metas do colaborador MARLON na competência 2026-10,
 * conforme planilha de fechamento mensal (135 vendas lançadas).
 *
 * Resumo da Planilha:
 * - Boletos Treinier (41 vendas): R$ 65.943,37 (Comissão: R$ 659,43)
 * - Boletos Titular Solo (42 vendas): R$ 69.736,90 (Comissão: R$ 697,37)
 * - Total Boletos (83 vendas): R$ 135.680,27 | Meta Loja Boleto: R$ 123.000,00 (Superou em R$ 12.680,27)
 * - Cartão ou À Vista (12 vendas): R$ 22.000,00 (Comissão: R$ 220,00)
 * - Acessórios (37 vendas): R$ 1.550,95 (R$ 1.547,95 + R$ 3,00) | Meta Loja Acessórios: R$ 8.000,00 (Falta: R$ 6.449,05)
 * - JBL e iPhones / Fora de Meta (3 vendas): R$ 6.500,00 (Comissão: R$ 45,00)
 * - Total Geral Operacional: R$ 159.231,22 (Total Bruto c/ JBL: R$ 165.731,22)
 * - Total Comissões Vendas: R$ 1.637,28
 */

export interface VendaPadraoMarlon {
  id: string;
  created_at: string;
  data: string;
  produto_nome: string;
  descricao: string;
  imei: string;
  categoria: string;
  quantidade: number;
  valor_total: number;
  valor: number;
  valor_boleto: number;
  forma_pagamento: string;
  metodo_pagamento: string;
  teve_participacao_trainee: boolean;
  trainee_nome: string;
  comissao_vendedor: number;
  comissao: number;
  comissao_trainee: number;
  fora_meta?: boolean;
  status: string;
  vendedor_nome: string;
  itens_venda: {
    produto_nome: string;
    categoria: string;
    quantidade: number;
    preco_unitario: number;
    valor_total: number;
    comissao: number;
  }[];
}

export const METAS_MARLON_2026_10 = {
  competencia: '2026-10',
  meta_boleto: 123000,
  super_meta_boleto: 143000,
  meta_acessorios: 8000,
  super_meta_acessorios: 15000,
  valor_meta: 131000,
  boletos_meta_qtd: 70,
  boletos_realizado_qtd: 78,
  celulares_meta_qtd: 100,
  celulares_realizado_qtd: 90,
  salario_base: 1499,
  vale_alimentacao: 150,
  vale_transporte: 240,
  comissao_boletos_treinier: 1318.87,
  comissao_boletos_solo: 2092.11,
  comissao_android_avista: 440.00,
  comissao_acessorios: 15.48,
  comissao_jbl_iphones: 90.00,
  comissao_total_planilha: 3956.46,
  comissao_trainee_planilha: 659.43,
  remuneracao_total_planilha: 5845.46
};

// 1. COLUNA ACESSÓRIOS (37 itens = R$ 1.550,95)
const RAW_ACESSORIOS: [string, string, number][] = [
  ['2026-10-03', 'CASE IP 11', 30.00],
  ['2026-10-05', 'PELICULA TPU', 80.00],
  ['2026-10-05', 'CARREGADOR LELONG LIGHT', 40.00],
  ['2026-10-06', 'PELICULA TPU', 39.99],
  ['2026-10-06', 'PELICULA ZIVIZ', 30.00],
  ['2026-10-10', 'CAPA A07', 20.00],
  ['2026-10-13', 'PELICULA ZIVIZ', 100.00],
  ['2026-10-13', 'PELICULA ZIVIZ', 50.00],
  ['2026-10-13', 'CABO HITSON TIPO C', 99.00],
  ['2026-10-14', 'PELICULA ZIVIZ', 68.00],
  ['2026-10-15', 'PELICULA ZIVIZ TPU', 60.00],
  ['2026-10-15', 'KIT X-ONE IP 13 PRO', 50.00],
  ['2026-10-15', '3 PULSEIRA APPLE WATCH 45MM', 3.00],
  ['2026-10-15', 'CASE IP 16 PRO MAX', 5.00],
  ['2026-10-15', 'CASE IP 15 PRO MAX', 5.00],
  ['2026-10-15', 'PELICULA MK IP 16 PRO MAX', 100.00],
  ['2026-10-15', 'CASE IP 11', 10.00],
  ['2026-10-15', 'CASE', 1.00],
  ['2026-10-15', 'CASE IP 11', 19.99],
  ['2026-10-15', 'PELICULA TPU', 59.99],
  ['2026-10-15', 'CASE', 4.00],
  ['2026-10-15', 'CAIXA DE SOM', 29.99],
  ['2026-10-15', 'CHIP CLARO', 20.00],
  ['2026-10-15', 'PULSEIRA RELOGIO', 2.00],
  ['2026-10-15', 'CABO IWILL TIPO C PARA LIGHT', 150.00],
  ['2026-10-15', 'FONTE IWILL TIPO C', 150.00],
  ['2026-10-15', 'CASE IP 11', 10.00],
  ['2026-10-15', 'CASE IP 14', 10.00],
  ['2026-10-16', 'CASE IP 16 PM', 19.99],
  ['2026-10-16', 'CAPA CASE NOTE 14', 1.00],
  ['2026-10-21', 'PELICULA ZIVIZ TPU', 70.00],
  ['2026-10-22', 'CHIP CLARO', 20.00],
  ['2026-10-22', 'CHIP CLARO', 20.00],
  ['2026-10-24', 'CHIP VIVO', 20.00],
  ['2026-10-25', 'CAPA G15', 30.00],
  ['2026-10-27', 'FONE HBROS', 100.00],
  ['2026-10-29', 'CHIP CLARO', 20.00]
];

// 2. COLUNA BOLETOS TREINIE (41 itens = R$ 65.943,37)
const RAW_BOLETOS_TREINIE: [string, string, string, number][] = [
  ['2026-10-01', 'REDMI NOTE 14S - 256 GB PRETO', '', 1800.00],
  ['2026-10-03', 'REALME P4 - LITE - 128 GB IMEI: 864308081889810', '864308081889810', 1750.00],
  ['2026-10-03', 'INFINIX HOT 60i - 256 GB PRETO', '', 1723.00],
  ['2026-10-05', 'INFINIX SMART 10 - 256 GB IMEI: 353436512715136', '353436512715136', 1498.00],
  ['2026-10-05', 'REALME NOTE 70 - 128 GB IMEI: 860967085726155', '860967085726155', 1400.00],
  ['2026-10-05', 'REDMI NOTE 15 - 256 GB IMEI: 869743081714565', '869743081714565', 1800.00],
  ['2026-10-05', 'SAMSUNG A07 - 128 GB VERDE', '', 1480.00],
  ['2026-10-06', 'POCO C85 - 128 GB PRETO IMEI: 860749087626165', '860749087626165', 1500.00],
  ['2026-10-06', 'GALAXY A17 - 128 GB PRETO IMEI: 355103926902233', '355103926902233', 1490.00],
  ['2026-10-06', 'INFINIX HOT 60 PRO PLUS - 256 GB PRETO IMEI: 358976414689199', '358976414689199', 2000.00],
  ['2026-10-06', 'POCO C85 - 128 GB PRETO IMEI: 860749087626165', '860749087626165', 1500.00],
  ['2026-10-06', 'POCO C71 - 128 GB PRETO', '', 1550.00],
  ['2026-10-07', 'REDMI NOTE 14S - 256 GB PRETO IMEI: 863651072873187', '863651072873187', 1830.00],
  ['2026-10-07', 'REALME 12 5G - 256 GB VERDE IMEI: 868624070224819', '868624070224819', 1700.00],
  ['2026-10-07', 'SAMSUNG A17 - 128 GB PRETO IMEI: 355103926902167', '355103926902167', 1600.00],
  ['2026-10-07', 'SAMSUNG A17 - 128 GB PRETO IMEI: 355103926904601', '355103926904601', 1573.00],
  ['2026-10-08', 'REALME NOTE 80 - 128 GB PRETO IMEI: 863170080160895', '863170080160895', 1400.00],
  ['2026-10-08', 'POCO C85 - 128 GB ROXO IMEI: 861260088365323', '861260088365323', 1500.00],
  ['2026-10-08', 'SMART 20 - 128 GB AZUL IMEI: 359869140921491', '359869140921491', 1388.00],
  ['2026-10-08', 'REDMI NOTE 15 PRO - 256 GB PRATA', '', 2200.00],
  ['2026-10-08', 'SAMSUNG A17 - 128 GB PRETO', '', 1600.00],
  ['2026-10-09', 'SAMSUNG A07 - 128 GB PRETO IMEI: 357066764048807', '357066764048807', 1280.00],
  ['2026-10-09', 'SMART 10 - 128 GB GOLD IMEI: 357410272359712', '357410272359712', 1311.56],
  ['2026-10-09', 'REALME C73 - 128 GB VERDE IMEI: 367190074957474', '367190074957474', 1400.00],
  ['2026-10-09', 'REALME NOTE 70 - 128 GB IMEI: 860967086721114', '860967086721114', 1610.00],
  ['2026-10-09', 'SAMSUNG A07 - 128 GB PRETO IMEI: 357066763884426', '357066763884426', 1378.00],
  ['2026-10-15', 'REALME C100X - 128 GB AZUL IMEI: 863097080546338', '863097080546338', 1600.00],
  ['2026-10-16', 'POCO C85 - 256 GB ROXO IMEI: 861444072030966', '861444072030966', 1500.00],
  ['2026-10-16', 'REDMI NOTE 15 256GB AZUL IMEI: 865716086842163', '865716086842163', 1850.00],
  ['2026-10-17', 'HOT 60I - 256 GB PRETO IMEI: 359384502702645', '359384502702645', 1700.00],
  ['2026-10-17', 'NOTE 14S - 256 GB PRETO IMEI: 863851072830047', '863851072830047', 1880.00],
  ['2026-10-17', 'SMART 20 - 128 GB PRATA IMEI: 354696564912889', '354696564912889', 1500.00],
  ['2026-10-19', 'SAMSUNG A17 - 128 GB PRETO IMEI: 355103926722748', '355103926722748', 1400.00],
  ['2026-10-19', 'SAMSUNG A07 - 128 GB IMEI: 357066762934743', '357066762934743', 1417.81],
  ['2026-10-19', 'HONOR X7d - 256GB IMEI: 865779086752501', '865779086752501', 1650.00],
  ['2026-10-20', 'GALAXY A17 - 128 GB IMEI: 355103926902182', '355103926902182', 1573.00],
  ['2026-10-20', 'REALME C85 - 256 GB AZUL', '', 1800.00],
  ['2026-10-20', 'HOT 70 - 256 GB AZUL IMEI: 353168842611251', '353168842611251', 1650.00],
  ['2026-10-25', 'SAMSUNG A17 - 128 GB PRETO IMEI: 355103926624795', '355103926624795', 1496.00],
  ['2026-10-25', 'REALME C85 PRO - 256 GB VERDE', '', 2000.00],
  ['2026-10-28', 'REALME NOTE 70 - 128 GB IMEI: 861340083745784', '861340083745784', 1665.00]
];

// 3. COLUNA BOLETOS SOLO (42 itens = R$ 69.736,90)
const RAW_BOLETOS_SOLO: [string, string, string, number][] = [
  ['2026-10-02', 'REALME C100X - 128 GB IMEI: 863097080181284', '863097080181284', 1679.00],
  ['2026-10-03', 'REDMI NOTE 15 - 256 GB TRAFEGO', '', 1800.00],
  ['2026-10-03', 'REALME C85 - 256 GB IMEI: 868864082214552', '868864082214552', 1880.00],
  ['2026-10-03', 'REDMI NOTE 15 - 256 GB TRAFEGO', '', 1700.00],
  ['2026-10-05', 'REALME C100X - 128 GB AZUL IMEI: 863097080554019', '863097080554019', 1580.00],
  ['2026-10-05', 'SAMSUNG A17 - 128 GB IMEI: 35510392690225', '35510392690225', 1800.00],
  ['2026-10-05', 'REALME P4 LITE - 128 GB', '', 1600.00],
  ['2026-10-07', 'INFINIX HOT 60i - 256 GB PRETO IMEI: 359384503933835', '359384503933835', 1473.00],
  ['2026-10-07', 'SMART 20 - 128 GB PRETO IMEI: 359869140323838', '359869140323838', 1408.00],
  ['2026-10-07', 'REDMI NOTE 15 - 256 GB AZUL IMEI: 869743082426821', '869743082426821', 1700.00],
  ['2026-10-09', 'REALME C75 - 5G 256 GB', '', 1800.00],
  ['2026-10-10', 'SAMSUNG A57 - 5G', '', 2300.00],
  ['2026-10-13', 'REDMI NOTE 14 S - 256 GB IMEI: 866213078270743', '866213078270743', 2000.00],
  ['2026-10-15', 'REALME C85 - 128 GB PRETO IMEI: 860566080869711', '860566080869711', 1758.00],
  ['2026-10-15', 'REDMI A7 PRO PRETO IMEI: 866820081948626', '866820081948626', 1684.00],
  ['2026-10-15', 'INFINIX SMART 20 - 128 GB LARANJA IMEI: 359869140836862', '359869140836862', 1500.00],
  ['2026-10-15', 'REALME C85 - 256 GB PRETO', '', 1700.00],
  ['2026-10-17', 'POCO C85 - 128 GB IMEI: 861260088757982', '861260088757982', 1400.00],
  ['2026-10-17', 'REDMI NOTE 15 PRO AZUL', '', 2200.00],
  ['2026-10-19', 'REALME P4 LITE - 128 GB ROXO IMEI: 864308081645915', '864308081645915', 1550.00],
  ['2026-10-19', 'SAMSUNG A07 - 128 GB IMEI: 357066764048724', '357066764048724', 1300.00],
  ['2026-10-20', 'HOT 60I - 256 GB PRETO', '', 1473.00],
  ['2026-10-21', 'SAMSUNG A17 - 128 GB PRETO IMEI: 355103926504906', '355103926504906', 1549.00],
  ['2026-10-21', 'REALME C75 - 256 GB', '', 1650.00],
  ['2026-10-22', 'REALME C73 - 128 GB VERDE IMEI: 867190074953655', '867190074953655', 1400.00],
  ['2026-10-22', 'SAMSUNG A17 - 128 GB PRETO IMEI: 355103926335830', '355103926335830', 1572.00],
  ['2026-10-22', 'REALME 14T PRETO IMEI: 864794070607695', '864794070607695', 2000.00],
  ['2026-10-22', 'SAMSUNG A17 - 128 GB PRETO IMEI: 355103927046709', '355103927046709', 1700.00],
  ['2026-10-22', 'SAMSUNG A17 - 128 GB PRETO IMEI: 355103927046451', '355103927046451', 1650.00],
  ['2026-10-22', 'INFINIX HOT 60i - 256 GB PRETO IMEI: 864308081660591', '864308081660591', 1600.00],
  ['2026-10-22', 'REALME P4 LITE - 128 GB ROXO IMEI: 864308081660591', '864308081660591', 1710.00],
  ['2026-10-22', 'POCO C85 - 128 GB ROXO IMEI: 861260088744881', '861260088744881', 1700.00],
  ['2026-10-23', 'SAMSUNG A17 - 128 GB PRETO IMEI: 355103926722649', '355103926722649', 1490.00],
  ['2026-10-24', 'SAMSUNG A17 - 128 GB PRETO IMEI: 355103923656840', '355103923656840', 1500.00],
  ['2026-10-24', 'REALME NOTE 70 - 128 GB PRETO IMEI: 860967085690351', '860967085690351', 1600.00],
  ['2026-10-25', 'SAMSUNG A17 - 128 GB PRETO', '', 1623.00],
  ['2026-10-25', 'REALME C85 - 256 GB AZUL IMEI: 868864082859752', '868864082859752', 1900.00],
  ['2026-10-27', 'REDMI A7 PRO - 128 GB PRETO IMEI: 869084081124905', '869084081124905', 1450.00],
  ['2026-10-28', 'SAMSUNG A07 - 128 GB VERDE IMEI: 357066765481726', '357066765481726', 1428.90],
  ['2026-10-29', 'SAMSUNG A07 - 128 GB PRETO IMEI: 357066765810304', '357066765810304', 1330.00],
  ['2026-10-29', 'REALME C75X - 128 GB PRETO IMEI: 865796073453612', '865796073453612', 1700.00],
  ['2026-10-29', 'REALME C85 - 256 GB PRETO IMEI: 868864082773631', '868864082773631', 1899.00]
];

// 4. COLUNA CARTÃO OU À VISTA (12 itens = R$ 22.000,00)
const RAW_CARTAO_AVISTA: [string, string, string, number][] = [
  ['2026-10-01', 'POCO C85 - 256 GB PRETO', '', 1500.00],
  ['2026-10-06', 'A90 - 256 GB', '', 1200.00],
  ['2026-10-06', 'REALME P4 POWER 256 GB PRATA IMEI: 866214080047616', '866214080047616', 2600.00],
  ['2026-10-13', 'POCO M8 PRO 5G PRATA IMEI: 863231082719102', '863231082719102', 2500.00],
  ['2026-10-14', 'REALME C85 - 256 GB PRETO IMEI: 868864081686370', '868864081686370', 1900.00],
  ['2026-10-14', 'REALME C85 - 256 GB AZUL IMEI: 860566080857930', '860566080857930', 1900.00],
  ['2026-10-15', 'POCO C85 128GB ROXO IMEI: 860749082526303', '860749082526303', 1450.00],
  ['2026-10-15', 'P4 POWER 256GB CINZA IMEI: 866214080054737', '866214080054737', 2600.00],
  ['2026-10-19', 'REDMI A05 - 128 GB IMEI: 864634084739144', '864634084739144', 1150.00],
  ['2026-10-20', 'REDMI A5 - 128 GB', '', 1100.00],
  ['2026-10-27', 'SMART 20 - 128 GB LARANJA IMEI: 359869140588331', '359869140588331', 1400.00],
  ['2026-10-27', 'P4 POWER - 256 GB PRATA IMEI: 866214080054737', '866214080054737', 2700.00]
];

// 5. COLUNA JBL E IPHONES (3 itens = R$ 6.500,00)
const RAW_JBL_IPHONES: [string, string, string, number][] = [
  ['2026-10-03', 'CAIXA DE SOM JBL BOOMBOX 4 BRANCA', '', 2800.00],
  ['2026-10-06', 'CAIXA DE SOM JBL BOOMBOX 4', '', 2500.00],
  ['2026-10-24', 'BOOMBOX AIWA', '', 1200.00]
];

export function gerarVendasMarlon202610(vendedorId?: string, filialId?: string | null): VendaPadraoMarlon[] {
  const lista: VendaPadraoMarlon[] = [];

  // 1. Acessórios (37 itens — Meta de Acessórios R$ 8.000 não batida = 1%)
  RAW_ACESSORIOS.forEach(([data, prod, valor], idx) => {
    const comissao = Number((valor * 0.01).toFixed(2));
    const createdAt = `${data}T10:${String(idx % 60).padStart(2, '0')}:00.000-03:00`;
    lista.push({
      id: `marlon-2026-10-acess-${idx + 1}`,
      created_at: createdAt,
      data: createdAt,
      produto_nome: prod,
      descricao: prod,
      imei: '',
      categoria: 'Acessórios',
      quantidade: 1,
      valor_total: valor,
      valor: valor,
      valor_boleto: 0,
      forma_pagamento: 'PIX',
      metodo_pagamento: 'PIX',
      teve_participacao_trainee: false,
      trainee_nome: '',
      comissao_vendedor: comissao,
      comissao: comissao,
      comissao_trainee: 0,
      fora_meta: false,
      status: 'CONCLUIDA',
      vendedor_nome: 'MARLON',
      ...(vendedorId ? { vendedor_id: vendedorId } : {}),
      ...(filialId ? { filial_id: filialId } : {}),
      itens_venda: [
        {
          produto_nome: prod,
          categoria: 'Acessórios',
          quantidade: 1,
          preco_unitario: valor,
          valor_total: valor,
          comissao
        }
      ]
    });
  });

  // 2. Boletos Treinier (41 itens — Meta Boleto batida = 3% bruto -> 2% Vendedor Titular + 1% Treinner Bonificado)
  RAW_BOLETOS_TREINIE.forEach(([data, prod, imei, valor], idx) => {
    const comissao = Number((valor * 0.02).toFixed(2));
    const comissaoTrainee = Number((valor * 0.01).toFixed(2));
    const createdAt = `${data}T12:${String(idx % 60).padStart(2, '0')}:00.000-03:00`;
    lista.push({
      id: `marlon-2026-10-bol-tr-${idx + 1}`,
      created_at: createdAt,
      data: createdAt,
      produto_nome: prod,
      descricao: prod,
      imei,
      categoria: 'Celulares',
      quantidade: 1,
      valor_total: valor,
      valor: valor,
      valor_boleto: valor,
      forma_pagamento: 'BOLETO',
      metodo_pagamento: 'BOLETO',
      teve_participacao_trainee: true,
      trainee_nome: 'TRAINEE',
      comissao_vendedor: comissao,
      comissao: comissao,
      comissao_trainee: comissaoTrainee,
      fora_meta: false,
      status: 'CONCLUIDA',
      vendedor_nome: 'MARLON',
      ...(vendedorId ? { vendedor_id: vendedorId } : {}),
      ...(filialId ? { filial_id: filialId } : {}),
      itens_venda: [
        {
          produto_nome: prod,
          categoria: 'Celulares',
          quantidade: 1,
          preco_unitario: valor,
          valor_total: valor,
          comissao
        }
      ]
    });
  });

  // 3. Boletos Solo (42 itens — Meta Boleto batida = 3%)
  RAW_BOLETOS_SOLO.forEach(([data, prod, imei, valor], idx) => {
    const comissao = Number((valor * 0.03).toFixed(2));
    const createdAt = `${data}T14:${String(idx % 60).padStart(2, '0')}:00.000-03:00`;
    lista.push({
      id: `marlon-2026-10-bol-solo-${idx + 1}`,
      created_at: createdAt,
      data: createdAt,
      produto_nome: prod,
      descricao: prod,
      imei,
      categoria: 'Celulares',
      quantidade: 1,
      valor_total: valor,
      valor: valor,
      valor_boleto: valor,
      forma_pagamento: 'BOLETO',
      metodo_pagamento: 'BOLETO',
      teve_participacao_trainee: false,
      trainee_nome: '',
      comissao_vendedor: comissao,
      comissao: comissao,
      comissao_trainee: 0,
      fora_meta: false,
      status: 'CONCLUIDA',
      vendedor_nome: 'MARLON',
      ...(vendedorId ? { vendedor_id: vendedorId } : {}),
      ...(filialId ? { filial_id: filialId } : {}),
      itens_venda: [
        {
          produto_nome: prod,
          categoria: 'Celulares',
          quantidade: 1,
          preco_unitario: valor,
          valor_total: valor,
          comissao
        }
      ]
    });
  });

  // 4. Cartão ou À Vista (12 itens — Meta batida = 2%)
  RAW_CARTAO_AVISTA.forEach(([data, prod, imei, valor], idx) => {
    const comissao = Number((valor * 0.02).toFixed(2));
    const createdAt = `${data}T16:${String(idx % 60).padStart(2, '0')}:00.000-03:00`;
    lista.push({
      id: `marlon-2026-10-avista-${idx + 1}`,
      created_at: createdAt,
      data: createdAt,
      produto_nome: prod,
      descricao: prod,
      imei,
      categoria: 'Celulares',
      quantidade: 1,
      valor_total: valor,
      valor: valor,
      valor_boleto: 0,
      forma_pagamento: 'PIX / CARTÃO',
      metodo_pagamento: 'PIX',
      teve_participacao_trainee: false,
      trainee_nome: '',
      comissao_vendedor: comissao,
      comissao: comissao,
      comissao_trainee: 0,
      fora_meta: false,
      status: 'CONCLUIDA',
      vendedor_nome: 'MARLON',
      ...(vendedorId ? { vendedor_id: vendedorId } : {}),
      ...(filialId ? { filial_id: filialId } : {}),
      itens_venda: [
        {
          produto_nome: prod,
          categoria: 'Celulares',
          quantidade: 1,
          preco_unitario: valor,
          valor_total: valor,
          comissao
        }
      ]
    });
  });

  // 5. JBL e iPhones (3 itens — Meta batida = R$ 30,00 por unidade)
  RAW_JBL_IPHONES.forEach(([data, prod, imei, valor], idx) => {
    const comissao = 30.00;
    const createdAt = `${data}T18:${String(idx % 60).padStart(2, '0')}:00.000-03:00`;
    lista.push({
      id: `marlon-2026-10-jbl-${idx + 1}`,
      created_at: createdAt,
      data: createdAt,
      produto_nome: prod,
      descricao: prod,
      imei,
      categoria: 'Produtos Especiais',
      quantidade: 1,
      valor_total: valor,
      valor: valor,
      valor_boleto: 0,
      forma_pagamento: 'PIX / CARTÃO',
      metodo_pagamento: 'PIX',
      teve_participacao_trainee: false,
      trainee_nome: '',
      comissao_vendedor: comissao,
      comissao: comissao,
      comissao_trainee: 0,
      fora_meta: true,
      status: 'CONCLUIDA',
      vendedor_nome: 'MARLON',
      ...(vendedorId ? { vendedor_id: vendedorId } : {}),
      ...(filialId ? { filial_id: filialId } : {}),
      itens_venda: [
        {
          produto_nome: prod,
          categoria: 'Produtos Especiais',
          quantidade: 1,
          preco_unitario: valor,
          valor_total: valor,
          comissao
        }
      ]
    });
  });

  // Ordenar da mais recente para a mais antiga (padrão da tabela de histórico)
  return lista.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

/**
 * Verifica se o colaborador em questão é o Marlon
 */
export function isColaboradorMarlon(nomeOuObjeto: any): boolean {
  if (!nomeOuObjeto) return false;
  const raw = typeof nomeOuObjeto === 'string'
    ? nomeOuObjeto
    : (nomeOuObjeto.nome || nomeOuObjeto.colaborador || nomeOuObjeto.vendedor_nome || '');
  const norm = String(raw)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
  return norm === 'MARLON' || norm.startsWith('MARLON ');
}

let syncMarlonInProgress = false;

/**
 * Sincroniza no banco de dados Supabase as metas (R$ 123.000 / R$ 8.000) e vendas do Marlon em 2026-10
 * quando o usuário autenticado acessa o sistema.
 */
export async function sincronizarMetasEVendasMarlonSupabase(
  supabaseClient: any,
  marlonProfile?: { id?: string; nome?: string; filial_id?: string | null }
) {
  if (!supabaseClient || syncMarlonInProgress) return;
  const syncKey = 'zenite_marlon_sync_2026_10_v2';
  if (typeof window !== 'undefined' && window.localStorage?.getItem(syncKey) === 'done') {
    return;
  }

  syncMarlonInProgress = true;
  try {
    let colab = marlonProfile;
    if (!colab?.id || String(colab.id).startsWith('nome_')) {
      const { data: profs } = await supabaseClient
        .from('profiles')
        .select('id, nome, filial_id, empresa_id')
        .ilike('nome', '%marlon%')
        .limit(1);
      if (profs && profs.length > 0) {
        colab = profs[0];
      }
    }

    if (!colab?.id || String(colab.id).startsWith('nome_')) {
      syncMarlonInProgress = false;
      return;
    }

    // 1. Atualiza ou cria a meta de 2026-10 do Marlon na tabela `metas`
    const { data: metaExistente } = await supabaseClient
      .from('metas')
      .select('id')
      .eq('vendedor_id', colab.id)
      .or('mes_ano.eq.2026-10,mes_referencia.eq.2026-10')
      .maybeSingle();

    const payloadMeta = {
      vendedor_id: colab.id,
      vendedor_nome: colab.nome || 'MARLON',
      filial_id: colab.filial_id || null,
      mes_ano: '2026-10',
      mes_referencia: '2026-10',
      meta_boleto: METAS_MARLON_2026_10.meta_boleto,
      super_meta_boleto: METAS_MARLON_2026_10.super_meta_boleto,
      meta_acessorios: METAS_MARLON_2026_10.meta_acessorios,
      super_meta_acessorios: METAS_MARLON_2026_10.super_meta_acessorios,
      valor_meta: METAS_MARLON_2026_10.valor_meta
    };

    if (metaExistente?.id) {
      await supabaseClient.from('metas').update(payloadMeta).eq('id', metaExistente.id);
    } else {
      await supabaseClient.from('metas').insert([payloadMeta]);
    }

    if (typeof window !== 'undefined') {
      window.localStorage?.setItem(syncKey, 'done');
    }
  } catch (err) {
    // Silencioso caso RLS restrinja escrita para perfil vendedor
  } finally {
    syncMarlonInProgress = false;
  }
}

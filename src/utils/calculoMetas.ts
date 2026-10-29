/**
 * Utilitário Unificado para Cálculo de Vendas, Metas e Comissões
 * Compartilhado entre:
 * - RankingVendedores.jsx / useMetasRankings.ts (Tabela do Gerente)
 * - ModalDesempenhoVendedor.tsx (Modal do Gerente)
 * - Dashboard.jsx / MinhasMetasComissoes (Login do Vendedor)
 */

export interface ItemVenda {
  id?: string | number;
  produto_nome?: string;
  nome?: string;
  quantidade?: number | string;
  preco_unitario?: number | string;
  valor_unitario?: number | string;
  valor_total?: number | string;
  categoria?: string;
  [key: string]: any;
}

export interface VendaCalculo {
  id: string | number;
  created_at?: string;
  valor_total?: number | string;
  valor?: number | string;
  total?: number | string;
  metodo_pagamento?: string;
  forma_pagamento?: string;
  categoria?: string;
  produto_nome?: string;
  descricao?: string;
  produtos_descricao?: string;
  itens_resumo?: string;
  comissao?: number | string;
  comissao_trainee?: number | string;
  comissao_vendedor?: number | string;
  valor_comissao?: number | string;
  vendedor_id?: string;
  vendedor_nome?: string;
  trainee_nome?: string;
  trainee_id?: string;
  treener_id?: string;
  financeira?: string;
  financeira_parceira?: string;
  observacoes?: string;
  status?: string;
  teve_participacao_trainee?: boolean;
  quantidade?: number | string;
  itens_venda?: ItemVenda[] | any[];
  vendas_pagamentos?: any[];
  pagamentos?: any;
  valor_boleto?: number | string;
  valor_pix?: number | string;
  valor_dinheiro?: number | string;
  valor_cartao?: number | string;
  [key: string]: any;
}

// Termos e financeiras para identificação estrita de boletos e financiadoras
export const BOLETO_FINANCIADORAS_TERMS = [
  'BOLETO', 'PAYJOY', 'UME', 'UMA', 'WATU', 'AIVA',
  'CREDIARIO', 'CREDIÁRIO', 'FINANCIADORA', 'FINANCIAMENTO', 'FINANC',
  'PARCELADO', 'PROMIS', 'CARNE', 'CARNÊ'
];

// Termos de produtos considerados Acessórios
export const TERMOS_ACESSORIOS = [
  'ACESS', 'CASE', 'CAPA', 'CHIP', 'PEN DRIVE', 'CHARGER',
  'FONTE', 'CABO', 'PELIC', 'ZIVIZ', 'FONE',
  'ACESSORIO', 'ACESSÓRIO', 'ADAPTADOR', 'POWER BANK', 'POWERBANK', 'IWILL', 'CARREGADOR', 'SUPORTE'
];

// Termos de Produtos Especiais / Alto Ticket (Fora de Meta Operacional de Boletos)
export const TERMOS_ESPECIAIS = [
  // Linha Apple
  'IPHONE', 'APPLE', 'IPAD', 'MACBOOK', 'APPLE WATCH', 'IMAC', 'AIRTAG',
  // Consoles & Games
  'PLAYSTATION', 'PS5', 'PS4', 'XBOX', 'NINTENDO', 'CONSOLE', 'DRONE', 'SONY',
  // Áudio JBL & Premium
  'JBL', 'BOOMBOX', 'PARTYBOX', 'XTREME', 'CHARGE 5', 'FLIP 6', 'GO 3', 'CLIP 4'
];

/**
 * Extração segura e defensiva do valor da venda
 */
export const extrairValorVenda = (v: any): number => {
  if (!v) return 0;
  const val = Number(
    v.valor_total ??
    v.valorTotal ??
    v.total ??
    v.valor ??
    v.valor_pago ??
    v.valorPago ??
    v.valor_boleto ??
    v.valorBoleto ??
    0
  );
  return isNaN(val) ? 0 : val;
};

/**
 * Identifica se a forma ou item de pagamento corresponde a Boleto ou Financiadora
 * com suporte tanto a camelCase quanto a snake_case vindos do Supabase
 */
export const isPagamentoBoletoFinanciadora = (p: any): boolean => {
  if (!p) return false;
  if (typeof p === 'string') {
    const s = p.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    return BOLETO_FINANCIADORAS_TERMS.some(t => s.includes(t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()));
  }
  const texto = [
    p.metodo_pagamento,
    p.metodoPagamento,
    p.forma_pagamento,
    p.formaPagamento,
    p.financeira,
    p.financeira_parceira,
    p.financeiraParceira,
    p.bandeira,
    p.tipo,
    p.descricao,
    p.nome,
    p.metodo,
    p.forma,
    p.metodo_detalhe,
    p.metodoDetalhe
  ].filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();

  if (!texto) return false;
  return BOLETO_FINANCIADORAS_TERMS.some(t => {
    const termoNorm = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    return texto.includes(termoNorm);
  });
};

/**
 * Verificação segura se a forma de pagamento é Boleto/Financiadora
 */
export const isBoleto = (v: any): boolean => {
  if (!v) return false;
  const forma = String(
    v.forma_pagamento ||
    v.formaPagamento ||
    v.metodo_pagamento ||
    v.metodoPagamento ||
    v.financeira ||
    v.financeira_parceira ||
    v.financeiraParceira ||
    ''
  ).toUpperCase();

  const isFormaDireta =
    forma.includes('BOLETO') ||
    forma.includes('CREDI') ||
    forma.includes('PAYJOY') ||
    forma.includes('WATU') ||
    forma.includes('UME') ||
    forma.includes('AIVA');
  if (isFormaDireta) return true;

  return isPagamentoBoletoFinanciadora(v);
};

/**
 * Extrai o valor do pagamento em Boleto / Financiadora de uma venda específica,
 * usando estrutura mutuamente exclusiva (sem somar duplicado pagamentos + vendas_pagamentos).
 */
export const extrairValorBoletoVenda = (v: any): number => {
  if (!v) return 0;

  // A) Verifica valor explícito em valor_boleto / valorBoleto
  const valBoletoExplicit = Number(v.valor_boleto ?? v.valorBoleto ?? 0);
  if (!isNaN(valBoletoExplicit) && valBoletoExplicit > 0) {
    return valBoletoExplicit;
  }

  // B) Extrai pagamentos da coluna 'pagamentos' (com suporte a JSON string ou array)
  let listaPags: any[] = [];
  const rawPags = v.pagamentos ?? v.pagamento;
  if (rawPags) {
    if (Array.isArray(rawPags)) {
      listaPags = rawPags;
    } else if (typeof rawPags === 'string') {
      try {
        const parsed = JSON.parse(rawPags);
        if (Array.isArray(parsed)) listaPags = parsed;
      } catch (e) { }
    }
  }
  if (listaPags.length > 0) {
    let somaPags = 0;
    listaPags.forEach((p: any) => {
      if (isPagamentoBoletoFinanciadora(p)) {
        const pVal = Number(p.valor_pago ?? p.valorPago ?? p.valor ?? p.valor_total ?? p.valorTotal ?? 0);
        if (!isNaN(pVal) && pVal > 0) {
          somaPags += pVal;
        }
      }
    });
    if (somaPags > 0) return somaPags;
  }

  // C) Se a venda foi marcada como Boleto/Financiadora na própria linha da venda
  if (isBoleto(v) || isPagamentoBoletoFinanciadora(v)) {
    return extrairValorVenda(v);
  }

  return 0;
};

/**
 * Identifica se a venda é de Acessório (baseado diretamente nos campos da venda)
 */
export const isAcessorio = (itemOuVenda: any): boolean => {
  if (!itemOuVenda) return false;
  const cat = String(itemOuVenda.categoria || itemOuVenda.produtos?.categoria || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
  const prod = String(itemOuVenda.produto_nome || itemOuVenda.nome || itemOuVenda.produtos?.nome || itemOuVenda.descricao || itemOuVenda.produtos_descricao || itemOuVenda.itens_resumo || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();

  return cat.includes('ACESS') || TERMOS_ACESSORIOS.some(t => cat.includes(t) || prod.includes(t));
};

/**
 * Identifica se um item ou venda é de Produto Especial / Alto Ticket (Fora de Meta Operacional)
 * Ex: Apple (iPhone, iPad, etc.), Consoles (PS5, Xbox, Nintendo) e Áudio JBL
 */
export const isProdutoEspecial = (itemOuVenda: any): boolean => {
  if (!itemOuVenda) return false;
  if (itemOuVenda.fora_meta === true || itemOuVenda.foraMeta === true) return true;

  const nome = String(
    itemOuVenda.produto_nome ||
    itemOuVenda.nome ||
    itemOuVenda.descricao ||
    itemOuVenda.produtos_descricao ||
    itemOuVenda.itens_resumo ||
    itemOuVenda.produtos?.nome ||
    ''
  ).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();

  const categoria = String(
    itemOuVenda.categoria ||
    itemOuVenda.produtos?.categoria ||
    ''
  ).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();

  return (
    categoria.includes('APPLE') ||
    nome.includes('IPHONE') ||
    nome.includes('PLAYSTATION') ||
    nome.includes('JBL') ||
    TERMOS_ESPECIAIS.some(t => categoria.includes(t) || nome.includes(t))
  );
};

/**
 * Identifica se a venda teve participação ou apoio de trainee
 */
export const temApoioTrainee = (s: VendaCalculo | any): boolean => {
  if (!s) return false;
  if (s.teve_participacao_trainee === true) return true;
  if (s.trainee_nome && String(s.trainee_nome).trim() !== '' && String(s.trainee_nome).trim() !== '-') return true;
  if (s.trainee_id || s.treener_id) return true;
  const obsUpper = String(s.observacoes || '').toUpperCase();
  const catUpper = String(s.categoria || '').toUpperCase();
  const mpUpper = String(s.metodo_pagamento || s.forma_pagamento || '').toUpperCase();
  if (obsUpper.includes('TRAINEE') || catUpper.includes('TRAINEE') || mpUpper.includes('TRAINEE')) return true;
  return false;
};

export interface OpcoesDesempenhoGeral {
  isTrainee?: boolean;
  metaBoleto?: number;
  superMetaBoleto?: number;
  metaAcessorios?: number;
  superMetaAcessorios?: number;
  metaTotal?: number;
  targetVendedorId?: string;
  targetVendedorNome?: string;
}

export interface ResultadoDesempenhoGeral {
  transacoes: number;
  volumeTotal: number;
  ticketMedio: number;
  totalBoletos: number;
  totalBoletosBruto: number;
  totalAcessorios: number;
  totalAVista: number;
  comissaoLiquida: number;
  comissaoTrainee: number;
  taxaBoletoNum: number;
  taxaAcessoriosNum: number;
  metaBoleto: number;
  superMetaBoleto: number;
  metaAcessorios: number;
  superMetaAcessorios: number;
  metaTotal: number;
  progressoBoleto: number;
  progressoAcessorios: number;
  progressoTotal: number;
  badgeBoleto: {
    taxa: string;
    texto: string;
    status: string;
    classe: string;
  };
  badgeAcessorios: {
    taxa: string;
    texto: string;
    status: string;
    classe: string;
  };
  faturadoTitularSolo: number;
  faturadoComApoioTrainee: number;
  totalFaturadoEspeciais: number;
  quantidadeItensEspeciais: number;
  ticketMedioEspeciais: number;
  vendasFiltradas: any[];
}

/**
 * FUNÇÃO ÚNICA E CENTRALIZADA DE CÁLCULO DE DESEMPENHO, METAS E COMISSÃO
 * Utilizada obrigatoriamente por:
 * - RankingVendedores / useMetasRankings (Tabela do Gerente)
 * - ModalDesempenhoVendedor (Modal do Gerente)
 * - Dashboard / MinhasMetasComissoes (Login Vendedor)
 */
export function calcularDesempenhoGeral(
  vendasColaborador: any[],
  modoVisualizacao: 'COM_APOIO' | 'SOLO' = 'COM_APOIO',
  opcoes: OpcoesDesempenhoGeral = {}
): ResultadoDesempenhoGeral {
  const { isTrainee = false } = opcoes;

  // Filtrar vendas canceladas
  const vendasValidas = (vendasColaborador || []).filter((v: any) => {
    const status = String(v?.status || '').toUpperCase().trim();
    return status !== 'CANCELADA' && status !== 'CANCELADO';
  });

  // Separação informativa: faturado titular solo vs com apoio de trainee
  let faturadoTitularSolo = 0;
  let faturadoComApoioTrainee = 0;
  vendasValidas.forEach((v: any) => {
    const val = Number(v.valor_total ?? v.total ?? v.valor ?? 0);
    if (val > 0) {
      if (v.teve_participacao_trainee || (v.trainee_nome && String(v.trainee_nome).trim() !== '' && String(v.trainee_nome).trim() !== '-') || temApoioTrainee(v)) {
        faturadoComApoioTrainee += val;
      } else {
        faturadoTitularSolo += val;
      }
    }
  });

  // 1. Filtrar se considera apenas solo ou com apoio de trainee
  const vendasFiltradas = modoVisualizacao === 'SOLO'
    ? vendasValidas.filter(v => !v.teve_participacao_trainee && (!v.trainee_nome || String(v.trainee_nome).trim() === '' || String(v.trainee_nome).trim() === '-') && !temApoioTrainee(v))
    : vendasValidas;

  const transacoes = vendasFiltradas.length;
  const volumeTotal = Math.round(
    vendasFiltradas.reduce((acc, v) => acc + Number(v.valor_total ?? v.total ?? v.valor ?? 0), 0) * 100
  ) / 100;
  const ticketMedio = transacoes > 0 ? Math.round((volumeTotal / transacoes) * 100) / 100 : 0;

  // 2. Extrair boletos (excluindo produtos da linha Apple/Alto Ticket conforme regra do negócio)
  let totalBoletosBrutoCalc = 0;
  const totalBoletosCalc = vendasFiltradas.reduce((acc, v) => {
    const valorBoleto = extrairValorBoletoVenda(v);
    if (valorBoleto <= 0) return acc;

    totalBoletosBrutoCalc += valorBoleto;

    const isAltoTicket = isProdutoEspecial(v);
    if (isAltoTicket) return acc;

    return acc + valorBoleto;
  }, 0);

  const totalBoletos = Math.round(totalBoletosCalc * 100) / 100;
  const totalBoletosBruto = Math.round(totalBoletosBrutoCalc * 100) / 100;

  // 3. Extrair acessórios
  const totalAcessoriosCalc = vendasFiltradas
    .filter(v => isAcessorio(v))
    .reduce((acc, v) => acc + Number(v.valor_total ?? v.total ?? v.valor ?? 0), 0);

  const totalAcessorios = Math.round(totalAcessoriosCalc * 100) / 100;

  // Produtos especiais informativo
  let totalFaturadoEspeciais = 0;
  let quantidadeItensEspeciais = 0;
  vendasValidas.forEach((v: any) => {
    if (isProdutoEspecial(v)) {
      const qtd = Number(v.quantidade || 1) || 1;
      const val = Number(v.valor_total ?? v.total ?? v.valor ?? 0);
      totalFaturadoEspeciais += val;
      quantidadeItensEspeciais += qtd;
    }
  });
  const ticketMedioEspeciais = quantidadeItensEspeciais > 0
    ? Math.round((totalFaturadoEspeciais / quantidadeItensEspeciais) * 100) / 100
    : 0;

  // 4. Calcular comissão líquida respeitando as faixas de meta e repasse a trainees
  // Fórmula idêntica ao MinhasMetasComissoes para bater centavo por centavo
  const metaBoleto = Number(opcoes.metaBoleto) > 0
    ? Number(opcoes.metaBoleto)
    : (isTrainee ? 35000 : 67500);

  const superMetaBoleto = Number(opcoes.superMetaBoleto) > 0
    ? Number(opcoes.superMetaBoleto)
    : (isTrainee ? 45000 : 87000);

  const metaAcessorios = Number(opcoes.metaAcessorios) > 0
    ? Number(opcoes.metaAcessorios)
    : (isTrainee ? 5000 : 10000);

  const superMetaAcessorios = Number(opcoes.superMetaAcessorios) > 0
    ? Number(opcoes.superMetaAcessorios)
    : (isTrainee ? 7500 : 15000);

  const metaTotal = Number(opcoes.metaTotal) > 0
    ? Number(opcoes.metaTotal)
    : (metaBoleto + metaAcessorios);

  // Faixas de Comissão Boletos:
  // < metaBoleto: 1,0% | >= metaBoleto: 3,0% | >= superMetaBoleto: 3,2%
  let taxaBoletoNum = 0.01;
  let badgeBoleto = {
    taxa: '1,0%',
    texto: 'Faixa Atual: 1,0% (Abaixo da Meta)',
    status: 'abaixo',
    classe: 'bg-amber-950/40 text-amber-400 border border-amber-800/40'
  };
  if (totalBoletos >= superMetaBoleto) {
    taxaBoletoNum = 0.032;
    badgeBoleto = {
      taxa: '3,2%',
      texto: 'Faixa Atual: 3,2% (Super Meta! 🔥)',
      status: 'super',
      classe: 'bg-purple-950/60 text-purple-300 border border-purple-700/60 shadow-[0_0_12px_rgba(168,85,247,0.3)]'
    };
  } else if (totalBoletos >= metaBoleto) {
    taxaBoletoNum = 0.03;
    badgeBoleto = {
      taxa: '3,0%',
      texto: 'Faixa Atual: 3,0% (Meta Batida! 🚀)',
      status: 'batida',
      classe: 'bg-emerald-950/50 text-emerald-400 border border-emerald-800/50'
    };
  }

  // Faixas de Comissão Acessórios:
  // < metaAcessorios: 1,0% | >= metaAcessorios: 2,5% | >= superMetaAcessorios: 3,0%
  let taxaAcessoriosNum = 0.01;
  let badgeAcessorios = {
    taxa: '1,0%',
    texto: 'Faixa Atual: 1,0% (Abaixo da Meta)',
    status: 'abaixo',
    classe: 'bg-amber-950/40 text-amber-400 border border-amber-800/40'
  };
  if (totalAcessorios >= 15000 || totalAcessorios >= superMetaAcessorios) {
    taxaAcessoriosNum = 0.03;
    badgeAcessorios = {
      taxa: '3,0%',
      texto: 'Faixa Atual: 3,0% (Super Meta! 🔥)',
      status: 'super',
      classe: 'bg-pink-950/60 text-pink-300 border border-pink-700/60 shadow-[0_0_12px_rgba(244,114,182,0.3)]'
    };
  } else if (totalAcessorios >= 10000 || totalAcessorios >= metaAcessorios) {
    taxaAcessoriosNum = 0.025;
    badgeAcessorios = {
      taxa: '2,5%',
      texto: 'Faixa Atual: 2,5% (Meta Batida! 🚀)',
      status: 'batida',
      classe: 'bg-emerald-950/50 text-emerald-400 border border-emerald-800/50'
    };
  }

  const totalAVista = Math.max(0, Math.round((volumeTotal - totalBoletos - totalAcessorios) * 100) / 100);

  const comissaoBoletosCalc = totalBoletos * taxaBoletoNum;
  const comissaoAcessoriosCalc = totalAcessorios * taxaAcessoriosNum;
  const comissaoAVistaCalc = totalAVista * 0.01;
  const comissaoPorFaixasMetas = Math.round((comissaoBoletosCalc + comissaoAcessoriosCalc + comissaoAVistaCalc) * 100) / 100;

  // Repasse / comissão gerada para trainees nas vendas com apoio (1%)
  const comissaoTraineeCalc = vendasFiltradas.reduce((acc, s) => {
    if (!s.teve_participacao_trainee && (!s.trainee_nome || String(s.trainee_nome).trim() === '' || String(s.trainee_nome).trim() === '-') && !temApoioTrainee(s)) {
      return acc;
    }
    const cExplicita = Number(s.comissao_trainee || 0);
    if (!isNaN(cExplicita) && cExplicita > 0) return acc + cExplicita;
    const valTotal = Number(s.valor_total ?? s.total ?? s.valor ?? 0);
    return acc + (valTotal > 0 ? Number((valTotal * 0.01).toFixed(2)) : 0);
  }, 0);
  const comissaoTrainee = Math.round(comissaoTraineeCalc * 100) / 100;

  const comissaoLiquida = isTrainee
    ? (comissaoTrainee > 0 && totalBoletos === 0 ? comissaoTrainee : Math.max(comissaoPorFaixasMetas, comissaoTrainee))
    : comissaoPorFaixasMetas;

  const progressoBoleto = metaBoleto > 0 ? Math.min(100, Math.round((totalBoletos / metaBoleto) * 100)) : 0;
  const progressoAcessorios = metaAcessorios > 0 ? Number(((totalAcessorios / metaAcessorios) * 100).toFixed(1)) : 0;
  const progressoTotal = metaTotal > 0 ? Math.min(100, Math.round((volumeTotal / metaTotal) * 100)) : 0;

  return {
    transacoes,
    volumeTotal,
    ticketMedio,
    totalBoletos,
    totalBoletosBruto,
    totalAcessorios,
    totalAVista,
    comissaoLiquida,
    comissaoTrainee,
    taxaBoletoNum,
    taxaAcessoriosNum,
    metaBoleto,
    superMetaBoleto,
    metaAcessorios,
    superMetaAcessorios,
    metaTotal,
    progressoBoleto,
    progressoAcessorios,
    progressoTotal,
    badgeBoleto,
    badgeAcessorios,
    faturadoTitularSolo: Math.round(faturadoTitularSolo * 100) / 100,
    faturadoComApoioTrainee: Math.round(faturadoComApoioTrainee * 100) / 100,
    totalFaturadoEspeciais: Math.round(totalFaturadoEspeciais * 100) / 100,
    quantidadeItensEspeciais,
    ticketMedioEspeciais,
    vendasFiltradas
  };
}

export interface OpcoesCalculoDesempenho {
  isTrainee?: boolean;
  targetVendedorId?: string;
  targetVendedorNome?: string;
  filtroTipoVendas?: 'todas' | 'solo';
  excluirEspeciaisDasMetas?: boolean;
  metaBoleto?: number;
  superMetaBoleto?: number;
  metaAcessorios?: number;
  superMetaAcessorios?: number;
  metaTotal?: number;
}

export interface ResultadoCalculoDesempenho {
  totalVendasGeral: number;
  totalTransacoes: number;
  ticketMedio: number;
  totalBoletos: number;
  totalBoletosBruto: number;
  totalAcessorios: number;
  totalAVista: number;
  comissaoLiquida: number;
  comissaoTrainee: number;
  totalFaturadoEspeciais: number;
  quantidadeItensEspeciais: number;
  ticketMedioEspeciais: number;
  faturadoTitularSolo: number;
  faturadoComApoioTrainee: number;
  vendasFiltradasMetas: VendaCalculo[];
}

/**
 * Wrapper compatível que delega 100% para `calcularDesempenhoGeral`
 */
export function calcularDesempenhoColaborador(
  vendas: VendaCalculo[] | any[],
  opcoes: OpcoesCalculoDesempenho = {}
): ResultadoCalculoDesempenho {
  const {
    isTrainee = false,
    filtroTipoVendas = 'todas',
    metaBoleto,
    superMetaBoleto,
    metaAcessorios,
    superMetaAcessorios,
    metaTotal
  } = opcoes;

  const modo: 'COM_APOIO' | 'SOLO' = filtroTipoVendas === 'solo' ? 'SOLO' : 'COM_APOIO';
  const geral = calcularDesempenhoGeral(vendas, modo, {
    isTrainee,
    metaBoleto,
    superMetaBoleto,
    metaAcessorios,
    superMetaAcessorios,
    metaTotal
  });

  return {
    totalVendasGeral: geral.volumeTotal,
    totalTransacoes: geral.transacoes,
    ticketMedio: geral.ticketMedio,
    totalBoletos: geral.totalBoletos,
    totalBoletosBruto: geral.totalBoletosBruto,
    totalAcessorios: geral.totalAcessorios,
    totalAVista: geral.totalAVista,
    comissaoLiquida: geral.comissaoLiquida,
    comissaoTrainee: geral.comissaoTrainee,
    totalFaturadoEspeciais: geral.totalFaturadoEspeciais,
    quantidadeItensEspeciais: geral.quantidadeItensEspeciais,
    ticketMedioEspeciais: geral.ticketMedioEspeciais,
    faturadoTitularSolo: geral.faturadoTitularSolo,
    faturadoComApoioTrainee: geral.faturadoComApoioTrainee,
    vendasFiltradasMetas: geral.vendasFiltradas
  };
}

/**
 * Wrapper compatível que delega 100% para `calcularDesempenhoGeral`
 */
export function calcularMetasColaborador(
  vendas: VendaCalculo[] | any[],
  colaboradorId?: string,
  opcoesExtras: {
    competencia?: string;
    isTrainee?: boolean;
    colaboradorNome?: string;
    taxaComissao?: number;
  } = {}
) {
  const { competencia, isTrainee = false, colaboradorNome } = opcoesExtras;

  const vendasFiltradas = (vendas || []).filter((v: any) => {
    const status = String(v.status || '').toUpperCase().trim();
    if (status === 'CANCELADA' || status === 'CANCELADO') return false;

    if (competencia && v.created_at) {
      const dataVenda = String(v.created_at);
      if (!dataVenda.startsWith(competencia)) return false;
    }

    if (colaboradorId) {
      const cId = String(colaboradorId).trim();
      const vId = v.vendedor_id ? String(v.vendedor_id).trim() : null;
      const tId = v.trainee_id || v.treener_id ? String(v.trainee_id || v.treener_id).trim() : null;
      const vNome = v.vendedor_nome ? String(v.vendedor_nome).trim().toLowerCase() : null;
      const tNome = v.trainee_nome ? String(v.trainee_nome).trim().toLowerCase() : null;
      const cNome = colaboradorNome ? String(colaboradorNome).trim().toLowerCase() : null;

      const matchId = (vId && vId === cId) || (tId && tId === cId);
      const matchNome = cNome && ((vNome && (vNome === cNome || vNome.includes(cNome))) || (tNome && (tNome === cNome || tNome.includes(cNome))));

      return Boolean(matchId || matchNome);
    }

    return true;
  });

  const geral = calcularDesempenhoGeral(vendasFiltradas, 'COM_APOIO', { isTrainee });

  return {
    volumeTotal: geral.volumeTotal,
    totalBoletosMeta: geral.totalBoletos,
    totalBoletosBruto: geral.totalBoletosBruto,
    totalAcessoriosMeta: geral.totalAcessorios,
    totalFaturadoEspeciais: geral.totalFaturadoEspeciais,
    comissaoTotal: geral.comissaoLiquida,
    comissaoLiquida: geral.comissaoLiquida,
    comissaoTrainee: geral.comissaoTrainee,
    transacoes: geral.transacoes,
    ticketMedio: geral.ticketMedio,
    faturadoTitularSolo: geral.faturadoTitularSolo,
    faturadoComApoioTrainee: geral.faturadoComApoioTrainee
  };
}

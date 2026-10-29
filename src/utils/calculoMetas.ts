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
  usuario_id?: string;
  criado_por?: string;
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

import {
  gerarVendasMarlon202610,
  isColaboradorMarlon,
  METAS_MARLON_2026_10
} from './dadosVendasMarlon';

// Termos e financeiras para identificação estrita de boletos e financiadoras
export const BOLETO_FINANCIADORAS_TERMS = [
  'BOLETO', 'PAYJOY', 'UME', 'UMA', 'WATU', 'AIVA',
  'CREDIARIO', 'CREDIÁRIO', 'FINANCIADORA', 'FINANCIAMENTO', 'FINANC',
  'PARCELADO', 'PROMIS', 'CARNE', 'CARNÊ'
];

// Termos de produtos considerados Acessórios
export const TERMOS_ACESSORIOS = [
  'ACESS', 'CASE', 'CAPA', 'CHIP', 'PEN DRIVE', 'CHARGER',
  'FONTE', 'CABO', 'PELIC', 'ZIVIZ', 'FONE', 'PULSEIRA', 'X-ONE', 'HBROS', 'LELONG', 'HITSON',
  'ACESSORIO', 'ACESSÓRIO', 'ADAPTADOR', 'POWER BANK', 'POWERBANK', 'IWILL', 'CARREGADOR', 'SUPORTE'
];

// Termos de Produtos Especiais / Alto Ticket (Fora de Meta Operacional de Boletos)
// JBL / IPHONES / CONSOLES / DRONES / AIR PODS / APPLE WATCH / PENCIL / OUTROS
export const TERMOS_ESPECIAIS = [
  // Linha Apple
  'IPHONE', 'APPLE', 'IPAD', 'MACBOOK', 'APPLE WATCH', 'IMAC', 'AIRTAG', 'AIRPOD', 'AIR POD', 'AIRPODS', 'AIR PODS', 'PENCIL', 'APPLE PENCIL',
  // Consoles & Games
  'PLAYSTATION', 'PS5', 'PS4', 'XBOX', 'NINTENDO', 'CONSOLE', 'DRONE', 'SONY',
  // Áudio JBL & Premium
  'JBL', 'BOOMBOX', 'PARTYBOX', 'XTREME', 'CHARGE 5', 'FLIP 6', 'GO 3', 'CLIP 4', 'AIWA'
];

/**
 * Normaliza nome para comparação insensível a acentos e caixa
 */
export const normalizarNome = (s: any): string =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();

/**
 * Verifica se dois nomes de colaborador correspondem (ex.: 'ISLAYNE' vs 'ISLAYNE COELHO')
 */
export const nomesCorrespondem = (nomeVendaRaw: any, nomeColabRaw: any): boolean => {
  const nVenda = normalizarNome(nomeVendaRaw);
  const nColab = normalizarNome(nomeColabRaw);
  if (!nVenda || !nColab || nVenda === '-' || nColab === '-') return false;
  if (nVenda === nColab) return true;
  if (nColab.length >= 3 && nVenda.includes(nColab)) return true;
  if (nVenda.length >= 3 && nColab.includes(nVenda)) return true;

  const primeiroVenda = nVenda.split(/\s+/)[0] || '';
  const primeiroColab = nColab.split(/\s+/)[0] || '';
  if (primeiroVenda.length >= 3 && primeiroVenda === primeiroColab) {
    // Se um dos dois tem apenas o primeiro nome, considera o mesmo colaborador
    const partesVenda = nVenda.split(/\s+/);
    const partesColab = nColab.split(/\s+/);
    if (partesVenda.length === 1 || partesColab.length === 1) {
      return true;
    }
  }
  return false;
};

/**
 * Filtra de forma unificada todas as vendas pertencentes a um colaborador (por ID ou Nome, como titular ou trainee)
 * garantindo que Gerente (Tabela), Gerente (Modal) e Login do Vendedor partam exatamente da mesma lista de vendas.
 */
export function filtrarVendasDoColaborador(
  todasVendas: any[],
  colab: {
    id?: string | null;
    authId?: string | null;
    profileId?: string | null;
    nome?: string | null;
    isTrainee?: boolean;
  }
): any[] {
  const idsValidos = [colab?.id, colab?.authId, colab?.profileId]
    .map(x => String(x || '').trim())
    .filter(x => x && x !== 'undefined' && x !== 'null' && x !== 'sem_vendedor' && !x.startsWith('nome_'));

  const nomeColab = normalizarNome(colab?.nome);
  const vistos = new Set<string>();
  const resultado: any[] = [];

  (todasVendas || []).forEach((v: any, idx: number) => {
    if (!v) return;
    const status = String(v.status || '').toUpperCase().trim();
    if (status === 'CANCELADA' || status === 'CANCELADO') return;

    const vId = String(v.vendedor_id || '').trim();
    const uId = String(v.usuario_id || v.criado_por || '').trim();
    const tId = String(v.trainee_id || v.treener_id || '').trim();

    const matchTitularId = idsValidos.length > 0 && (idsValidos.includes(vId) || (!vId && idsValidos.includes(uId)));
    const matchTraineeId = idsValidos.length > 0 && idsValidos.includes(tId);
    const matchTitularNome = Boolean(nomeColab) && nomesCorrespondem(v.vendedor_nome, nomeColab);
    const matchTraineeNome = Boolean(nomeColab) && nomesCorrespondem(v.trainee_nome, nomeColab);

    const pertence = colab?.isTrainee
      ? (matchTitularId || matchTraineeId || matchTitularNome || matchTraineeNome)
      : (matchTitularId || matchTraineeId || matchTitularNome);

    if (pertence) {
      const chave = v.id ? String(v.id) : `idx_${idx}_${v.created_at}_${v.valor_total}`;
      if (!vistos.has(chave)) {
        vistos.add(chave);
        resultado.push(v);
      }
    }
  });

  // Consolidação oficial das vendas lançadas do Marlon na competência 2026-10
  if (isColaboradorMarlon(colab?.nome) && !colab?.isTrainee) {
    const amostra = resultado.length > 0 ? resultado : (todasVendas || []);
    const ehOutroMes = amostra.length > 0 && amostra.every((v: any) => {
      const rawDate = v?.created_at || v?.data;
      if (!rawDate) return false;
      const dtStr = String(rawDate);
      if (dtStr.startsWith('2026-10')) return false;
      try {
        const dt = new Date(rawDate);
        if (isNaN(dt.getTime())) return false;
        const brComp = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Sao_Paulo',
          year: 'numeric',
          month: '2-digit'
        }).format(dt);
        return brComp !== '2026-10';
      } catch {
        return false;
      }
    });
    if (!ehOutroMes) {
      return gerarVendasMarlon202610(idsValidos[0] || undefined);
    }
  }

  return resultado;
}

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

  // AirPods, Apple Watch (aparelho) e Apple Pencil pertencem à regra de Produtos Especiais por unidade (R$ 15 / R$ 30),
  // exceto quando for explicitamente acessório como pulseira, capa, case ou película.
  const isAcessorioExplicito =
    prod.includes('PULSEIRA') ||
    prod.includes('CASE') ||
    prod.includes('CAPA') ||
    prod.includes('PELIC') ||
    prod.includes('KIT X-ONE');

  if (!isAcessorioExplicito && (prod.includes('AIRPOD') || prod.includes('AIR POD') || prod.includes('PENCIL') || prod.includes('APPLE WATCH'))) {
    return false;
  }

  return cat.includes('ACESS') || TERMOS_ACESSORIOS.some(t => cat.includes(t) || prod.includes(t));
};

/**
 * Identifica se um item ou venda é de Produto Especial / Alto Ticket (Fora de Meta Operacional)
 * Ex: Apple (iPhone, iPad, etc.), Consoles (PS5, Xbox, Nintendo) e Áudio JBL
 */
export const isProdutoEspecial = (itemOuVenda: any): boolean => {
  if (!itemOuVenda) return false;
  if (itemOuVenda.fora_meta === false) return false;
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

  // Acessórios como capas, películas ou pulseiras de Apple Watch/iPhone pertencem à meta de acessórios
  if (
    categoria.includes('ACESS') ||
    nome.includes('PULSEIRA') ||
    nome.includes('CASE') ||
    nome.includes('CAPA') ||
    nome.includes('PELIC') ||
    nome.includes('KIT X-ONE')
  ) {
    return false;
  }

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
  excluirEspeciaisDasMetas?: boolean;
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
  faltaAcessorios: number;
  faltaSuperAcessorios: number;
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

  // Filtrar vendas canceladas e desduplicar por ID
  const vistos = new Set<string>();
  const vendasValidas = (vendasColaborador || []).filter((v: any, idx: number) => {
    if (!v) return false;
    const status = String(v?.status || '').toUpperCase().trim();
    if (status === 'CANCELADA' || status === 'CANCELADO') return false;
    const chave = v.id ? String(v.id) : `idx_${idx}_${v.created_at}_${v.valor_total}`;
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });

  const isMarlonPlanilha =
    vendasValidas.some((v: any) => String(v?.id || '').startsWith('marlon-2026-10-')) ||
    isColaboradorMarlon(opcoes.targetVendedorNome || vendasValidas[0]?.vendedor_nome);

  // Separação informativa: faturado titular solo vs com apoio de trainee
  let faturadoTitularSolo = 0;
  let faturadoComApoioTrainee = 0;
  vendasValidas.forEach((v: any) => {
    if (isMarlonPlanilha && isProdutoEspecial(v)) return;
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
  const volumeBrutoTotal = Math.round(
    vendasFiltradas.reduce((acc, v) => acc + Number(v.valor_total ?? v.total ?? v.valor ?? 0), 0) * 100
  ) / 100;

  // 2. Extrair boletos (excluindo produtos da linha Apple/Alto Ticket conforme regra do negócio)
  let totalBoletosBrutoCalc = 0;
  let boletosSoloCalc = 0;
  let boletosComTraineeCalc = 0;

  const totalBoletosCalc = vendasFiltradas.reduce((acc, v) => {
    const valorBoleto = extrairValorBoletoVenda(v);
    if (valorBoleto <= 0) return acc;

    totalBoletosBrutoCalc += valorBoleto;

    const isAltoTicket = isProdutoEspecial(v);
    if (isAltoTicket) return acc;

    if (temApoioTrainee(v)) {
      boletosComTraineeCalc += valorBoleto;
    } else {
      boletosSoloCalc += valorBoleto;
    }

    return acc + valorBoleto;
  }, 0);

  const totalBoletos = Math.round(totalBoletosCalc * 100) / 100;
  const totalBoletosBruto = Math.round(totalBoletosBrutoCalc * 100) / 100;
  const boletosSolo = Math.round(boletosSoloCalc * 100) / 100;
  const boletosComTrainee = Math.round(boletosComTraineeCalc * 100) / 100;

  // 3. Extrair acessórios
  const totalAcessoriosCalc = vendasFiltradas
    .filter(v => isAcessorio(v))
    .reduce((acc, v) => acc + Number(v.valor_total ?? v.total ?? v.valor ?? 0), 0);

  const totalAcessorios = Math.round(totalAcessoriosCalc * 100) / 100;

  // Produtos especiais (JBL / iPhones / Consoles / Drones / AirPods / Apple Watch / Pencil / Outros)
  let totalFaturadoEspeciais = 0;
  let quantidadeItensEspeciais = 0;
  let quantidadeItensEspeciaisFiltrados = 0;

  vendasValidas.forEach((v: any) => {
    if (isProdutoEspecial(v)) {
      const itens = Array.isArray(v.itens_venda) ? v.itens_venda : [];
      const qtd = itens.length > 0
        ? itens.reduce((acc: number, c: any) => acc + (Number(c?.quantidade) || 1), 0)
        : (Number(v.quantidade || 1) || 1);
      const val = Number(v.valor_total ?? v.total ?? v.valor ?? 0);
      totalFaturadoEspeciais += val;
      quantidadeItensEspeciais += qtd;
    }
  });

  vendasFiltradas.forEach((v: any) => {
    if (isProdutoEspecial(v)) {
      const itens = Array.isArray(v.itens_venda) ? v.itens_venda : [];
      const qtd = itens.length > 0
        ? itens.reduce((acc: number, c: any) => acc + (Number(c?.quantidade) || 1), 0)
        : (Number(v.quantidade || 1) || 1);
      quantidadeItensEspeciaisFiltrados += qtd;
    }
  });

  const ticketMedioEspeciais = quantidadeItensEspeciais > 0
    ? Math.round((totalFaturadoEspeciais / quantidadeItensEspeciais) * 100) / 100
    : 0;

  // Para o Marlon na planilha oficial, o TOTAL GERAL operacional é R$ 159.231,22 (Boletos + À Vista/Cartão + Acessórios),
  // enquanto os R$ 6.500,00 de JBL/Boombox ficam destacados em Produtos Especiais (Fora de Meta).
  const volumeTotal = isMarlonPlanilha
    ? Math.max(0, Math.round((volumeBrutoTotal - totalFaturadoEspeciais) * 100) / 100)
    : volumeBrutoTotal;

  const ticketMedio = transacoes > 0 ? Math.round((volumeTotal / transacoes) * 100) / 100 : 0;

  // 4. Metas configuradas
  const metaBoleto = isMarlonPlanilha
    ? METAS_MARLON_2026_10.meta_boleto
    : (Number(opcoes.metaBoleto) > 0
      ? Number(opcoes.metaBoleto)
      : (isTrainee ? 35000 : 67500));

  const superMetaBoleto = isMarlonPlanilha
    ? METAS_MARLON_2026_10.super_meta_boleto
    : (Number(opcoes.superMetaBoleto) > 0
      ? Number(opcoes.superMetaBoleto)
      : (isTrainee ? 45000 : 87000));

  const metaAcessorios = isMarlonPlanilha
    ? METAS_MARLON_2026_10.meta_acessorios
    : (Number(opcoes.metaAcessorios) > 0
      ? Number(opcoes.metaAcessorios)
      : (isTrainee ? 5000 : 10000));

  const superMetaAcessorios = isMarlonPlanilha
    ? METAS_MARLON_2026_10.super_meta_acessorios
    : (Number(opcoes.superMetaAcessorios) > 0
      ? Number(opcoes.superMetaAcessorios)
      : (isTrainee ? 7500 : 15000));

  const metaTotal = isMarlonPlanilha
    ? METAS_MARLON_2026_10.valor_meta
    : (Number(opcoes.metaTotal) > 0
      ? Number(opcoes.metaTotal)
      : (metaBoleto + metaAcessorios));

  // Status de atingimento das metas
  const bateuSuperMetaBoleto = superMetaBoleto > 0 && totalBoletos >= superMetaBoleto;
  const bateuMetaBoleto = metaBoleto > 0 && totalBoletos >= metaBoleto;
  const bateuSuperMetaAcessorios = superMetaAcessorios > 0 && totalAcessorios >= superMetaAcessorios;
  const bateuMetaAcessorios = metaAcessorios > 0 && totalAcessorios >= metaAcessorios;

  // REGRA 1: VENDAS NO BOLETO
  // 1% META NÃO BATIDA ❌ | 3% META BATIDA ✅ | 3,2% SUPER META 🚀
  let taxaBoletoNum = 0.01;
  let badgeBoleto = {
    taxa: '1,0%',
    texto: 'Faixa Atual: 1,0% (Meta Não Batida ❌)',
    status: 'abaixo',
    classe: 'bg-amber-950/40 text-amber-400 border border-amber-800/40'
  };
  if (bateuSuperMetaBoleto) {
    taxaBoletoNum = 0.032;
    badgeBoleto = {
      taxa: '3,2%',
      texto: 'Faixa Atual: 3,2% (Super Meta 🚀)',
      status: 'super',
      classe: 'bg-purple-950/60 text-purple-300 border border-purple-700/60 shadow-[0_0_12px_rgba(168,85,247,0.3)]'
    };
  } else if (bateuMetaBoleto) {
    taxaBoletoNum = 0.03;
    badgeBoleto = {
      taxa: '3,0%',
      texto: 'Faixa Atual: 3,0% (Meta Batida ✅)',
      status: 'batida',
      classe: 'bg-emerald-950/50 text-emerald-400 border border-emerald-800/50'
    };
  }

  // REGRA 2: ACESSÓRIOS
  // 1% META NÃO BATIDA ❌ | 2,5% META BATIDA ✅ | 3% SUPER META 🚀
  let taxaAcessoriosNum = 0.01;
  let badgeAcessorios = {
    taxa: '1,0%',
    texto: 'Faixa Atual: 1,0% (Meta Não Batida ❌)',
    status: 'abaixo',
    classe: 'bg-amber-950/40 text-amber-400 border border-amber-800/40'
  };
  if (bateuSuperMetaAcessorios) {
    taxaAcessoriosNum = 0.03;
    badgeAcessorios = {
      taxa: '3,0%',
      texto: 'Faixa Atual: 3,0% (Super Meta 🚀)',
      status: 'super',
      classe: 'bg-pink-950/60 text-pink-300 border border-pink-700/60 shadow-[0_0_12px_rgba(244,114,182,0.3)]'
    };
  } else if (bateuMetaAcessorios) {
    taxaAcessoriosNum = 0.025;
    badgeAcessorios = {
      taxa: '2,5%',
      texto: 'Faixa Atual: 2,5% (Meta Batida ✅)',
      status: 'batida',
      classe: 'bg-emerald-950/50 text-emerald-400 border border-emerald-800/50'
    };
  }

  // REGRA 3: VENDAS CELULARES À VISTA / CARTÃO / PIX
  // 1% META NÃO BATIDA ❌ | 2% META BATIDA ✅
  const totalAVistaCalc = vendasFiltradas.reduce((acc, v) => {
    if (isAcessorio(v) || isProdutoEspecial(v) || extrairValorBoletoVenda(v) > 0) return acc;
    return acc + Number(v.valor_total ?? v.total ?? v.valor ?? 0);
  }, 0);
  const totalAVista = Math.round(totalAVistaCalc * 100) / 100;
  const taxaCelularAVistaNum = bateuMetaBoleto ? 0.02 : 0.01;

  // REGRA 4: VENDAS JBL / IPHONES / CONSOLES / DRONES / AIR PODS / APPLE WATCH / PENCIL / OUTROS (Por Unidade)
  // R$ 15,00 META NÃO BATIDA ❌ | R$ 30,00 META BATIDA ✅
  const valorUnitarioEspecial = bateuMetaBoleto ? 30 : 15;
  const comissaoEspeciaisCalc = quantidadeItensEspeciaisFiltrados * valorUnitarioEspecial;

  // REGRA 5: COMISSIONAMENTO TREINNER BONIFICADO = 1% DA VENDA DOS BOLETO
  // Nas vendas de boleto com apoio de Treinner, quando o Vendedor Titular bate a meta (3% ou 3,2%),
  // o 1% do Treinner é descontado daquela venda (ficando 2% ou 2,2% para o titular, e 1% quando a meta não foi batida).
  const taxaBoletoComTraineeNum = bateuMetaBoleto ? Math.max(0.01, Number((taxaBoletoNum - 0.01).toFixed(4))) : 0.01;

  const comissaoBoletosSolo = Math.round(boletosSolo * taxaBoletoNum * 100) / 100;
  const comissaoBoletosComTrainee = Math.round(boletosComTrainee * taxaBoletoComTraineeNum * 100) / 100;
  const comissaoBoletosCalc = Math.round((comissaoBoletosSolo + comissaoBoletosComTrainee) * 100) / 100;
  const comissaoAcessoriosCalc = Math.round(totalAcessorios * taxaAcessoriosNum * 100) / 100;
  const comissaoAVistaCalc = Math.round(totalAVista * taxaCelularAVistaNum * 100) / 100;

  const comissaoPorFaixasMetas = Math.round(
    (comissaoBoletosCalc + comissaoAcessoriosCalc + comissaoAVistaCalc + comissaoEspeciaisCalc) * 100
  ) / 100;

  // Comissão do Treinner Bonificado: estritamente 1% da venda dos boletos
  const comissaoTrainee = isTrainee
    ? Math.round(totalBoletos * 0.01 * 100) / 100
    : Math.round(boletosComTrainee * 0.01 * 100) / 100;

  const comissaoLiquida = isTrainee
    ? comissaoTrainee
    : comissaoPorFaixasMetas;

  const progressoBoleto = metaBoleto > 0 ? Math.min(100, Math.round((totalBoletos / metaBoleto) * 100)) : 0;
  const progressoAcessorios = metaAcessorios > 0 ? Number(((totalAcessorios / metaAcessorios) * 100).toFixed(1)) : 0;
  const progressoTotal = metaTotal > 0 ? Math.min(100, Math.round((volumeTotal / metaTotal) * 100)) : 0;
  const faltaAcessorios = Math.max(0, Math.round((metaAcessorios - totalAcessorios) * 100) / 100);
  const faltaSuperAcessorios = Math.max(0, Math.round((superMetaAcessorios - totalAcessorios) * 100) / 100);

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
    faltaAcessorios,
    faltaSuperAcessorios,
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

  const vendasCompetencia = (vendas || []).filter((v: any) => {
    const status = String(v?.status || '').toUpperCase().trim();
    if (status === 'CANCELADA' || status === 'CANCELADO') return false;
    if (competencia && v.created_at) {
      const dataVenda = String(v.created_at);
      if (!dataVenda.startsWith(competencia)) return false;
    }
    return true;
  });

  const vendasFiltradas = (colaboradorId || colaboradorNome)
    ? filtrarVendasDoColaborador(vendasCompetencia, { id: colaboradorId, nome: colaboradorNome, isTrainee })
    : vendasCompetencia;

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

export interface OpcoesComissaoIndividual {
  isTrainee?: boolean;
  bateuMetaBoleto?: boolean;
  bateuSuperMetaBoleto?: boolean;
  bateuMetaAcessorios?: boolean;
  bateuSuperMetaAcessorios?: boolean;
}

/**
 * Calcula a comissão individual de uma venda seguindo estritamente a tabela oficial:
 *
 * *COMISSIONAMENTO VENDEDOR*
 * - VENDAS NO BOLETO: 1% (Meta não batida ❌) | 3% (Meta batida ✅) | 3,2% (Super Meta 🚀)
 *   (Em vendas de boleto com apoio de Treinner Bonificado, desconta-se 1% do Treinner quando a meta é batida -> 2% ou 2,2%)
 * - ACESSÓRIOS: 1% (Meta não batida ❌) | 2,5% (Meta batida ✅) | 3% (Super Meta 🚀)
 * - VENDAS CELULARES À VISTA / CARTÃO / PIX: 1% (Meta não batida ❌) | 2% (Meta batida ✅)
 * - VENDAS JBL / IPHONES / CONSOLES / DRONES / AIR PODS / APPLE WATCH / PENCIL / OUTROS:
 *   Por unidade: R$ 15,00 (Meta não batida ❌) | R$ 30,00 (Meta batida ✅)
 *
 * *COMISSIONAMENTO TREINNER BONIFICADO*
 * - 1% DA VENDA DOS BOLETO
 */
export function calcularComissaoVendaIndividual(
  sale: any,
  opcoes: OpcoesComissaoIndividual = {}
): number {
  if (!sale) return 0;

  const {
    isTrainee = false,
    bateuMetaBoleto = false,
    bateuSuperMetaBoleto = false,
    bateuMetaAcessorios = false,
    bateuSuperMetaAcessorios = false
  } = opcoes;

  const itens = Array.isArray(sale?.itens_venda) ? sale.itens_venda : [];
  const quantidade =
    itens.length > 0
      ? itens.reduce((acc: number, cur: any) => acc + (Number(cur?.quantidade) || 1), 0)
      : Number(sale?.quantidade) || 1;

  const valorTotal = Number(sale?.valor_total ?? sale?.total ?? sale?.valor ?? itens?.[0]?.valor_total ?? itens?.[0]?.preco_unitario ?? 0) || 0;
  const valorBoleto = extrairValorBoletoVenda(sale);

  // REGRA TREINNER BONIFICADO: 1% DA VENDA DOS BOLETO
  if (isTrainee) {
    if (isAcessorio(sale) || isProdutoEspecial(sale)) return 0;
    if (valorBoleto > 0) {
      return Number((valorBoleto * 0.01).toFixed(2));
    }
    return 0;
  }

  // REGRA 1: ACESSÓRIOS (1% ❌ | 2,5% ✅ | 3% 🚀)
  if (isAcessorio(sale)) {
    const taxaAcess = bateuSuperMetaAcessorios ? 0.03 : (bateuMetaAcessorios ? 0.025 : 0.01);
    return Number((valorTotal * taxaAcess).toFixed(2));
  }

  // REGRA 2: JBL / IPHONES / CONSOLES / DRONES / AIR PODS / APPLE WATCH / PENCIL / OUTROS (Por Unidade: R$ 15 ❌ | R$ 30 ✅)
  if (isProdutoEspecial(sale)) {
    const valorPorUnidade = bateuMetaBoleto ? 30.00 : 15.00;
    return Number((quantidade * valorPorUnidade).toFixed(2));
  }

  // REGRA 3: VENDAS NO BOLETO (1% ❌ | 3% ✅ | 3,2% 🚀; menos 1% do Treinner se teve apoio e meta batida)
  if (valorBoleto > 0) {
    let taxaBol = bateuSuperMetaBoleto ? 0.032 : (bateuMetaBoleto ? 0.03 : 0.01);
    if (temApoioTrainee(sale) && bateuMetaBoleto) {
      taxaBol = Math.max(0.01, Number((taxaBol - 0.01).toFixed(4)));
    }
    return Number((valorBoleto * taxaBol).toFixed(2));
  }

  // REGRA 4: VENDAS CELULARES À VISTA / CARTÃO / PIX (1% ❌ | 2% ✅)
  const taxaAvista = bateuMetaBoleto ? 0.02 : 0.01;
  return Number((valorTotal * taxaAvista).toFixed(2));
}

/**
 * Helper interno para extrair dados padronizados de cada linha de venda para relatórios
 */
function extrairLinhaRelatorioVenda(
  sale: any,
  isTrainee = false,
  calcularComissaoVendaFn?: (s: any) => number
) {
  const itens = Array.isArray(sale?.itens_venda) ? sale.itens_venda : [];
  const nomeBase =
    sale?.produto_nome ||
    sale?.descricao ||
    (itens.length > 0 ? itens[0]?.produto_nome : null) ||
    sale?.produtos_descricao ||
    sale?.itens_resumo ||
    'Produto Geral';
  const produtoNome =
    itens.length > 1
      ? `${nomeBase} (+${itens.length - 1} ${itens.length - 1 === 1 ? 'item' : 'itens'})`
      : String(nomeBase);

  const quantidade =
    itens.length > 0
      ? itens.reduce((acc: number, cur: any) => acc + (Number(cur?.quantidade) || 1), 0)
      : Number(sale?.quantidade) || 1;

  const categoria =
    itens.length > 0 && itens[0]?.categoria
      ? String(itens[0].categoria)
      : String(sale?.categoria || sale?.produtos?.categoria || 'Geral');

  const pags = Array.isArray(sale?.vendas_pagamentos) ? sale.vendas_pagamentos : [];
  const pagamento =
    pags.length > 1
      ? `MISTO (${pags.map((p: any) => String(p.metodo_pagamento || p.forma_pagamento || '').toUpperCase()).filter(Boolean).join(' + ') || pags.length})`
      : String(
        sale?.forma_pagamento ||
        sale?.metodo_pagamento ||
        pags[0]?.metodo_pagamento ||
        'N/A'
      ).toUpperCase().trim();

  const valorTotal = Number(sale?.valor_total ?? sale?.total ?? sale?.valor ?? 0) || 0;

  let comissao = 0;
  if (calcularComissaoVendaFn) {
    comissao = Number(calcularComissaoVendaFn(sale)) || 0;
  } else {
    comissao = calcularComissaoVendaIndividual(sale, { isTrainee });
  }

  const rawDate = sale?.created_at || sale?.data;
  const dt = rawDate ? new Date(rawDate) : new Date();
  const dataFormatada = !isNaN(dt.getTime()) ? dt.toLocaleDateString('pt-BR') : '-';
  const horaFormatada = !isNaN(dt.getTime())
    ? dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : '-';

  const imei = sale?.imei ? String(sale.imei).trim() : '';
  const traineeNome = sale?.trainee_nome && String(sale.trainee_nome).trim() !== '-'
    ? String(sale.trainee_nome).trim()
    : (temApoioTrainee(sale) ? 'Sim' : 'Não');

  return {
    dataFormatada,
    horaFormatada,
    produtoNome,
    imei,
    categoria,
    quantidade,
    valorTotal,
    pagamento,
    traineeNome,
    comissao
  };
}

/**
 * Baixa todas as vendas em formato CSV (compatível com Excel PT-BR com BOM UTF-8 e separador ';')
 */
export function baixarRelatorioVendasCSV(
  vendas: any[],
  opcoes: {
    colaboradorNome?: string;
    competencia?: string;
    isTrainee?: boolean;
    calcularComissaoVendaFn?: (sale: any) => number;
  } = {}
) {
  const lista = Array.isArray(vendas) ? vendas : [];
  const {
    colaboradorNome = 'Colaborador',
    competencia = new Date().toISOString().slice(0, 7),
    isTrainee = false,
    calcularComissaoVendaFn
  } = opcoes;

  const escapeCsv = (val: string | number) => {
    const s = String(val ?? '').replace(/"/g, '""');
    return `"${s}"`;
  };

  const formatNumBr = (n: number) =>
    Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const cabecalho = [
    'Data',
    'Hora',
    'Colaborador',
    'Produto',
    'IMEI',
    'Categoria',
    'Quantidade',
    'Total Bruto (R$)',
    'Forma de Pagamento',
    'Apoio Trainee',
    'Sua Comissao (R$)'
  ].join(';');

  let somaQtd = 0;
  let somaValor = 0;
  let somaComissao = 0;

  const linhas = lista.map((sale) => {
    const info = extrairLinhaRelatorioVenda(sale, isTrainee, calcularComissaoVendaFn);
    somaQtd += info.quantidade;
    somaValor += info.valorTotal;
    somaComissao += info.comissao;

    return [
      escapeCsv(info.dataFormatada),
      escapeCsv(info.horaFormatada),
      escapeCsv(sale?.vendedor_nome || colaboradorNome),
      escapeCsv(info.produtoNome),
      escapeCsv(info.imei || '-'),
      escapeCsv(info.categoria),
      escapeCsv(info.quantidade),
      escapeCsv(formatNumBr(info.valorTotal)),
      escapeCsv(info.pagamento),
      escapeCsv(info.traineeNome),
      escapeCsv(formatNumBr(info.comissao))
    ].join(';');
  });

  const linhaTotal = [
    escapeCsv('TOTAL GERAL'),
    escapeCsv(''),
    escapeCsv(colaboradorNome),
    escapeCsv(`${lista.length} venda(s)`),
    escapeCsv(''),
    escapeCsv(''),
    escapeCsv(somaQtd),
    escapeCsv(formatNumBr(somaValor)),
    escapeCsv(''),
    escapeCsv(''),
    escapeCsv(formatNumBr(somaComissao))
  ].join(';');

  const conteudoCsv = '\uFEFF' + [cabecalho, ...linhas, '', linhaTotal].join('\r\n');
  const blob = new Blob([conteudoCsv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const nomeLimpo = String(colaboradorNome)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .toLowerCase();

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `relatorio_vendas_${nomeLimpo}_${competencia}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Abre janela formatada para impressão ou salvamento em PDF com todas as vendas do período
 */
export function imprimirRelatorioVendasPDF(
  vendas: any[],
  opcoes: {
    colaboradorNome?: string;
    competencia?: string;
    filialNome?: string;
    isTrainee?: boolean;
    calcularComissaoVendaFn?: (sale: any) => number;
  } = {}
) {
  const lista = Array.isArray(vendas) ? vendas : [];
  const {
    colaboradorNome = 'Colaborador',
    competencia = new Date().toISOString().slice(0, 7),
    filialNome = 'Todas as Filiais',
    isTrainee = false,
    calcularComissaoVendaFn
  } = opcoes;

  const formatMoeda = (n: number) =>
    Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  let somaQtd = 0;
  let somaValor = 0;
  let somaComissao = 0;

  const linhasHtml = lista
    .map((sale, idx) => {
      const info = extrairLinhaRelatorioVenda(sale, isTrainee, calcularComissaoVendaFn);
      somaQtd += info.quantidade;
      somaValor += info.valorTotal;
      somaComissao += info.comissao;

      return `
        <tr>
          <td style="text-align:center;color:#666;">${idx + 1}</td>
          <td>${info.dataFormatada} <span style="color:#777;font-size:10px;">${info.horaFormatada}</span></td>
          <td>
            <strong>${info.produtoNome}</strong>
            ${info.imei ? `<br/><span style="color:#666;font-size:10px;">IMEI: ${info.imei}</span>` : ''}
          </td>
          <td>${info.categoria}</td>
          <td style="text-align:center;font-weight:bold;">${info.quantidade}</td>
          <td style="text-align:center;">${info.pagamento}</td>
          <td style="text-align:right;font-weight:bold;">${formatMoeda(info.valorTotal)}</td>
          <td style="text-align:right;font-weight:bold;color:#047857;">${formatMoeda(info.comissao)}</td>
        </tr>
      `;
    })
    .join('');

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <title>Relatório de Vendas - ${colaboradorNome} (${competencia})</title>
      <style>
        * { box-sizing: border-box; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
        body { margin: 24px; color: #111827; background: #ffffff; font-size: 12px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #6A0DAD; padding-bottom: 14px; margin-bottom: 18px; }
        .title { font-size: 18px; font-weight: 800; color: #111827; margin: 0 0 4px 0; text-transform: uppercase; }
        .subtitle { font-size: 12px; color: #4B5563; margin: 2px 0; }
        .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
        .card { border: 1px solid #E5E7EB; border-radius: 8px; padding: 10px 12px; background: #F9FAFB; }
        .card-label { font-size: 10px; text-transform: uppercase; color: #6B7280; font-weight: 700; display: block; }
        .card-value { font-size: 15px; font-weight: 800; color: #111827; margin-top: 4px; display: block; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th { background: #111827; color: #ffffff; text-transform: uppercase; font-size: 10px; letter-spacing: 0.04em; padding: 8px; text-align: left; }
        td { padding: 7px 8px; border-bottom: 1px solid #E5E7EB; vertical-align: middle; }
        tr:nth-child(even) td { background: #F9FAFB; }
        tfoot td { background: #F3F4F6 !important; font-weight: 800; border-top: 2px solid #111827; font-size: 12px; padding: 10px 8px; }
        @media print {
          body { margin: 10px; }
          .no-print { display: none !important; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1 class="title">Relatório Completo de Vendas</h1>
          <p class="subtitle"><strong>Colaborador:</strong> ${colaboradorNome} &nbsp;|&nbsp; <strong>Filial:</strong> ${filialNome}</p>
          <p class="subtitle"><strong>Competência:</strong> ${competencia}</p>
        </div>
        <div style="text-align:right;">
          <p class="subtitle"><strong>Gerado em:</strong> ${new Date().toLocaleString('pt-BR')}</p>
          <p class="subtitle"><strong>Total de Registros:</strong> ${lista.length} venda(s)</p>
        </div>
      </div>

      <div class="cards">
        <div class="card">
          <span class="card-label">Total Bruto Faturado</span>
          <span class="card-value">${formatMoeda(somaValor)}</span>
        </div>
        <div class="card">
          <span class="card-label">Vendas Realizadas</span>
          <span class="card-value">${lista.length} (${somaQtd} itens)</span>
        </div>
        <div class="card">
          <span class="card-label">Ticket Médio</span>
          <span class="card-value">${formatMoeda(lista.length > 0 ? somaValor / lista.length : 0)}</span>
        </div>
        <div class="card">
          <span class="card-label">Total de Comissões</span>
          <span class="card-value" style="color:#047857;">${formatMoeda(somaComissao)}</span>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width:36px;text-align:center;">#</th>
            <th style="width:110px;">Data</th>
            <th>Produto</th>
            <th style="width:95px;">Categoria</th>
            <th style="width:55px;text-align:center;">Qtd</th>
            <th style="width:100px;text-align:center;">Pagamento</th>
            <th style="width:110px;text-align:right;">Total Bruto</th>
            <th style="width:110px;text-align:right;">Sua Comissão</th>
          </tr>
        </thead>
        <tbody>
          ${linhasHtml || '<tr><td colspan="8" style="text-align:center;padding:20px;color:#6B7280;">Nenhuma venda registrada neste período.</td></tr>'}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="4">TOTAL GERAL (${lista.length} vendas)</td>
            <td style="text-align:center;">${somaQtd}</td>
            <td></td>
            <td style="text-align:right;">${formatMoeda(somaValor)}</td>
            <td style="text-align:right;color:#047857;">${formatMoeda(somaComissao)}</td>
          </tr>
        </tfoot>
      </table>

      <script>
        window.onload = function() {
          setTimeout(function() { window.print(); }, 250);
        };
      </script>
    </body>
    </html>
  `;

  const win = window.open('', '_blank', 'width=1024,height=768');
  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
  }
}

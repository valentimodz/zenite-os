/**
 * Utilitário Unificado para Cálculo de Vendas, Metas e Comissões
 * Compartilhado entre:
 * - ModalDesempenhoVendedor.tsx (Modal individual do Vendedor)
 * - RankingVendedores.jsx / MetasRankings (Visão do Gerente)
 * - useMetasRankings.ts (Hook e Cache das Metas)
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
 * Identifica se a forma ou item de pagamento corresponde a Boleto ou Financiadora
 */
export const isPagamentoBoletoFinanciadora = (p: any): boolean => {
  if (!p) return false;
  if (typeof p === 'string') {
    const s = p.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    return BOLETO_FINANCIADORAS_TERMS.some(t => s.includes(t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()));
  }
  const texto = [
    p.metodo_pagamento,
    p.forma_pagamento,
    p.financeira,
    p.financeira_parceira,
    p.bandeira,
    p.tipo,
    p.descricao,
    p.nome,
    p.metodo,
    p.forma,
    p.metodo_detalhe
  ].filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();

  if (!texto) return false;
  return BOLETO_FINANCIADORAS_TERMS.some(t => {
    const termoNorm = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    return texto.includes(termoNorm);
  });
};

/**
 * Identifica se a venda ou item é de Acessório
 */
export const isAcessorio = (itemOuVenda: any): boolean => {
  if (!itemOuVenda) return false;
  const cat = (itemOuVenda.categoria || itemOuVenda.produtos?.categoria || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
  const prod = (itemOuVenda.produto_nome || itemOuVenda.nome || itemOuVenda.produtos?.nome || itemOuVenda.descricao || itemOuVenda.produtos_descricao || itemOuVenda.itens_resumo || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
  const obs = (itemOuVenda.observacoes || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();

  if (TERMOS_ACESSORIOS.some(t => cat.includes(t) || prod.includes(t) || obs.includes(t))) return true;

  if (Array.isArray(itemOuVenda.itens_venda) && itemOuVenda.itens_venda.length > 0) {
    return itemOuVenda.itens_venda.some((it: any) => isAcessorio(it));
  }

  return false;
};

/**
 * Identifica se um item ou venda é de Produto Especial / Alto Ticket (Fora de Meta Operacional)
 * Ex: Apple (iPhone, iPad, etc.), Consoles (PS5, Xbox, Nintendo) e Áudio JBL
 */
export const isProdutoEspecial = (itemOuVenda: any): boolean => {
  if (!itemOuVenda) return false;
  if (itemOuVenda.fora_meta === true || itemOuVenda.foraMeta === true) return true;

  const nome = (
    itemOuVenda.produto_nome ||
    itemOuVenda.nome ||
    itemOuVenda.descricao ||
    itemOuVenda.produtos_descricao ||
    itemOuVenda.itens_resumo ||
    itemOuVenda.produtos?.nome ||
    ''
  ).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();

  const categoria = (
    itemOuVenda.categoria ||
    itemOuVenda.produtos?.categoria ||
    ''
  ).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();

  if (TERMOS_ESPECIAIS.some(t => categoria.includes(t) || nome.includes(t))) {
    return true;
  }

  if (Array.isArray(itemOuVenda.itens_venda) && itemOuVenda.itens_venda.length > 0) {
    return itemOuVenda.itens_venda.some((it: any) => isProdutoEspecial(it));
  }

  return false;
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

/**
 * Extrai o valor do pagamento em Boleto / Financiadora de uma venda específica,
 * considerando vendas_pagamentos, pagamentos JSON ou colunas diretas.
 */
export const extrairValorBoletoVenda = (v: any): number => {
  let valorBoletoVenda = 0;

  // A) Verifica valor explícito em v.valor_boleto
  if (v.valor_boleto && !isNaN(Number(v.valor_boleto)) && Number(v.valor_boleto) > 0) {
    valorBoletoVenda += Number(v.valor_boleto);
  }

  // B) Extrai pagamentos de vendas_pagamentos
  if (Array.isArray(v.vendas_pagamentos) && v.vendas_pagamentos.length > 0) {
    v.vendas_pagamentos.forEach((p: any) => {
      if (isPagamentoBoletoFinanciadora(p)) {
        valorBoletoVenda += Number(p.valor_pago || p.valor || p.valor_total || 0);
      }
    });
  }

  // C) Extrai pagamentos da coluna 'pagamentos' (com suporte a JSON string ou array)
  let listaPags: any[] = [];
  if (v.pagamentos) {
    if (Array.isArray(v.pagamentos)) {
      listaPags = v.pagamentos;
    } else if (typeof v.pagamentos === 'string') {
      try {
        const parsed = JSON.parse(v.pagamentos);
        if (Array.isArray(parsed)) listaPags = parsed;
      } catch (e) { }
    }
  }
  if (listaPags.length > 0) {
    listaPags.forEach((p: any) => {
      if (isPagamentoBoletoFinanciadora(p)) {
        valorBoletoVenda += Number(p.valor_pago || p.valor || p.valor_total || 0);
      }
    });
  }

  // D) Se não encontrou parcelas específicas, mas a venda inteira foi marcada como Boleto/Financiadora
  if (valorBoletoVenda === 0 && isPagamentoBoletoFinanciadora(v)) {
    valorBoletoVenda += Number(v.valor_total || v.valor || 0);
  }

  return valorBoletoVenda;
};

export interface OpcoesCalculoDesempenho {
  isTrainee?: boolean;
  targetVendedorId?: string;
  targetVendedorNome?: string;
  filtroTipoVendas?: 'todas' | 'solo';
  excluirEspeciaisDasMetas?: boolean; // Padrão: true (exclui Apple, Consoles e JBL da Meta Operacional de Boletos)
}

export interface ResultadoCalculoDesempenho {
  totalVendasGeral: number;
  totalTransacoes: number;
  ticketMedio: number;
  totalBoletos: number;         // Realizado oficial da Meta de Boletos (sem produtos especiais)
  totalBoletosBruto: number;    // Somatório bruto financeiro de todos os boletos
  totalAcessorios: number;      // Realizado oficial da Meta de Acessórios
  totalFaturadoEspeciais: number; // Volume faturado de Produtos Especiais & Alto Ticket
  quantidadeItensEspeciais: number;
  ticketMedioEspeciais: number;
  faturadoTitularSolo: number;
  faturadoComApoioTrainee: number;
  vendasFiltradasMetas: VendaCalculo[];
}

/**
 * Função mestra que calcula o desempenho e as metas de um colaborador
 * de forma 100% idêntica entre o Modal de Desempenho e a Tabela do Gerente.
 */
export function calcularDesempenhoColaborador(
  vendas: VendaCalculo[] | any[],
  opcoes: OpcoesCalculoDesempenho = {}
): ResultadoCalculoDesempenho {
  const {
    isTrainee = false,
    targetVendedorId,
    targetVendedorNome,
    filtroTipoVendas = 'todas',
    excluirEspeciaisDasMetas = true
  } = opcoes;

  const sales = (vendas || []).filter((v: any) => {
    const status = String(v.status || '').toUpperCase().trim();
    return status !== 'CANCELADA' && status !== 'CANCELADO';
  });

  const totalTransacoes = sales.length;
  const totalVendasGeral = sales.reduce((acc, s) => acc + Number(s.valor_total || s.valor || 0), 0);
  const ticketMedio = totalTransacoes > 0 ? totalVendasGeral / totalTransacoes : 0;

  // Separação de vendas com apoio de trainee e titular solo
  let faturadoComApoioTrainee = 0;
  let faturadoTitularSolo = 0;

  sales.forEach((s: any) => {
    const val = Number(s.valor_total || s.valor || 0);
    if (val > 0) {
      if (temApoioTrainee(s)) {
        faturadoComApoioTrainee += val;
      } else {
        faturadoTitularSolo += val;
      }
    }
  });

  // Filtro de vendas para metas operacionais (conforme papel e seletor)
  const vendasFiltradasMetas = isTrainee
    ? sales.filter(s => {
      const tIdMatch = targetVendedorId && (String(s.trainee_id) === String(targetVendedorId) || String(s.treener_id) === String(targetVendedorId));
      const tNomeMatch = targetVendedorNome && String(s.trainee_nome || '').toUpperCase().includes(targetVendedorNome.toUpperCase());
      return tIdMatch || tNomeMatch || temApoioTrainee(s) || String(s.vendedor_id) === String(targetVendedorId);
    })
    : (filtroTipoVendas === 'solo'
      ? sales.filter(s => !temApoioTrainee(s))
      : sales);

  // 1. CÁLCULO DE BOLETOS / FINANCIADORAS
  let totalBoletosCalculado = 0;
  let totalBoletosBruto = 0;

  vendasFiltradasMetas.forEach((v: any) => {
    const valorBoleto = extrairValorBoletoVenda(v);
    if (valorBoleto <= 0) return;

    totalBoletosBruto += valorBoleto;

    // Se a regra é excluir Produtos Especiais & Alto Ticket da Meta Operacional de Boletos:
    if (excluirEspeciaisDasMetas && isProdutoEspecial(v)) {
      return; // Linha Apple, Consoles e JBL não pontuam na meta operacional de boletos
    }

    totalBoletosCalculado += valorBoleto;
  });

  const totalBoletos = Math.round(totalBoletosCalculado * 100) / 100;

  // 2. CÁLCULO DE ACESSÓRIOS
  let totalAcessoriosCalculado = 0;

  vendasFiltradasMetas.forEach((v: any) => {
    const itens = Array.isArray(v.itens_venda) ? v.itens_venda : [];

    if (itens.length > 0) {
      itens.forEach((item: any) => {
        const nomeItem = String(item.produto_nome || item.nome || '').toUpperCase().trim();
        const catItem = String(item.categoria || '').toUpperCase().trim();
        if (catItem.includes('ACESS') || TERMOS_ACESSORIOS.some(t => nomeItem.includes(t) || catItem.includes(t))) {
          totalAcessoriosCalculado += Number(item.valor_total || (Number(item.preco_unitario || item.valor_unitario || 0) * Number(item.quantidade || 1)) || 0);
        }
      });
    } else {
      const cat = String(v.categoria || '').toUpperCase().trim();
      const prodNome = String(v.produto_nome || v.produtos_descricao || v.descricao || v.nome || '').toUpperCase().trim();
      if (cat.includes('ACESS') || TERMOS_ACESSORIOS.some(t => cat.includes(t) || prodNome.includes(t))) {
        totalAcessoriosCalculado += Number(v.valor_total || v.valor || 0);
      }
    }
  });

  const totalAcessorios = Math.round(totalAcessoriosCalculado * 100) / 100;

  // 3. CÁLCULO DE PRODUTOS ESPECIAIS & ALTO TICKET (Linha Apple, Consoles, JBL, etc.)
  let totalFaturadoEspeciais = 0;
  let quantidadeItensEspeciais = 0;

  sales.forEach((v: any) => {
    const itens = Array.isArray(v.itens_venda) ? v.itens_venda : [];
    if (itens.length > 0) {
      itens.forEach((item: any) => {
        if (isProdutoEspecial(item)) {
          const qtd = Number(item.quantidade || 1) || 1;
          const val = Number(item.valor_total || (Number(item.preco_unitario || item.valor_unitario || 0) * qtd) || 0);
          totalFaturadoEspeciais += val;
          quantidadeItensEspeciais += qtd;
        }
      });
    } else if (isProdutoEspecial(v)) {
      const qtd = Number(v.quantidade || 1) || 1;
      const val = Number(v.valor_total || v.valor || 0);
      totalFaturadoEspeciais += val;
      quantidadeItensEspeciais += qtd;
    }
  });

  const ticketMedioEspeciais = quantidadeItensEspeciais > 0
    ? totalFaturadoEspeciais / quantidadeItensEspeciais
    : 0;

  return {
    totalVendasGeral: Math.round(totalVendasGeral * 100) / 100,
    totalTransacoes,
    ticketMedio: Math.round(ticketMedio * 100) / 100,
    totalBoletos,
    totalBoletosBruto: Math.round(totalBoletosBruto * 100) / 100,
    totalAcessorios,
    totalFaturadoEspeciais: Math.round(totalFaturadoEspeciais * 100) / 100,
    quantidadeItensEspeciais,
    ticketMedioEspeciais: Math.round(ticketMedioEspeciais * 100) / 100,
    faturadoTitularSolo: Math.round(faturadoTitularSolo * 100) / 100,
    faturadoComApoioTrainee: Math.round(faturadoComApoioTrainee * 100) / 100,
    vendasFiltradasMetas
  };
}

/**
 * Função utilitária com a assinatura solicitada para calcular as metas e realizados do colaborador
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
  const { competencia, isTrainee = false, colaboradorNome, taxaComissao } = opcoesExtras;

  // Filtrar mês de competência caso informado (YYYY-MM)
  let vendasFiltradas = (vendas || []).filter((v: any) => {
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

  const res = calcularDesempenhoColaborador(vendasFiltradas, {
    isTrainee,
    targetVendedorId: colaboradorId,
    targetVendedorNome: colaboradorNome,
    filtroTipoVendas: 'todas',
    excluirEspeciaisDasMetas: true
  });

  const comissaoTotal = vendasFiltradas.reduce((acc, v) => {
    const comissaoCadastrada = isTrainee ? Number(v.comissao_trainee || 0) : Number(v.comissao_vendedor || v.comissao || 0);
    if (comissaoCadastrada > 0) return acc + comissaoCadastrada;
    const taxa = taxaComissao || (isTrainee ? 0.01 : 0.021);
    return acc + (Number(v.valor_total || v.valor || 0) * taxa);
  }, 0);

  return {
    volumeTotal: res.totalVendasGeral,
    totalBoletosMeta: res.totalBoletos,
    totalBoletosBruto: res.totalBoletosBruto,
    totalAcessoriosMeta: res.totalAcessorios,
    totalFaturadoEspeciais: res.totalFaturadoEspeciais,
    comissaoTotal: Math.round(comissaoTotal * 100) / 100,
    transacoes: res.totalTransacoes,
    ticketMedio: res.ticketMedio,
    faturadoTitularSolo: res.faturadoTitularSolo,
    faturadoComApoioTrainee: res.faturadoComApoioTrainee
  };
}

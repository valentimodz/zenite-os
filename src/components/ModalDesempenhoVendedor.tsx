import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Award,
  TrendingUp,
  Target,
  DollarSign,
  Receipt,
  Sparkles,
  Calendar,
  Store,
  User,
  CreditCard,
  ShoppingBag,
  Zap,
  CheckCircle2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Users,
  Filter,
  Gem,
  Download,
  Printer
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import GraficosMinhasMetas from './GraficosMinhasMetas';
import { useMinhasMetasIndividual } from '../hooks/useMetasRankings';
import { useQueryClient } from '@tanstack/react-query';
import { formatarMoeda } from '../utils/currencyUtils';
import {
  calcularDesempenhoGeral,
  calcularDesempenhoColaborador,
  calcularMetasColaborador,
  filtrarVendasDoColaborador,
  extrairValorBoletoVenda,
  baixarRelatorioVendasCSV,
  imprimirRelatorioVendasPDF,
  isPagamentoBoletoFinanciadora as isPagamentoBoletoFinanciadoraUtil,
  isAcessorio as isAcessorioUtil,
  isProdutoEspecial as isProdutoEspecialUtil,
  temApoioTrainee as temApoioTraineeUtil,
  BOLETO_FINANCIADORAS_TERMS as BOLETO_FINANCIADORAS_TERMS_UTIL,
  TERMOS_ACESSORIOS,
  TERMOS_ESPECIAIS
} from '../utils/calculoMetas';

export { calcularDesempenhoGeral, calcularMetasColaborador, calcularDesempenhoColaborador };

export const formatCurrency = (value?: number | string | null): string => {
  if (value === undefined || value === null || value === '' || isNaN(Number(value))) {
    return 'R$ 0,00';
  }
  return Number(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
};

export const formatPercent = (value?: number | null): string => {
  if (value === undefined || value === null || isNaN(Number(value))) {
    return '0%';
  }
  return `${Number(value).toFixed(1)}%`;
};

export interface MetaBanco {
  id?: string;
  vendedor_id?: string;
  mes_ano?: string;
  mes_referencia?: string;
  valor_meta?: number | string | null;
  meta_boleto?: number | string | null;
  meta_acessorios?: number | string | null;
  meta_trainee_boleto?: number | string | null;
  super_meta_boleto?: number | string | null;
  super_meta_acessorios?: number | string | null;
  [key: string]: any;
}

export interface ColaboradorDesempenho {
  id: string;
  nome: string;
  cargo?: string;
  role?: string;
  filial_id?: string;
  is_treinner?: boolean;
  avatar_url?: string;
  filial_nome?: string;
  [key: string]: any;
}

export interface ItemVenda {
  id?: string | number;
  produto_nome?: string;
  nome?: string;
  quantidade?: number | string;
  preco_unitario?: number | string;
  valor_unitario?: number | string;
  categoria?: string;
  [key: string]: any;
}

export interface Venda {
  id: string | number;
  created_at?: string;
  valor_total?: number | string;
  valor?: number | string;
  metodo_pagamento?: string;
  forma_pagamento?: string;
  categoria?: string;
  comissao?: number | string;
  comissao_trainee?: number | string;
  comissao_vendedor?: number | string;
  valor_comissao?: number | string;
  vendedor_id?: string;
  vendedor_nome?: string;
  trainee_nome?: string;
  financeira?: string;
  financeira_parceira?: string;
  observacoes?: string;
  produto_nome?: string;
  descricao?: string;
  produtos_descricao?: string;
  itens_resumo?: string;
  imei?: string;
  teve_participacao_trainee?: boolean;
  treener_id?: string;
  trainee_id?: string;
  quantidade?: number | string;
  itens_venda?: ItemVenda[] | any[];
  produtos?: any;
  vendas_pagamentos?: any[];
  [key: string]: any;
}

export type IVenda = Venda;

export interface DashboardInfo {
  mesReferencia: string;
  isTrainee: boolean;
  totalVendasGeral: number;
  ticketMedio: number;
  totalComissoes: number;
  totalComissaoComoTitular: number;
  totalComissaoComoTrainee: number;
  comissaoTitularExclusiva: number;
  totalComissaoGeradaParaTrainees: number;
  extratoVendasComTrainee: any[];
  metaTotal: number;
  salesCount: number;
  totalBoletos: number;
  metaBoleto: number;
  superMetaBoleto: number;
  progressoBoleto: number;
  badgeBoleto: any;
  totalAcessorios: number;
  realizadoAcessorios: number;
  metaAcessorios: number;
  superMetaAcessorios: number;
  progressoAcessorios: number;
  badgeAcessorios: any;
  faturadoTitular: number;
  faturadoTrainee: number;
  faturadoComApoioTrainee: number;
  faturadoTitularSolo: number;
  totalFaturadoEspeciais: number;
  quantidadeItensEspeciais: number;
  ticketMedioEspeciais: number;
  totalAVista: number;
  progressoTotal: number;
  evolucaoDiaria: { dia: number; total: number }[];
  historico: any[];
}

export interface ModalDesempenhoVendedorProps {
  colaborador: ColaboradorDesempenho;
  colaboradorId?: string | null;
  competencia?: string;
  mesAno?: string;
  filtroMes?: string;
  dataInicio?: string;
  dataFim?: string;
  filiais?: any[];
  vendasCache?: Venda[] | any[];
  vendasColaborador?: Venda[] | any[];
  onClose: () => void;
}

export function calcularComissaoVendaIndividual(
  sale: any,
  opcoes: {
    isTrainee?: boolean;
    bateuMetaBoleto?: boolean;
    bateuSuperMetaBoleto?: boolean;
    bateuMetaAcessorios?: boolean;
    bateuSuperMetaAcessorios?: boolean;
  } = {}
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

  const valorTotal =
    Number(
      sale?.valor_total ??
      sale?.total ??
      sale?.valor ??
      itens?.[0]?.valor_total ??
      itens?.[0]?.preco_unitario ??
      0
    ) || 0;
  const valorBoleto = extrairValorBoletoVenda(sale);

  // REGRA TREINNER BONIFICADO: 1% DA VENDA DOS BOLETO
  if (isTrainee) {
    if (isAcessorioUtil(sale) || isProdutoEspecialUtil(sale)) return 0;
    if (valorBoleto > 0) {
      return Number((valorBoleto * 0.01).toFixed(2));
    }
    return 0;
  }

  // REGRA 1: ACESSÓRIOS (1% ❌ | 2,5% ✅ | 3% 🚀)
  if (isAcessorioUtil(sale)) {
    const taxaAcess = bateuSuperMetaAcessorios ? 0.03 : (bateuMetaAcessorios ? 0.025 : 0.01);
    return Number((valorTotal * taxaAcess).toFixed(2));
  }

  // REGRA 2: JBL / IPHONES / CONSOLES / DRONES / AIR PODS / APPLE WATCH / PENCIL / OUTROS (Por Unidade: R$ 15 ❌ | R$ 30 ✅)
  if (isProdutoEspecialUtil(sale)) {
    const valorPorUnidade = bateuMetaBoleto ? 30.00 : 15.00;
    return Number((quantidade * valorPorUnidade).toFixed(2));
  }

  // REGRA 3: VENDAS NO BOLETO (1% ❌ | 3% ✅ | 3,2% 🚀; menos 1% do Treinner se teve apoio e meta batida)
  if (valorBoleto > 0) {
    let taxaBol = bateuSuperMetaBoleto ? 0.032 : (bateuMetaBoleto ? 0.03 : 0.01);
    if (temApoioTraineeUtil(sale) && bateuMetaBoleto) {
      taxaBol = Math.max(0.01, Number((taxaBol - 0.01).toFixed(4)));
    }
    return Number((valorBoleto * taxaBol).toFixed(2));
  }

  // REGRA 4: VENDAS CELULARES À VISTA / CARTÃO / PIX (1% ❌ | 2% ✅)
  const taxaAvista = bateuMetaBoleto ? 0.02 : 0.01;
  return Number((valorTotal * taxaAvista).toFixed(2));
}

export function obterComissaoVenda(
  venda: any,
  opcoesMeta: {
    isTrainee?: boolean;
    bateuMetaBoleto?: boolean;
    bateuSuperMetaBoleto?: boolean;
    bateuMetaAcessorios?: boolean;
    bateuSuperMetaAcessorios?: boolean;
  } = {}
): number {
  return calcularComissaoVendaIndividual(venda, {
    isTrainee: opcoesMeta.isTrainee ?? false,
    bateuMetaBoleto: opcoesMeta.bateuMetaBoleto ?? true,
    bateuSuperMetaBoleto: opcoesMeta.bateuSuperMetaBoleto ?? false,
    bateuMetaAcessorios: opcoesMeta.bateuMetaAcessorios ?? false,
    bateuSuperMetaAcessorios: opcoesMeta.bateuSuperMetaAcessorios ?? false
  });
}

export function calcularComissaoTotal(venda: any, item?: any) {
  const formaPgto = String(
    venda?.forma_pagamento ||
    venda?.metodo_pagamento ||
    item?.forma_pagamento ||
    ''
  ).toUpperCase();

  const valor = Number(item?.valor_total || venda?.valor_total || 0);
  if (valor <= 0) return { comissaoVendedor: 0, comissaoTrainee: 0 };

  const alvo = item ? { ...venda, ...item, forma_pagamento: formaPgto, valor_total: valor } : venda;
  const comissaoVendedor = obterComissaoVenda(alvo);
  const comissaoTrainee = temApoioTraineeUtil(alvo)
    ? calcularComissaoVendaIndividual(alvo, { isTrainee: true })
    : 0;

  return { comissaoVendedor, comissaoTrainee };
}

export function calcularComissao(vendaOuItem: any): number {
  return obterComissaoVenda(vendaOuItem);
}

// Helper robusto de comissão para cada item
export const calcularComissaoItem = (
  sale: Venda | any,
  isTrainee = false,
  opcoesMeta: {
    bateuMetaBoleto?: boolean;
    bateuSuperMetaBoleto?: boolean;
    bateuMetaAcessorios?: boolean;
    bateuSuperMetaAcessorios?: boolean;
  } = {}
): number => {
  if (!sale) return 0;
  return calcularComissaoVendaIndividual(sale, {
    isTrainee,
    bateuMetaBoleto: opcoesMeta.bateuMetaBoleto ?? true,
    bateuSuperMetaBoleto: opcoesMeta.bateuSuperMetaBoleto ?? false,
    bateuMetaAcessorios: opcoesMeta.bateuMetaAcessorios ?? false,
    bateuSuperMetaAcessorios: opcoesMeta.bateuSuperMetaAcessorios ?? false
  });
};

// Termos e financeiras para metas de boletos/financiadoras (PAYJOY, UME, WATU, AIVA, BOLETO, CREDIARIO, FINANCIADORA, etc.)
export const BOLETO_FINANCIADORAS_TERMS = [
  'BOLETO', 'PAYJOY', 'UME', 'UMA', 'WATU', 'AIVA',
  'CREDIARIO', 'CREDIÁRIO', 'FINANCIADORA', 'FINANCIAMENTO', 'FINANC',
  'PARCELADO', 'PROMIS', 'CARNE', 'CARNÊ'
];

export const isPagamentoBoletoFinanciadora = (p: any): boolean => {
  if (!p) return false;
  // Se for string direta
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

// Helper robusto para identificar se a venda é de acessório
export const isAcessorio = (venda: any): boolean => {
  const cat = (venda.categoria || venda.produtos?.categoria || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
  const prod = (venda.produto_nome || venda.produtos?.nome || venda.descricao || venda.produtos_descricao || venda.itens_resumo || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
  const obs = (venda.observacoes || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();

  const termosAcessorios = [
    'ACESSORIO', 'ACESSORIOS', 'CAPA', 'CAPAS', 'CASE', 'CASES',
    'PELICULA', 'PELICULAS', 'FILME', 'FONE', 'FONES', 'HEADSET', 'AIRPOD',
    'FONTE', 'FONTES', 'CABO', 'CABOS', 'CARREGADOR', 'CARREGADORES',
    'SUPORTE', 'POWERBANK', 'POWER BANK', 'ADAPTADOR', 'ADAPTADORES'
  ];

  if (termosAcessorios.some(termo => cat.includes(termo))) return true;
  if (termosAcessorios.some(termo => prod.includes(termo))) return true;
  if (termosAcessorios.some(termo => obs.includes(termo))) return true;

  if (Array.isArray(venda.itens_venda) && venda.itens_venda.length > 0) {
    return venda.itens_venda.some((item: any) => {
      const iCat = (item.categoria || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
      const iProd = (item.produto_nome || item.nome || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
      return termosAcessorios.some(termo => iCat.includes(termo) || iProd.includes(termo));
    });
  }

  return false;
};

// Helper robusto para identificar se um item ou venda é de Produto Especial / Fora de Meta (Apple, Sony/Consoles, JBL, etc.)
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

  const termosEspeciais = [
    // Linha Apple
    'IPHONE', 'APPLE', 'IPAD', 'MACBOOK', 'APPLE WATCH', 'IMAC', 'AIRTAG',
    // Consoles & Games
    'PLAYSTATION', 'PS5', 'PS4', 'XBOX', 'NINTENDO', 'CONSOLE', 'DRONE', 'SONY',
    // Áudio JBL & Premium
    'JBL', 'BOOMBOX', 'PARTYBOX', 'XTREME', 'CHARGE 5', 'FLIP 6', 'GO 3', 'CLIP 4'
  ];

  if (termosEspeciais.some(t => categoria.includes(t) || nome.includes(t))) {
    return true;
  }

  // Se tiver array de itens aninhados
  if (Array.isArray(itemOuVenda.itens_venda) && itemOuVenda.itens_venda.length > 0) {
    return itemOuVenda.itens_venda.some((it: any) => isProdutoEspecial(it));
  }

  return false;
};

// Helper robusto para identificar se a venda teve participação de trainee
export const temApoioTrainee = (s: Venda | any): boolean => {
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

export default function ModalDesempenhoVendedor({
  colaborador,
  colaboradorId: propColaboradorId,
  competencia: propCompetencia,
  mesAno: propMesAno,
  filtroMes,
  filiais = [],
  vendasCache = [],
  vendasColaborador: propVendasColaborador = [],
  onClose
}: ModalDesempenhoVendedorProps) {
  const mesCompetencia = propCompetencia || propMesAno || filtroMes || new Date().toISOString().slice(0, 7);
  const [mesAtivo, setMesAtivo] = useState<string>(() => mesCompetencia);
  const initialVendas = Array.isArray(propVendasColaborador) && propVendasColaborador.length > 0
    ? propVendasColaborador
    : (Array.isArray(vendasCache) && vendasCache.length > 0 ? vendasCache : []);

  const [vendasColaborador, setVendasColaborador] = useState<Venda[]>(() => initialVendas as Venda[]);
  const [vendasLocais, setVendasLocais] = useState<any[]>(() => initialVendas as any[]);
  const [metaIndividual, setMetaIndividual] = useState<MetaBanco | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 1. EXTRAÇÃO ROBUSTA DO ID E NOME DO VENDEDOR (nunca confundir com o usuário autenticado)
  const colaboradorId = propColaboradorId || (colaborador?.id || colaborador?.vendedor_id || colaborador?.colaborador_id || (colaborador as any)?.colaboradorId || null) ? String(propColaboradorId || colaborador?.id || colaborador?.vendedor_id || colaborador?.colaborador_id || (colaborador as any)?.colaboradorId) : null;
  const targetVendedorId = colaboradorId || '';
  const targetVendedorNome = String(colaborador?.nome || colaborador?.colaborador || colaborador?.vendedor_nome || '').trim();
  const colaboradorFilialId = colaborador?.filial_id;
  const vendasCacheLength = Array.isArray(vendasCache) ? vendasCache.length : 0;
  const lastLoadedVendedorRef = useRef<string | null>(null);

  const queryClient = useQueryClient();

  // Consulta à view consolidada do Supabase para conciliação perfeita
  const {
    colaboradorMetas: dadosViewConsolidada,
    isLoading: isLoadingView,
    refetch: refetchViewConsolidada
  } = useMinhasMetasIndividual({
    colaboradorId: targetVendedorId,
    competencia: mesAtivo,
    enabled: Boolean(targetVendedorId)
  });

  // Estados alimentados diretamente pela RPC 'obter_resumo_metas_vendedor' ou cálculo de vendas
  const [totalVendas, setTotalVendas] = useState<number>(0);
  const [qtdVendas, setQtdVendas] = useState<number>(0);
  const [ticketMedio, setTicketMedio] = useState<number>(0);
  const [comissoesAcumuladas, setComissoesAcumuladas] = useState<number>(0);
  const [realizadoBoletos, setRealizadoBoletos] = useState<number>(0);
  const [realizadoAcessorios, setRealizadoAcessorios] = useState<number>(0);

  // Estados de Metas configuradas para a Filial (tabela 'regras_comissoes')
  const [objetivoBoleto, setObjetivoBoleto] = useState<number>(67500);
  const [superMetaBoleto, setSuperMetaBoleto] = useState<number>(87000);
  const [objetivoAcessorios, setObjetivoAcessorios] = useState<number>(10000);
  const [superMetaAcessorios, setSuperMetaAcessorios] = useState<number>(15000);
  const [metaTotalCombinada, setMetaTotalCombinada] = useState<number>(77500);

  // Filtro seletivo de Metas: 'todas' vs 'solo' (apenas titular solo)
  const [filtroTipoVendas, setFiltroTipoVendas] = useState<'todas' | 'solo'>('todas');
  // Seção colapsável de Extrato de Vendas com Trainee
  const [extratoTraineeAberto, setExtratoTraineeAberto] = useState<boolean>(true);

  // Invalidação de cache local e força de recarga
  const invalidarCacheERecarregar = useCallback((novoMes?: string) => {
    lastLoadedVendedorRef.current = null;
    const mesAlvo = novoMes || mesAtivo;
    if (novoMes) {
      setMesAtivo(novoMes);
    }
    queryClient.invalidateQueries({
      queryKey: ['ranking-colaboradores-v3', mesAlvo]
    });
  }, [mesAtivo, queryClient]);

  // 1. BUSCAR AS METAS DA FILIAL NA TABELA 'regras_comissoes'
  const carregarRegrasMetas = useCallback(async () => {
    const filialId = colaboradorFilialId;
    if (!filialId) return;

    const mesAtual = mesAtivo || mesCompetencia || '2026-10';

    try {
      const { data: regra, error: erroRegra } = await supabase
        .from('regras_comissoes')
        .select('*')
        .eq('filial_id', filialId)
        .eq('mes_referencia', mesAtual)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (erroRegra) {
        console.warn('Erro ao consultar regras_comissoes da filial:', erroRegra);
      }

      if (regra) {
        // Alimenta os objetivos e super metas configurados para o VENDEDOR (nunca o total da loja):
        const metaBoletoVendedor = Number(regra.meta_vendedor_boleto || 67500);
        const metaAcessoriosVendedor = Number(regra.meta_vendedor_acessorios || 10000);
        const superMetaBoletoVendedor = Number(regra.super_meta_boleto || 87000);
        const superMetaAcessoriosVendedor = Number(regra.super_meta_acessorios || 15000);

        setObjetivoBoleto(metaBoletoVendedor);
        setSuperMetaBoleto(superMetaBoletoVendedor);
        setObjetivoAcessorios(metaAcessoriosVendedor);
        setSuperMetaAcessorios(superMetaAcessoriosVendedor);
        setMetaTotalCombinada(metaBoletoVendedor + metaAcessoriosVendedor);
      }
    } catch (err) {
      console.error('Erro ao carregar regras de metas da filial:', err);
    }
  }, [colaboradorFilialId, mesAtivo, mesCompetencia]);

  // Função de carregamento com uma única requisição direta ao Supabase
  const carregarDadosVendedor = useCallback(async () => {
    const vendedorId = targetVendedorId;
    const vendedorNome = targetVendedorNome;
    const competencia = mesAtivo || mesCompetencia || '2026-10';
    if (!vendedorId && !vendedorNome) return;
    setIsLoading(true);

    try {
      // 1. Período do mês atual selecionado (ex: '2026-10')
      const [anoStr, mesStr] = (competencia || '2026-10').split('-');
      const ano = parseInt(anoStr, 10);
      const mes = parseInt(mesStr, 10);
      const ultimoDia = new Date(ano, mes, 0).getDate();
      const inicioMes = `${competencia}-01T00:00:00.000-03:00`;
      const fimMes = `${competencia}-${String(ultimoDia).padStart(2, '0')}T23:59:59.999-03:00`;

      const isUuidValido = Boolean(
        vendedorId &&
        vendedorId !== 'sem_vendedor' &&
        !String(vendedorId).startsWith('nome_')
      );

      // Busca meta individual rápida em paralelo
      (async () => {
        try {
          let mQuery = supabase.from('metas').select('*');
          if (isUuidValido) {
            mQuery = mQuery.eq('vendedor_id', vendedorId);
          } else if (vendedorNome) {
            mQuery = mQuery.ilike('vendedor_nome', `%${vendedorNome}%`);
          }
          const { data: mData } = await mQuery
            .or(`mes_ano.eq.${competencia},mes_referencia.eq.${competencia}`)
            .maybeSingle();

          if (mData) {
            setMetaIndividual(mData);
          }
        } catch {
          // Erro silencioso ao carregar meta individual
        }
      })();

      // 2. Busca de vendas sem filtro restritivo de filial_id e sem .neq('status','CANCELADA') em SQL (que descarta status IS NULL)
      const orClauses: string[] = [];
      if (isUuidValido) {
        orClauses.push(`vendedor_id.eq.${vendedorId}`);
        orClauses.push(`usuario_id.eq.${vendedorId}`);
        orClauses.push(`trainee_id.eq.${vendedorId}`);
        orClauses.push(`treener_id.eq.${vendedorId}`);
      }
      if (vendedorNome) {
        const nomeLimpo = vendedorNome.trim();
        orClauses.push(`vendedor_nome.ilike.%${nomeLimpo}%`);
        orClauses.push(`trainee_nome.ilike.%${nomeLimpo}%`);
        const primeiroNome = nomeLimpo.split(/\s+/)[0];
        if (primeiroNome && primeiroNome.length >= 3 && primeiroNome.toUpperCase() !== nomeLimpo.toUpperCase()) {
          orClauses.push(`vendedor_nome.ilike.%${primeiroNome}%`);
          orClauses.push(`trainee_nome.ilike.%${primeiroNome}%`);
        }
      }

      let query = supabase
        .from('vendas')
        .select('*, itens_venda (*)')
        .gte('created_at', inicioMes)
        .lte('created_at', fimMes)
        .order('created_at', { ascending: false });

      if (orClauses.length > 0) {
        query = query.or(orClauses.join(','));
      }

      const { data: vendasRes, error: vendasError } = await query;
      let vendas = vendasRes;

      if (vendasError) {
        let fbQuery = supabase
          .from('vendas')
          .select('*')
          .gte('created_at', inicioMes)
          .lte('created_at', fimMes)
          .order('created_at', { ascending: false });
        if (orClauses.length > 0) {
          fbQuery = fbQuery.or(orClauses.join(','));
        }
        const fbRes = await fbQuery;
        vendas = fbRes.data || [];
      }

      if (vendas) {
        const cargoNormalizado = String(colaborador?.cargo || (colaborador as any)?.funcao || '').toUpperCase().trim();
        const roleNormalizado = String(colaborador?.role || '').toUpperCase().trim();
        const isOriginalTrainee = cargoNormalizado.includes('TRAINEE') || roleNormalizado.includes('TRAINEE') || colaborador?.is_treinner === true;

        // Filtra estritamente na competência America/Sao_Paulo e valida vínculo do colaborador
        const vendasMesBr = vendas.filter((v: any) => {
          const statusLimpo = String(v?.status || '').toUpperCase().trim();
          if (statusLimpo === 'CANCELADA' || statusLimpo === 'CANCELADO') return false;
          const rawDate = v.created_at || v.data;
          if (!rawDate) return true;
          try {
            const dt = new Date(rawDate);
            if (isNaN(dt.getTime())) return true;
            const brComp = new Intl.DateTimeFormat('en-CA', {
              timeZone: 'America/Sao_Paulo',
              year: 'numeric',
              month: '2-digit'
            }).format(dt);
            return brComp === competencia;
          } catch {
            return true;
          }
        });

        const vendasValidas = filtrarVendasDoColaborador(vendasMesBr, {
          id: isUuidValido ? vendedorId : undefined,
          nome: vendedorNome,
          isTrainee: isOriginalTrainee
        });

        const modoVis: 'COM_APOIO' | 'SOLO' = filtroTipoVendas === 'solo' ? 'SOLO' : 'COM_APOIO';
        const resumoGeral = calcularDesempenhoGeral(vendasValidas, modoVis, {
          isTrainee: isOriginalTrainee,
          metaBoleto: objetivoBoleto,
          superMetaBoleto: superMetaBoleto,
          metaAcessorios: objetivoAcessorios,
          superMetaAcessorios: superMetaAcessorios,
          metaTotal: metaTotalCombinada,
          targetVendedorId: vendedorId,
          targetVendedorNome: vendedorNome
        });

        // Atualiza os estados da tela com a fórmula unificada
        setTotalVendas(resumoGeral.volumeTotal);
        setQtdVendas(resumoGeral.transacoes);
        setTicketMedio(resumoGeral.ticketMedio);
        setComissoesAcumuladas(resumoGeral.comissaoLiquida);
        setRealizadoBoletos(resumoGeral.totalBoletos);
        setRealizadoAcessorios(resumoGeral.totalAcessorios);
        setVendasColaborador(vendasValidas as Venda[]);
        setVendasLocais(vendasValidas as any[]);
      }
    } catch (err) {
      console.error('Erro ao calcular metas do vendedor:', err);
    } finally {
      setIsLoading(false);
    }
  }, [targetVendedorId, targetVendedorNome, mesAtivo, mesCompetencia]);

  const carregarDadosMetas = carregarDadosVendedor;

  // 3. ATUALIZAR NO USEEFFECT:
  // Executa carregarRegrasMetas() e carregarDadosVendedor() quando o modal for aberto ou filialId/mesAtivo mudarem
  useEffect(() => {
    if (mounted) {
      if (colaboradorFilialId) {
        carregarRegrasMetas();
      }
      if (targetVendedorId || targetVendedorNome) {
        carregarDadosVendedor();
      }
    }
  }, [mounted, colaboradorFilialId, targetVendedorId, targetVendedorNome, mesAtivo, carregarRegrasMetas, carregarDadosVendedor]);

  // Cálculos do Dashboard do Colaborador 100% centralizados via calcularDesempenhoGeral
  const dashboardInfo = useMemo(() => {
    // 1. Classificação estrita de Trainee (apenas se o cargo ou função for explicitamente de trainee)
    const cargoNormalizado = String(colaborador?.cargo || (colaborador as any)?.funcao || '').toUpperCase().trim();
    const roleNormalizado = String(colaborador?.role || '').toUpperCase().trim();
    const isOriginalTrainee = Boolean(
      cargoNormalizado.includes('TRAINEE') ||
      roleNormalizado.includes('TRAINEE') ||
      colaborador?.is_treinner === true
    );
    const isTrainee = isOriginalTrainee;

    // 2. Mapeamento oficial de metas com prioridade para meta individual e regras_comissoes da filial
    const metaBanco = metaIndividual;

    const metaBoleto = Number(metaBanco?.meta_boleto) > 0
      ? Number(metaBanco?.meta_boleto)
      : (isTrainee
        ? (Number(metaBanco?.meta_trainee_boleto) || 35000)
        : (objetivoBoleto > 0 ? objetivoBoleto : 67500));

    const metaAcessorios = Number(metaBanco?.meta_acessorios) > 0
      ? Number(metaBanco?.meta_acessorios)
      : (isTrainee
        ? 5000
        : (objetivoAcessorios > 0 ? objetivoAcessorios : 10000));

    const metaTotal = metaTotalCombinada > 0 ? metaTotalCombinada : (metaBoleto + metaAcessorios);

    const metaSuperBoleto = Number(metaBanco?.super_meta_boleto) > 0
      ? Number(metaBanco?.super_meta_boleto)
      : (isTrainee
        ? 45000
        : (superMetaBoleto > 0 ? superMetaBoleto : 87000));

    const metaSuperAcessorios = Number(metaBanco?.super_meta_acessorios) > 0
      ? Number(metaBanco?.super_meta_acessorios)
      : (isTrainee
        ? 7500
        : (superMetaAcessorios > 0 ? superMetaAcessorios : 15000));

    // Fallback em cascata para que 'sales' nunca fique vazio se houver vendas disponíveis
    const vendasParaCalculo = (Array.isArray(vendasColaborador) && vendasColaborador.length > 0)
      ? vendasColaborador
      : ((Array.isArray(vendasLocais) && vendasLocais.length > 0)
        ? vendasLocais
        : ((Array.isArray(propVendasColaborador) && propVendasColaborador.length > 0)
          ? propVendasColaborador
          : ((Array.isArray(vendasCache) && vendasCache.length > 0)
            ? vendasCache
            : ((Array.isArray((colaborador as any)?.vendas_colaborador) && (colaborador as any).vendas_colaborador.length > 0)
              ? (colaborador as any).vendas_colaborador
              : ((Array.isArray((colaborador as any)?.vendas) && (colaborador as any).vendas.length > 0)
                ? (colaborador as any).vendas
                : ((Array.isArray((colaborador as any)?.extrato) && (colaborador as any).extrato.length > 0)
                  ? (colaborador as any).extrato
                  : []))))));

    const sales = (vendasParaCalculo || []) as any[];
    const modoVisualizacao: 'COM_APOIO' | 'SOLO' = filtroTipoVendas === 'solo' ? 'SOLO' : 'COM_APOIO';

    // 3. Centralização Única via calcularDesempenhoGeral
    const desempenhoGeral = calcularDesempenhoGeral(sales, modoVisualizacao, {
      isTrainee,
      metaBoleto,
      superMetaBoleto: metaSuperBoleto,
      metaAcessorios,
      superMetaAcessorios: metaSuperAcessorios,
      metaTotal,
      targetVendedorId,
      targetVendedorNome
    });

    const totalVendasGeral = desempenhoGeral.volumeTotal;
    const salesCount = desempenhoGeral.transacoes;
    const ticketMedioCalc = desempenhoGeral.ticketMedio;
    const totalBoletos = desempenhoGeral.totalBoletos;
    const totalAcessorios = desempenhoGeral.totalAcessorios;
    const totalAVista = desempenhoGeral.totalAVista;
    const progressoTotal = desempenhoGeral.progressoTotal;
    const progressoBoleto = desempenhoGeral.progressoBoleto;
    const progressoAcessorios = desempenhoGeral.progressoAcessorios;
    const badgeBoleto = desempenhoGeral.badgeBoleto;
    const badgeAcessorios = desempenhoGeral.badgeAcessorios;
    const faturadoTitularSolo = desempenhoGeral.faturadoTitularSolo;
    const faturadoComApoioTrainee = desempenhoGeral.faturadoComApoioTrainee;
    const totalFaturadoEspeciais = desempenhoGeral.totalFaturadoEspeciais;
    const quantidadeItensEspeciais = desempenhoGeral.quantidadeItensEspeciais;
    const ticketMedioEspeciais = desempenhoGeral.ticketMedioEspeciais;

    const totalComissoes = desempenhoGeral.comissaoLiquida;
    const comissaoTitularExclusiva = desempenhoGeral.comissaoLiquida;
    const totalComissaoComoTitular = desempenhoGeral.comissaoLiquida;
    const totalComissaoComoTrainee = desempenhoGeral.comissaoTrainee;
    const totalComissaoGeradaParaTrainees = desempenhoGeral.comissaoTrainee;

    // Lista de extrato de vendas com trainee
    interface ExtratoVendaTrainee {
      id: string | number;
      data: string;
      produto: string;
      traineeNome: string;
      valorVenda: number;
      comissaoTrainee: number;
      imei?: string;
    }
    const extratoVendasComTrainee: ExtratoVendaTrainee[] = [];

    sales.forEach(s => {
      if (temApoioTrainee(s)) {
        const valTotal = Number(s.valor_total || s.valor || 0);
        // COMISSIONAMENTO TREINNER BONIFICADO: 1% DA VENDA DOS BOLETO
        const cTraineeCalc = calcularComissaoVendaIndividual(s, { isTrainee: true });

        const itens = Array.isArray(s.itens_venda) ? s.itens_venda : [];
        let nomeBase = s.produto_nome || s.descricao || (itens.length > 0 ? itens[0]?.produto_nome : null) || 'Produto / Pedido';
        if (itens.length > 1) {
          nomeBase = `${nomeBase} (+${itens.length - 1} itens)`;
        }

        const tNome = String(s.trainee_nome || (colaborador?.cargo?.toLowerCase().includes('trainee') ? colaborador.nome : '') || 'Trainee Vinculado').trim();

        extratoVendasComTrainee.push({
          id: s.id || Math.random(),
          data: s.created_at || s.data || new Date().toISOString(),
          produto: nomeBase,
          traineeNome: tNome,
          valorVenda: valTotal,
          comissaoTrainee: cTraineeCalc,
          imei: s.imei
        });
      }
    });

    // Evolução diária (dias 1 a 31)
    const [anoStr, mesStr] = (mesAtivo || mesCompetencia).split('-');
    const ano = parseInt(anoStr, 10);
    const mes = parseInt(mesStr, 10);
    const diasNoMes = new Date(ano, mes, 0).getDate();
    const evolucaoDiaria: { dia: number; total: number }[] = [];
    for (let d = 1; d <= diasNoMes; d++) {
      evolucaoDiaria.push({ dia: d, total: 0 });
    }
    sales.forEach(s => {
      const dStr = s.created_at || s.data;
      if (dStr) {
        const dt = new Date(dStr);
        const diaNum = dt.getDate();
        if (diaNum >= 1 && diaNum <= diasNoMes) {
          evolucaoDiaria[diaNum - 1].total += parseFloat(String(s.valor_total || s.valor || 0));
        }
      }
    });

    return {
      mesReferencia: mesAtivo,
      isTrainee,
      totalVendasGeral,
      ticketMedio: ticketMedioCalc,
      totalComissoes,
      totalComissaoComoTitular,
      totalComissaoComoTrainee,
      comissaoTitularExclusiva,
      totalComissaoGeradaParaTrainees,
      extratoVendasComTrainee,
      metaTotal: desempenhoGeral.metaTotal,
      salesCount,
      // Boletos
      totalBoletos,
      metaBoleto: desempenhoGeral.metaBoleto,
      superMetaBoleto: desempenhoGeral.superMetaBoleto,
      progressoBoleto,
      badgeBoleto,
      // Acessórios
      totalAcessorios,
      realizadoAcessorios: totalAcessorios,
      metaAcessorios: desempenhoGeral.metaAcessorios,
      superMetaAcessorios: desempenhoGeral.superMetaAcessorios,
      progressoAcessorios,
      badgeAcessorios,
      faturadoTitular: faturadoTitularSolo,
      faturadoTrainee: faturadoComApoioTrainee,
      faturadoComApoioTrainee: Number(faturadoComApoioTrainee || 0),
      faturadoTitularSolo: Number(faturadoTitularSolo || 0),
      // Produtos Especiais & Alto Ticket (Fora de Meta)
      totalFaturadoEspeciais,
      quantidadeItensEspeciais,
      ticketMedioEspeciais,
      // Geral
      totalAVista,
      progressoTotal,
      evolucaoDiaria,
      historico: sales
    };
  }, [
    metaIndividual,
    vendasColaborador,
    vendasLocais,
    propVendasColaborador,
    vendasCache,
    dadosViewConsolidada,
    colaboradorId,
    colaborador?.nome,
    colaborador?.cargo,
    colaborador?.role,
    colaborador?.is_treinner,
    mesAtivo,
    mesCompetencia,
    objetivoBoleto,
    superMetaBoleto,
    objetivoAcessorios,
    superMetaAcessorios,
    metaTotalCombinada,
    filtroTipoVendas
  ]);

  // Identificação da filial
  const filialDoColaborador = filiais.find(f => String(f.id) === String(colaborador?.filial_id)) || null;

  if (!mounted || typeof document === 'undefined') {
    return null;
  }

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="bg-[#0D0D0D] border border-[#222222] rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative my-auto">

        {/* CABEÇALHO DO MODAL */}
        <div className="p-4 sm:p-6 border-b border-[#222222] bg-[#0A0A0A] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#6A0DAD] to-[#450A7A] flex items-center justify-center text-white font-black text-lg shadow-lg shadow-purple-950/40 border border-purple-500/30">
              {colaborador.avatar_url ? (
                <img
                  src={colaborador.avatar_url}
                  alt={colaborador.nome}
                  className="w-full h-full object-cover rounded-xl"
                />
              ) : (
                (colaborador.nome || 'V').slice(0, 2).toUpperCase()
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white tracking-wide">
                  Desempenho &amp; Metas: {colaborador.nome}
                </h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${dashboardInfo.isTrainee
                  ? 'bg-purple-950/60 text-purple-300 border border-purple-700/50'
                  : 'bg-emerald-950/60 text-emerald-400 border border-emerald-700/50'
                  }`}>
                  {dashboardInfo.isTrainee ? 'Trainee Bonificado' : (colaborador.cargo || colaborador.role || 'Vendedor')}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 mt-1">
                <span className="flex items-center gap-1">
                  <Store size={13} className="text-gray-500" />
                  {filialDoColaborador?.nome || colaborador.filial_nome || 'Filial não vinculada'}
                </span>
                <span className="text-gray-600">•</span>
                <span className="flex items-center gap-1">
                  <Calendar size={13} className="text-[#6A0DAD]" />
                  Competência: <strong className="text-gray-200">{dashboardInfo.mesReferencia}</strong>
                </span>
                {((dashboardInfo?.faturadoTitularSolo ?? 0) > 0 || (dashboardInfo?.faturadoComApoioTrainee ?? 0) > 0) && (
                  <span className="inline-flex items-center gap-2">
                    <span className="text-gray-600">•</span>
                    <span className="text-purple-300 font-semibold">
                      {dashboardInfo?.isTrainee
                        ? `Atuação como Trainee: R$ ${(dashboardInfo?.faturadoComApoioTrainee ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Vendas Diretas: R$ ${(dashboardInfo?.faturadoTitularSolo ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : `Titular Solo: R$ ${(dashboardInfo?.faturadoTitularSolo ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Com Apoio Trainee: R$ ${(dashboardInfo?.faturadoComApoioTrainee ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-auto">
            {/* Seletor de Mês */}
            <div className="flex items-center gap-1.5 bg-[#151515] border border-[#2A2A2A] rounded-lg px-2.5 py-1.5">
              <Calendar size={13} className="text-gray-400" />
              <input
                type="month"
                value={mesAtivo}
                onChange={(e) => {
                  const novoM = e.target.value;
                  invalidarCacheERecarregar(novoM);
                }}
                className="bg-transparent text-white text-xs font-bold font-mono outline-none cursor-pointer"
              />
            </div>

            {/* Botão Recarregar */}
            <button
              type="button"
              onClick={() => {
                invalidarCacheERecarregar();
                carregarRegrasMetas();
                carregarDadosVendedor();
              }}
              disabled={isLoading}
              className="p-2 rounded-lg bg-black border border-[#222222] hover:border-[#6A0DAD]/50 text-gray-300 hover:text-white transition-colors cursor-pointer"
              title="Recarregar dados"
            >
              <RefreshCw size={15} className={isLoading ? 'animate-spin text-[#6A0DAD]' : ''} />
            </button>

            {/* Botão Fechar */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg bg-[#151515] hover:bg-rose-950/40 text-gray-400 hover:text-rose-400 border border-[#2A2A2A] hover:border-rose-800/60 transition-colors cursor-pointer"
              title="Fechar Dashboard"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* CORPO DO MODAL (SCROLLÁVEL) */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">

          {/* CARDS SUPERIORES DE MÉTRICAS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

            {/* Vendas Totais */}
            <div className="bg-[#0A0A0A] border border-[#222222] rounded-xl p-4 flex flex-col justify-between shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Vendas Totais ({dashboardInfo.mesReferencia})</span>
                <div className="w-7 h-7 rounded-lg bg-[#6A0DAD]/20 text-purple-300 flex items-center justify-center border border-[#6A0DAD]/40">
                  <DollarSign size={14} />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-xl sm:text-2xl font-black text-white font-mono block">
                  {formatCurrency(dashboardInfo.totalVendasGeral)}
                </span>
                <span className="text-[11px] text-gray-400 mt-1 block">
                  {dashboardInfo.salesCount} {dashboardInfo.salesCount === 1 ? 'venda realizada' : 'vendas realizadas'}
                </span>
                {((dashboardInfo?.faturadoTitularSolo ?? 0) > 0 || (dashboardInfo?.faturadoComApoioTrainee ?? 0) > 0) && (
                  <span className="text-[10px] text-purple-300 mt-1 block font-medium">
                    Titular Solo: R$ {(dashboardInfo?.faturadoTitularSolo ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Com Apoio Trainee: R$ {(dashboardInfo?.faturadoComApoioTrainee ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                )}
              </div>
            </div>

            {/* Ticket Médio */}
            <div className="bg-[#0A0A0A] border border-[#222222] rounded-xl p-4 flex flex-col justify-between shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ticket Médio</span>
                <div className="w-7 h-7 rounded-lg bg-blue-950/30 text-blue-400 flex items-center justify-center border border-blue-800/40">
                  <TrendingUp size={14} />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-xl sm:text-2xl font-black text-blue-400 font-mono block">
                  {formatCurrency(dashboardInfo.ticketMedio)}
                </span>
                <span className="text-[11px] text-gray-400 mt-1 block">Média por transação faturada</span>
              </div>
            </div>

            {/* Comissões Acumuladas */}
            <div className="bg-[#0A0A0A] border border-[#222222] rounded-xl p-4 flex flex-col justify-between shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Comissões Acumuladas</span>
                <div className="w-7 h-7 rounded-lg bg-emerald-950/30 text-emerald-400 flex items-center justify-center border border-emerald-800/40">
                  <Award size={14} />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono block">
                  {formatCurrency(dashboardInfo.isTrainee ? dashboardInfo.totalComissoes : dashboardInfo.comissaoTitularExclusiva)}
                </span>
                <span className="text-[10px] text-gray-400 uppercase tracking-wider block font-semibold mt-0.5">
                  {dashboardInfo.isTrainee ? 'Comissão Trainee (Líquida)' : 'Comissão do Titular (Líquida)'}
                </span>

                {/* Subcard detalhado com clareza total: Titular e Trainees */}
                <div className="mt-3 pt-2.5 border-t border-[#1C1C1C] space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-300 font-medium">Comissão do Titular:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {formatCurrency(dashboardInfo.comissaoTitularExclusiva)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-purple-300/90 font-medium">
                      {dashboardInfo.isTrainee ? 'Comissão Apoio/Trainee:' : 'Comissão Repassada aos Trainees:'}
                    </span>
                    <span className="font-mono font-bold text-purple-300">
                      {formatCurrency(dashboardInfo.isTrainee ? dashboardInfo.totalComissaoComoTrainee : dashboardInfo.totalComissaoGeradaParaTrainees)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* CARTÃO 1: META TOTAL COMBINADA */}
            <div className="bg-[#0A0A0A] border border-[#222222] rounded-xl p-4 flex flex-col justify-between shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Meta Total Combinada</span>
                <div className="w-7 h-7 rounded-lg bg-purple-950/30 text-purple-400 flex items-center justify-center border border-purple-800/40">
                  <Target size={14} />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-xl sm:text-2xl font-black text-purple-300 font-mono block">
                  {formatCurrency(dashboardInfo.metaTotal)}
                </span>
                <div className="w-full bg-[#1A1A1A] rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#6A0DAD] to-purple-400 transition-all duration-700"
                    style={{ width: `${Math.min(100, Math.max(0, Number(dashboardInfo.progressoTotal) || 0))}%` }}
                  ></div>
                </div>
                <span className="text-[9px] text-purple-400/80 mt-1.5 block font-semibold">
                  {formatPercent(dashboardInfo.progressoTotal)} • Boletos ({formatCurrency(dashboardInfo.metaBoleto)}) + Acessórios ({formatCurrency(dashboardInfo.metaAcessorios)})
                </span>
              </div>
            </div>

          </div>

          {/* CABEÇALHO DA SEÇÃO DE METAS COM FILTRO SELETIVO */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0A0A0A] border border-[#222222] rounded-xl px-4 py-3">
            <div className="flex items-center gap-2">
              <Target size={16} className="text-[#6A0DAD]" />
              <span className="text-xs font-bold text-gray-200 uppercase tracking-wider">
                Metas Operacionais do Período
              </span>
              <span className="text-[10px] text-gray-500 font-mono">
                (Itens faturados com apoio são somados por padrão)
              </span>
            </div>

            {/* SELETOR SELETIVO: TODAS AS VENDAS VS APENAS TITULAR SOLO */}
            <div className="flex items-center bg-[#141414] border border-[#262626] rounded-lg p-0.5 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setFiltroTipoVendas('todas')}
                className={`px-3 py-1 rounded-md text-[11px] font-bold tracking-wide transition-all ${filtroTipoVendas === 'todas'
                  ? 'bg-gradient-to-r from-[#6A0DAD] to-[#8A2BE2] text-white shadow-md'
                  : 'text-gray-400 hover:text-gray-200'
                  }`}
              >
                Todas as Vendas (Com Apoio)
              </button>
              <button
                type="button"
                onClick={() => setFiltroTipoVendas('solo')}
                className={`px-3 py-1 rounded-md text-[11px] font-bold tracking-wide transition-all ${filtroTipoVendas === 'solo'
                  ? 'bg-gradient-to-r from-[#6A0DAD] to-[#8A2BE2] text-white shadow-md'
                  : 'text-gray-400 hover:text-gray-200'
                  }`}
              >
                Apenas Titular Solo
              </button>
            </div>
          </div>

          {/* BLOCOS DE METAS: BOLETOS & ACESSÓRIOS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* CARTÃO 2: META DE BOLETOS / FINANCIADORAS */}
            <div className="bg-[#0A0A0A] border border-[#222222] rounded-xl p-5 space-y-4 shadow-lg">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1A1A1A] pb-3">
                <div>
                  <h4 className="text-sm font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                    <CreditCard size={16} /> Meta de Boletos / Financiadoras
                  </h4>
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    Boleto, PayJoy, Watu, Ume, Aiva e Crediário
                  </span>
                </div>
                <div className={`px-2.5 py-1 rounded text-[11px] font-bold ${dashboardInfo?.badgeBoleto?.classe || 'bg-amber-950/40 text-amber-400 border border-amber-800/40'}`}>
                  {dashboardInfo?.badgeBoleto?.texto || 'Faixa Atual: 1,0%'}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 bg-[#111111] p-3 rounded-lg border border-[#222222] text-center font-mono">
                <div>
                  <span className="text-[9px] text-gray-400 uppercase font-bold block">Realizado</span>
                  <span className="text-sm sm:text-base font-black text-amber-400 mt-0.5 block">
                    {formatCurrency(dashboardInfo.totalBoletos)}
                  </span>
                </div>
                <div className="border-x border-[#222222]">
                  <span className="text-[9px] text-gray-400 uppercase font-bold block">Objetivo</span>
                  <span className="text-sm sm:text-base font-black text-white mt-0.5 block">
                    {formatCurrency(dashboardInfo.metaBoleto)}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-purple-300 uppercase font-bold block flex items-center justify-center gap-0.5">
                    <Sparkles size={10} /> Super Meta
                  </span>
                  <span className="text-sm sm:text-base font-black text-purple-300 mt-0.5 block">
                    {formatCurrency(dashboardInfo.superMetaBoleto)}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-gray-400">Progresso do Objetivo</span>
                  <span className="text-amber-400 font-mono">{formatPercent(dashboardInfo.progressoBoleto)} atingido</span>
                </div>
                <div className="w-full bg-[#161616] rounded-full h-3 overflow-hidden border border-[#222222]">
                  <div
                    className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-400 shadow-[0_0_10px_#f59e0b]"
                    style={{ width: `${Math.min(100, Math.max(0, Number(dashboardInfo.progressoBoleto) || 0))}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* CARTÃO 3: META DE ACESSÓRIOS */}
            <div className="bg-[#0A0A0A] border border-[#222222] rounded-xl p-5 space-y-4 shadow-lg">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1A1A1A] pb-3">
                <div>
                  <h4 className="text-sm font-extrabold text-pink-400 uppercase tracking-wider flex items-center gap-2">
                    <ShoppingBag size={16} /> Meta de Acessórios
                  </h4>
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    Capas, Películas, Fones, Carregadores e Cabos
                  </span>
                </div>
                <div className={`px-2.5 py-1 rounded text-[11px] font-bold ${dashboardInfo?.badgeAcessorios?.classe || 'bg-amber-950/40 text-amber-400 border border-amber-800/40'}`}>
                  {dashboardInfo?.badgeAcessorios?.texto || 'Faixa Atual: 1,0%'}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 bg-[#111111] p-3 rounded-lg border border-[#222222] text-center font-mono">
                <div>
                  <span className="text-[9px] text-gray-400 uppercase font-bold block">Realizado</span>
                  <span className="text-sm sm:text-base font-black text-pink-400 mt-0.5 block">
                    {formatCurrency(dashboardInfo.totalAcessorios || dashboardInfo.realizadoAcessorios || 0)}
                  </span>
                </div>
                <div className="border-x border-[#222222]">
                  <span className="text-[9px] text-gray-400 uppercase font-bold block">Objetivo</span>
                  <span className="text-sm sm:text-base font-black text-white mt-0.5 block">
                    {formatCurrency(dashboardInfo.metaAcessorios)}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-pink-300 uppercase font-bold block flex items-center justify-center gap-0.5">
                    <Sparkles size={10} /> Super Meta
                  </span>
                  <span className="text-sm sm:text-base font-black text-pink-300 mt-0.5 block">
                    {formatCurrency(dashboardInfo.superMetaAcessorios)}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-gray-400">Progresso do Objetivo</span>
                  <span className="text-pink-400 font-mono">
                    {(() => {
                      const metaAcess = Number(dashboardInfo.metaAcessorios) || 10000;
                      const percAcess = metaAcess > 0 ? ((Number(dashboardInfo.totalAcessorios) / metaAcess) * 100) : 0;
                      return `${formatPercent(percAcess)} atingido`;
                    })()}
                  </span>
                </div>
                <div className="w-full bg-[#161616] rounded-full h-3 overflow-hidden border border-[#222222]">
                  <div
                    className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-pink-600 via-pink-500 to-rose-400 shadow-[0_0_10px_#ec4899]"
                    style={{ width: `${Math.min(100, Math.max(0, Number(dashboardInfo.metaAcessorios) > 0 ? (Number(dashboardInfo.totalAcessorios) / Number(dashboardInfo.metaAcessorios)) * 100 : 0))}%` }}
                  ></div>
                </div>
              </div>
            </div>

          </div>

          {/* CARD ANALÍTICO: PRODUTOS ESPECIAIS & ALTO TICKET (FORA DE META) */}
          <div className="bg-[#0A0A0A] border border-[#222222] hover:border-amber-500/40 rounded-xl p-5 shadow-xl transition-all relative overflow-hidden group">
            {/* Efeito Glow Sutil de Fundo */}
            <div className="absolute -top-16 -right-16 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl pointer-events-none group-hover:bg-amber-500/10 transition-all duration-700"></div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1A1A1A] pb-3.5 relative z-10">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/30">
                    <Gem size={15} />
                  </div>
                  <h4 className="text-sm font-extrabold text-amber-300 uppercase tracking-wider">
                    PRODUTOS ESPECIAIS & ALTO TICKET
                  </h4>
                </div>
                <p className="text-[11px] text-gray-400 pl-9">
                  Linha Apple, Consoles, Caixas JBL e Eletrônicos Premium
                </p>
              </div>

              <div className="self-start sm:self-auto px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30 uppercase tracking-wide">
                Sem Meta Operacional / Faturamento Direto
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 relative z-10">
              {/* Valor Principal em Destaque */}
              <div className="bg-[#111111] border border-[#1E1E1E] rounded-xl p-4 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  Total Faturado no Período
                </span>
                <div className="mt-2">
                  <span className="text-2xl sm:text-3xl font-black text-amber-400 font-mono block tracking-tight">
                    {formatCurrency(dashboardInfo.totalFaturadoEspeciais)}
                  </span>
                  <span className="text-[10px] text-gray-400 mt-1 block">
                    Volume bruto comercializado na competência
                  </span>
                </div>
              </div>

              {/* Unidades Vendidas & Ticket Médio */}
              <div className="bg-[#111111] border border-[#1E1E1E] rounded-xl p-4 grid grid-cols-2 gap-2 text-center font-mono">
                <div className="flex flex-col justify-center border-r border-[#222222] pr-2">
                  <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider block">
                    Unidades Vendidas
                  </span>
                  <span className="text-xl sm:text-2xl font-black text-white mt-1 block">
                    {dashboardInfo.quantidadeItensEspeciais} <span className="text-xs font-normal text-gray-400">un.</span>
                  </span>
                  <span className="text-[9px] text-gray-400 mt-0.5 block">Itens especiais</span>
                </div>

                <div className="flex flex-col justify-center pl-2">
                  <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider block">
                    Ticket Médio
                  </span>
                  <span className="text-base sm:text-lg font-black text-amber-300 mt-1 block">
                    {formatCurrency(dashboardInfo.ticketMedioEspeciais)}
                  </span>
                  <span className="text-[9px] text-gray-400 mt-0.5 block">Por item vendido</span>
                </div>
              </div>

              {/* Status de Comissão e Regra Aplicada */}
              <div className="bg-[#111111] border border-[#1E1E1E] rounded-xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Regra de Remuneração
                  </span>
                  <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase ${
                    dashboardInfo.totalBoletos >= dashboardInfo.metaBoleto
                      ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40'
                      : 'bg-amber-950/40 text-amber-400 border border-amber-800/40'
                  }`}>
                    {dashboardInfo.totalBoletos >= dashboardInfo.metaBoleto
                      ? 'R$ 30,00 / un. (Meta Batida ✅)'
                      : 'R$ 15,00 / un. (Meta Não Batida ❌)'}
                  </span>
                </div>
                <div className="mt-2 space-y-1">
                  <span className="text-xs font-bold text-gray-200 block">
                    Vendas por Unidade (JBL, iPhones, Consoles, Drones, AirPods, Watch, Pencil)
                  </span>
                  <p className="text-[10.5px] text-gray-400 leading-snug">
                    R$ 15,00 na Meta Não Batida ❌ e R$ 30,00 na Meta Batida ✅ por unidade vendida.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* GRÁFICOS DINÂMICOS DO COLABORADOR */}
          <GraficosMinhasMetas metasInfo={dashboardInfo} />

          {/* TABELA COM O HISTÓRICO RECENTE DE VENDAS */}
          <div className="bg-[#0A0A0A] border border-[#222222] rounded-xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h4 className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                <Receipt size={16} className="text-[#6A0DAD]" />
                Histórico de Vendas do Colaborador ({dashboardInfo.historico.length})
              </h4>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    baixarRelatorioVendasCSV(dashboardInfo.historico, {
                      colaboradorNome: colaborador.nome,
                      competencia: dashboardInfo.mesReferencia,
                      isTrainee: dashboardInfo.isTrainee,
                      calcularComissaoVendaFn: (s) =>
                        calcularComissaoVendaIndividual(s, {
                          isTrainee: dashboardInfo.isTrainee,
                          bateuMetaBoleto: dashboardInfo.totalBoletos >= dashboardInfo.metaBoleto,
                          bateuSuperMetaBoleto: dashboardInfo.totalBoletos >= dashboardInfo.superMetaBoleto,
                          bateuMetaAcessorios: dashboardInfo.totalAcessorios >= dashboardInfo.metaAcessorios,
                          bateuSuperMetaAcessorios: dashboardInfo.totalAcessorios >= dashboardInfo.superMetaAcessorios
                        })
                    })
                  }
                  disabled={dashboardInfo.historico.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-700/50 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Baixar todas as vendas em planilha Excel / CSV"
                >
                  <Download size={14} />
                  Baixar Relatório (Excel / CSV)
                </button>

                <button
                  type="button"
                  onClick={() =>
                    imprimirRelatorioVendasPDF(dashboardInfo.historico, {
                      colaboradorNome: colaborador.nome,
                      competencia: dashboardInfo.mesReferencia,
                      filialNome: filialDoColaborador?.nome || colaborador.filial_nome || 'Filial Geral',
                      isTrainee: dashboardInfo.isTrainee,
                      calcularComissaoVendaFn: (s) =>
                        calcularComissaoVendaIndividual(s, {
                          isTrainee: dashboardInfo.isTrainee,
                          bateuMetaBoleto: dashboardInfo.totalBoletos >= dashboardInfo.metaBoleto,
                          bateuSuperMetaBoleto: dashboardInfo.totalBoletos >= dashboardInfo.superMetaBoleto,
                          bateuMetaAcessorios: dashboardInfo.totalAcessorios >= dashboardInfo.metaAcessorios,
                          bateuSuperMetaAcessorios: dashboardInfo.totalAcessorios >= dashboardInfo.superMetaAcessorios
                        })
                    })
                  }
                  disabled={dashboardInfo.historico.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#6A0DAD]/20 hover:bg-[#6A0DAD]/40 text-purple-300 border border-[#6A0DAD]/50 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Gerar PDF ou imprimir relatório completo com todas as vendas"
                >
                  <Printer size={14} />
                  Relatório em PDF / Imprimir
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#222222] text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="pb-3">Data</th>
                    <th className="pb-3">Produto</th>
                    <th className="pb-3">Categoria</th>
                    <th className="pb-3 text-center">Quantidade</th>
                    <th className="pb-3 text-right">Total Bruto</th>
                    <th className="pb-3 text-center">Pagamento</th>
                    <th className="pb-3 text-right text-emerald-400">Comissão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222222]/50">
                  {dashboardInfo.historico.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center italic text-gray-600">
                        {isLoading ? 'Carregando vendas...' : `Nenhuma venda registrada para ${colaborador.nome} no mês ${dashboardInfo.mesReferencia}.`}
                      </td>
                    </tr>
                  ) : (
                    dashboardInfo.historico.map((sale, idx) => {
                      const rowKey = sale.id ? `${sale.id}-${idx}` : `venda-${idx}`;
                      const itens = Array.isArray(sale.itens_venda) ? sale.itens_venda : [];
                      let nomeBase = sale.produto_nome || sale.descricao || (itens.length > 0 ? itens[0]?.produto_nome : null) || 'Produto Geral';
                      let produtoNome = nomeBase;
                      if (itens.length > 1) {
                        const sobram = itens.length - 1;
                        produtoNome = `${nomeBase} (+${sobram} ${sobram === 1 ? 'item' : 'itens'})`;
                      }

                      const quantidadeItens = itens.length > 0
                        ? itens.reduce((acc: number, cur: any) => acc + (Number(cur.quantidade) || 1), 0)
                        : (Number(sale.quantidade) || 1);

                      const categoriaExibida = (itens.length > 0 && itens[0]?.categoria)
                        ? itens[0].categoria
                        : (sale.categoria || 'Geral');

                      const comissaoVendaCalculada = calcularComissaoVendaIndividual(sale, {
                        isTrainee: dashboardInfo.isTrainee,
                        bateuMetaBoleto: dashboardInfo.totalBoletos >= dashboardInfo.metaBoleto,
                        bateuSuperMetaBoleto: dashboardInfo.totalBoletos >= dashboardInfo.superMetaBoleto,
                        bateuMetaAcessorios: dashboardInfo.totalAcessorios >= dashboardInfo.metaAcessorios,
                        bateuSuperMetaAcessorios: dashboardInfo.totalAcessorios >= dashboardInfo.superMetaAcessorios
                      });

                      const metodoRaw = String(sale.forma_pagamento || sale.metodo_pagamento || 'N/A').toUpperCase();

                      return (
                        <tr key={rowKey} className="hover:bg-purple-950/5 transition-colors">
                          <td className="py-3 text-gray-400 font-mono">
                            {new Date(sale.created_at || Date.now()).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="py-3">
                            <div className="flex flex-col">
                              <span className="font-semibold text-white">{produtoNome}</span>
                              {Boolean(sale.imei) && (
                                <span className="text-[10px] text-zinc-500 font-mono">IMEI: ...{String(sale.imei).slice(-4)}</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3">
                            <span className="inline-flex px-2 py-0.5 rounded text-[9px] font-bold bg-[#6A0DAD]/10 text-purple-300">
                              {categoriaExibida}
                            </span>
                          </td>
                          <td className="py-3 text-center font-bold text-gray-300">{quantidadeItens}</td>
                          <td className="py-3 text-right font-mono font-bold text-white">
                            {formatarMoeda(sale.valor_total || sale.valor)}
                          </td>
                          <td className="py-3 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#111] text-gray-300 border border-[#333] uppercase">
                              {metodoRaw}
                            </span>
                          </td>
                          <td className="py-3 text-right font-mono font-bold">
                            <span className="text-purple-400 font-bold">
                              {formatarMoeda(comissaoVendaCalculada)}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ABA/SEÇÃO COLAPSÁVEL: EXTRATO DE VENDAS COM TRAINEE */}
          <div className="bg-[#0A0A0A] border border-[#222222] rounded-xl overflow-hidden shadow-lg transition-all">
            <button
              type="button"
              onClick={() => setExtratoTraineeAberto(prev => !prev)}
              className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-[#111111] transition-colors cursor-pointer border-b border-[#1A1A1A]"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-purple-950/40 text-purple-300 flex items-center justify-center border border-purple-800/40">
                  <Users size={14} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-200 uppercase tracking-wider flex items-center gap-2">
                    Extrato de Vendas com Trainee
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#6A0DAD]/20 text-purple-300 border border-[#6A0DAD]/40">
                      {dashboardInfo.extratoVendasComTrainee.length} {dashboardInfo.extratoVendasComTrainee.length === 1 ? 'venda com apoio' : 'vendas com apoio'}
                    </span>
                  </h4>
                  <span className="text-[11px] text-gray-400 mt-0.5 block">
                    Total gerado/repassado aos trainees: <strong className="text-purple-300 font-mono">{formatCurrency(dashboardInfo.totalComissaoGeradaParaTrainees)}</strong>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-gray-400">
                <span className="text-[11px] font-semibold hidden sm:inline">
                  {extratoTraineeAberto ? 'Recolher' : 'Expandir extrato'}
                </span>
                {extratoTraineeAberto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </button>

            {extratoTraineeAberto && (
              <div className="p-4 sm:p-6 overflow-x-auto animate-fade-in">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#222222] text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="pb-3">Data</th>
                      <th className="pb-3">Produto / Pedido</th>
                      <th className="pb-3">Nome do Trainee</th>
                      <th className="pb-3 text-right">Valor da Venda</th>
                      <th className="pb-3 text-right text-purple-400">Comissão Trainee</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#222222]/50">
                    {dashboardInfo.extratoVendasComTrainee.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center italic text-gray-600">
                          Nenhuma venda com apoio de trainee registrada para {colaborador.nome} nesta competência ({dashboardInfo.mesReferencia}).
                        </td>
                      </tr>
                    ) : (
                      dashboardInfo.extratoVendasComTrainee.map((item, idx) => (
                        <tr key={`${item.id}-${idx}`} className="hover:bg-purple-950/10 transition-colors">
                          <td className="py-3 text-gray-400 font-mono">
                            {new Date(item.data).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="py-3">
                            <div className="flex flex-col">
                              <span className="font-semibold text-white">{item.produto}</span>
                              {Boolean(item.imei) && (
                                <span className="text-[10px] text-zinc-500 font-mono">IMEI: ...{String(item.imei).slice(-4)}</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-bold bg-purple-950/40 text-purple-300 border border-purple-800/40">
                              <Users size={11} className="text-purple-400" />
                              {item.traineeNome}
                            </span>
                          </td>
                          <td className="py-3 text-right font-mono font-bold text-white">
                            {formatarMoeda(item.valorVenda)}
                          </td>
                          <td className="py-3 text-right font-mono font-bold text-purple-400">
                            {formatarMoeda(item.comissaoTrainee)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {dashboardInfo.extratoVendasComTrainee.length > 0 && (
                    <tfoot>
                      <tr className="border-t border-[#333] font-bold text-xs bg-[#111]">
                        <td colSpan={3} className="py-3 px-2 text-gray-300 uppercase tracking-wider text-[11px]">
                          Totais de Vendas com Trainee
                        </td>
                        <td className="py-3 text-right font-mono text-white">
                          {formatarMoeda(dashboardInfo.extratoVendasComTrainee.reduce((acc, cur) => acc + cur.valorVenda, 0))}
                        </td>
                        <td className="py-3 text-right font-mono text-purple-300">
                          {formatarMoeda(dashboardInfo.totalComissaoGeradaParaTrainees)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>

        </div>

        {/* RODAPÉ DO MODAL */}
        <div className="p-4 bg-[#0B0B0B] border-t border-[#222222] flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#1F1F1F] hover:bg-[#2A2A2A] text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

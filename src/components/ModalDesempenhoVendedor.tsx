import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  RefreshCw
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import GraficosMinhasMetas from './GraficosMinhasMetas';

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

export interface ModalDesempenhoVendedorProps {
  colaborador: ColaboradorDesempenho;
  mesAno?: string;
  filtroMes?: string;
  dataInicio?: string;
  dataFim?: string;
  filiais?: any[];
  vendasCache?: any[];
  onClose: () => void;
}

// Helper robusto de comissão para cada item
export const calcularComissaoItem = (sale: any, isTrainee = false): number => {
  if (!sale) return 0;
  
  if (sale.comissao !== undefined && sale.comissao !== null && sale.comissao !== '') {
    const val = parseFloat(sale.comissao);
    if (!isNaN(val) && val > 0) return val;
  }
  if (sale.valor_comissao !== undefined && sale.valor_comissao !== null && sale.valor_comissao !== '') {
    const val = parseFloat(sale.valor_comissao);
    if (!isNaN(val) && val > 0) return val;
  }
  if (sale.comissao_vendedor !== undefined && sale.comissao_vendedor !== null && sale.comissao_vendedor !== '') {
    const val = parseFloat(sale.comissao_vendedor);
    if (!isNaN(val) && val > 0) return val;
  }

  const totalBruto = parseFloat(sale.valor_total || sale.valor || sale.preco || 0);
  const qtd = parseInt(sale.quantidade || 1, 10);
  if (totalBruto <= 0) return 0;

  const cat = (sale.produtos?.categoria || sale.categoria || '').toUpperCase();
  const tipo = (sale.produtos?.tipo || sale.tipo || '').toUpperCase();
  const nomeProd = (sale.produto_nome || sale.produtos?.nome || '').toUpperCase();

  // Serviços
  if (cat === 'SERVICO' || tipo === 'SERVICO') {
    return totalBruto * (isTrainee ? 0.02 : 0.03);
  }
  
  // Acessórios
  if (tipo === 'ACESSORIO' || cat.includes('ACESSORIO') || cat.includes('CAPA') || cat.includes('PELICULA') || cat.includes('FONE')) {
    return totalBruto * 0.025;
  }

  // Celulares / Aparelhos
  const isCelular = tipo === 'CELULAR' || cat === 'ANDROID' || cat === 'IOS' || cat.includes('CELULAR') || cat === 'APPLE_JBL_CONSOLE' || !!sale.imei;
  if (isCelular) {
    if (cat === 'IOS' || cat === 'APPLE_JBL_CONSOLE' || nomeProd.includes('IPHONE') || nomeProd.includes('APPLE')) {
      return Math.max(30 * qtd, totalBruto * 0.02);
    }
    return totalBruto * 0.02;
  }

  return totalBruto * 0.02;
};

// Helper robusto para identificar se a venda é de acessório
export const isAcessorio = (venda: any): boolean => {
  const cat = (venda.categoria || venda.produtos?.categoria || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
  const prod = (venda.produto_nome || venda.produtos?.nome || venda.descricao || venda.produtos_descricao || venda.itens_resumo || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
  
  if (cat.includes('ACESSORIO')) return true;

  const termosAcessorios = ['CAPA', 'CASE', 'PELICULA', 'FILME', 'FONE', 'FONTE', 'CABO', 'CARREGADOR', 'SUPORTE', 'POWERBANK', 'ADAPTADOR'];
  if (termosAcessorios.some(termo => prod.includes(termo))) return true;

  if (Array.isArray(venda.itens_venda) && venda.itens_venda.length > 0) {
    return venda.itens_venda.some((item: any) => {
      const iCat = (item.categoria || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
      const iProd = (item.produto_nome || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
      return iCat.includes('ACESSORIO') || termosAcessorios.some(termo => iProd.includes(termo));
    });
  }

  return false;
};

export default function ModalDesempenhoVendedor({
  colaborador,
  mesAno: propMesAno,
  filtroMes,
  filiais = [],
  vendasCache = [],
  onClose
}: ModalDesempenhoVendedorProps) {
  const mesCompetencia = propMesAno || filtroMes || new Date().toISOString().slice(0, 7);
  const [mesAtivo, setMesAtivo] = useState<string>(() => mesCompetencia);
  const [vendasColaborador, setVendasColaborador] = useState<any[]>([]);
  const [metaIndividual, setMetaIndividual] = useState<MetaBanco | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Carregar dados de vendas e metas do colaborador selecionado
  const carregarDadosVendedor = useCallback(async () => {
    if (!colaborador) return;
    setIsLoading(true);

    try {
      const vendedorId = colaborador?.id;
      const vendedorNome = colaborador?.nome;

      // Início e fim do mês selecionado
      const [anoStr, mesStr] = (mesAtivo || mesCompetencia).split('-');
      const ano = parseInt(anoStr, 10);
      const mes = parseInt(mesStr, 10);
      const ultimoDia = new Date(ano, mes, 0).getDate();
      const dataInicio = `${anoStr}-${mesStr}-01T00:00:00Z`;
      const dataFim = `${anoStr}-${mesStr}-${String(ultimoDia).padStart(2, '0')}T23:59:59Z`;

      // 1. Consulta de vendas no Supabase
      let query = supabase
        .from('vendas')
        .select(`
          id,
          created_at,
          valor_total,
          metodo_pagamento,
          forma_pagamento,
          categoria,
          comissao,
          vendedor_id,
          vendedor_nome,
          produto_nome,
          imei,
          teve_participacao_trainee,
          comissao_trainee,
          treener_id,
          trainee_id,
          itens_venda (
            id,
            produto_nome,
            quantidade,
            preco_unitario
          )
        `)
        .gte('created_at', dataInicio)
        .lte('created_at', dataFim)
        .order('created_at', { ascending: false });

      // Filtrar pelo ID do colaborador selecionado ou pelo nome dele
      const isUuid = (str: string | number) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(str));
      const primeiroNome = vendedorNome ? vendedorNome.trim().split(' ')[0] : '';

      if (vendedorId && vendedorId !== '' && vendedorId !== 'sem_vendedor' && !String(vendedorId).startsWith('nome_')) {
        if (isUuid(vendedorId) && primeiroNome) {
          query = query.or(`vendedor_id.eq.${vendedorId},treener_id.eq.${vendedorId},trainee_id.eq.${vendedorId},vendedor_nome.ilike.%${primeiroNome}%`);
        } else if (isUuid(vendedorId)) {
          query = query.or(`vendedor_id.eq.${vendedorId},treener_id.eq.${vendedorId},trainee_id.eq.${vendedorId}`);
        } else if (primeiroNome) {
          query = query.ilike('vendedor_nome', `%${primeiroNome}%`);
        }
      } else if (primeiroNome) {
        query = query.ilike('vendedor_nome', `%${primeiroNome}%`);
      }

      let { data: vendasModal, error } = await query;

      if (error) {
        console.warn('[ModalDesempenhoVendedor] Fallback na busca sem itens_venda:', error);
        let fbQuery = supabase
          .from('vendas')
          .select('id, created_at, valor_total, metodo_pagamento, forma_pagamento, categoria, comissao, vendedor_id, vendedor_nome, produto_nome, imei, teve_participacao_trainee, comissao_trainee, treener_id, trainee_id')
          .gte('created_at', dataInicio)
          .lte('created_at', dataFim)
          .order('created_at', { ascending: false });

        if (vendedorId && vendedorId !== '' && vendedorId !== 'sem_vendedor' && !String(vendedorId).startsWith('nome_')) {
          if (isUuid(vendedorId) && primeiroNome) {
            fbQuery = fbQuery.or(`vendedor_id.eq.${vendedorId},treener_id.eq.${vendedorId},trainee_id.eq.${vendedorId},vendedor_nome.ilike.%${primeiroNome}%`);
          } else if (isUuid(vendedorId)) {
            fbQuery = fbQuery.or(`vendedor_id.eq.${vendedorId},treener_id.eq.${vendedorId},trainee_id.eq.${vendedorId}`);
          } else if (primeiroNome) {
            fbQuery = fbQuery.ilike('vendedor_nome', `%${primeiroNome}%`);
          }
        } else if (primeiroNome) {
          fbQuery = fbQuery.ilike('vendedor_nome', `%${primeiroNome}%`);
        }

        const fbRes = await fbQuery;
        if (!fbRes.error && fbRes.data) {
          vendasModal = fbRes.data;
        }
      }

      // Fallback em cache
      if ((!vendasModal || vendasModal.length === 0) && Array.isArray(vendasCache) && vendasCache.length > 0) {
        const cachedVendas = vendasCache.filter(v => {
          const matchId = vendedorId && String(v.vendedor_id) === String(vendedorId);
          const rawNome = (v.vendedor_nome || '').toLowerCase();
          const pNome = (primeiroNome || '').toLowerCase();
          const matchNome = pNome && rawNome.includes(pNome);
          const matchTrainee = (v.treener_id && String(v.treener_id) === String(vendedorId)) || 
                               (v.trainee_id && String(v.trainee_id) === String(vendedorId));
          return matchId || matchNome || matchTrainee;
        });
        if (cachedVendas.length > 0) {
          vendasModal = cachedVendas;
        }
      }

      setVendasColaborador(vendasModal || []);

      // 2. Consulta de Metas configuradas para o vendedor no mês na tabela 'metas'
      // Colunas oficiais: valor_meta, meta_boleto, meta_acessorios, meta_trainee_boleto, super_meta_boleto, super_meta_acessorios
      let metaEncontrada: MetaBanco | null = null;
      if (colaborador.id && colaborador.id !== 'sem_vendedor' && !String(colaborador.id).startsWith('nome_')) {
        try {
          const { data: mData } = await supabase
            .from('metas')
            .select('*')
            .eq('vendedor_id', colaborador.id)
            .or(`mes_ano.eq.${mesAtivo},mes_referencia.eq.${mesAtivo}`)
            .maybeSingle();

          if (mData) {
            metaEncontrada = mData;
          }
        } catch (e) {
          console.warn('[ModalDesempenhoVendedor] Erro ao consultar metas do vendedor:', e);
        }
      }

      // Fallback para metas da filial
      if (!metaEncontrada && colaborador.filial_id) {
        try {
          const { data: cData } = await supabase
            .from('configuracoes_metas_filial')
            .select('*')
            .eq('filial_id', colaborador.filial_id)
            .eq('mes_ano', mesAtivo)
            .maybeSingle();
          if (cData) metaEncontrada = cData;
        } catch (e) {}
      }

      setMetaIndividual(metaEncontrada);
    } catch (err) {
      console.error('[ModalDesempenhoVendedor] Erro ao carregar dados:', err);
    } finally {
      setIsLoading(false);
    }
  }, [colaborador, mesAtivo, mesCompetencia, vendasCache]);

  useEffect(() => {
    carregarDadosVendedor();
  }, [carregarDadosVendedor]);

  // Cálculos do Dashboard do Colaborador com regras oficiais da tabela 'metas'
  const dashboardInfo = useMemo(() => {
    const isTrainee = Boolean(
      colaborador?.cargo === 'Trainee' || 
      colaborador?.role === 'TRAINEE' || 
      colaborador?.is_treinner ||
      (colaborador?.cargo || '').toLowerCase().includes('trainee')
    );

    // Mapeamento oficial de metas:
    // Trainee: metaTotal = R$ 40.000, metaBoleto = R$ 35.000, metaAcessorios = R$ 5.000
    // Vendedor: metaTotal = R$ 77.500, metaBoleto = R$ 67.500, metaAcessorios = R$ 10.000
    const metaBanco = metaIndividual;

    const metaTotal = Number(metaBanco?.valor_meta) > 0 
      ? Number(metaBanco?.valor_meta) 
      : (isTrainee ? 40000 : 77500);

    const metaBoleto = Number(metaBanco?.meta_boleto) > 0 
      ? Number(metaBanco?.meta_boleto) 
      : (isTrainee ? (Number(metaBanco?.meta_trainee_boleto) || 35000) : 67500);

    const metaAcessorios = Number(metaBanco?.meta_acessorios) > 0 
      ? Number(metaBanco?.meta_acessorios) 
      : (isTrainee ? 5000 : 10000);

    const superMetaBoleto = Number(metaBanco?.super_meta_boleto) > 0 
      ? Number(metaBanco?.super_meta_boleto) 
      : (isTrainee ? 45000 : 87000);

    const superMetaAcessorios = Number(metaBanco?.super_meta_acessorios) > 0 
      ? Number(metaBanco?.super_meta_acessorios) 
      : (isTrainee ? 7500 : 15000);

    const sales = vendasColaborador || [];
    const salesCount = sales.length;
    const totalVendasGeral = sales.reduce((acc, s) => acc + parseFloat(s.valor_total || s.valor || 0), 0);
    const ticketMedio = salesCount > 0 ? totalVendasGeral / salesCount : 0;

    // Detecção de Acessórios com helper isAcessorio robusto
    const totalAcessorios = sales
      .filter(isAcessorio)
      .reduce((acc, v) => acc + Number(v.valor_total || v.valor || 0), 0);

    // Boletos / Financiamentos (PayJoy, Watu, Ume, Aiva, Crediário, Boleto)
    const BOLETO_KEYWORDS = ['BOLETO', 'PAYJOY', 'WATU', 'UME', 'AIVA', 'CREDIARIO'];
    let totalBoletos = 0;
    sales.forEach(sale => {
      const val = parseFloat(sale.valor_total || sale.valor || 0);
      const mpUpper = String(sale.metodo_pagamento || sale.forma_pagamento || '').toUpperCase();
      const finUpper = String(sale.financeira || sale.financeira_parceira || '').toUpperCase();
      const pags = Array.isArray(sale.vendas_pagamentos) ? sale.vendas_pagamentos : [];

      const isBoleto = BOLETO_KEYWORDS.some(k => mpUpper.includes(k) || finUpper.includes(k)) ||
        pags.some((p: any) => {
          const pMp = String(p.metodo_pagamento || '').toUpperCase();
          const pFin = String(p.financeira || '').toUpperCase();
          return BOLETO_KEYWORDS.some(k => pMp.includes(k) || pFin.includes(k));
        });

      if (isBoleto) {
        totalBoletos += val;
      }
    });

    const totalAVista = Math.max(0, totalVendasGeral - totalBoletos - totalAcessorios);

    // Recálculo do Progresso (%) Proporcional
    const progressoTotal = metaTotal > 0 ? Math.min(100, Math.round((totalVendasGeral / metaTotal) * 100)) : 0;
    const progressoBoleto = metaBoleto > 0 ? Math.min(100, Math.round((totalBoletos / metaBoleto) * 100)) : 0;
    const progressoAcessorios = metaAcessorios > 0 ? Math.min(100, Math.round((totalAcessorios / metaAcessorios) * 100)) : 0;

    // Badges Boletos
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

    // Badges Acessórios
    let taxaAcessoriosNum = 0.01;
    let badgeAcessorios = {
      taxa: '1,0%',
      texto: 'Faixa Atual: 1,0% (Abaixo da Meta)',
      status: 'abaixo',
      classe: 'bg-amber-950/40 text-amber-400 border border-amber-800/40'
    };
    if (totalAcessorios >= superMetaAcessorios) {
      taxaAcessoriosNum = 0.03;
      badgeAcessorios = {
        taxa: '3,0%',
        texto: 'Faixa Atual: 3,0% (Super Meta! 🔥)',
        status: 'super',
        classe: 'bg-pink-950/60 text-pink-300 border border-pink-700/60 shadow-[0_0_12px_rgba(244,114,182,0.3)]'
      };
    } else if (totalAcessorios >= metaAcessorios) {
      taxaAcessoriosNum = 0.025;
      badgeAcessorios = {
        taxa: '2,5%',
        texto: 'Faixa Atual: 2,5% (Meta Batida! 🚀)',
        status: 'batida',
        classe: 'bg-emerald-950/50 text-emerald-400 border border-emerald-800/50'
      };
    }

    // Comissões Acumuladas
    let totalComissoesHistorico = 0;
    let totalComissaoComoTitular = 0;
    let totalComissaoComoTrainee = 0;

    sales.forEach(s => {
      const vTitular = Number(s.comissao || 0);
      const vTrainee = Number(s.comissao_trainee || 0);
      if (isTrainee) {
        const cTitular = vTitular > 0 ? vTitular : calcularComissaoItem(s, true);
        const cTrainee = vTrainee > 0 ? vTrainee : (s.teve_participacao_trainee ? Number((Number(s.valor_total || 0) * 0.01).toFixed(2)) : 0);
        totalComissaoComoTitular += cTitular;
        totalComissaoComoTrainee += cTrainee;
        totalComissoesHistorico += (cTitular + cTrainee);
      } else {
        const c = vTitular > 0 ? vTitular : calcularComissaoItem(s, false);
        totalComissaoComoTitular += c;
        totalComissoesHistorico += c;
      }
    });

    const comissaoBoletosCalc = totalBoletos * taxaBoletoNum;
    const comissaoAcessoriosCalc = totalAcessorios * taxaAcessoriosNum;
    const comissaoAVistaCalc = totalAVista * 0.01;
    const comissaoCalculadaPorMetas = comissaoBoletosCalc + comissaoAcessoriosCalc + comissaoAVistaCalc;

    const totalComissoes = isTrainee
      ? totalComissoesHistorico
      : Math.max(comissaoCalculadaPorMetas, totalComissoesHistorico);

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
        if (!isNaN(dt.getTime())) {
          const diaNum = dt.getUTCDate() || dt.getDate();
          if (diaNum >= 1 && diaNum <= diasNoMes) {
            evolucaoDiaria[diaNum - 1].total += parseFloat(s.valor_total || s.valor || 0);
          }
        }
      }
    });

    return {
      mesReferencia: mesAtivo,
      isTrainee,
      totalVendasGeral,
      ticketMedio,
      totalComissoes,
      totalComissaoComoTitular,
      totalComissaoComoTrainee,
      metaTotal,
      salesCount,
      // Boletos
      totalBoletos,
      metaBoleto,
      superMetaBoleto,
      progressoBoleto,
      badgeBoleto,
      // Acessórios
      totalAcessorios,
      metaAcessorios,
      superMetaAcessorios,
      progressoAcessorios,
      badgeAcessorios,
      // Geral
      totalAVista,
      progressoTotal,
      evolucaoDiaria,
      historico: sales
    };
  }, [metaIndividual, vendasColaborador, colaborador, mesAtivo, mesCompetencia]);

  // Identificação da filial
  const filialDoColaborador = filiais.find(f => String(f.id) === String(colaborador?.filial_id)) || null;

  return (
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
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  dashboardInfo.isTrainee 
                    ? 'bg-purple-950/60 text-purple-300 border border-purple-700/50' 
                    : 'bg-emerald-950/60 text-emerald-400 border border-emerald-700/50'
                }`}>
                  {dashboardInfo.isTrainee ? 'Trainee Bonificado' : (colaborador.cargo || colaborador.role || 'Vendedor')}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                <span className="flex items-center gap-1">
                  <Store size={13} className="text-gray-500" />
                  {filialDoColaborador?.nome || colaborador.filial_nome || 'Filial não vinculada'}
                </span>
                <span className="text-gray-600">•</span>
                <span className="flex items-center gap-1">
                  <Calendar size={13} className="text-[#6A0DAD]" />
                  Competência: <strong className="text-gray-200">{dashboardInfo.mesReferencia}</strong>
                </span>
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
                onChange={(e) => setMesAtivo(e.target.value)}
                className="bg-transparent text-white text-xs font-bold font-mono outline-none cursor-pointer"
              />
            </div>

            {/* Botão Recarregar */}
            <button
              type="button"
              onClick={carregarDadosVendedor}
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
                  R$ {dashboardInfo.totalVendasGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[11px] text-gray-400 mt-1 block">
                  {dashboardInfo.salesCount} {dashboardInfo.salesCount === 1 ? 'venda realizada' : 'vendas realizadas'}
                </span>
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
                  R$ {dashboardInfo.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                  R$ {dashboardInfo.totalComissoes.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                {dashboardInfo.totalComissaoComoTrainee > 0 ? (
                  <span className="text-[10px] text-purple-300 mt-1 block font-medium">
                    Titular: R$ {dashboardInfo.totalComissaoComoTitular.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | Trainee: R$ {dashboardInfo.totalComissaoComoTrainee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                ) : (
                  <span className="text-[11px] text-emerald-400/80 mt-1 block font-medium">
                    Comissão calculada no período
                  </span>
                )}
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
                  R$ {dashboardInfo.metaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <div className="w-full bg-[#1A1A1A] rounded-full h-1.5 mt-2 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[#6A0DAD] to-purple-400 transition-all duration-700"
                    style={{ width: `${Math.min(100, Math.max(0, dashboardInfo.progressoTotal))}%` }}
                  ></div>
                </div>
                <span className="text-[9px] text-purple-400/80 mt-1.5 block font-semibold">
                  {dashboardInfo.progressoTotal}% • Boletos (R$ {dashboardInfo.metaBoleto.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}) + Acessórios (R$ {dashboardInfo.metaAcessorios.toLocaleString('pt-BR', { minimumFractionDigits: 0 })})
                </span>
              </div>
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
                <div className={`px-2.5 py-1 rounded text-[11px] font-bold ${dashboardInfo.badgeBoleto.classe}`}>
                  {dashboardInfo.badgeBoleto.texto}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 bg-[#111111] p-3 rounded-lg border border-[#222222] text-center font-mono">
                <div>
                  <span className="text-[9px] text-gray-400 uppercase font-bold block">Realizado</span>
                  <span className="text-sm sm:text-base font-black text-amber-400 mt-0.5 block">
                    R$ {dashboardInfo.totalBoletos.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="border-x border-[#222222]">
                  <span className="text-[9px] text-gray-400 uppercase font-bold block">Objetivo</span>
                  <span className="text-sm sm:text-base font-black text-white mt-0.5 block">
                    R$ {dashboardInfo.metaBoleto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-purple-300 uppercase font-bold block flex items-center justify-center gap-0.5">
                    <Sparkles size={10} /> Super Meta
                  </span>
                  <span className="text-sm sm:text-base font-black text-purple-300 mt-0.5 block">
                    R$ {dashboardInfo.superMetaBoleto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-gray-400">Progresso do Objetivo</span>
                  <span className="text-amber-400 font-mono">{dashboardInfo.progressoBoleto}% atingido</span>
                </div>
                <div className="w-full bg-[#161616] rounded-full h-3 overflow-hidden border border-[#222222]">
                  <div
                    className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-400 shadow-[0_0_10px_#f59e0b]"
                    style={{ width: `${Math.min(100, Math.max(0, dashboardInfo.progressoBoleto))}%` }}
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
                <div className={`px-2.5 py-1 rounded text-[11px] font-bold ${dashboardInfo.badgeAcessorios.classe}`}>
                  {dashboardInfo.badgeAcessorios.texto}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 bg-[#111111] p-3 rounded-lg border border-[#222222] text-center font-mono">
                <div>
                  <span className="text-[9px] text-gray-400 uppercase font-bold block">Realizado</span>
                  <span className="text-sm sm:text-base font-black text-pink-400 mt-0.5 block">
                    R$ {dashboardInfo.totalAcessorios.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="border-x border-[#222222]">
                  <span className="text-[9px] text-gray-400 uppercase font-bold block">Objetivo</span>
                  <span className="text-sm sm:text-base font-black text-white mt-0.5 block">
                    R$ {dashboardInfo.metaAcessorios.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-pink-300 uppercase font-bold block flex items-center justify-center gap-0.5">
                    <Sparkles size={10} /> Super Meta
                  </span>
                  <span className="text-sm sm:text-base font-black text-pink-300 mt-0.5 block">
                    R$ {dashboardInfo.superMetaAcessorios.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-gray-400">Progresso do Objetivo</span>
                  <span className="text-pink-400 font-mono">
                    {dashboardInfo.progressoAcessorios}% atingido
                  </span>
                </div>
                <div className="w-full bg-[#161616] rounded-full h-3 overflow-hidden border border-[#222222]">
                  <div
                    className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-pink-600 via-pink-500 to-rose-400 shadow-[0_0_10px_#ec4899]"
                    style={{ width: `${Math.min(100, Math.max(0, dashboardInfo.progressoAcessorios))}%` }}
                  ></div>
                </div>
              </div>
            </div>

          </div>

          {/* GRÁFICOS DINÂMICOS DO COLABORADOR */}
          <GraficosMinhasMetas metasInfo={dashboardInfo} />

          {/* TABELA COM O HISTÓRICO RECENTE DE VENDAS */}
          <div className="bg-[#0A0A0A] border border-[#222222] rounded-xl p-6">
            <h4 className="text-sm font-bold text-gray-300 mb-4 uppercase tracking-wider flex items-center gap-2">
              <Receipt size={16} className="text-[#6A0DAD]" />
              Histórico de Vendas do Colaborador ({dashboardInfo.historico.length})
            </h4>

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
                    dashboardInfo.historico.map(sale => {
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

                      const valorComissaoBruto = Number(calcularComissaoItem(sale, dashboardInfo.isTrainee));
                      const comissaoFormatada = valorComissaoBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                      const metodoRaw = String(sale.forma_pagamento || sale.metodo_pagamento || 'N/A').toUpperCase();

                      return (
                        <tr key={sale.id} className="hover:bg-purple-950/5 transition-colors">
                          <td className="py-3 text-gray-400 font-mono">
                            {new Date(sale.created_at).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="py-3">
                            <div className="flex flex-col">
                              <span className="font-semibold text-white">{produtoNome}</span>
                              {sale.imei && (
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
                            R$ {parseFloat(sale.valor_total || sale.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#111] text-gray-300 border border-[#333] uppercase">
                              {metodoRaw}
                            </span>
                          </td>
                          <td className="py-3 text-right font-mono font-bold text-emerald-400">
                            R$ {comissaoFormatada}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
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
}

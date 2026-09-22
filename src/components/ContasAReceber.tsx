import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  DollarSign, CheckCircle2, AlertTriangle, Percent, Search, Filter,
  Calendar, Building2, Store, ArrowUpRight, Check, X, Eye, Clock,
  RefreshCw, Loader2, ShieldCheck, ChevronRight, AlertCircle, Plus, FileText
} from 'lucide-react';
import { supabase } from '../supabaseClient';

export interface RepasseFinanceira {
  id: string;
  venda_id: string | null;
  filial_id: string | null;
  financeira: string;
  valor_bruto: number;
  taxa_retencao: number;
  valor_liquido: number;
  status: 'PENDENTE' | 'RECEBIDO' | 'GLOSADO' | 'CANCELADO' | string;
  data_prevista_repasse: string | null;
  data_recebimento_real: string | null;
  comprovante_repasse_url?: string | null;
  created_at: string;
  // Joined or populated fields
  filiais?: { id: string; nome: string } | null;
  vendas?: {
    id: string;
    valor_total?: number;
    cliente_nome?: string;
    vendedor_nome?: string;
    produto_nome?: string;
    forma_pagamento?: string;
    metodo_pagamento?: string;
    created_at?: string;
  } | null;
}

interface ContasAReceberProps {
  profile?: any;
  filiais?: Array<{ id: string; nome: string; tipo?: string }>;
}

export const ContasAReceber: React.FC<ContasAReceberProps> = ({ profile, filiais: propFiliais = [] }) => {
  // Competência Ativa (Ano-Mês, default mês atual: YYYY-MM)
  const currentYearMonth = new Date().toISOString().slice(0, 7);
  const [mesCompetencia, setMesCompetencia] = useState<string>(currentYearMonth);

  // Filtros Estratégicos
  const [filialFiltro, setFilialFiltro] = useState<string>('TODAS');
  const [financeiraFiltro, setFinanceiraFiltro] = useState<string>('TODAS');
  const [statusFiltro, setStatusFiltro] = useState<string>('TODOS');
  const [termoBusca, setTermoBusca] = useState<string>('');

  // Dados
  const [repasses, setRepasses] = useState<RepasseFinanceira[]>([]);
  const [filiaisLista, setFiliaisLista] = useState<Array<{ id: string; nome: string }>>(propFiliais);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [feedbackToast, setFeedbackToast] = useState<{ msg: string; tipo: 'success' | 'error' } | null>(null);

  // Seleção em Lote
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modais
  const [modalLiquidarItem, setModalLiquidarItem] = useState<RepasseFinanceira | null>(null);
  const [dataRecebimentoReal, setDataRecebimentoReal] = useState<string>(new Date().toISOString().slice(0, 10));
  const [modalAuditoriaItem, setModalAuditoriaItem] = useState<RepasseFinanceira | null>(null);
  const [modalNovoRepasseOpen, setModalNovoRepasseOpen] = useState<boolean>(false);

  // Form Novo Repasse Manual
  const [novoRepasse, setNovoRepasse] = useState({
    filial_id: '',
    financeira: 'PAYJOY',
    valor_bruto: '',
    taxa_retencao: '',
    data_prevista_repasse: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
    observacao: ''
  });

  // Mostrar Toast Temporário
  const showToast = (msg: string, tipo: 'success' | 'error' = 'success') => {
    setFeedbackToast({ msg, tipo });
    setTimeout(() => setFeedbackToast(null), 4000);
  };

  // Buscar Filiais se não passadas por props
  useEffect(() => {
    if (propFiliais.length > 0) {
      setFiliaisLista(propFiliais);
      return;
    }
    const fetchFiliais = async () => {
      try {
        const { data } = await supabase.from('filiais').select('id, nome').order('nome');
        if (data && data.length > 0) {
          setFiliaisLista(data);
        }
      } catch (err) {
        console.warn('Erro ao carregar filiais para filtro:', err);
      }
    };
    fetchFiliais();
  }, [propFiliais]);

  // Buscar Lançamentos da tabela repasses_financeiras
  const fetchRepasses = useCallback(async () => {
    setLoading(true);
    try {
      // Competência: início e fim do mês selecionado
      const [ano, mes] = mesCompetencia.split('-');
      const inicioMes = `${ano}-${mes}-01T00:00:00.000Z`;
      const proximoMesDate = new Date(Number(ano), Number(mes), 1);
      const fimMes = proximoMesDate.toISOString();

      // Tentativa de busca com joins
      let query = supabase
        .from('repasses_financeiras')
        .select(`
          id,
          venda_id,
          filial_id,
          financeira,
          valor_bruto,
          taxa_retencao,
          valor_liquido,
          status,
          data_prevista_repasse,
          data_recebimento_real,
          comprovante_repasse_url,
          created_at,
          filiais:filial_id (id, nome),
          vendas:venda_id (id, valor_total, cliente_nome, vendedor_nome, produto_nome, forma_pagamento, metodo_pagamento, created_at)
        `)
        .gte('created_at', inicioMes)
        .lt('created_at', fimMes)
        .order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.warn('[ContasAReceber] Fallback para select sem joins explícitos:', error);
        // Fallback sem joins caso as relações não estejam configuradas no schema cache
        const { data: rawData, error: rawErr } = await supabase
          .from('repasses_financeiras')
          .select('*')
          .gte('created_at', inicioMes)
          .lt('created_at', fimMes)
          .order('created_at', { ascending: false });

        if (rawErr) throw rawErr;

        // Hidratar nomes de filiais se existirem
        const hydrated = (rawData || []).map((item: any) => {
          const filialObj = filiaisLista.find(f => f.id === item.filial_id);
          return {
            ...item,
            filiais: filialObj ? { id: filialObj.id, nome: filialObj.nome } : null,
            vendas: null
          };
        });
        setRepasses(hydrated);
      } else {
        setRepasses((data as any) || []);
      }
    } catch (err: any) {
      console.error('[ContasAReceber] Falha ao carregar repasses:', err);
      showToast('Erro ao carregar dados de repasses financeiros: ' + (err?.message || ''), 'error');
    } finally {
      setLoading(false);
    }
  }, [mesCompetencia, filiaisLista]);

  useEffect(() => {
    fetchRepasses();
  }, [fetchRepasses]);

  // Lista padronizada de lojas físicas solicitadas
  const lojasPreset = ['MONKEY SHOP', 'CRED PHONE', 'CRED SMART', 'CRED CELL'];
  const todasLojasNomes = useMemo(() => {
    const list = [...lojasPreset];
    filiaisLista.forEach(f => {
      if (f.nome && !list.includes(f.nome.toUpperCase())) {
        list.push(f.nome.toUpperCase());
      }
    });
    return list;
  }, [filiaisLista]);

  // Lista padronizada de financeiras
  const financeirasPreset = ['PAYJOY', 'AIVA', 'UME', 'WATU', 'CREDIÁRIO / BOLETO', 'CARTÃO'];

  // Normalização de Operadoras para Badges e Filtros
  const getFinanceiraNormalizada = (fin: string = '') => {
    const s = String(fin).toUpperCase().trim();
    if (s.includes('PAYJOY')) return 'PAYJOY';
    if (s.includes('AIVA')) return 'AIVA';
    if (s.includes('UME')) return 'UME';
    if (s.includes('WATU')) return 'WATU';
    if (s.includes('BOLETO') || s.includes('CREDIARIO') || s.includes('CREDIÁRIO')) return 'CREDIÁRIO / BOLETO';
    if (s.includes('CARTAO') || s.includes('CARTÃO')) return 'CARTÃO';
    return s || 'OUTRA';
  };

  // Cores dos Badges de Financeira
  const renderFinanceiraBadge = (fin: string) => {
    const norm = getFinanceiraNormalizada(fin);
    let colorClass = 'bg-zinc-800 text-zinc-300 border-zinc-700';

    if (norm === 'PAYJOY') {
      colorClass = 'bg-cyan-950/60 text-cyan-300 border-cyan-700/50 shadow-cyan-950/40';
    } else if (norm === 'AIVA') {
      colorClass = 'bg-purple-950/60 text-purple-300 border-purple-700/50 shadow-purple-950/40';
    } else if (norm === 'UME') {
      colorClass = 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50 shadow-emerald-950/40';
    } else if (norm === 'WATU') {
      colorClass = 'bg-amber-950/60 text-amber-300 border-amber-700/50 shadow-amber-950/40';
    } else if (norm === 'CREDIÁRIO / BOLETO') {
      colorClass = 'bg-orange-950/60 text-orange-300 border-orange-700/50 shadow-orange-950/40';
    } else if (norm === 'CARTÃO') {
      colorClass = 'bg-indigo-950/60 text-indigo-300 border-indigo-700/50 shadow-indigo-950/40';
    }

    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider border shadow-sm ${colorClass}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
        {fin || 'N/A'}
      </span>
    );
  };

  // Badge de Status
  const renderStatusBadge = (status: string, dataPrevista?: string | null) => {
    const s = String(status || '').toUpperCase();
    const hojeStr = new Date().toISOString().slice(0, 10);
    const isAtrasado = s === 'PENDENTE' && dataPrevista && dataPrevista < hojeStr;

    if (s === 'RECEBIDO') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-950/70 text-emerald-300 border border-emerald-700/60 shadow-xs">
          <Check size={11} className="stroke-[3]" />
          Recebido
        </span>
      );
    }
    if (s === 'GLOSADO' || s === 'CANCELADO') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-950/70 text-rose-300 border border-rose-700/60 shadow-xs">
          <X size={11} className="stroke-[3]" />
          Glosado / Cancelado
        </span>
      );
    }
    if (isAtrasado) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-red-950/70 text-red-300 border border-red-700/60 shadow-xs animate-pulse">
          <AlertTriangle size={11} className="stroke-[2.5]" />
          Pendente (Atrasado)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-950/70 text-amber-300 border border-amber-700/60 shadow-xs">
        <Clock size={11} className="stroke-[2.5]" />
        Pendente
      </span>
    );
  };

  // Filtragem dos repasses
  const repassesFiltrados = useMemo(() => {
    return repasses.filter(item => {
      // Filtro Filial
      if (filialFiltro !== 'TODAS') {
        const filialNome = item.filiais?.nome?.toUpperCase() || '';
        const matchFilialId = item.filial_id === filialFiltro;
        const matchFilialNome = filialNome.includes(filialFiltro.toUpperCase());
        if (!matchFilialId && !matchFilialNome) return false;
      }

      // Filtro Financeira
      if (financeiraFiltro !== 'TODAS') {
        const norm = getFinanceiraNormalizada(item.financeira);
        if (norm !== financeiraFiltro) return false;
      }

      // Filtro Status
      if (statusFiltro !== 'TODOS') {
        const s = String(item.status || '').toUpperCase();
        if (statusFiltro === 'PENDENTE' && s !== 'PENDENTE') return false;
        if (statusFiltro === 'RECEBIDO' && s !== 'RECEBIDO') return false;
        if (statusFiltro === 'GLOSADO_CANCELADO' && !['GLOSADO', 'CANCELADO'].includes(s)) return false;
      }

      // Busca por Texto (cliente, vendedor, contrato/venda)
      if (termoBusca.trim()) {
        const t = termoBusca.toLowerCase().trim();
        const cliente = (item.vendas?.cliente_nome || '').toLowerCase();
        const vendedor = (item.vendas?.vendedor_nome || '').toLowerCase();
        const vendaId = (item.venda_id || '').toLowerCase();
        const repasseId = (item.id || '').toLowerCase();
        const financeira = (item.financeira || '').toLowerCase();

        const match = cliente.includes(t) || vendedor.includes(t) || vendaId.includes(t) || repasseId.includes(t) || financeira.includes(t);
        if (!match) return false;
      }

      return true;
    });
  }, [repasses, filialFiltro, financeiraFiltro, statusFiltro, termoBusca]);

  // Cálculos dos Cards de KPIs Financeiros
  const kpis = useMemo(() => {
    const hojeStr = new Date().toISOString().slice(0, 10);
    let totalPrevisto = 0;
    let totalRecebido = 0;
    let totalAtrasados = 0;
    let totalTaxas = 0;

    repasses.forEach(r => {
      const vLiq = Number(r.valor_liquido || 0);
      const vTaxa = Number(r.taxa_retencao || 0);
      const s = String(r.status || '').toUpperCase();

      totalPrevisto += vLiq;
      totalTaxas += vTaxa;

      if (s === 'RECEBIDO') {
        totalRecebido += vLiq;
      } else if (s === 'PENDENTE') {
        if (r.data_prevista_repasse && r.data_prevista_repasse < hojeStr) {
          totalAtrasados += vLiq;
        }
      }
    });

    return {
      totalPrevisto,
      totalRecebido,
      totalAtrasados,
      totalTaxas
    };
  }, [repasses]);

  // Seleção de Checkboxes
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === repassesFiltrados.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(repassesFiltrados.map(r => r.id));
    }
  };

  // Somatório dos Itens Selecionados para Ação em Lote
  const totalLiquidoSelecionado = useMemo(() => {
    return repasses
      .filter(r => selectedIds.includes(r.id))
      .reduce((acc, r) => acc + Number(r.valor_liquido || 0), 0);
  }, [repasses, selectedIds]);

  // Dar Baixa em Lote / Confirmar Recebimento
  const handleBaixaEmLote = async () => {
    if (selectedIds.length === 0) return;
    setActionLoading(true);
    const dataHoje = new Date().toISOString();

    try {
      const { error } = await supabase
        .from('repasses_financeiras')
        .update({
          status: 'RECEBIDO',
          data_recebimento_real: dataHoje
        })
        .in('id', selectedIds);

      if (error) throw error;

      // Atualização reativa de estado local
      setRepasses(prev =>
        prev.map(r =>
          selectedIds.includes(r.id)
            ? { ...r, status: 'RECEBIDO', data_recebimento_real: dataHoje }
            : r
        )
      );

      const valorFormatado = totalLiquidoSelecionado.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
      showToast(`Lote de R$ ${valorFormatado} liquidado com sucesso! (${selectedIds.length} repasses)`, 'success');
      setSelectedIds([]);
    } catch (err: any) {
      console.error('Erro ao liquidar lote:', err);
      showToast('Erro ao processar baixa em lote: ' + (err?.message || ''), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Liquidar Individual
  const handleConfirmarLiquidacaoIndividual = async () => {
    if (!modalLiquidarItem) return;
    setActionLoading(true);

    try {
      const dataEfetiva = new Date(dataRecebimentoReal).toISOString();
      const { error } = await supabase
        .from('repasses_financeiras')
        .update({
          status: 'RECEBIDO',
          data_recebimento_real: dataEfetiva
        })
        .eq('id', modalLiquidarItem.id);

      if (error) throw error;

      setRepasses(prev =>
        prev.map(r =>
          r.id === modalLiquidarItem.id
            ? { ...r, status: 'RECEBIDO', data_recebimento_real: dataEfetiva }
            : r
        )
      );

      showToast(`Repasse de R$ ${Number(modalLiquidarItem.valor_liquido).toFixed(2)} liquidado com sucesso!`, 'success');
      setModalLiquidarItem(null);
    } catch (err: any) {
      console.error('Erro ao liquidar repasse:', err);
      showToast('Falha ao liquidar repasse: ' + (err?.message || ''), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Criar Novo Repasse Manual
  const handleCriarRepasseManual = async (e: React.FormEvent) => {
    e.preventDefault();
    const vBruto = parseFloat(String(novoRepasse.valor_bruto).replace(',', '.')) || 0;
    const vTaxa = parseFloat(String(novoRepasse.taxa_retencao).replace(',', '.')) || 0;

    if (vBruto <= 0) {
      showToast('Informe um valor bruto válido maior que zero.', 'error');
      return;
    }

    setActionLoading(true);
    try {
      const payload = {
        filial_id: novoRepasse.filial_id || null,
        financeira: novoRepasse.financeira,
        valor_bruto: vBruto,
        taxa_retencao: vTaxa,
        valor_liquido: Math.max(0, vBruto - vTaxa),
        status: 'PENDENTE',
        data_prevista_repasse: novoRepasse.data_prevista_repasse || null,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('repasses_financeiras')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      showToast('Lançamento financeiro registrado com sucesso!', 'success');
      setModalNovoRepasseOpen(false);
      setNovoRepasse({
        filial_id: '',
        financeira: 'PAYJOY',
        valor_bruto: '',
        taxa_retencao: '',
        data_prevista_repasse: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
        observacao: ''
      });
      fetchRepasses();
    } catch (err: any) {
      console.error('Erro ao criar repasse:', err);
      showToast('Erro ao criar lançamento: ' + (err?.message || ''), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const formatarDataBR = (dataIso?: string | null) => {
    if (!dataIso) return '-';
    try {
      const d = new Date(dataIso);
      return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    } catch {
      return dataIso;
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn font-sans text-white pb-16">
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-[#6A0DAD]/20 border border-emerald-500/40 text-emerald-400">
              <DollarSign size={24} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                Contas a Receber & Conciliação
                <span className="text-[10px] bg-purple-950/80 text-purple-300 border border-purple-800/60 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  Exclusivo Dono / Admin
                </span>
              </h1>
              <p className="text-xs text-zinc-400 mt-0.5">
                Gestão estratégica de repasses das financeiras parceiras, cartões e controle de liquidações.
              </p>
            </div>
          </div>
        </div>

        {/* Seleção de Competência e Ações do Header */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-zinc-900/80 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-300">
            <Calendar size={14} className="text-[#6A0DAD]" />
            <span className="font-semibold text-[11px] text-zinc-400">Mês:</span>
            <input
              type="month"
              value={mesCompetencia}
              onChange={(e) => setMesCompetencia(e.target.value)}
              className="bg-transparent text-white font-bold outline-none cursor-pointer text-xs"
            />
          </div>

          <button
            type="button"
            onClick={() => fetchRepasses()}
            disabled={loading}
            className="p-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition-all cursor-pointer disabled:opacity-50"
            title="Atualizar dados"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin text-[#6A0DAD]' : ''} />
          </button>

          <button
            type="button"
            onClick={() => setModalNovoRepasseOpen(true)}
            className="px-3.5 py-2 bg-[#6A0DAD] hover:bg-[#500885] text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-[#6A0DAD]/30 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={15} />
            <span>Novo Lançamento</span>
          </button>
        </div>
      </div>

      {/* TOAST FLUTUANTE DE FEEDBACK */}
      {feedbackToast && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-2xl border flex items-center gap-3 text-xs font-bold animate-slideRight ${
          feedbackToast.tipo === 'success'
            ? 'bg-emerald-950/95 border-emerald-600 text-emerald-200'
            : 'bg-rose-950/95 border-rose-600 text-rose-200'
        }`}>
          {feedbackToast.tipo === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{feedbackToast.msg}</span>
        </div>
      )}

      {/* 1. CARDS DE RESUMO NO TOPO (KPIS FINANCEIROS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Previsto no Mês */}
        <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-5 relative overflow-hidden transition-all hover:border-zinc-700/80 group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Total Previsto no Mês</span>
            <div className="w-8 h-8 rounded-xl bg-blue-950/50 border border-blue-800/40 flex items-center justify-center text-blue-400">
              <Calendar size={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white font-mono tracking-tight">
              R$ {kpis.totalPrevisto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-zinc-400 mt-1 flex items-center gap-1">
              <span>Líquido acumulado de todos os repasses da competência</span>
            </p>
          </div>
        </div>

        {/* Card 2: Já Liquidado / Recebido */}
        <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-5 relative overflow-hidden transition-all hover:border-emerald-700/50 group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Já Liquidado / Recebido</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-950/50 border border-emerald-800/40 flex items-center justify-center text-emerald-400">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-emerald-400 font-mono tracking-tight">
              R$ {kpis.totalRecebido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="flex items-center justify-between mt-1 text-[11px] text-zinc-400">
              <span>Dinheiro conciliado na conta</span>
              <span className="text-emerald-400 font-bold font-mono">
                {kpis.totalPrevisto > 0 ? `${((kpis.totalRecebido / kpis.totalPrevisto) * 100).toFixed(1)}%` : '0%'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Atrasados / Pendentes Críticos */}
        <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-5 relative overflow-hidden transition-all hover:border-rose-700/50 group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl group-hover:bg-rose-500/20 transition-all pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Atrasados / Críticos</span>
            <div className="w-8 h-8 rounded-xl bg-rose-950/50 border border-rose-800/40 flex items-center justify-center text-rose-400">
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-rose-400 font-mono tracking-tight">
              R$ {kpis.totalAtrasados.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">
              {kpis.totalAtrasados > 0 ? 'Repasses com data de previsão vencida' : 'Nenhum repasse atrasado'}
            </p>
          </div>
        </div>

        {/* Card 4: Taxas Retidas pelas Financeiras */}
        <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-5 relative overflow-hidden transition-all hover:border-amber-700/50 group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Taxas Retidas</span>
            <div className="w-8 h-8 rounded-xl bg-amber-950/50 border border-amber-800/40 flex items-center justify-center text-amber-400">
              <Percent size={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-amber-400 font-mono tracking-tight">
              R$ {kpis.totalTaxas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">
              Total retido pelas operadoras parceiras
            </p>
          </div>
        </div>
      </div>

      {/* 2. FILTROS ESTRATÉGICOS */}
      <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Dropdown Filial */}
          <div>
            <label className="block text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Store size={12} className="text-[#6A0DAD]" />
              Filial
            </label>
            <select
              value={filialFiltro}
              onChange={(e) => setFilialFiltro(e.target.value)}
              className="w-full bg-black/70 border border-zinc-800 focus:border-[#6A0DAD] rounded-xl px-3 py-2 text-xs text-white font-medium outline-none transition-all cursor-pointer"
            >
              <option value="TODAS">Todas as Filiais</option>
              {todasLojasNomes.map(loja => (
                <option key={loja} value={loja}>{loja}</option>
              ))}
            </select>
          </div>

          {/* Dropdown Financeira */}
          <div>
            <label className="block text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <DollarSign size={12} className="text-emerald-400" />
              Financeira
            </label>
            <select
              value={financeiraFiltro}
              onChange={(e) => setFinanceiraFiltro(e.target.value)}
              className="w-full bg-black/70 border border-zinc-800 focus:border-[#6A0DAD] rounded-xl px-3 py-2 text-xs text-white font-medium outline-none transition-all cursor-pointer"
            >
              <option value="TODAS">Todas as Financeiras</option>
              {financeirasPreset.map(fin => (
                <option key={fin} value={fin}>{fin}</option>
              ))}
            </select>
          </div>

          {/* Dropdown Status */}
          <div>
            <label className="block text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Filter size={12} className="text-amber-400" />
              Status do Repasse
            </label>
            <select
              value={statusFiltro}
              onChange={(e) => setStatusFiltro(e.target.value)}
              className="w-full bg-black/70 border border-zinc-800 focus:border-[#6A0DAD] rounded-xl px-3 py-2 text-xs text-white font-medium outline-none transition-all cursor-pointer"
            >
              <option value="TODOS">Todos os Status</option>
              <option value="PENDENTE">PENDENTE (Amarelo)</option>
              <option value="RECEBIDO">RECEBIDO (Verde)</option>
              <option value="GLOSADO_CANCELADO">GLOSADO / CANCELADO (Vermelho)</option>
            </select>
          </div>

          {/* Busca por Texto */}
          <div>
            <label className="block text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Search size={12} className="text-zinc-400" />
              Busca Rápida
            </label>
            <div className="relative">
              <input
                type="text"
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                placeholder="Cliente, vendedor, contrato..."
                className="w-full bg-black/70 border border-zinc-800 focus:border-[#6A0DAD] rounded-xl pl-8 pr-3 py-2 text-xs text-white outline-none transition-all placeholder:text-zinc-600"
              />
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              {termoBusca && (
                <button
                  type="button"
                  onClick={() => setTermoBusca('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. BARRA FLUTUANTE DE CONCILIAÇÃO EM LOTE */}
      {selectedIds.length > 0 && (
        <div className="sticky top-2 z-30 bg-gradient-to-r from-[#6A0DAD] to-[#400569] border border-purple-400/50 rounded-2xl p-4 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-slideDown">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center font-black text-white text-sm">
              {selectedIds.length}
            </div>
            <div>
              <div className="text-xs font-black text-white uppercase tracking-wider">
                {selectedIds.length} repasse{selectedIds.length > 1 ? 's' : ''} selecionado{selectedIds.length > 1 ? 's' : ''}
              </div>
              <div className="text-sm font-black font-mono text-emerald-300">
                Total Líquido: R$ {totalLiquidoSelecionado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="px-3 py-2 bg-black/40 hover:bg-black/60 text-zinc-300 hover:text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Desmarcar Todos
            </button>
            <button
              type="button"
              onClick={handleBaixaEmLote}
              disabled={actionLoading}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-extrabold rounded-xl transition-all shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {actionLoading ? <Loader2 size={15} className="animate-spin text-black" /> : <Check size={15} className="stroke-[3]" />}
              <span>Dar Baixa em Lote / Confirmar Recebimento</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. GRADE DE LANÇAMENTOS */}
      <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              Lançamentos & Repasses da Competência
            </h3>
            <span className="text-[11px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full font-mono font-bold">
              {repassesFiltrados.length} registro{repassesFiltrados.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="text-xs text-zinc-400">
            Competência: <span className="font-bold text-white font-mono">{mesCompetencia}</span>
          </div>
        </div>

        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3 text-zinc-400">
            <Loader2 size={32} className="animate-spin text-[#6A0DAD]" />
            <span className="text-xs font-medium">Carregando repasses financeiros...</span>
          </div>
        ) : repassesFiltrados.length === 0 ? (
          <div className="p-16 text-center text-zinc-500 space-y-2">
            <DollarSign size={40} className="mx-auto opacity-30 text-zinc-400" />
            <p className="text-sm font-bold text-zinc-300">Nenhum repasse encontrado</p>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              Não há lançamentos de repasse para os filtros selecionados ou para o mês de {mesCompetencia}.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/40 text-zinc-400 font-extrabold uppercase text-[10px] tracking-wider">
                  <th className="p-3.5 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={repassesFiltrados.length > 0 && selectedIds.length === repassesFiltrados.length}
                      onChange={handleSelectAll}
                      className="rounded border-zinc-700 text-[#6A0DAD] focus:ring-[#6A0DAD] cursor-pointer"
                    />
                  </th>
                  <th className="p-3.5">Data Venda / Previsão</th>
                  <th className="p-3.5">Filial</th>
                  <th className="p-3.5">Vendedor & Cliente</th>
                  <th className="p-3.5">Financeira / Origem</th>
                  <th className="p-3.5 text-right">Valor Bruto</th>
                  <th className="p-3.5 text-right">Taxa Retenção</th>
                  <th className="p-3.5 text-right">Valor Líquido</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-medium">
                {repassesFiltrados.map((item) => {
                  const isSelected = selectedIds.includes(item.id);
                  const isPendente = String(item.status || '').toUpperCase() === 'PENDENTE';
                  const lojaNome = item.filiais?.nome || 'Loja Física';
                  const clienteNome = item.vendas?.cliente_nome || 'Consumidor Final';
                  const vendedorNome = item.vendas?.vendedor_nome || 'Vendedor';

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-zinc-800/40 transition-colors ${
                        isSelected ? 'bg-purple-950/20' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(item.id)}
                          className="rounded border-zinc-700 text-[#6A0DAD] focus:ring-[#6A0DAD] cursor-pointer"
                        />
                      </td>

                      {/* Data Venda / Previsão */}
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="font-mono text-zinc-300 font-bold">
                          {formatarDataBR(item.created_at)}
                        </div>
                        <div className="text-[10px] text-zinc-400 flex items-center gap-1 mt-0.5 font-mono">
                          <span>Prev:</span>
                          <span className={isPendente && item.data_prevista_repasse && item.data_prevista_repasse < new Date().toISOString().slice(0, 10) ? 'text-rose-400 font-bold' : 'text-zinc-300'}>
                            {formatarDataBR(item.data_prevista_repasse)}
                          </span>
                        </div>
                      </td>

                      {/* Filial */}
                      <td className="p-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 text-[10px] font-bold uppercase">
                          <Building2 size={11} className="text-zinc-400" />
                          {lojaNome}
                        </span>
                      </td>

                      {/* Vendedor & Cliente */}
                      <td className="p-3.5 max-w-[200px] truncate">
                        <div className="font-bold text-white truncate" title={clienteNome}>
                          {clienteNome}
                        </div>
                        <div className="text-[10px] text-zinc-400 truncate" title={vendedorNome}>
                          Vend: {vendedorNome}
                        </div>
                      </td>

                      {/* Origem / Financeira */}
                      <td className="p-3.5 whitespace-nowrap">
                        {renderFinanceiraBadge(item.financeira)}
                      </td>

                      {/* Valor Bruto */}
                      <td className="p-3.5 text-right font-mono text-zinc-400 whitespace-nowrap">
                        R$ {Number(item.valor_bruto || 0).toFixed(2)}
                      </td>

                      {/* Taxa Retenção */}
                      <td className="p-3.5 text-right font-mono text-amber-400/90 whitespace-nowrap">
                        - R$ {Number(item.taxa_retencao || 0).toFixed(2)}
                      </td>

                      {/* Valor Líquido (Destaque Verde/Branco) */}
                      <td className="p-3.5 text-right font-mono font-extrabold text-emerald-400 text-sm whitespace-nowrap">
                        R$ {Number(item.valor_liquido || 0).toFixed(2)}
                      </td>

                      {/* Status */}
                      <td className="p-3.5 text-center whitespace-nowrap">
                        {renderStatusBadge(item.status, item.data_prevista_repasse)}
                      </td>

                      {/* Ações */}
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Botão Liquidar se status for PENDENTE */}
                          {isPendente && (
                            <button
                              type="button"
                              onClick={() => {
                                setModalLiquidarItem(item);
                                setDataRecebimentoReal(new Date().toISOString().slice(0, 10));
                              }}
                              className="px-2.5 py-1 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                              title="Confirmar recebimento / liquidar este repasse"
                            >
                              <Check size={12} className="stroke-[3]" />
                              <span>Liquidar</span>
                            </button>
                          )}

                          {/* Botão Auditar / Ver Venda */}
                          <button
                            type="button"
                            onClick={() => setModalAuditoriaItem(item)}
                            className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg transition-all cursor-pointer"
                            title="Auditar / Ver detalhes da venda"
                          >
                            <Eye size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: LIQUIDAR INDIVIDUAL */}
      {modalLiquidarItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-[#0A0A0A] border border-emerald-500/40 rounded-2xl max-w-md w-full p-6 space-y-5 flex flex-col relative shadow-[0_0_50px_rgba(16,185,129,0.2)]">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-950/60 border border-emerald-700/50 text-emerald-400">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Confirmar Liquidação</h3>
                  <p className="text-xs text-zinc-400">Repasse da financeira {modalLiquidarItem.financeira}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalLiquidarItem(null)}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="bg-zinc-900/80 rounded-xl p-4 border border-zinc-800 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400">Operadora:</span>
                <span className="font-bold text-white">{modalLiquidarItem.financeira}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400">Valor Bruto:</span>
                <span className="font-mono text-zinc-300">R$ {Number(modalLiquidarItem.valor_bruto).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400">Taxa Retida:</span>
                <span className="font-mono text-rose-400">- R$ {Number(modalLiquidarItem.taxa_retencao).toFixed(2)}</span>
              </div>
              <div className="border-t border-zinc-800 pt-2 flex justify-between text-sm">
                <span className="font-bold text-white">Valor Líquido a Receber:</span>
                <span className="font-mono font-extrabold text-emerald-400">R$ {Number(modalLiquidarItem.valor_liquido).toFixed(2)}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                Data do Recebimento Real
              </label>
              <input
                type="date"
                value={dataRecebimentoReal}
                onChange={(e) => setDataRecebimentoReal(e.target.value)}
                className="w-full bg-black border border-zinc-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalLiquidarItem(null)}
                className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarLiquidacaoIndividual}
                disabled={actionLoading}
                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-extrabold rounded-xl transition-all shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {actionLoading ? <Loader2 size={15} className="animate-spin text-black" /> : <Check size={15} className="stroke-[3]" />}
                <span>Confirmar e Liquidar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: AUDITAR / VER VENDA */}
      {modalAuditoriaItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-[#0A0A0A] border border-zinc-800 rounded-2xl max-w-lg w-full p-6 space-y-5 flex flex-col relative shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-950/60 border border-purple-800/50 text-[#c084fc]">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Auditoria de Venda & Contrato</h3>
                  <p className="text-xs text-zinc-400">ID Repasse: {modalAuditoriaItem.id.slice(0, 8)}...</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalAuditoriaItem(null)}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-zinc-900/60 p-3.5 rounded-xl border border-zinc-800">
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-bold block">Filial</span>
                  <span className="font-bold text-white">{modalAuditoriaItem.filiais?.nome || 'Loja Física'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-bold block">Financeira / Operadora</span>
                  <span className="font-bold text-cyan-300">{modalAuditoriaItem.financeira}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-bold block">Cliente</span>
                  <span className="font-bold text-white">{modalAuditoriaItem.vendas?.cliente_nome || 'Consumidor Final'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-bold block">Vendedor</span>
                  <span className="font-bold text-white">{modalAuditoriaItem.vendas?.vendedor_nome || 'Vendedor'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-bold block">Data da Venda</span>
                  <span className="font-mono text-zinc-300">{formatarDataBR(modalAuditoriaItem.created_at)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-bold block">Previsão de Repasse</span>
                  <span className="font-mono text-zinc-300">{formatarDataBR(modalAuditoriaItem.data_prevista_repasse)}</span>
                </div>
              </div>

              {/* Detalhes Financeiros */}
              <div className="bg-zinc-900/80 p-4 rounded-xl border border-zinc-800 space-y-2">
                <h4 className="font-bold text-white uppercase text-[10px] tracking-wider mb-2">Composição Financeira</h4>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Valor Bruto da Venda:</span>
                  <span className="font-mono text-zinc-200 font-bold">R$ {Number(modalAuditoriaItem.valor_bruto).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Taxa de Retenção ({modalAuditoriaItem.valor_bruto > 0 ? ((modalAuditoriaItem.taxa_retencao / modalAuditoriaItem.valor_bruto) * 100).toFixed(1) : 0}%):</span>
                  <span className="font-mono text-rose-400 font-bold">- R$ {Number(modalAuditoriaItem.taxa_retencao).toFixed(2)}</span>
                </div>
                <div className="border-t border-zinc-800 pt-2 flex justify-between text-sm">
                  <span className="font-bold text-white">Valor Líquido Conciliado:</span>
                  <span className="font-mono font-black text-emerald-400">R$ {Number(modalAuditoriaItem.valor_liquido).toFixed(2)}</span>
                </div>
              </div>

              {modalAuditoriaItem.vendas?.produto_nome && (
                <div className="bg-zinc-900/40 p-3 rounded-xl border border-zinc-800/80">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold block">Itens / Descrição</span>
                  <span className="text-zinc-300">{modalAuditoriaItem.vendas.produto_nome}</span>
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setModalAuditoriaItem(null)}
                className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold rounded-xl transition-all"
              >
                Fechar Auditoria
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NOVO LANÇAMENTO MANUAL */}
      {modalNovoRepasseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-[#0A0A0A] border border-[#6A0DAD]/50 rounded-2xl max-w-md w-full p-6 space-y-5 flex flex-col relative shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#6A0DAD]/20 border border-[#6A0DAD]/40 text-[#c084fc]">
                  <Plus size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Novo Lançamento de Repasse</h3>
                  <p className="text-xs text-zinc-400">Registro manual de valores a receber</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalNovoRepasseOpen(false)}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCriarRepasseManual} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Filial *</label>
                <select
                  value={novoRepasse.filial_id}
                  onChange={(e) => setNovoRepasse({ ...novoRepasse, filial_id: e.target.value })}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-white outline-none"
                  required
                >
                  <option value="">Selecione a filial...</option>
                  {filiaisLista.map(f => (
                    <option key={f.id} value={f.id}>{f.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Financeira / Operadora *</label>
                <select
                  value={novoRepasse.financeira}
                  onChange={(e) => setNovoRepasse({ ...novoRepasse, financeira: e.target.value })}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-white outline-none"
                  required
                >
                  {financeirasPreset.map(fin => (
                    <option key={fin} value={fin}>{fin}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Valor Bruto (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={novoRepasse.valor_bruto}
                    onChange={(e) => setNovoRepasse({ ...novoRepasse, valor_bruto: e.target.value })}
                    className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Taxa Retenção (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={novoRepasse.taxa_retencao}
                    onChange={(e) => setNovoRepasse({ ...novoRepasse, taxa_retencao: e.target.value })}
                    className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Data Prevista de Repasse</label>
                <input
                  type="date"
                  value={novoRepasse.data_prevista_repasse}
                  onChange={(e) => setNovoRepasse({ ...novoRepasse, data_prevista_repasse: e.target.value })}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono outline-none"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalNovoRepasseOpen(false)}
                  className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-2.5 bg-[#6A0DAD] hover:bg-[#500885] text-white text-xs font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  <span>Salvar Lançamento</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContasAReceber;

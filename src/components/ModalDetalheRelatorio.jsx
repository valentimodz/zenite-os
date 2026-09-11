import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, BarChart3, Calendar, Building2, DollarSign, TrendingUp, 
  ArrowUpRight, ArrowDownRight, CreditCard, Layers, Store, 
  User, PieChart, RefreshCw, Printer, Download, Filter, Eye
} from 'lucide-react';
import { supabase } from '../supabaseClient';

// Helper para formatação amigável dos métodos de pagamento
const formatarMetodoPagamento = (metodo) => {
  if (!metodo) return 'Outros';
  const key = String(metodo).toUpperCase().trim();
  const mapa = {
    'CARTAO_DEBITO': 'Cartão de Débito',
    'DEBITO': 'Cartão de Débito',
    'CARTAO_CREDITO': 'Cartão de Crédito',
    'CREDITO': 'Cartão de Crédito',
    'BOLETO': 'Boleto / Crediário',
    'CREDIARIO': 'Boleto / Crediário',
    'PIX': 'Pix',
    'DINHEIRO': 'Dinheiro'
  };
  return mapa[key] || metodo;
};

export default function ModalDetalheRelatorio({
  isOpen,
  onClose,
  filiais = []
}) {
  const [listaFiliais, setListaFiliais] = useState(filiais || []);
  const [filialSelecionada, setFilialSelecionada] = useState('todas');
  
  // Função utilitária para formatar Date em YYYY-MM-DD
  const formatarDataIso = (d) => {
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  };

  // Padrão inicial: data de hoje YYYY-MM-DD
  const hojeStr = useMemo(() => formatarDataIso(new Date()), []);
  const [dataInicio, setDataInicio] = useState(hojeStr);
  const [dataFim, setDataFim] = useState(hojeStr);

  const [loading, setLoading] = useState(false);
  const [vendas, setVendas] = useState([]);
  const [caixas, setCaixas] = useState([]);
  const [tabAtiva, setTabAtiva] = useState('visao_geral'); // 'visao_geral' | 'metodos' | 'filiais' | 'vendedores'

  // Funções de atalhos rápidos de período
  const definirPeriodoHoje = () => {
    const hoje = formatarDataIso(new Date());
    setDataInicio(hoje);
    setDataFim(hoje);
  };

  const definirPeriodoOntem = () => {
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    const ontemStr = formatarDataIso(ontem);
    setDataInicio(ontemStr);
    setDataFim(ontemStr);
  };

  const definirPeriodoUltimos7Dias = () => {
    const dHoje = new Date();
    const d7Atras = new Date();
    d7Atras.setDate(d7Atras.getDate() - 6);
    setDataInicio(formatarDataIso(d7Atras));
    setDataFim(formatarDataIso(dHoje));
  };

  const definirPeriodoMesAtual = () => {
    const dHoje = new Date();
    const primeiroDiaMes = new Date(dHoje.getFullYear(), dHoje.getMonth(), 1);
    setDataInicio(formatarDataIso(primeiroDiaMes));
    setDataFim(formatarDataIso(dHoje));
  };

  // Sincronizar filiais caso receba novas props ou buscar do Supabase
  useEffect(() => {
    if (Array.isArray(filiais) && filiais.length > 0) {
      setListaFiliais(filiais);
    } else if (isOpen) {
      supabase
        .from('filiais')
        .select('id, nome')
        .order('nome', { ascending: true })
        .then(({ data }) => {
          if (data) setListaFiliais(data);
        });
    }
  }, [filiais, isOpen]);

  // Carregar dados financeiros consolidados quando abrir ou mudar filtros
  useEffect(() => {
    if (!isOpen) return;

    const carregarDadosFinanceiros = async () => {
      setLoading(true);
      try {
        // 1. Buscar vendas com filtros no range de datas
        let queryVendas = supabase
          .from('vendas')
          .select('*')
          .order('created_at', { ascending: false });

        if (dataInicio) {
          queryVendas = queryVendas.gte('created_at', `${dataInicio}T00:00:00`);
        }
        if (dataFim) {
          queryVendas = queryVendas.lte('created_at', `${dataFim}T23:59:59`);
        }

        if (filialSelecionada && filialSelecionada !== 'todas') {
          queryVendas = queryVendas.eq('filial_id', filialSelecionada);
        }

        // 2. Buscar caixas com filtros no range de datas
        let queryCaixas = supabase
          .from('caixas')
          .select('*')
          .order('data_abertura', { ascending: false });

        if (dataInicio) {
          queryCaixas = queryCaixas.gte('created_at', `${dataInicio}T00:00:00`);
        }
        if (dataFim) {
          queryCaixas = queryCaixas.lte('created_at', `${dataFim}T23:59:59`);
        }

        if (filialSelecionada && filialSelecionada !== 'todas') {
          queryCaixas = queryCaixas.eq('filial_id', filialSelecionada);
        }

        const [resVendas, resCaixas, resProfiles, resFiliais] = await Promise.all([
          queryVendas,
          queryCaixas,
          supabase.from('profiles').select('id, nome'),
          supabase.from('filiais').select('id, nome')
        ]);

        const profilesMap = (resProfiles.data || []).reduce((acc, p) => {
          acc[p.id] = p.nome;
          return acc;
        }, {});

        const filiaisMap = (resFiliais.data || []).reduce((acc, f) => {
          acc[f.id] = f.nome;
          return acc;
        }, {});

        const vendasFormatadas = (resVendas.data || []).map(v => ({
          ...v,
          vendedor_nome: v.vendedor_nome || profilesMap[v.vendedor_id] || 'Vendedor'
        }));

        setVendas(vendasFormatadas);

        // Mapear sessões de caixa com nomes reais de vendedor e filial
        const caixasFormatados = (resCaixas.data || []).map(cx => {
          const filialNome = cx.filial_nome || filiaisMap[cx.filial_id] || 'Loja';
          const vendedorNome = cx.vendedor_nome || cx.operador_nome || profilesMap[cx.operador_id] || profilesMap[cx.vendedor_id] || 'Vendedor';

          return {
            ...cx,
            filial_nome: filialNome,
            vendedor_nome: vendedorNome
          };
        });

        setCaixas(caixasFormatados);
      } catch (err) {
        console.error('Erro ao carregar relatório financeiro:', err);
      } finally {
        setLoading(false);
      }
    };

    carregarDadosFinanceiros();
  }, [isOpen, dataInicio, dataFim, filialSelecionada]);

  // Cálculos consolidados
  const metricas = useMemo(() => {
    let faturamentoTotal = 0;
    let totalComissoes = 0;
    let qtdItens = 0;

    const porMetodo = {};
    const porFilial = {};
    const porVendedor = {};

    vendas.forEach(v => {
      const valor = Number(v.valor_total || v.valor || v.valor_pago || 0);
      const comissao = Number(v.comissao || 0);
      const qtd = Number(v.quantidade || 1);

      faturamentoTotal += valor;
      totalComissoes += comissao;
      qtdItens += qtd;

      // Por método formatado
      const metodoRaw = v.metodo_pagamento || v.forma_pagamento || 'OUTROS';
      const metodoLabel = formatarMetodoPagamento(metodoRaw);
      if (!porMetodo[metodoLabel]) porMetodo[metodoLabel] = { valor: 0, count: 0 };
      porMetodo[metodoLabel].valor += valor;
      porMetodo[metodoLabel].count += 1;

      // Por filial
      const filialNome = listaFiliais.find(f => String(f.id) === String(v.filial_id))?.nome || v.filial_nome || 'Matriz';
      if (!porFilial[filialNome]) porFilial[filialNome] = { valor: 0, count: 0 };
      porFilial[filialNome].valor += valor;
      porFilial[filialNome].count += 1;

      // Por vendedor
      const vendedor = v.vendedor_nome || 'Vendedor Padrão';
      if (!porVendedor[vendedor]) porVendedor[vendedor] = { valor: 0, count: 0, comissao: 0 };
      porVendedor[vendedor].valor += valor;
      porVendedor[vendedor].count += 1;
      porVendedor[vendedor].comissao += comissao;
    });

    // Cálculo real do CMV abatendo o preco_custo dos itens vendidos
    const custoTotal = vendas.reduce((acc, v) => acc + Number(v.preco_custo || 0), 0);
    const lucroBruto = faturamentoTotal - custoTotal;
    const margem = faturamentoTotal > 0 ? ((lucroBruto / faturamentoTotal) * 100).toFixed(1) : 0;
    const ticketMedio = vendas.length > 0 ? faturamentoTotal / vendas.length : 0;

    return {
      faturamentoTotal,
      custoTotal,
      totalComissoes,
      lucroBruto,
      margem,
      ticketMedio,
      qtdVendas: vendas.length,
      qtdItens,
      porMetodo,
      porFilial,
      porVendedor
    };
  }, [vendas, listaFiliais]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-6 animate-fadeIn">
      <div className="bg-[#0A0A0A] border border-[#222222] rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl shadow-purple-950/20 overflow-hidden">
        
        {/* Cabeçalho do Modal */}
        <div className="p-5 border-b border-[#222222] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#111111]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0 shadow-inner">
              <BarChart3 size={22} />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                Detalhamento do Relatório Financeiro
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800">
                  Consolidado
                </span>
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Métricas detalhadas de faturamento, canais de pagamento, lucro e desempenho por filial.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              onClick={() => window.print()}
              className="p-2 text-gray-400 hover:text-white hover:bg-[#222222] rounded-lg transition-colors cursor-pointer"
              title="Imprimir Relatório"
            >
              <Printer size={18} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-[#222222] rounded-lg transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Barra de Filtros e Atalhos Rápidos */}
        <div className="p-4 bg-[#0E0E0E] border-b border-[#222222] flex flex-col gap-3">
          {/* Chips de Atalhos Rápidos de Período */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-gray-400 flex items-center gap-1 mr-1">
              <Calendar size={13} className="text-[#6A0DAD]" /> Período rápido:
            </span>
            <button
              type="button"
              onClick={definirPeriodoHoje}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-black hover:bg-[#1a1a1a] text-gray-300 hover:text-white border border-[#2a2a2a] hover:border-purple-500/50 transition-all cursor-pointer"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={definirPeriodoOntem}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-black hover:bg-[#1a1a1a] text-gray-300 hover:text-white border border-[#2a2a2a] hover:border-purple-500/50 transition-all cursor-pointer"
            >
              Ontem
            </button>
            <button
              type="button"
              onClick={definirPeriodoUltimos7Dias}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-black hover:bg-[#1a1a1a] text-gray-300 hover:text-white border border-[#2a2a2a] hover:border-purple-500/50 transition-all cursor-pointer"
            >
              Últimos 7 dias
            </button>
            <button
              type="button"
              onClick={definirPeriodoMesAtual}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-black hover:bg-[#1a1a1a] text-gray-300 hover:text-white border border-[#2a2a2a] hover:border-purple-500/50 transition-all cursor-pointer"
            >
              Mês Atual
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-3">
              {/* Filtro Data Inicial */}
              <div className="flex items-center gap-2 bg-black border border-[#222222] px-3 py-1.5 rounded-lg text-xs">
                <Calendar size={14} className="text-[#6A0DAD]" />
                <span className="text-gray-400 font-semibold">De:</span>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="bg-black text-white text-xs font-bold focus:outline-none cursor-pointer"
                />
              </div>

              {/* Filtro Data Final */}
              <div className="flex items-center gap-2 bg-black border border-[#222222] px-3 py-1.5 rounded-lg text-xs">
                <Calendar size={14} className="text-[#6A0DAD]" />
                <span className="text-gray-400 font-semibold">Até:</span>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="bg-black text-white text-xs font-bold focus:outline-none cursor-pointer"
                />
              </div>

              {/* Filtro Filial */}
              <div className="flex items-center gap-2 bg-black border border-[#222222] px-3 py-1.5 rounded-lg text-xs">
                <Building2 size={14} className="text-[#6A0DAD]" />
                <span className="text-gray-400 font-semibold">Filial:</span>
                <select
                  value={filialSelecionada}
                  onChange={(e) => setFilialSelecionada(e.target.value)}
                  className="bg-black text-white text-xs font-bold focus:outline-none cursor-pointer"
                >
                  <option value="todas">🏢 Todas as Filiais</option>
                  {listaFiliais.map(f => (
                    <option key={f.id} value={f.id}>{f.nome}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Abas Internas */}
            <div className="flex items-center bg-black border border-[#222222] p-1 rounded-xl text-xs gap-1">
              <button
                onClick={() => setTabAtiva('visao_geral')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  tabAtiva === 'visao_geral'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Visão Geral
              </button>
              <button
                onClick={() => setTabAtiva('metodos')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  tabAtiva === 'metodos'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Formas de Pagamento
              </button>
              <button
                onClick={() => setTabAtiva('filiais')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  tabAtiva === 'filiais'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Por Filial
              </button>
              <button
                onClick={() => setTabAtiva('vendedores')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  tabAtiva === 'vendedores'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Vendedores
              </button>
            </div>
          </div>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-gray-500">
              <RefreshCw size={28} className="animate-spin text-purple-500" />
              <span className="text-sm font-semibold">Calculando dados financeiros em tempo real...</span>
            </div>
          ) : (
            <>
              {/* KPIs Principais em Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[#111111] border border-[#222222] p-4 rounded-xl flex flex-col gap-1">
                  <div className="flex items-center justify-between text-gray-400 text-xs font-semibold">
                    <span>Faturamento Total</span>
                    <DollarSign size={16} className="text-emerald-400" />
                  </div>
                  <span className="text-xl font-extrabold text-white font-mono mt-1">
                    {metricas.faturamentoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                  <span className="text-[11px] text-gray-500 font-medium">
                    {metricas.qtdVendas} vendas faturadas
                  </span>
                </div>

                <div className="bg-[#111111] border border-[#222222] p-4 rounded-xl flex flex-col gap-1">
                  <div className="flex items-center justify-between text-gray-400 text-xs font-semibold">
                    <span>Ticket Médio</span>
                    <TrendingUp size={16} className="text-purple-400" />
                  </div>
                  <span className="text-xl font-extrabold text-purple-300 font-mono mt-1">
                    {metricas.ticketMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                  <span className="text-[11px] text-gray-500 font-medium">
                    Média por venda realizada
                  </span>
                </div>

                <div className="bg-[#111111] border border-[#222222] p-4 rounded-xl flex flex-col gap-1">
                  <div className="flex items-center justify-between text-gray-400 text-xs font-semibold">
                    <span>Lucro Bruto Estimado</span>
                    <ArrowUpRight size={16} className="text-green-400" />
                  </div>
                  <span className="text-xl font-extrabold text-green-400 font-mono mt-1">
                    {metricas.lucroBruto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] text-emerald-500/90 font-medium">
                      Margem bruta ~{metricas.margem}%
                    </span>
                    {metricas.custoTotal === 0 && metricas.faturamentoTotal > 0 && (
                      <span className="text-[10px] text-amber-400/90 bg-amber-950/40 px-1.5 py-0.2 rounded border border-amber-800/40" title="Itens vendidos sem preço de custo cadastrado no estoque">
                        (sem custo base)
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-[#111111] border border-[#222222] p-4 rounded-xl flex flex-col gap-1">
                  <div className="flex items-center justify-between text-gray-400 text-xs font-semibold">
                    <span>Comissões Totais</span>
                    <User size={16} className="text-amber-400" />
                  </div>
                  <span className="text-xl font-extrabold text-amber-300 font-mono mt-1">
                    {metricas.totalComissoes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                  <span className="text-[11px] text-gray-500 font-medium">
                    Rateio a pagar à equipe
                  </span>
                </div>
              </div>

              {/* ABA 1: Visão Geral */}
              {tabAtiva === 'visao_geral' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Resumo por Forma de Pagamento */}
                  <div className="bg-[#111111] border border-[#222222] rounded-xl p-5 space-y-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <CreditCard size={16} className="text-purple-400" />
                      Participação por Forma de Pagamento
                    </h3>
                    <div className="space-y-3">
                      {Object.keys(metricas.porMetodo).length === 0 ? (
                        <p className="text-xs text-gray-500 italic py-4">Sem dados no período.</p>
                      ) : (
                        Object.entries(metricas.porMetodo).map(([metodo, dados]) => {
                          const percentual = metricas.faturamentoTotal > 0 ? (dados.valor / metricas.faturamentoTotal) * 100 : 0;
                          return (
                            <div key={metodo} className="space-y-1">
                              <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-gray-300">{metodo} ({dados.count}x)</span>
                                <span className="font-mono text-white font-extrabold">
                                  {dados.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} ({percentual.toFixed(1)}%)
                                </span>
                              </div>
                              <div className="w-full bg-[#222222] h-2 rounded-full overflow-hidden">
                                <div
                                  className="bg-gradient-to-r from-purple-600 to-[#8A2BE2] h-full rounded-full transition-all duration-500"
                                  style={{ width: `${percentual}%` }}
                                />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Resumo de Caixas no Período */}
                  <div className="bg-[#111111] border border-[#222222] rounded-xl p-5 space-y-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Store size={16} className="text-purple-400" />
                      Sessões de Caixa no Período ({caixas.length})
                    </h3>
                    <div className="space-y-2">
                      {caixas.length === 0 ? (
                        <p className="text-xs text-gray-500 italic py-4">Nenhuma sessão de caixa encontrada.</p>
                      ) : (
                        caixas.slice(0, 5).map(cx => {
                          const isAberto = String(cx.status || '').toLowerCase() === 'aberto' && !cx.data_fechamento;
                          const fundo = Number(cx.saldo_inicial || 0);
                          const totalDinheiro = Number(cx.total_dinheiro || 0);
                          const emGaveta = fundo + totalDinheiro;

                          return (
                            <div key={cx.id} className="p-3 bg-black/50 border border-[#222222] rounded-lg flex items-center justify-between text-xs">
                              <div>
                                <span className="font-bold text-white block">
                                  {cx.filial_nome || cx.filiais?.nome || 'Loja'} • {cx.vendedor_nome || cx.profiles?.nome || 'Vendedor'}
                                </span>
                                <span className="text-[10px] text-gray-500">
                                  {cx.data_abertura ? new Date(cx.data_abertura).toLocaleDateString('pt-BR') : '-'}
                                </span>
                              </div>
                              <div className="text-right flex flex-col items-end">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isAberto ? 'bg-green-950 text-green-400 border border-green-800' : 'bg-zinc-900 text-gray-400'
                                }`}>
                                  {isAberto ? 'Aberto' : 'Fechado'}
                                </span>
                                <div className="mt-1 flex flex-col items-end text-[11px]">
                                  <span className="font-mono text-gray-400">
                                    Fundo: R$ {fundo.toFixed(2)}
                                  </span>
                                  <span className="font-mono text-emerald-400 font-bold">
                                    Em Gaveta: R$ {emGaveta.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ABA 2: Formas de Pagamento Detalhadas */}
              {tabAtiva === 'metodos' && (
                <div className="bg-[#111111] border border-[#222222] rounded-xl p-5">
                  <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <CreditCard size={16} className="text-purple-400" />
                    Detalhamento Financeiro por Método
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-[#222222] text-gray-500 font-bold uppercase text-[10px]">
                          <th className="pb-3">Método / Bandeira</th>
                          <th className="pb-3 text-center">Transações</th>
                          <th className="pb-3 text-right">Volume Total</th>
                          <th className="pb-3 text-right">Ticket Médio</th>
                          <th className="pb-3 text-right">Participação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#222222]">
                        {Object.entries(metricas.porMetodo).map(([metodo, dados]) => {
                          const part = metricas.faturamentoTotal > 0 ? (dados.valor / metricas.faturamentoTotal) * 100 : 0;
                          const tMedio = dados.count > 0 ? dados.valor / dados.count : 0;
                          return (
                            <tr key={metodo} className="hover:bg-purple-950/5">
                              <td className="py-3 font-bold text-white">{metodo}</td>
                              <td className="py-3 text-center font-mono text-gray-300">{dados.count}</td>
                              <td className="py-3 text-right font-mono font-bold text-emerald-400">
                                {dados.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </td>
                              <td className="py-3 text-right font-mono text-gray-300">
                                {tMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </td>
                              <td className="py-3 text-right font-bold text-purple-300">
                                {part.toFixed(1)}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ABA 3: Por Filial */}
              {tabAtiva === 'filiais' && (
                <div className="bg-[#111111] border border-[#222222] rounded-xl p-5">
                  <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <Building2 size={16} className="text-purple-400" />
                    Desempenho Financeiro por Filial
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {Object.entries(metricas.porFilial).map(([filial, dados]) => {
                      const part = metricas.faturamentoTotal > 0 ? (dados.valor / metricas.faturamentoTotal) * 100 : 0;
                      return (
                        <div key={filial} className="bg-black/60 border border-[#222222] p-4 rounded-xl flex flex-col gap-2">
                          <span className="text-xs font-bold text-white flex items-center gap-1.5">
                            <Store size={14} className="text-purple-400" />
                            {filial}
                          </span>
                          <span className="text-lg font-extrabold text-white font-mono">
                            {dados.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                          <div className="flex justify-between text-[11px] text-gray-400 border-t border-[#222222] pt-2">
                            <span>{dados.count} vendas</span>
                            <span className="text-purple-300 font-bold">{part.toFixed(1)}% do total</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ABA 4: Por Vendedor */}
              {tabAtiva === 'vendedores' && (
                <div className="bg-[#111111] border border-[#222222] rounded-xl p-5">
                  <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <User size={16} className="text-purple-400" />
                    Performance e Comissões por Vendedor
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-[#222222] text-gray-500 font-bold uppercase text-[10px]">
                          <th className="pb-3">Vendedor</th>
                          <th className="pb-3 text-center">Vendas</th>
                          <th className="pb-3 text-right">Faturamento</th>
                          <th className="pb-3 text-right">Comissão Devida</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#222222]">
                        {Object.entries(metricas.porVendedor).map(([vend, dados]) => (
                          <tr key={vend} className="hover:bg-purple-950/5">
                            <td className="py-3 font-bold text-white">{vend}</td>
                            <td className="py-3 text-center font-mono text-gray-300">{dados.count}</td>
                            <td className="py-3 text-right font-mono font-bold text-white">
                              {dados.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </td>
                            <td className="py-3 text-right font-mono font-bold text-amber-300">
                              {dados.comissao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Rodapé do Modal */}
        <div className="p-4 bg-[#111111] border-t border-[#222222] flex justify-between items-center text-xs">
          <span className="text-gray-500">
            * Dados calculados a partir dos registros de vendas e caixas no Supabase.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold transition-all shadow-md shadow-purple-900/30 cursor-pointer"
          >
            Fechar Relatório
          </button>
        </div>

      </div>
    </div>
  );
}

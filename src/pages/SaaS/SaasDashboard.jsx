import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { 
  LayoutDashboard, TrendingUp, Users, DollarSign, Activity, AlertTriangle, 
  CheckCircle2, Loader2, Sparkles, RefreshCw, AlertCircle, Box, TrendingDown 
} from 'lucide-react';
import { calcularInsightsEstoque, gerarConselhoFinanceiro } from '../../services/groqService';

export default function SaasDashboard({ 
  totalCompanies: propTotal = 0, 
  activeCompanies: propActive = 0, 
  inactiveCompanies: propInactive = 0, 
  simulatedSalesVolume: propVolume = 0 
}) {
  const [metricas, setMetricas] = useState({
    total: propTotal,
    ativas: propActive,
    inativas: propInactive,
    faturamento: propVolume
  });
  const [loading, setLoading] = useState(!propTotal);

  // Estados do Motor de Insights Executivos IA
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
  const [insightsMatematicos, setInsightsMatematicos] = useState(null);
  const [conselhoExecutivo, setConselhoExecutivo] = useState('');
  const [isAiConseil, setIsAiConseil] = useState(false);

  useEffect(() => {
    fetchMetricas();
    runExecutiveAnalysis();
  }, []);

  const fetchMetricas = async () => {
    try {
      if (!propTotal) setLoading(true);

      let { data: empresasData, error: empresasErr } = await supabase.from('empresas').select('*');

      if (empresasErr || !empresasData || empresasData.length === 0) {
        const { data: compData } = await supabase.from('companies').select('*');
        if (compData && compData.length > 0) {
          empresasData = compData;
        }
      }

      const total = empresasData ? empresasData.length : propTotal;
      const ativas = empresasData 
        ? empresasData.filter(c => c.status === 'ATIVO' || c.status_assinatura === 'ATIVO' || c.status === 'active').length 
        : propActive;
      const inativas = Math.max(0, total - ativas);

      let faturamentoTotal = propVolume;
      const { data: vendasData } = await supabase.from('vendas').select('valor_total, valor');
      if (vendasData && vendasData.length > 0) {
        faturamentoTotal = vendasData.reduce((acc, curr) => acc + (Number(curr.valor_total || curr.valor || 0)), 0);
      }

      setMetricas({
        total,
        ativas,
        inativas,
        faturamento: faturamentoTotal
      });
    } catch (err) {
      console.error('Erro ao agregar métricas do SaaS:', err);
    } finally {
      setLoading(false);
    }
  };

  const runExecutiveAnalysis = async () => {
    try {
      setAiAnalysisLoading(true);

      // 1. Buscar produtos do estoque
      const { data: prodsData } = await supabase.from('produtos').select('*');
      const produtosList = prodsData || [];

      // 2. Buscar histórico de vendas
      const { data: vendsData } = await supabase.from('vendas').select('*');
      const meVendasList = vendsData || [];

      // 3. Executar o Cérebro Matemático Determinístico (0 alucinações)
      const mathInsights = calcularInsightsEstoque(produtosList, meVendasList);
      setInsightsMatematicos(mathInsights);

      // 4. Invocar o Conselheiro Financeiro Groq LLaMA 3
      const result = await gerarConselhoFinanceiro(mathInsights);
      setConselhoExecutivo(result.conselho);
      setIsAiConseil(result.isAI);
    } catch (err) {
      console.error('Erro na análise do Conselheiro Zênite IA:', err);
    } finally {
      setAiAnalysisLoading(false);
    }
  };

  const finalTotal = metricas.total || propTotal;
  const finalAtivas = metricas.ativas || propActive;
  const finalInativas = metricas.inativas || propInactive;
  const finalVolume = metricas.faturamento || propVolume;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0C001C] to-black border border-[#6A0DAD]/30 p-8 rounded-2xl shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-3">
            <LayoutDashboard className="text-[#6A0DAD]" size={32} />
            Dashboard SaaS - Métricas Globais do Zênite
          </h1>
          <p className="text-gray-400 text-sm mt-2">
            Visão geral executiva do software Zênite: volume total transacionado, lojas ativas e conselheiro IA de negócios.
          </p>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-xs text-purple-400 bg-purple-950/30 border border-purple-800/40 px-3 py-1.5 rounded-lg shrink-0">
            <Loader2 size={14} className="animate-spin" />
            <span>Atualizando banco...</span>
          </div>
        )}
      </div>

      {/* Grid Único de KPIs do SaaS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Total de Empresas */}
        <div className="bg-[#0A0A0A] border border-[#222222] p-6 rounded-xl relative overflow-hidden shadow-xl hover:border-[#6A0DAD]/40 transition-all">
          <div className="flex justify-between items-start">
            <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Total de Empresas</span>
            <div className="p-2 bg-[#6A0DAD]/10 rounded-lg text-[#6A0DAD]">
              <Users size={18} />
            </div>
          </div>
          <div className="text-3xl font-black mt-3 text-white">
            {loading && !finalTotal ? <Loader2 size={24} className="animate-spin text-gray-600" /> : finalTotal}
          </div>
          <div className="text-[10px] text-gray-500 font-semibold mt-2 flex items-center gap-1">
            <Activity size={12} /> Tenants cadastrados no sistema
          </div>
        </div>

        {/* Card 2: Empresas Ativas */}
        <div className="bg-[#0A0A0A] border border-[#222222] p-6 rounded-xl relative overflow-hidden shadow-xl border-l-4 border-l-green-500 hover:border-[#222222] transition-all">
          <div className="flex justify-between items-start">
            <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Empresas Ativas</span>
            <div className="p-2 bg-green-500/10 rounded-lg text-green-400">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="text-3xl font-black mt-3 text-green-400">
            {loading && !finalTotal ? <Loader2 size={24} className="animate-spin text-gray-600" /> : finalAtivas}
          </div>
          <div className="text-[10px] text-green-400 font-semibold mt-2">Clientes operando ativamente</div>
        </div>

        {/* Card 3: Inadimplentes / Inativas */}
        <div className="bg-[#0A0A0A] border border-[#222222] p-6 rounded-xl relative overflow-hidden shadow-xl border-l-4 border-l-red-500 hover:border-[#222222] transition-all">
          <div className="flex justify-between items-start">
            <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Inadimplentes / Inativas</span>
            <div className="p-2 bg-red-500/10 rounded-lg text-red-400">
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="text-3xl font-black mt-3 text-red-400">
            {loading && !finalTotal ? <Loader2 size={24} className="animate-spin text-gray-600" /> : finalInativas}
          </div>
          <div className="text-[10px] text-red-400 font-semibold mt-2">Empresas bloqueadas ou pendentes</div>
        </div>

        {/* Card 4: Faturamento Transacionado */}
        <div className="bg-[#0A0A0A] border border-[#222222] p-6 rounded-xl relative overflow-hidden shadow-xl border-l-4 border-l-purple-500 hover:border-[#222222] transition-all">
          <div className="flex justify-between items-start">
            <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Faturamento Transacionado</span>
            <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="text-3xl font-black mt-3 text-purple-400">
            {loading && !finalVolume ? (
              <Loader2 size={24} className="animate-spin text-gray-600" />
            ) : (
              `R$ ${Number(finalVolume || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            )}
          </div>
          <div className="text-[10px] text-purple-400 font-semibold mt-2 flex items-center gap-1">
            <TrendingUp size={12} /> Volume transacionado no sistema
          </div>
        </div>
      </div>

      {/* CARD DA ZÊNITE IA - CONSELHEIRO EXECUTIVO DE NEGÓCIOS */}
      <div className="bg-gradient-to-br from-[#120429] via-[#0A0A0A] to-black border border-[#6A0DAD]/50 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
        {/* Glow de Fundo */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-[#6A0DAD]/15 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#222222] pb-5 relative z-10">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-[#6A0DAD]/20 border border-[#6A0DAD]/40 rounded-xl text-yellow-400">
                <Sparkles size={22} className="animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-black text-white flex items-center gap-2 tracking-tight">
                  🧠 Zênite IA - Conselheiro Executivo de Negócios
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Análise matemática determinística de estoque imobilizado + Diagnóstico tático via LLaMA 3
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isAiConseil ? (
              <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 shadow-sm">
                🤖 Groq LLaMA 3.3 (IA Ativa)
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1.5">
                ⚡ Cérebro Determinístico (Fallback)
              </span>
            )}

            <button
              type="button"
              disabled={aiAnalysisLoading}
              onClick={runExecutiveAnalysis}
              className="px-4 py-2 bg-[#6A0DAD] hover:bg-[#7b12c4] text-white text-xs font-bold rounded-xl transition-all shadow-lg flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={14} className={aiAnalysisLoading ? 'animate-spin' : ''} />
              {aiAnalysisLoading ? 'Analisando...' : 'Recalcular & Gerar IA'}
            </button>
          </div>
        </div>

        {/* Métricas Calculadas (Cérebro Matemático Sem Alucinação) */}
        {insightsMatematicos && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10">
            <div className="bg-black/60 border border-[#222222] p-4 rounded-xl">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Capital Imobilizado Parado</span>
              <span className="text-xl font-black text-red-400 font-mono mt-1 block">
                R$ {insightsMatematicos.capitalParadoEncalhado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] text-gray-500 mt-1 block">Sem vendas nos últimos 30 dias</span>
            </div>

            <div className="bg-black/60 border border-[#222222] p-4 rounded-xl">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Produtos Sem Giro</span>
              <span className="text-xl font-black text-amber-400 font-mono mt-1 block">
                {insightsMatematicos.produtosEncalhadosCount} modelo(s)
              </span>
              <span className="text-[10px] text-gray-500 mt-1 block">De um total de {insightsMatematicos.totalProdutos} cadastrados</span>
            </div>

            <div className="bg-black/60 border border-[#222222] p-4 rounded-xl">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Maior Impacto de Caixa</span>
              <span className="text-sm font-bold text-purple-300 truncate mt-1 block">
                {insightsMatematicos.topEncalhado ? insightsMatematicos.topEncalhado.nome : 'Nenhum'}
              </span>
              <span className="text-[10px] text-gray-400 mt-0.5 block">
                {insightsMatematicos.topEncalhado ? `${insightsMatematicos.topEncalhado.quantidade} un imobilizadas (R$ ${insightsMatematicos.topEncalhado.capitalTotal.toLocaleString('pt-BR')})` : 'Estoque 100% girando'}
              </span>
            </div>
          </div>
        )}

        {/* Diagnóstico Gerado pelo Conselheiro AI */}
        <div className="bg-black/80 border border-[#222222] p-5 rounded-xl space-y-2 relative z-10">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <AlertCircle size={14} className="text-[#6A0DAD]" />
            Diagnóstico Executivo &amp; Plano de Ação Estratégico:
          </span>
          {aiAnalysisLoading ? (
            <div className="flex items-center gap-3 py-4 text-xs text-purple-300">
              <Loader2 size={18} className="animate-spin text-purple-400" />
              <span>Calculando matemática exata do estoque e consultando conselheiro Groq LLaMA 3...</span>
            </div>
          ) : (
            <p className="text-xs sm:text-sm text-gray-200 font-sans leading-relaxed whitespace-pre-line">
              {conselhoExecutivo || 'Clique em "Recalcular & Gerar IA" para obter o diagnóstico tático do seu estoque.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

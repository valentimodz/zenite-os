import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Award, RefreshCw, Calendar, Store, Filter } from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function RankingVendedores({
  vendedores = [],
  vendas: initialVendas = [],
  filiais = [],
  filtroMes: propFiltroMes,
  setFiltroMes: propSetFiltroMes,
  empresaId,
  fetchGerenteData
}) {
  // 1. Filtro de Mês/Ano Dinâmico no Topo (padrão: Mês Atual dinâmico YYYY-MM)
  const currentMonthStr = useMemo(() => {
    const d = new Date();
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    return `${ano}-${mes}`;
  }, []);

  const [localFiltroMes, setLocalFiltroMes] = useState(() => propFiltroMes || currentMonthStr);
  const filtroMes = propFiltroMes || localFiltroMes;
  const setFiltroMes = propSetFiltroMes || setLocalFiltroMes;

  // Filtro de Filial (Todas as Filiais / Por Filial)
  const [filtroFilial, setFiltroFilial] = useState('TODAS');

  // Estado de Vendas do Período e Loading
  const [vendasPeriodo, setVendasPeriodo] = useState(() => initialVendas || []);
  const [isLoading, setIsLoading] = useState(false);

  // 2. Ajuste na Query de Vendas:
  // Remova qualquer data fixa. Calcule o range com base no mês selecionado:
  // dataInicio = new Date(ano, mes, 1).toISOString();
  // dataFim = new Date(ano, mes + 1, 0, 23, 59, 59).toISOString();
  const fetchVendasRanking = useCallback(async () => {
    setIsLoading(true);
    try {
      const [anoStr, mesStr] = (filtroMes || currentMonthStr).split('-');
      const ano = parseInt(anoStr, 10);
      const mes = parseInt(mesStr, 10) - 1; // 0-indexed para o construtor Date

      const dataInicio = new Date(ano, mes, 1).toISOString();
      const dataFim = new Date(ano, mes + 1, 0, 23, 59, 59, 999).toISOString();

      let query = supabase
        .from('vendas')
        .select('*')
        .gte('created_at', dataInicio)
        .lte('created_at', dataFim)
        .order('created_at', { ascending: false });

      if (empresaId && empresaId !== 'MASTER') {
        query = query.eq('empresa_id', empresaId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[RankingVendedores] Erro ao buscar vendas do período:', error);
        // Fallback para filtrar initialVendas em memória com timezone safety
        const fallback = (initialVendas || []).filter(v => {
          const d = v.created_at || v.data || v.date;
          if (!d) return false;
          return String(d).startsWith(filtroMes);
        });
        setVendasPeriodo(fallback);
      } else {
        setVendasPeriodo(data || []);
      }
    } catch (err) {
      console.error('[RankingVendedores] Exceção ao consultar vendas:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filtroMes, empresaId, currentMonthStr, initialVendas]);

  // Carregar dados sempre que o filtroMes ou empresaId mudar
  useEffect(() => {
    fetchVendasRanking();
  }, [fetchVendasRanking]);

  // 4. Canal Realtime:
  // Listener realtime na tabela 'vendas' para disparar busca novamente sempre que houver INSERT de nova venda
  useEffect(() => {
    const channelName = `realtime-ranking-vendas-${empresaId || 'global'}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'vendas'
        },
        (payload) => {
          console.log('⚡ [Ranking Realtime] Nova venda detectada no ranking:', payload?.new);
          fetchVendasRanking();
          if (typeof fetchGerenteData === 'function' && empresaId) {
            fetchGerenteData(empresaId);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [empresaId, fetchVendasRanking, fetchGerenteData]);

  // Atualização manual via botão Recarregar
  const handleRecarregar = async () => {
    await fetchVendasRanking();
    if (typeof fetchGerenteData === 'function' && empresaId) {
      fetchGerenteData(empresaId);
    }
  };

  // 3. Agrupamento e Ordenação:
  // - Agrupe as vendas pelo vendedor_id.
  // - Some 'valor_total' para Volume, conte as vendas para 'Transações', calcule a média para 'Ticket Médio' e some a comissão acumulada.
  // - Ordene o array final por Volume decrescente (b.volume - a.volume).
  const rankingData = useMemo(() => {
    if (!vendedores || vendedores.length === 0) return [];

    // Filtrar vendas pela filial selecionada, se houver filtro ativo
    const vendasFiltradas = (vendasPeriodo || []).filter(v => {
      if (!filtroFilial || filtroFilial === 'TODAS') return true;
      return String(v.filial_id) === String(filtroFilial);
    });

    const data = vendedores
      .filter(colab => {
        if (!filtroFilial || filtroFilial === 'TODAS') return true;
        return String(colab.filial_id) === String(filtroFilial);
      })
      .map(colab => {
        // Pega as vendas onde o colaborador foi vendedor ou trainee
        const vendasColab = vendasFiltradas.filter(v =>
          String(v.vendedor_id) === String(colab.id) ||
          String(v.usuario_id) === String(colab.id) ||
          String(v.treener_id) === String(colab.id) ||
          String(v.trainee_id) === String(colab.id)
        );

        const transacoes = vendasColab.length;
        const volume = vendasColab.reduce((acc, v) => {
          const val = parseFloat(v.valor_total || v.valor_vendido || v.total || (v.preco * v.quantidade) || v.valor_pago || 0);
          return acc + (isNaN(val) ? 0 : val);
        }, 0);

        // Separa a comissão pela função exercida na venda
        const comissaoAcumulada = vendasColab.reduce((acc, v) => {
          let ganho = 0;
          if (String(v.vendedor_id) === String(colab.id) || String(v.usuario_id) === String(colab.id)) {
            ganho += parseFloat(v.comissao || 0);
          }
          if (String(v.treener_id) === String(colab.id) || String(v.trainee_id) === String(colab.id)) {
            ganho += parseFloat(v.comissao_trainee || 0);
          }
          return acc + (isNaN(ganho) ? 0 : ganho);
        }, 0);

        const ticketMedio = transacoes > 0 ? volume / transacoes : 0;
        const filialObj = filiais?.find(f => String(f.id) === String(colab.filial_id));

        return {
          ...colab,
          transacoes,
          volume,
          ticketMedio,
          comissaoAcumulada,
          filialNome: filialObj?.nome || 'Rede Cred'
        };
      });

    // Ordenação estrita por Volume decrescente (b.volume - a.volume)
    return data.sort((a, b) => b.volume - a.volume);
  }, [vendedores, vendasPeriodo, filiais, filtroFilial]);

  return (
    <div className="bg-black border border-[#222] rounded-xl overflow-hidden shadow-2xl animate-fadeIn mt-4 space-y-0">
      {/* 1. CABEÇALHO COM FILTRO DE PERÍODO DINÂMICO, FILTRO DE FILIAL E BOTÃO RECARREGAR */}
      <div className="p-4 bg-[#0E0E0E] border-b border-[#222] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-sm font-bold text-gray-200 flex items-center gap-2 uppercase tracking-wider">
            <Award size={18} className="text-[#6A0DAD]" />
            Classificação de Vendedores &amp; Trainees
          </span>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Acompanhamento em tempo real de transações, volume faturado, ticket médio e comissões.
          </p>
        </div>

        {/* Controles de Filtros */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Seletor de Mês/Ano Dinâmico */}
          <div className="flex items-center gap-2 bg-black border border-[#222] hover:border-[#6A0DAD]/50 px-3 py-1.5 rounded-lg transition-colors">
            <Calendar size={14} className="text-[#6A0DAD]" />
            <span className="text-[11px] font-bold text-gray-400 uppercase">Mês:</span>
            <input
              type="month"
              value={filtroMes}
              onChange={(e) => setFiltroMes(e.target.value)}
              className="bg-transparent text-white text-xs font-bold font-mono outline-none cursor-pointer"
            />
          </div>

          {/* Filtro de Filial */}
          <div className="flex items-center gap-2 bg-black border border-[#222] hover:border-[#6A0DAD]/50 px-3 py-1.5 rounded-lg transition-colors">
            <Store size={14} className="text-[#6A0DAD]" />
            <span className="text-[11px] font-bold text-gray-400 uppercase">Filial:</span>
            <select
              value={filtroFilial}
              onChange={(e) => setFiltroFilial(e.target.value)}
              className="bg-transparent text-white text-xs font-bold outline-none cursor-pointer"
            >
              <option value="TODAS" className="bg-[#111] text-white">Todas as Filiais</option>
              {filiais.map(f => (
                <option key={f.id} value={f.id} className="bg-[#111] text-white">
                  {f.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Botão Recarregar Dados */}
          <button
            onClick={handleRecarregar}
            disabled={isLoading}
            className="flex items-center gap-2 bg-gradient-to-r from-[#6A0DAD]/20 to-purple-900/30 hover:from-[#6A0DAD]/30 hover:to-purple-900/50 text-purple-200 hover:text-white border border-[#6A0DAD]/40 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-sm shadow-purple-950/30"
            title="Recarregar Dados em Tempo Real"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin text-purple-400' : 'text-purple-300'} />
            <span>{isLoading ? 'Atualizando...' : 'Recarregar'}</span>
          </button>
        </div>
      </div>

      {/* 2. TABELA DE RANKING ORDENADA POR VOLUME */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#0A0A0A] border-b border-[#222] text-gray-500 font-bold uppercase text-[10px]">
              <th className="py-3 px-4">Posição</th>
              <th className="py-3 px-4">Colaborador</th>
              <th className="py-3 px-4">Filial</th>
              <th className="py-3 px-4">Cargo</th>
              <th className="py-3 px-4 text-center">Transações</th>
              <th className="py-3 px-4 text-right">Volume</th>
              <th className="py-3 px-4 text-right">Ticket Médio</th>
              <th className="py-3 px-4 text-right text-emerald-400">Comissão Acumulada</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1A1A1A]">
            {rankingData.map((colab, idx) => (
              <tr key={colab.id} className="hover:bg-white/5 transition-colors">
                <td className="py-3 px-4 font-mono font-bold text-gray-400">
                  {idx === 0 ? '🥇 1º' : idx === 1 ? '🥈 2º' : idx === 2 ? '🥉 3º' : `${idx + 1}º`}
                </td>
                <td className="py-3 px-4 font-bold text-white uppercase">{colab.nome}</td>
                <td className="py-3 px-4 text-gray-400 text-[11px]">{colab.filialNome}</td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    colab.role === 'TRAINEE' || colab.is_treinner
                      ? 'bg-purple-950/40 text-purple-400 border border-purple-800/40'
                      : 'bg-emerald-950/30 text-emerald-500 border border-emerald-800/30'
                  }`}>
                    {colab.role === 'TRAINEE' || colab.is_treinner ? 'Trainee' : 'Profissional'}
                  </span>
                </td>
                <td className="py-3 px-4 text-center font-mono font-bold text-gray-300">{colab.transacoes}</td>
                <td className="py-3 px-4 text-right font-mono font-bold text-white">
                  {colab.volume.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td className="py-3 px-4 text-right font-mono text-blue-400">
                  {colab.ticketMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                  {colab.comissaoAcumulada.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
              </tr>
            ))}

            {rankingData.length === 0 && (
              <tr>
                <td colSpan="8" className="py-10 text-center text-gray-500 italic">
                  {isLoading ? 'Carregando dados do período...' : 'Nenhum colaborador ou venda encontrada para os filtros selecionados.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
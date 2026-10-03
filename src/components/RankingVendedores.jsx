import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Award, RefreshCw, Calendar, Store, Filter, Eye, UserCheck, Info } from 'lucide-react';
import { supabase } from '../supabaseClient';
import ModalDesempenhoVendedor from './ModalDesempenhoVendedor';
import PeriodoSelector from './common/PeriodoSelector';
import { useMetasRankings } from '../hooks/useMetasRankings';
import { useQueryClient } from '@tanstack/react-query';

// Helper de cálculo dinâmico de comissão do vendedor titular
export function calcularComissaoVendedorItem(v, teveTrainee = false) {
  if (Number(v?.comissao) > 0) {
    return Number(v.comissao);
  }
  const valor = Number(v?.valor_total || v?.valor_vendido || v?.total || (v?.preco * v?.quantidade) || v?.valor_pago || 0);
  const cat = (v?.categoria || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const metodo = (v?.metodo_pagamento || v?.forma_pagamento || '').toUpperCase();

  // 1. Acessórios: aplicar alíquota base (2,5% titular sem trainee, ou 1,5% se teve trainee)
  if (cat.includes('ACESS')) {
    return valor * (teveTrainee ? 0.015 : 0.025);
  }

  // 2. Boleto / Financiadoras (PayJoy, Aiva, Crediário, UME, WATU, etc.)
  const isFinanciado = ['PAYJOY', 'AIVA', 'BOLETO', 'CREDIARIO', 'UME', 'WATU'].some(m => metodo.includes(m));
  if (isFinanciado) {
    const taxa = teveTrainee ? 0.015 : 0.020;
    return valor * taxa;
  }

  // 3. Demais vendas (Cartão, Dinheiro, Pix em celulares)
  return valor * (teveTrainee ? 0.005 : 0.010);
}

// Helper de cálculo dinâmico de comissão da trainee participante
export function calcularComissaoTraineeItem(v) {
  if (Number(v?.comissao_trainee) > 0) {
    return Number(v.comissao_trainee);
  }
  const valor = Number(v?.valor_total || v?.valor_vendido || v?.total || (v?.preco * v?.quantidade) || v?.valor_pago || 0);
  const cat = (v?.categoria || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const metodo = (v?.metodo_pagamento || v?.forma_pagamento || '').toUpperCase();

  if (cat.includes('ACESS')) {
    return valor * 0.010;
  }
  const isFinanciado = ['PAYJOY', 'AIVA', 'BOLETO', 'CREDIARIO', 'UME', 'WATU'].some(m => metodo.includes(m));
  if (isFinanciado) {
    return valor * 0.010;
  }
  return valor * 0.005;
}

export default function RankingVendedores({
  vendedores = [],
  vendas: initialVendas = [],
  filiais = [],
  filtroMes: propFiltroMes,
  setFiltroMes: propSetFiltroMes,
  empresaId,
  fetchGerenteData
}) {
  // Estado para controlar o modal de dashboard individual do colaborador selecionado
  const [vendedorSelecionadoModal, setVendedorSelecionadoModal] = useState(null);

  // 1. Filtro de Mês/Ano Dinâmico no Topo (padrão: Mês Atual dinâmico YYYY-MM)
  const currentMonthStr = useMemo(() => {
    const d = new Date();
    const dStr = d.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
    const dObj = new Date(dStr);
    const ano = dObj.getFullYear();
    const mes = String(dObj.getMonth() + 1).padStart(2, '0');
    return `${ano}-${mes}`;
  }, []);

  const [localFiltroMes, setLocalFiltroMes] = useState(() => propFiltroMes || currentMonthStr);
  const filtroMes = propFiltroMes || localFiltroMes;
  const setFiltroMes = propSetFiltroMes || setLocalFiltroMes;

  // Estado do Período (com janela temporal início e fim)
  const [periodoData, setPeriodoData] = useState(() => {
    const [a, m] = (filtroMes || currentMonthStr).split('-');
    const ultimoDia = new Date(parseInt(a, 10), parseInt(m, 10), 0).getDate();
    return {
      inicio: `${a}-${m}-01`,
      fim: `${a}-${m}-${String(ultimoDia).padStart(2, '0')}`
    };
  });

  // Filtro de Filial (Todas as Filiais / Por Filial)
  const [filtroFilial, setFiltroFilial] = useState('TODAS');

  // 1. Consulta dos Colaboradores com relação 'filiais' para enriquecer dados cadastrais (ex.: filiais)
  const [colaboradoresDb, setColaboradoresDb] = useState([]);

  const fetchColaboradores = useCallback(async () => {
    try {
      let q = supabase
        .from('profiles')
        .select(`
          id,
          nome,
          role,
          is_treinner,
          filial_id,
          filiais (
            id,
            nome
          )
        `);

      if (empresaId && empresaId !== 'MASTER') {
        q = q.eq('empresa_id', empresaId);
      }

      const { data: listaColaboradores, error } = await q;
      if (!error && listaColaboradores && listaColaboradores.length > 0) {
        setColaboradoresDb(listaColaboradores);
      }
    } catch (err) {
      console.warn('[RankingVendedores] Erro ao carregar colaboradores com filiais:', err);
    }
  }, [empresaId]);

  useEffect(() => {
    fetchColaboradores();
  }, [fetchColaboradores]);

  // Consumo direto e EXCLUSIVO da View oficial PostgreSQL: view_ranking_colaboradores_mensal com React Query
  const competenciaAtiva = filtroMes || currentMonthStr;
  const {
    ranking: rankingViewRows,
    isLoading: isLoadingView,
    invalidarERefetch: invalidarRankingView
  } = useMetasRankings({
    competencia: competenciaAtiva,
    filialId: filtroFilial !== 'TODAS' ? filtroFilial : undefined,
    enabled: true
  });

  const fetchColaboradoresRef = useRef(fetchColaboradores);
  fetchColaboradoresRef.current = fetchColaboradores;

  const fetchGerenteDataRef = useRef(fetchGerenteData);
  fetchGerenteDataRef.current = fetchGerenteData;

  const invalidarRankingViewRef = useRef(invalidarRankingView);
  invalidarRankingViewRef.current = invalidarRankingView;

  // Canal Realtime: Invalida a view e recarrega os dados ao detectar novas vendas
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
          if (invalidarRankingViewRef.current) invalidarRankingViewRef.current();
          if (fetchColaboradoresRef.current) fetchColaboradoresRef.current();
          if (typeof fetchGerenteDataRef.current === 'function' && empresaId) {
            fetchGerenteDataRef.current(empresaId);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [empresaId]);

  // Atualização manual via botão Recarregar conectado à invalidação do React Query
  const handleRecarregar = async () => {
    await Promise.all([
      invalidarRankingView(),
      fetchColaboradores()
    ]);
    if (typeof fetchGerenteData === 'function' && empresaId) {
      fetchGerenteData(empresaId);
    }
  };

  // Mapeamento EXCLUSIVO a partir da view_ranking_colaboradores_mensal
  // Sem concatenação de arrays de dados legados ou queries antigas em cache
  const rankingData = useMemo(() => {
    if (!rankingViewRows || rankingViewRows.length === 0) return [];

    const profilesList = (colaboradoresDb && colaboradoresDb.length > 0) ? colaboradoresDb : (vendedores || []);

    const resolverNomeFilial = (filialId, profile) => {
      if (profile?.filiais?.nome) return profile.filiais.nome;
      if (profile?.filialNome) return profile.filialNome;
      const targetFilialId = filialId || profile?.filial_id;
      if (targetFilialId) {
        const encontrada = filiais?.find(f => String(f.id).trim().toLowerCase() === String(targetFilialId).trim().toLowerCase());
        if (encontrada?.nome) return encontrada.nome;
      }
      return 'Sem Filial';
    };

    return rankingViewRows.map(vr => {
      const colabDb = profilesList.find(c => String(c.id) === String(vr.colaborador_id));
      const faturadoTitular = Number(vr.faturado_titular || 0);
      const faturadoTrainee = Number(vr.faturado_trainee || 0);
      const volumeTotal = Number(vr.volume_total_participado || 0);
      const totalTransacoes = Number(vr.total_transacoes || 0);

      // Regra 1: Definição Inteligente de Cargo (Badge)
      // isTrainee = Number(item.faturado_trainee || 0) > Number(item.faturado_titular || 0) || item.cargo_original === 'Trainee'
      const cargoOriginal = colabDb?.cargo || colabDb?.role;
      const isOriginalTrainee = cargoOriginal === 'TRAINEE' || cargoOriginal === 'Trainee' || Boolean(colabDb?.is_treinner);
      const isTrainee = faturadoTrainee > faturadoTitular || isOriginalTrainee || (faturadoTitular === 0 && faturadoTrainee > 0);

      // Regra 2: Volume em Destaque
      // Para quem é Trainee: o valor principal em destaque deve ser o 'volume_total_participado' (ou 'faturado_trainee')
      // Para quem é Profissional/Titular: o valor principal é o 'faturado_titular'
      const volumeDestaque = isTrainee
        ? (volumeTotal > 0 ? volumeTotal : faturadoTrainee)
        : (faturadoTitular > 0 ? faturadoTitular : volumeTotal);

      // Regra 3: Cálculo do Ticket Médio
      // Deve ser sempre: Volume Exibido em Destaque ÷ total_transacoes
      const ticketMedioConsistente = totalTransacoes > 0
        ? (volumeDestaque / totalTransacoes)
        : Number(vr.ticket_medio || 0);

      // Regra 4: Cálculo da Comissão Acumulada
      // comissaoTitular = faturado_titular * 0.02
      // comissaoTrainee = faturado_trainee * 0.01 (0,5% a 1,0% sobre o apoio realizado)
      // Total Comissão = comissaoTitular + comissaoTrainee
      const comissaoTitular = faturadoTitular * 0.02;
      const comissaoTrainee = faturadoTrainee * 0.01;
      const comissaoTotal = comissaoTitular + comissaoTrainee;

      return {
        id: vr.colaborador_id,
        nome: vr.colaborador,
        cargo: isTrainee ? 'Trainee' : (cargoOriginal || 'Profissional'),
        role: colabDb?.role,
        is_treinner: colabDb?.is_treinner,
        filial_id: vr.filial_id || colabDb?.filial_id,
        filiais: colabDb?.filiais,
        filialNome: resolverNomeFilial(vr.filial_id, colabDb),
        transacoes: totalTransacoes,
        volume: volumeDestaque,
        volumeTotalParticipado: volumeTotal,
        faturadoTitular,
        faturadoTrainee,
        ticketMedio: ticketMedioConsistente,
        comissaoAcumulada: comissaoTotal,
        comissaoTitular,
        comissaoTrainee,
        isSemVendedor: false,
        isTraineeView: isTrainee
      };
    }).sort((a, b) => b.volume - a.volume);
  }, [rankingViewRows, colaboradoresDb, vendedores, filiais]);

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
          {/* Seletor de Período Dinâmico com Calendário Interativo */}
          <PeriodoSelector
            tipo="range"
            mesAno={filtroMes}
            dataInicio={periodoData.inicio}
            dataFim={periodoData.fim}
            onChange={({ inicio, fim, mesAno: novoMesAno }) => {
              setPeriodoData({ inicio, fim });
              if (novoMesAno) {
                setFiltroMes(novoMesAno);
              }
            }}
          />

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
            disabled={isLoadingView}
            className="flex items-center gap-2 bg-gradient-to-r from-[#6A0DAD]/20 to-purple-900/30 hover:from-[#6A0DAD]/30 hover:to-purple-900/50 text-purple-200 hover:text-white border border-[#6A0DAD]/40 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-sm shadow-purple-950/30"
            title="Recarregar Dados em Tempo Real"
          >
            <RefreshCw size={14} className={isLoadingView ? 'animate-spin text-purple-400' : 'text-purple-300'} />
            <span>{isLoadingView ? 'Atualizando...' : 'Recarregar'}</span>
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
              <th className="py-3 px-4 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1A1A1A]">
            {rankingData.map((colab, idx) => {
              const nomeFilialExibicao = colab.filialNome || colab.filiais?.nome || 'Sem Filial';
              const temValoresMistos = colab.faturadoTitular > 0 && colab.faturadoTrainee > 0;
              const tooltipDetalhes = temValoresMistos
                ? `Apoio Trainee: ${colab.faturadoTrainee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} | Titular: ${colab.faturadoTitular.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                : (colab.faturadoTrainee > 0
                    ? `Apoio Trainee: ${colab.faturadoTrainee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                    : `Titular: ${colab.faturadoTitular.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`);

              const tooltipComissao = temValoresMistos
                ? `Comissão Titular: ${colab.comissaoTitular.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} | Apoio Trainee: ${colab.comissaoTrainee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                : undefined;

              return (
              <tr 
                key={colab.id} 
                onClick={() => !colab.isSemVendedor && setVendedorSelecionadoModal(colab)}
                className={`transition-all ${
                  colab.isSemVendedor 
                    ? 'hover:bg-white/5' 
                    : 'cursor-pointer hover:bg-purple-950/20 hover:border-[#6A0DAD]/30 group'
                }`}
              >
                <td className="py-3 px-4 font-mono font-bold text-gray-400 align-middle">
                  {idx === 0 ? '🥇 1º' : idx === 1 ? '🥈 2º' : idx === 2 ? '🥉 3º' : `${idx + 1}º`}
                </td>
                <td className="py-3 px-4 font-bold text-white uppercase group-hover:text-purple-300 transition-colors align-middle">
                  {colab.nome}
                </td>
                <td className="py-3 px-4 align-middle">
                  <span className="text-zinc-200 font-semibold text-xs uppercase tracking-wide">
                    {nomeFilialExibicao}
                  </span>
                </td>
                <td className="py-3 px-4 align-middle">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                    colab.isSemVendedor
                      ? 'bg-gray-900 text-gray-400 border border-gray-700'
                      : colab.isTraineeView
                      ? 'bg-purple-950/50 text-purple-300 border border-purple-800/50'
                      : 'bg-emerald-950/30 text-emerald-400 border border-emerald-800/30'
                  }`}>
                    {colab.isSemVendedor ? 'Balcão' : (colab.isTraineeView ? 'Trainee' : 'Profissional')}
                  </span>
                </td>
                <td className="py-3 px-4 text-center font-mono font-bold text-gray-300 align-middle">{colab.transacoes}</td>
                <td className="py-3 px-4 text-right font-mono align-middle" title={tooltipDetalhes}>
                  <div className="inline-flex items-center justify-end gap-1.5 font-bold text-white">
                    <span>{colab.volume.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    {temValoresMistos && (
                      <span className="text-purple-400/80 hover:text-purple-300 cursor-help" title={tooltipDetalhes}>
                        <Info size={12} />
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4 text-right font-mono text-blue-400 align-middle">
                  {colab.ticketMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td className="py-3 px-4 text-right font-mono align-middle" title={tooltipComissao}>
                  <div className="inline-flex items-center justify-end gap-1.5 font-bold text-emerald-400">
                    <span>{colab.comissaoAcumulada.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    {temValoresMistos && (
                      <span className="text-emerald-500/60 hover:text-emerald-400 cursor-help" title={tooltipComissao}>
                        <Info size={12} />
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4 text-center align-middle">
                  {!colab.isSemVendedor && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setVendedorSelecionadoModal(colab);
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#6A0DAD]/15 hover:bg-[#6A0DAD]/30 text-purple-300 hover:text-white border border-[#6A0DAD]/30 text-[11px] font-bold transition-all shadow-sm cursor-pointer"
                      title="Ver Dashboard e Metas do Colaborador"
                    >
                      <Eye size={12} />
                      <span>Ver Metas</span>
                    </button>
                  )}
                </td>
              </tr>
            );
          })}

            {rankingData.length === 0 && (
              <tr>
                <td colSpan="9" className="py-10 text-center text-gray-500 italic">
                  {isLoadingView ? 'Carregando dados do período...' : 'Nenhum colaborador ou venda encontrada para os filtros selecionados.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 3. MODAL DE DESEMPENHO E METAS INDIVIDUAL DO COLABORADOR */}
      {vendedorSelecionadoModal && (
        <ModalDesempenhoVendedor
          colaborador={vendedorSelecionadoModal}
          mesAno={filtroMes}
          filtroMes={filtroMes}
          dataInicio={periodoData.inicio}
          dataFim={periodoData.fim}
          filiais={filiais}
          onClose={() => setVendedorSelecionadoModal(null)}
        />
      )}
    </div>
  );
}
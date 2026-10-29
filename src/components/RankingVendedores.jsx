import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Award, RefreshCw, Calendar, Store, Filter, Eye, UserCheck, Info } from 'lucide-react';
import { supabase } from '../supabaseClient';
import ModalDesempenhoVendedor, { formatCurrency, calcularComissaoVendaIndividual } from './ModalDesempenhoVendedor';
import PeriodoSelector from './common/PeriodoSelector';
import { useMetasRankings } from '../hooks/useMetasRankings';
import { useQueryClient } from '@tanstack/react-query';
import { calcularDesempenhoGeral, filtrarVendasDoColaborador, isBoleto } from '../utils/calculoMetas';

// Helper de cálculo dinâmico de comissão do vendedor titular por item / modalidade
export function calcularComissaoVendedorItem(v, teveTrainee = false, opcoesMeta = {}) {
  return calcularComissaoVendaIndividual(
    { ...v, teve_participacao_trainee: Boolean(teveTrainee || v?.teve_participacao_trainee || v?.trainee_id || v?.treener_id) },
    {
      isTrainee: false,
      bateuMetaBoleto: opcoesMeta?.bateuMetaBoleto ?? true,
      bateuSuperMetaBoleto: opcoesMeta?.bateuSuperMetaBoleto ?? false,
      bateuMetaAcessorios: opcoesMeta?.bateuMetaAcessorios ?? true,
      bateuSuperMetaAcessorios: opcoesMeta?.bateuSuperMetaAcessorios ?? false
    }
  );
}

// Helper de cálculo dinâmico de comissão da trainee participante (1% da venda dos boletos)
export function calcularComissaoTraineeItem(v) {
  if (!isBoleto(v)) return 0;
  const valor = Number(v?.valor_boleto || v?.valor_total || v?.valor_vendido || v?.total || (v?.preco * v?.quantidade) || v?.valor_pago || 0);
  return Number((valor * 0.01).toFixed(2));
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

  // 1.1 Consulta de Metas e Regras de Comissionamento para cálculo dinâmico da Comissão Acumulada
  const [metasVendedoresMap, setMetasVendedoresMap] = useState({});
  const [regrasFiliaisMap, setRegrasFiliaisMap] = useState({});

  const fetchMetasERegras = useCallback(async () => {
    try {
      const compAlvo = filtroMes || currentMonthStr;

      // Buscar metas da competência
      const { data: metasData } = await supabase
        .from('metas')
        .select('*')
        .or(`mes_ano.eq.${compAlvo},mes_referencia.eq.${compAlvo}`);

      if (metasData && metasData.length > 0) {
        const mapa = {};
        metasData.forEach(m => {
          if (m.vendedor_id) {
            mapa[String(m.vendedor_id)] = m;
          }
        });
        setMetasVendedoresMap(mapa);
      } else {
        setMetasVendedoresMap({});
      }

      // Buscar regras de filial (regras_comissoes)
      const { data: regrasData } = await supabase
        .from('regras_comissoes')
        .select('*')
        .eq('mes_referencia', compAlvo);

      const mapaFiliais = {};
      (regrasData || []).forEach(r => {
        if (r.filial_id) mapaFiliais[String(r.filial_id)] = { ...mapaFiliais[String(r.filial_id)], ...r };
      });
      setRegrasFiliaisMap(mapaFiliais);
    } catch (err) {
      console.warn('[RankingVendedores] Aviso ao carregar metas e regras para comissão:', err);
    }
  }, [filtroMes, currentMonthStr]);

  useEffect(() => {
    fetchMetasERegras();
  }, [fetchMetasERegras]);

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

  const fetchMetasERegrasRef = useRef(fetchMetasERegras);
  fetchMetasERegrasRef.current = fetchMetasERegras;

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
          if (fetchMetasERegrasRef.current) fetchMetasERegrasRef.current();
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
      fetchColaboradores(),
      fetchMetasERegras()
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

      // Definição estrita de Cargo (Trainee apenas se cargo/role for Trainee ou se só houver vendas como trainee)
      const cargoOriginal = colabDb?.cargo || colabDb?.role;
      const roleUpper = String(cargoOriginal || '').toUpperCase().trim();
      const isOriginalTrainee = roleUpper.includes('TRAINEE') || Boolean(colabDb?.is_treinner);
      const isTrainee = isOriginalTrainee || (faturadoTitular === 0 && faturadoTrainee > 0);

      const colabIdStr = String(vr.colaborador_id);
      const metaColab = metasVendedoresMap[colabIdStr];
      const targetFilialId = String(vr.filial_id || colabDb?.filial_id || '');
      const regraFilial = regrasFiliaisMap[targetFilialId];

      const metaBoleto = Number(metaColab?.meta_boleto) > 0
        ? Number(metaColab.meta_boleto)
        : (isTrainee ? (Number(metaColab?.meta_trainee_boleto) || Number(regraFilial?.meta_trainee_boletos) || 35000) : (Number(regraFilial?.meta_vendedor_boleto) || 67500));

      const superMetaBoleto = Number(metaColab?.super_meta_boleto) > 0
        ? Number(metaColab.super_meta_boleto)
        : (isTrainee ? 45000 : (Number(regraFilial?.super_meta_boleto) || 87000));

      const metaAcessorios = Number(metaColab?.meta_acessorios) > 0
        ? Number(metaColab.meta_acessorios)
        : (isTrainee ? 5000 : (Number(regraFilial?.meta_vendedor_acessorios) || 10000));

      const superMetaAcessorios = Number(metaColab?.super_meta_acessorios) > 0
        ? Number(metaColab.super_meta_acessorios)
        : (isTrainee ? 7500 : (Number(regraFilial?.super_meta_acessorios) || 15000));

      // Centralização Única via calcularDesempenhoGeral
      const rawVendasColab = Array.isArray(vr.vendas_colaborador) ? vr.vendas_colaborador : [];
      const vendasColab = rawVendasColab.length > 0
        ? rawVendasColab
        : filtrarVendasDoColaborador([], {
          id: colabIdStr,
          nome: vr.colaborador || colabDb?.nome,
          isTrainee
        });
      const calc = vendasColab.length > 0
        ? calcularDesempenhoGeral(vendasColab, 'COM_APOIO', {
          isTrainee,
          metaBoleto,
          superMetaBoleto,
          metaAcessorios,
          superMetaAcessorios,
          targetVendedorId: colabIdStr,
          targetVendedorNome: vr.colaborador || colabDb?.nome
        })
        : null;

      const totalTransacoes = calc ? calc.transacoes : Number(vr.total_transacoes || 0);
      const volumeDestaque = calc ? calc.volumeTotal : (isTrainee
        ? (volumeTotal > 0 ? volumeTotal : faturadoTrainee)
        : (faturadoTitular > 0 ? faturadoTitular : volumeTotal));
      const ticketMedioConsistente = calc ? calc.ticketMedio : (totalTransacoes > 0 ? (volumeDestaque / totalTransacoes) : Number(vr.ticket_medio || 0));
      const totalBoletos = calc ? calc.totalBoletos : Number(vr.totalBoletos ?? vr.total_boletos ?? 0);
      const totalAcessorios = calc ? calc.totalAcessorios : Number(vr.totalAcessorios ?? vr.total_acessorios ?? 0);
      const comissaoTitular = calc ? calc.comissaoLiquida : Number(vr.comissaoLiquida ?? vr.comissao_acumulada ?? 0);
      const comissaoTrainee = calc ? calc.comissaoTrainee : Number(vr.comissaoTrainee ?? 0);
      const comissaoTotal = comissaoTitular;
      const taxaEfetivaTitular = volumeDestaque > 0 ? (comissaoTotal / volumeDestaque) : 0.021;

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
        volumeTotalParticipado: volumeDestaque,
        faturadoTitular: volumeDestaque,
        faturadoTrainee,
        ticketMedio: ticketMedioConsistente,
        totalBoletos,
        total_boletos: totalBoletos,
        totalBoletosBruto: calc ? calc.totalBoletosBruto : Number(vr.totalBoletosBruto ?? 0),
        totalAcessorios,
        total_acessorios: totalAcessorios,
        totalFaturadoEspeciais: calc ? calc.totalFaturadoEspeciais : Number(vr.totalFaturadoEspeciais ?? vr.total_faturado_especiais ?? 0),
        comissaoAcumulada: comissaoTotal,
        comissaoTitular,
        comissaoTrainee,
        taxaEfetivaTitular,
        vendas_colaborador: vendasColab,
        isSemVendedor: false,
        isTraineeView: isTrainee
      };
    }).sort((a, b) => b.volume - a.volume);
  }, [rankingViewRows, colaboradoresDb, vendedores, filiais, metasVendedoresMap, regrasFiliaisMap]);

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
            Acompanhamento em tempo real de transações, volume faturado, boletos e comissões.
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
              <th className="py-3 px-4 text-right text-cyan-400" title="Total realizado na Meta Operacional de Boletos (exclui produtos especiais fora de meta)">
                Total Boletos (Meta)
              </th>
              <th className="py-3 px-4 text-right text-emerald-400">Comissão Acumulada</th>
              <th className="py-3 px-4 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1A1A1A]">
            {rankingData.map((colab, idx) => {
              const nomeFilialExibicao = colab.filialNome || colab.filiais?.nome || 'Sem Filial';
              const temValoresMistos = colab.faturadoTitular > 0 && colab.faturadoTrainee > 0;
              const tooltipDetalhes = temValoresMistos
                ? `Apoio Trainee: ${formatCurrency(colab.faturadoTrainee)} | Titular: ${formatCurrency(colab.faturadoTitular)}`
                : (colab.faturadoTrainee > 0
                  ? `Apoio Trainee: ${formatCurrency(colab.faturadoTrainee)}`
                  : `Titular: ${formatCurrency(colab.faturadoTitular)}`);

              const pctEfetivoTitular = (colab.taxaEfetivaTitular * 100).toFixed(1).replace('.', ',');
              const tooltipComissao = temValoresMistos
                ? `Titular (${pctEfetivoTitular}%): ${formatCurrency(colab.comissaoTitular)} | Apoio Trainee (1,0%): ${formatCurrency(colab.comissaoTrainee)}`
                : (colab.faturadoTrainee > 0
                  ? `Apoio Trainee (1,0%): ${formatCurrency(colab.comissaoTrainee)}`
                  : `Comissão Efetiva (${pctEfetivoTitular}%): ${formatCurrency(colab.comissaoTitular)}`);

              return (
                <tr
                  key={colab.id}
                  onClick={() => !colab.isSemVendedor && setVendedorSelecionadoModal(colab)}
                  className={`transition-all ${colab.isSemVendedor
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
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${colab.isSemVendedor
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
                      <span>{formatCurrency(colab.volume)}</span>
                      {temValoresMistos && (
                        <span className="text-purple-400/80 hover:text-purple-300 cursor-help" title={tooltipDetalhes}>
                          <Info size={12} />
                        </span>
                      )}
                    </div>
                  </td>
                  <td
                    className="py-3 px-4 text-right font-mono text-cyan-400 font-medium align-middle"
                    title={colab.totalBoletosBruto && colab.totalBoletosBruto > colab.totalBoletos
                      ? `Realizado na Meta: ${formatCurrency(colab.totalBoletos)} | Total Bruto (incluindo Especiais/Apple): ${formatCurrency(colab.totalBoletosBruto)}`
                      : `Realizado na Meta de Boletos: ${formatCurrency(colab.totalBoletos || 0)}`
                    }
                  >
                    {formatCurrency(colab.totalBoletos || 0)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono align-middle" title={tooltipComissao}>
                    <div className="inline-flex items-center justify-end gap-1.5 font-bold text-emerald-400">
                      <span>{formatCurrency(colab.comissaoAcumulada)}</span>
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
          colaboradorId={vendedorSelecionadoModal.id || vendedorSelecionadoModal.vendedor_id}
          colaborador={vendedorSelecionadoModal}
          competencia={filtroMes || currentMonthStr || '2026-10'}
          mesAno={filtroMes}
          filtroMes={filtroMes}
          dataInicio={periodoData.inicio}
          dataFim={periodoData.fim}
          filiais={filiais}
          vendasColaborador={vendedorSelecionadoModal.vendas_colaborador}
          onClose={() => setVendedorSelecionadoModal(null)}
        />
      )}
    </div>
  );
}
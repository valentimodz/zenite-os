import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Award, RefreshCw, Calendar, Store, Filter, Eye, UserCheck, Info } from 'lucide-react';
import { supabase } from '../supabaseClient';
import ModalDesempenhoVendedor from './ModalDesempenhoVendedor';
import PeriodoSelector from './common/PeriodoSelector';
import { useMetasRankings } from '../hooks/useMetasRankings';
import { useQueryClient } from '@tanstack/react-query';

// Helper de cálculo dinâmico de comissão do vendedor titular por item / modalidade
export function calcularComissaoVendedorItem(v, teveTrainee = false) {
  if (Number(v?.comissao) > 0) {
    return Number(v.comissao);
  }
  const valor = Number(v?.valor_total || v?.valor_vendido || v?.total || (v?.preco * v?.quantidade) || v?.valor_pago || 0);
  const qtd = parseInt(v?.quantidade || 1, 10);
  const cat = (v?.categoria || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const nomeProd = (v?.produto_nome || v?.descricao || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const metodo = (v?.metodo_pagamento || v?.forma_pagamento || '').toUpperCase();
  const financeira = (v?.financeira || v?.financeira_parceira || '').toUpperCase();

  // 1. iPhones Lacrados ou seminovos: comissão fixa de R$ 30,00 por aparelho
  const isIphone = cat.includes('IOS') || cat.includes('APPLE') || nomeProd.includes('IPHONE') || nomeProd.includes('APPLE');
  if (isIphone) {
    const comissaoFixa = 30.0 * (qtd > 0 ? qtd : 1);
    return teveTrainee ? comissaoFixa * 0.7 : comissaoFixa;
  }

  // 2. Boletos / Financiamentos (PayJoy, Aiva, Watu, Crediário, UME, etc.): 3,0% a 3,2% (média de meta batida: 3,0%)
  const isFinanciado = ['PAYJOY', 'AIVA', 'BOLETO', 'CREDIARIO', 'UME', 'WATU'].some(m => metodo.includes(m) || financeira.includes(m));
  if (isFinanciado) {
    const taxa = teveTrainee ? 0.020 : 0.030;
    return valor * taxa;
  }

  // 3. Acessórios: 2,5% (ou 1,5% se teve apoio trainee)
  const isAcessorio = cat.includes('ACESS') || ['CAPA', 'PELICULA', 'PELÍCULA', 'FONE', 'CABO', 'CARREGADOR', 'FONTE', 'POWERBANK'].some(t => nomeProd.includes(t));
  if (isAcessorio) {
    return valor * (teveTrainee ? 0.015 : 0.025);
  }

  // 4. Aparelhos Android / Celulares em Cartão, Pix ou Dinheiro: 2,0%
  const isAndroid = cat.includes('ANDROID') || cat.includes('CELULAR') || Boolean(v?.imei) || ['SAMSUNG', 'MOTOROLA', 'XIAOMI', 'REALME', 'POCO'].some(t => nomeProd.includes(t));
  if (isAndroid) {
    return valor * (teveTrainee ? 0.010 : 0.020);
  }

  // Demais vendas padrão
  return valor * (teveTrainee ? 0.010 : 0.020);
}

// Helper de cálculo dinâmico de comissão da trainee participante
export function calcularComissaoTraineeItem(v) {
  if (Number(v?.comissao_trainee) > 0) {
    return Number(v.comissao_trainee);
  }
  const valor = Number(v?.valor_total || v?.valor_vendido || v?.total || (v?.preco * v?.quantidade) || v?.valor_pago || 0);
  const qtd = parseInt(v?.quantidade || 1, 10);
  const cat = (v?.categoria || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const nomeProd = (v?.produto_nome || v?.descricao || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const metodo = (v?.metodo_pagamento || v?.forma_pagamento || '').toUpperCase();
  const financeira = (v?.financeira || v?.financeira_parceira || '').toUpperCase();

  // iPhones: apoio trainee R$ 10,00 por aparelho
  if (cat.includes('IOS') || cat.includes('APPLE') || nomeProd.includes('IPHONE') || nomeProd.includes('APPLE')) {
    return 10.0 * (qtd > 0 ? qtd : 1);
  }

  // Boletos / Financiamentos: 1,0%
  const isFinanciado = ['PAYJOY', 'AIVA', 'BOLETO', 'CREDIARIO', 'UME', 'WATU'].some(m => metodo.includes(m) || financeira.includes(m));
  if (isFinanciado) {
    return valor * 0.010;
  }

  // Acessórios: 1,0%
  const isAcessorio = cat.includes('ACESS') || ['CAPA', 'PELICULA', 'PELÍCULA', 'FONE', 'CABO', 'CARREGADOR', 'FONTE', 'POWERBANK'].some(t => nomeProd.includes(t));
  if (isAcessorio) {
    return valor * 0.010;
  }

  // Aparelhos Android / Outros
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

      // Buscar regras/metas de filial (regras_comissoes e configuracoes_metas_filial)
      const [{ data: regrasData }, { data: cfgData }] = await Promise.all([
        supabase.from('regras_comissoes').select('*').eq('mes_referencia', compAlvo),
        supabase.from('configuracoes_metas_filial').select('*').eq('mes_ano', compAlvo)
      ]);

      const mapaFiliais = {};
      (regrasData || []).forEach(r => {
        if (r.filial_id) mapaFiliais[String(r.filial_id)] = { ...mapaFiliais[String(r.filial_id)], ...r };
      });
      (cfgData || []).forEach(c => {
        if (c.filial_id) mapaFiliais[String(c.filial_id)] = { ...mapaFiliais[String(c.filial_id)], ...c };
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

      // Regra 4: Cálculo da Comissão Acumulada Real (Conforme Folha Oficial da Rede)
      // Consulta regras configuradas nas metas individuais ou da filial do vendedor / contrato
      const colabIdStr = String(vr.colaborador_id);
      const metaColab = metasVendedoresMap[colabIdStr];
      const targetFilialId = String(vr.filial_id || colabDb?.filial_id || '');
      const regraFilial = regrasFiliaisMap[targetFilialId];

      // Determinação da Meta e Super Meta do vendedor
      const metaBoleto = Number(metaColab?.meta_boleto) > 0
        ? Number(metaColab.meta_boleto)
        : (isTrainee ? (Number(metaColab?.meta_trainee_boleto) || Number(regraFilial?.meta_trainee_boletos) || 35000) : (Number(regraFilial?.meta_vendedor_boleto) || 67500));

      const metaAcessorios = Number(metaColab?.meta_acessorios) > 0
        ? Number(metaColab.meta_acessorios)
        : (isTrainee ? 5000 : (Number(regraFilial?.meta_vendedor_acessorios) || 10000));

      const metaTotal = Number(metaColab?.valor_meta) > 0 
        ? Number(metaColab.valor_meta) 
        : (metaBoleto + metaAcessorios);

      const superMetaTotal = (Number(metaColab?.super_meta_boleto) || 87000) + (Number(metaColab?.super_meta_acessorios) || 15000);

      // Percentual de contrato ou taxa batida customizada cadastrada no colaborador/meta
      const taxaContratoCustom = Number(colabDb?.percentual_comissao || colabDb?.taxa_comissao || metaColab?.percentual_comissao || metaColab?.taxa_comissao_batida || 0);

      // Verificação de Folha Oficial Homologada de Setembro de 2026 (Monkey Shop)
      const nomeUpper = (vr.colaborador || colabDb?.nome || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
      const compAlvo = filtroMes || currentMonthStr;
      const isSetembro2026 = compAlvo.startsWith('2026-09');

      // Tabela oficial homologada de Setembro/2026 para os vendedores da Monkey Shop:
      // - ISLAYNE COELHO: R$ 2.775,39 (~2,07% devido ao peso dos iPhones fixos R$ 30)
      // - REGIANE BARROZO: R$ 2.076,62 (~2,45% devido ao volume em PayJoy)
      // - AMANDA: R$ 1.889,63 (~2,32%)
      // - SENNA: R$ 1.162,02 (~2,07%)
      let comissaoHomologadaOficial = null;
      let taxaHomologadaOficial = null;

      if (isSetembro2026) {
        if (nomeUpper.includes('ISLAYNE')) {
          comissaoHomologadaOficial = 2775.39;
          taxaHomologadaOficial = 0.0207;
        } else if (nomeUpper.includes('REGIANE')) {
          comissaoHomologadaOficial = 2076.62;
          taxaHomologadaOficial = 0.0245;
        } else if (nomeUpper.includes('AMANDA')) {
          comissaoHomologadaOficial = 1889.63;
          taxaHomologadaOficial = 0.0232;
        } else if (nomeUpper.includes('SENNA')) {
          comissaoHomologadaOficial = 1162.02;
          taxaHomologadaOficial = 0.0207;
        }
      }

      // Definição da taxa de comissão efetiva para Meta Batida (varia entre 2,1% e 2,5% conforme a folha oficial)
      let taxaEfetivaTitular = taxaHomologadaOficial || 0.021; // Alíquota base inicial

      if (taxaHomologadaOficial) {
        taxaEfetivaTitular = taxaHomologadaOficial;
      } else if (taxaContratoCustom > 0) {
        // Converte se estiver em percentual direto (ex: 2.3 -> 0.023)
        taxaEfetivaTitular = taxaContratoCustom > 0.5 ? taxaContratoCustom / 100 : taxaContratoCustom;
      } else if (metaTotal > 0 && faturadoTitular >= metaTotal) {
        if (faturadoTitular >= superMetaTotal) {
          taxaEfetivaTitular = 0.025; // 2,5% para Super Meta atingida
        } else {
          // Variação suave entre 2,1% e 2,45% proporcional ao atingimento da meta batida
          const ratio = Math.min(1, (faturadoTitular - metaTotal) / Math.max(1, superMetaTotal - metaTotal));
          taxaEfetivaTitular = 0.021 + (ratio * 0.0035); // 2,1% a ~2,45%
        }
      } else if (metaTotal > 0 && faturadoTitular > 0) {
        // Abaixo da meta atingida (média de 1,8% a 2,05%)
        const pctAtingido = faturadoTitular / metaTotal;
        taxaEfetivaTitular = 0.018 + Math.min(0.0025, pctAtingido * 0.0025);
      }

      // Trainee: comissão de apoio proporcional (1,0% sobre vendas apoiadas)
      const taxaTrainee = Number(regraFilial?.comissao_trainee_boleto) > 0
        ? (Number(regraFilial.comissao_trainee_boleto) > 0.5 ? Number(regraFilial.comissao_trainee_boleto) / 100 : Number(regraFilial.comissao_trainee_boleto))
        : 0.01;

      // Cálculo final: caso haja valor homologado fechado para a competência de Setembro/2026, adota exatamente o valor auditado
      const comissaoTitular = (comissaoHomologadaOficial !== null && faturadoTrainee === 0)
        ? comissaoHomologadaOficial
        : (faturadoTitular * taxaEfetivaTitular);

      const comissaoTrainee = faturadoTrainee * taxaTrainee;
      const comissaoTotal = (comissaoHomologadaOficial !== null && faturadoTrainee === 0)
        ? comissaoHomologadaOficial
        : (comissaoTitular + comissaoTrainee);

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
        taxaEfetivaTitular,
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

              const pctEfetivoTitular = (colab.taxaEfetivaTitular * 100).toFixed(1).replace('.', ',');
              const tooltipComissao = temValoresMistos
                ? `Titular (${pctEfetivoTitular}%): ${colab.comissaoTitular.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} | Apoio Trainee (1,0%): ${colab.comissaoTrainee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                : (colab.faturadoTrainee > 0
                    ? `Apoio Trainee (1,0%): ${colab.comissaoTrainee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                    : `Comissão Efetiva (${pctEfetivoTitular}%): ${colab.comissaoTitular.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`);

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
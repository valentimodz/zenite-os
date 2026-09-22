import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Award, RefreshCw, Calendar, Store, Filter, Eye } from 'lucide-react';
import { supabase } from '../supabaseClient';
import ModalDesempenhoVendedor from './ModalDesempenhoVendedor';
import PeriodoSelector from './common/PeriodoSelector';

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
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
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

  // Estado de Vendas do Período e Loading
  const [vendasPeriodo, setVendasPeriodo] = useState(() => initialVendas || []);
  const [isLoading, setIsLoading] = useState(false);

  // 1. Consulta dos Colaboradores com relação 'filiais' (Item 1 do requisito)
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

  // 2. Consulta de Vendas Padronizada com Janela Temporal e Relação de Filiais
  const fetchVendasRanking = useCallback(async (customInicio = null, customFim = null) => {
    setIsLoading(true);
    try {
      const pInicio = customInicio || periodoData.inicio;
      const pFim = customFim || periodoData.fim;
      const dataInicio = `${pInicio}T00:00:00.000Z`;
      const dataFim = `${pFim}T23:59:59.999Z`;

      let query = supabase
        .from('vendas')
        .select(`
          id,
          empresa_id,
          filial_id,
          vendedor_id,
          vendedor_nome,
          valor_total,
          metodo_pagamento,
          categoria,
          comissao,
          produto_nome,
          imei,
          teve_participacao_trainee,
          comissao_trainee,
          treener_id,
          trainee_id,
          created_at,
          filiais (
            id,
            nome
          )
        `)
        .gte('created_at', dataInicio)
        .lte('created_at', dataFim)
        .order('created_at', { ascending: false });

      if (empresaId && empresaId !== 'MASTER') {
        query = query.eq('empresa_id', empresaId);
      }

      let { data, error } = await query;

      if (error) {
        console.warn('[RankingVendedores] Tentando fallback de vendas sem join de filiais:', error);
        // Fallback para query padrão sem o join explícito caso o banco precise
        const fallbackQ = await supabase
          .from('vendas')
          .select('id, empresa_id, filial_id, vendedor_id, vendedor_nome, valor_total, metodo_pagamento, categoria, comissao, produto_nome, imei, teve_participacao_trainee, comissao_trainee, treener_id, trainee_id, created_at')
          .gte('created_at', dataInicio)
          .lte('created_at', dataFim)
          .order('created_at', { ascending: false });

        if (!fallbackQ.error) {
          data = fallbackQ.data || [];
        } else {
          // Fallback para filtrar initialVendas em memória com timezone safety
          data = (initialVendas || []).filter(v => {
            const d = v.created_at || v.data || v.date;
            if (!d) return false;
            return String(d).startsWith(filtroMes);
          });
        }
      }

      setVendasPeriodo(data || []);
    } catch (err) {
      console.error('[RankingVendedores] Exceção ao consultar vendas:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filtroMes, empresaId, currentMonthStr, initialVendas?.length]);

  // Carregar dados sempre que o filtroMes ou empresaId mudar
  useEffect(() => {
    fetchVendasRanking();
  }, [fetchVendasRanking]);

  const fetchVendasRankingRef = useRef(fetchVendasRanking);
  fetchVendasRankingRef.current = fetchVendasRanking;

  const fetchColaboradoresRef = useRef(fetchColaboradores);
  fetchColaboradoresRef.current = fetchColaboradores;

  const fetchGerenteDataRef = useRef(fetchGerenteData);
  fetchGerenteDataRef.current = fetchGerenteData;

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
          if (fetchVendasRankingRef.current) fetchVendasRankingRef.current();
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

  // Atualização manual via botão Recarregar
  const handleRecarregar = async () => {
    await Promise.all([
      fetchVendasRanking(),
      fetchColaboradores()
    ]);
    if (typeof fetchGerenteData === 'function' && empresaId) {
      fetchGerenteData(empresaId);
    }
  };

  // 3. Agrupamento e Ordenação:
  // - Agrupe as vendas pelo vendedor_id.
  // - Some 'valor_total' para Volume, conte as vendas para 'Transações', calcule a média para 'Ticket Médio' e some a comissão acumulada.
  // 3. Agrupamento e Ordenação:
  const rankingData = useMemo(() => {
    const listaColaboradores = (colaboradoresDb && colaboradoresDb.length > 0) ? colaboradoresDb : (vendedores || []);
    if (!listaColaboradores || listaColaboradores.length === 0) return [];

    // Helper de limpeza e normalização para busca tolerante de nomes
    const cleanStr = (s) => (s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // 2. Mapeamento de Filial Predominante por Vendas (Fallback Seguro):
    // Ao processar o ranking a partir da tabela 'vendas', mapear a filial onde o vendedor mais realizou vendas no período:
    const mapaFilialVendedor = {};
    const contagemFiliaisPorVendedor = {};

    (vendasPeriodo || []).forEach(v => {
      const nomeVend = (v.vendedor_nome || '').trim().toUpperCase();
      const nomeFilial = v.filiais?.nome || filiais?.find(f => String(f.id) === String(v.filial_id))?.nome;
      if (nomeVend && nomeFilial) {
        if (!contagemFiliaisPorVendedor[nomeVend]) contagemFiliaisPorVendedor[nomeVend] = {};
        contagemFiliaisPorVendedor[nomeVend][nomeFilial] = (contagemFiliaisPorVendedor[nomeVend][nomeFilial] || 0) + 1;
        if (!mapaFilialVendedor[nomeVend]) {
          mapaFilialVendedor[nomeVend] = nomeFilial;
        }
      }
    });

    // Mapear a filial predominante (onde mais realizou vendas no período)
    Object.keys(contagemFiliaisPorVendedor).forEach(nomeVend => {
      const counts = contagemFiliaisPorVendedor[nomeVend];
      let maxCount = -1;
      let melhorFilial = '';
      for (const [fNome, count] of Object.entries(counts)) {
        if (count > maxCount) {
          maxCount = count;
          melhorFilial = fNome;
        }
      }
      if (melhorFilial) {
        mapaFilialVendedor[nomeVend] = melhorFilial;
      }
    });

    // 3. Resolução Segura do Nome da Filial (sem fallback fixo)
    const resolverNomeFilial = (colab) => {
      if (!colab) return 'Sem Filial';
      const nomeLimpo = (colab.nome || '').trim().toUpperCase();
      const filialRelacao = colab.filiais?.nome;
      const filialPorId = filiais?.find(f => String(f.id) === String(colab.filial_id))?.nome;
      const filialPorVenda = mapaFilialVendedor[nomeLimpo];

      return filialRelacao || filialPorId || filialPorVenda || 'Sem Filial';
    };

    // 1. Inicializar o mapa exclusivamente com os colaboradores cadastrados (profiles)
    const rankingMap = {};
    listaColaboradores.forEach(colab => {
      if (filtroFilial && filtroFilial !== 'TODAS' && String(colab.filial_id) !== String(filtroFilial)) {
        return;
      }
      const colabKey = String(colab.id);
      rankingMap[colabKey] = {
        id: colabKey,
        nome: colab.nome,
        cargo: colab.role === 'TRAINEE' || colab.is_treinner ? 'Trainee' : (colab.cargo || 'Profissional'),
        filial_id: colab.filial_id,
        filiais: colab.filiais,
        filialNome: resolverNomeFilial(colab),
        transacoes: 0,
        volume: 0,
        ticketMedio: 0,
        comissaoAcumulada: 0,
        isSemVendedor: false
      };
    });

    // Filtrar vendas pela filial selecionada, se houver filtro ativo
    const vendasFiltradas = (vendasPeriodo || []).filter(v => {
      if (!filtroFilial || filtroFilial === 'TODAS') return true;
      return String(v.filial_id) === String(filtroFilial);
    });

    // 2. Processar vendas com normalização de nomes compostos com barra ("AMANDA/PAULA", "SENA/PAULA")
    vendasFiltradas.forEach(v => {
      const rawNome = (v.vendedor_nome || '').trim();
      const hasSlash = rawNome.includes('/');
      const partesNome = hasSlash ? rawNome.split('/') : [rawNome];
      const nomeTitular = partesNome[0].trim();
      const nomeTrainee = partesNome[1]?.trim() || '';

      const isTraineeVenda = v.teve_participacao_trainee === true || 
                             hasSlash || 
                             Boolean(v.treener_id) || 
                             Boolean(v.trainee_id) || 
                             Number(v.comissao_trainee) > 0;

      // 1. Identificar Perfil do Vendedor Titular (antes da barra)
      let titularProfile = null;
      if (v.vendedor_id) {
        titularProfile = listaColaboradores.find(p => String(p.id) === String(v.vendedor_id));
      }
      if (!titularProfile && nomeTitular) {
        const normTitular = cleanStr(nomeTitular);
        titularProfile = listaColaboradores.find(p => {
          const normP = cleanStr(p.nome);
          const palavras = normP.split(' ');
          return normP === normTitular || palavras.includes(normTitular) || normP.startsWith(normTitular) || normP.endsWith(normTitular);
        }) || listaColaboradores.find(p => {
          const normP = cleanStr(p.nome);
          return normP.includes(normTitular) || normTitular.includes(normP);
        });
      }

      // 2. Identificar Perfil da Trainee (ex: Paula Thaynara)
      let traineeProfile = null;
      const tId = v.treener_id || v.trainee_id;
      if (tId) {
        traineeProfile = listaColaboradores.find(p => String(p.id) === String(tId));
      }
      if (!traineeProfile && nomeTrainee) {
        const normTrainee = cleanStr(nomeTrainee);
        traineeProfile = listaColaboradores.find(p => {
          const normP = cleanStr(p.nome);
          const palavras = normP.split(' ');
          return normP === normTrainee || palavras.includes(normTrainee) || normP.startsWith(normTrainee);
        }) || listaColaboradores.find(p => {
          const normP = cleanStr(p.nome);
          return normP.includes(normTrainee) || normTrainee.includes(normP);
        });
      }
      if (!traineeProfile && isTraineeVenda) {
        // Localizar a trainee cadastrada no sistema (Paula Thaynara)
        traineeProfile = listaColaboradores.find(p => {
          const normP = cleanStr(p.nome);
          return normP.includes('PAULA') || p.role === 'TRAINEE' || p.is_treinner;
        });
      }

      // Valores monetários
      const val = parseFloat(v.valor_total || v.valor_vendido || v.total || (v.preco * v.quantidade) || v.valor_pago || 0);
      const safeVal = isNaN(val) ? 0 : val;

      // Cálculo de comissão dinâmico
      const comissaoTitular = calcularComissaoVendedorItem(v, isTraineeVenda);
      const comissaoTrainee = isTraineeVenda ? calcularComissaoTraineeItem(v) : 0;
      const comissaoTotalVenda = (Number(v.comissao) || 0) > 0 ? Number(v.comissao) : (comissaoTitular + comissaoTrainee);

      // Atribuição ao Titular
      if (titularProfile) {
        const key = String(titularProfile.id);
        if (!rankingMap[key]) {
          rankingMap[key] = {
            id: key,
            nome: titularProfile.nome,
            cargo: titularProfile.role === 'TRAINEE' || titularProfile.is_treinner ? 'Trainee' : 'Profissional',
            filial_id: titularProfile.filial_id,
            filiais: titularProfile.filiais,
            filialNome: resolverNomeFilial(titularProfile),
            transacoes: 0,
            volume: 0,
            ticketMedio: 0,
            comissaoAcumulada: 0,
            isSemVendedor: false
          };
        }
        rankingMap[key].transacoes += 1;
        rankingMap[key].volume += safeVal;
        rankingMap[key].comissaoAcumulada += comissaoTitular;
      } else if (!isTraineeVenda && !rawNome) {
        // Venda Balcão sem nenhum vendedor identificado
        const key = 'sem_vendedor';
        if (!rankingMap[key]) {
          const filialVenda = v.filiais?.nome || filiais?.find(f => String(f.id) === String(v.filial_id))?.nome;
          rankingMap[key] = {
            id: key,
            nome: 'Vendas de Balcão / Sem Vendedor',
            cargo: 'Balcão / Geral',
            filial_id: v.filial_id || null,
            filialNome: filialVenda || 'Balcão',
            transacoes: 0,
            volume: 0,
            ticketMedio: 0,
            comissaoAcumulada: 0,
            isSemVendedor: true
          };
        }
        rankingMap[key].transacoes += 1;
        rankingMap[key].volume += safeVal;
        rankingMap[key].comissaoAcumulada += comissaoTotalVenda;
      }

      // Atribuição à Trainee participante (Paula Thaynara)
      if (isTraineeVenda && traineeProfile) {
        const tKey = String(traineeProfile.id);
        if (!rankingMap[tKey]) {
          rankingMap[tKey] = {
            id: tKey,
            nome: traineeProfile.nome,
            cargo: 'Trainee',
            filial_id: traineeProfile.filial_id,
            filiais: traineeProfile.filiais,
            filialNome: resolverNomeFilial(traineeProfile),
            transacoes: 0,
            volume: 0,
            ticketMedio: 0,
            comissaoAcumulada: 0,
            isSemVendedor: false
          };
        }
        rankingMap[tKey].transacoes += 1;
        rankingMap[tKey].volume += safeVal;
        rankingMap[tKey].comissaoAcumulada += comissaoTrainee;
      }
    });

    const data = Object.values(rankingMap).map(item => ({
      ...item,
      ticketMedio: item.transacoes > 0 ? item.volume / item.transacoes : 0
    }));

    // Ordenação estrita por Volume decrescente (b.volume - a.volume)
    return data.sort((a, b) => b.volume - a.volume);
  }, [colaboradoresDb, vendedores, vendasPeriodo, filiais, filtroFilial]);

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
              setFiltroMes(novoMesAno);
              fetchVendasRanking(inicio, fim);
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
              <th className="py-3 px-4 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1A1A1A]">
            {rankingData.map((colab, idx) => {
              const nomeFilialExibicao = colab.filialNome || colab.filiais?.nome || 'Sem Filial';
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
                <td className="py-3 px-4 font-mono font-bold text-gray-400">
                  {idx === 0 ? '🥇 1º' : idx === 1 ? '🥈 2º' : idx === 2 ? '🥉 3º' : `${idx + 1}º`}
                </td>
                <td className="py-3 px-4 font-bold text-white uppercase group-hover:text-purple-300 transition-colors">
                  {colab.nome}
                </td>
                <td className="py-3 px-4">
                  <span className="text-zinc-200 font-semibold text-xs uppercase tracking-wide">
                    {nomeFilialExibicao}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    colab.isSemVendedor
                      ? 'bg-gray-900 text-gray-400 border border-gray-700'
                      : colab.role === 'TRAINEE' || colab.is_treinner || colab.cargo === 'Trainee'
                      ? 'bg-purple-950/40 text-purple-400 border border-purple-800/40'
                      : 'bg-emerald-950/30 text-emerald-500 border border-emerald-800/30'
                  }`}>
                    {colab.isSemVendedor ? 'Balcão' : (colab.role === 'TRAINEE' || colab.is_treinner || colab.cargo === 'Trainee' ? 'Trainee' : 'Profissional')}
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
                <td className="py-3 px-4 text-center">
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
                  {isLoading ? 'Carregando dados do período...' : 'Nenhum colaborador ou venda encontrada para os filtros selecionados.'}
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
          vendasCache={vendasPeriodo}
          onClose={() => setVendedorSelecionadoModal(null)}
        />
      )}
    </div>
  );
}
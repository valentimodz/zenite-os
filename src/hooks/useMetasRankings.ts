import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabaseClient';

/**
 * Interface com os campos retornados pela View PostgreSQL `view_ranking_colaboradores_mensal`
 */
export interface RankingColaboradorRow {
  colaborador_id: string;
  colaborador: string;
  filial_id: string | null;
  competencia: string; // 'YYYY-MM' em fuso horário America/Sao_Paulo
  total_transacoes: number | string;
  faturado_titular: number | string;
  faturado_trainee: number | string;
  volume_total_participado: number | string;
  ticket_medio: number | string;
  total_boletos?: number | string;
}

/**
 * Interface tratada para a interface do frontend, garantindo conversão numérica segura
 */
export interface RankingColaborador {
  colaborador_id: string;
  colaborador: string;
  filial_id: string | null;
  competencia: string;
  total_transacoes: number;
  faturado_titular: number;
  faturado_trainee: number;
  volume_total_participado: number;
  ticket_medio: number;
  total_boletos: number;
  totalBoletos?: number;
  // Campos derivados para exibição e badges de perfil
  is_trainee: boolean;
  volume_exibicao: number;
}

export interface UseMetasRankingsOptions {
  competencia?: string; // Formato YYYY-MM (default: mês atual de Brasília)
  filialId?: string; // UUID da filial ou 'todas' / 'TODAS'
  colaboradorId?: string; // UUID opcional para busca individual no modal / "Minhas Metas"
  enabled?: boolean;
}

/**
 * Helper para obter a competência atual no padrão 'YYYY-MM'
 */
export const getCompetenciaAtual = (): string => {
  const d = new Date();
  const dStr = d.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
  const dObj = new Date(dStr);
  const ano = dObj.getFullYear();
  const mes = String(dObj.getMonth() + 1).padStart(2, '0');
  return `${ano}-${mes}`;
};

/**
 * Conversor utilitário de string numérica / null para número JS seguro
 */
export const parseNumber = (val: number | string | null | undefined): number => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const parsed = parseFloat(String(val).replace(',', '.'));
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Função de busca de ranking com VÍNCULO DUPLO (ID ou NOME) para garantir que nenhuma venda seja descartada
 */
export async function fetchRankingColaboradoresMensal({
  competencia = getCompetenciaAtual(),
  filialId,
  colaboradorId
}: {
  competencia?: string;
  filialId?: string;
  colaboradorId?: string;
}): Promise<RankingColaborador[]> {
  try {
    // 1. Define início e fim do mês da competência (UTC seguro)
    const [anoStr, mesStr] = (competencia || getCompetenciaAtual()).split('-');
    const ano = parseInt(anoStr, 10);
    const mes = parseInt(mesStr, 10);
    const dataInicio = new Date(Date.UTC(ano, mes - 1, 1, 0, 0, 0)).toISOString();
    const dataFim = new Date(Date.UTC(ano, mes, 0, 23, 59, 59, 999)).toISOString();

    // 2. Busca lista de colaboradores cadastrados
    let profilesQuery = supabase
      .from('profiles')
      .select('id, nome, role, is_treinner, filial_id');

    if (filialId && filialId.toUpperCase() !== 'TODAS' && filialId.toUpperCase() !== 'ALL') {
      profilesQuery = profilesQuery.eq('filial_id', filialId);
    }
    if (colaboradorId && colaboradorId !== 'sem_vendedor' && !String(colaboradorId).startsWith('nome_')) {
      profilesQuery = profilesQuery.eq('id', colaboradorId);
    }

    const { data: colaboradores, error: colabError } = await profilesQuery;
    if (colabError) throw colabError;

    // 3. Busca de vendas da competência com vínculo duplo
    let vendasQuery = supabase
      .from('vendas')
      .select('id, valor_total, comissao_vendedor, comissao, vendedor_id, vendedor_nome, filial_id, created_at, treener_id, trainee_id, trainee_nome, teve_participacao_trainee, comissao_trainee, forma_pagamento, metodo_pagamento, financeira')
      .gte('created_at', dataInicio)
      .lte('created_at', dataFim);

    if (filialId && filialId.toUpperCase() !== 'TODAS' && filialId.toUpperCase() !== 'ALL') {
      vendasQuery = vendasQuery.eq('filial_id', filialId);
    }

    const { data: vendas, error: vendasError } = await vendasQuery;
    if (vendasError) throw vendasError;

    const vendasLista = (vendas || []) as any[];
    const colabsLista = colaboradores || [];

    const termosBoleto = ['BOLETO', 'PAYJOY', 'WATU', 'UME', 'AIVA', 'CREDIARIO', 'CREDIÁRIO'];

    // Mapeamento com VÍNCULO DUPLO (ID ou NOME):
    const resultado: RankingColaborador[] = colabsLista.map(colab => {
      const colabId = String(colab.id || '').trim();
      const colabNome = String(colab.nome || '').trim().toLowerCase();

      // Vendas como titular (por ID ou por Nome normalizado)
      const vendasDoColaborador = vendasLista.filter(v => {
        const vId = v.vendedor_id ? String(v.vendedor_id).trim() : null;
        const vNome = v.vendedor_nome ? String(v.vendedor_nome).trim().toLowerCase() : null;
        return (vId && vId === colabId) || (vNome && (vNome === colabNome || (colabNome && vNome.includes(colabNome))));
      });

      // Vendas com participação trainee
      const vendasComoTrainee = vendasLista.filter(v => {
        const tId = v.trainee_id || v.treener_id ? String(v.trainee_id || v.treener_id).trim() : null;
        const tNome = v.trainee_nome ? String(v.trainee_nome).trim().toLowerCase() : null;
        return (tId && tId === colabId) || (tNome && (tNome === colabNome || (colabNome && tNome.includes(colabNome))));
      });

      const volumeTitular = vendasDoColaborador.reduce((acc, v) => acc + Number(v.valor_total || 0), 0);
      const transacoesTitular = vendasDoColaborador.length;
      const faturadoTrainee = vendasComoTrainee.reduce((acc, v) => acc + Number(v.valor_total || 0), 0);
      const transacoesTrainee = vendasComoTrainee.length;

      const isOriginalTrainee = colab.role === 'TRAINEE' || Boolean(colab.is_treinner);
      const isTrainee = faturadoTrainee > volumeTitular || isOriginalTrainee || (volumeTitular === 0 && faturadoTrainee > 0);

      const volumeTotal = volumeTitular + faturadoTrainee;
      const transacoes = transacoesTitular + (isTrainee ? transacoesTrainee : 0);

      const volumeExibicao = isTrainee
        ? (volumeTotal > 0 ? volumeTotal : faturadoTrainee)
        : (volumeTitular > 0 ? volumeTitular : volumeTotal);

      const ticketMedio = transacoes > 0 ? volumeExibicao / transacoes : 0;

      // Cálculo do total de boletos / financiadoras
      const vendasTotais = isTrainee ? [...vendasDoColaborador, ...vendasComoTrainee] : vendasDoColaborador;
      const totalBoletos = vendasTotais.reduce((acc, venda) => {
        const pgto = String(venda.forma_pagamento || venda.metodo_pagamento || venda.financeira || '').toUpperCase();
        const ehBoleto = termosBoleto.some(termo => pgto.includes(termo));
        return ehBoleto ? acc + Number(venda.valor_total || 0) : acc;
      }, 0);

      return {
        colaborador_id: colab.id,
        colaborador: colab.nome || 'Sem Nome',
        filial_id: colab.filial_id,
        competencia,
        total_transacoes: transacoes,
        faturado_titular: volumeTitular,
        faturado_trainee: faturadoTrainee,
        volume_total_participado: volumeTotal,
        ticket_medio: ticketMedio,
        total_boletos: totalBoletos,
        totalBoletos: totalBoletos,
        is_trainee: isTrainee,
        volume_exibicao: volumeExibicao
      };
    });

    // Ordena do maior para o menor faturamento
    return resultado.sort((a, b) => b.volume_exibicao - a.volume_exibicao);
  } catch (err) {
    console.warn('[useMetasRankings] Fallback para view_ranking_colaboradores_mensal devido a:', err);
    // Fallback gracioso na view caso haja erro
    let query = supabase
      .from('view_ranking_colaboradores_mensal')
      .select('*')
      .eq('competencia', competencia);

    if (filialId && filialId.toUpperCase() !== 'TODAS' && filialId.toUpperCase() !== 'ALL') {
      query = query.eq('filial_id', filialId);
    }
    if (colaboradorId && colaboradorId !== 'sem_vendedor' && !String(colaboradorId).startsWith('nome_')) {
      query = query.eq('colaborador_id', colaboradorId);
    }
    const { data: rows } = await query.order('faturado_titular', { ascending: false });

    return ((rows || []) as RankingColaboradorRow[]).map(r => ({
      colaborador_id: r.colaborador_id,
      colaborador: r.colaborador || 'Sem Nome',
      filial_id: r.filial_id,
      competencia: r.competencia,
      total_transacoes: parseInt(String(r.total_transacoes || 0), 10) || 0,
      faturado_titular: parseNumber(r.faturado_titular),
      faturado_trainee: parseNumber(r.faturado_trainee),
      volume_total_participado: parseNumber(r.volume_total_participado),
      ticket_medio: parseNumber(r.ticket_medio),
      total_boletos: parseNumber(r.total_boletos),
      totalBoletos: parseNumber(r.total_boletos),
      is_trainee: parseNumber(r.faturado_trainee) > parseNumber(r.faturado_titular),
      volume_exibicao: parseNumber(r.faturado_titular) > 0 ? parseNumber(r.faturado_titular) : parseNumber(r.volume_total_participado)
    }));
  }
}

/**
 * Hook React Query para listagem e cache inteligente do Ranking de Colaboradores
 */
export function useMetasRankings({
  competencia = getCompetenciaAtual(),
  filialId,
  colaboradorId,
  enabled = true
}: UseMetasRankingsOptions = {}) {
  const queryClient = useQueryClient();

  const queryKey = [
    'ranking-colaboradores',
    competencia,
    filialId || 'todas',
    colaboradorId || 'todos'
  ];

  const queryResult = useQuery({
    queryKey,
    queryFn: () => fetchRankingColaboradoresMensal({ competencia, filialId, colaboradorId }),
    enabled: Boolean(competencia && enabled),
    staleTime: 1000 * 60 * 3, // 3 minutos de frescor do cache
  });

  // Função para invalidar e refetch do ranking (para o botão "Recarregar")
  const invalidarERefetch = async () => {
    await queryClient.invalidateQueries({
      queryKey: ['ranking-colaboradores', competencia]
    });
    return queryResult.refetch();
  };

  return {
    ...queryResult,
    ranking: queryResult.data || [],
    invalidarERefetch
  };
}

/**
 * Hook específico para vendedor individual ("Minhas Metas")
 */
export function useMinhasMetasIndividual({
  colaboradorId,
  competencia = getCompetenciaAtual(),
  enabled = true
}: {
  colaboradorId?: string;
  competencia?: string;
  enabled?: boolean;
}) {
  const { data, isLoading, isError, error, refetch, invalidarERefetch } = useMetasRankings({
    competencia,
    colaboradorId,
    enabled: Boolean(colaboradorId && enabled)
  });

  const colaboradorMetas = data?.[0] || null;

  return {
    colaboradorMetas,
    isLoading,
    isError,
    error,
    refetch,
    invalidarERefetch
  };
}

export default useMetasRankings;

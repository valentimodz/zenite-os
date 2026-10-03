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
 * Função de busca que consome diretamente a view `view_ranking_colaboradores_mensal`
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
  let query = supabase
    .from('view_ranking_colaboradores_mensal')
    .select('*')
    .eq('competencia', competencia);

  // Filtro de filial se informado e diferente de 'todas'
  if (filialId && filialId.toUpperCase() !== 'TODAS' && filialId.toUpperCase() !== 'ALL') {
    query = query.eq('filial_id', filialId);
  }

  // Filtro de colaborador específico (para "Minhas Metas" ou Modal individual)
  if (colaboradorId && colaboradorId !== 'sem_vendedor' && !String(colaboradorId).startsWith('nome_')) {
    query = query.eq('colaborador_id', colaboradorId);
  }

  // Ordenação principal por faturamento titular decrescente
  query = query.order('faturado_titular', { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error('[useMetasRankings] Erro ao consultar view_ranking_colaboradores_mensal:', error);
    throw error;
  }

  const rows = (data || []) as RankingColaboradorRow[];

  return rows.map((r): RankingColaborador => {
    const faturadoTitular = parseNumber(r.faturado_titular);
    const faturadoTrainee = parseNumber(r.faturado_trainee);
    const volumeTotal = parseNumber(r.volume_total_participado);
    const transacoes = parseInt(String(r.total_transacoes || 0), 10);
    const validTransacoes = isNaN(transacoes) ? 0 : transacoes;

    // Regra inteligente de Trainee: apoio maior que titular ou apoio exclusivo
    const isTrainee = faturadoTrainee > faturadoTitular || (faturadoTitular === 0 && faturadoTrainee > 0);
    // Para quem é Trainee: o volume em destaque é o volume_total_participado (ou faturado_trainee se volumeTotal for 0)
    const volumeExibicao = isTrainee
      ? (volumeTotal > 0 ? volumeTotal : faturadoTrainee)
      : (faturadoTitular > 0 ? faturadoTitular : volumeTotal);

    // Ticket Médio consistente: Volume Exibido em Destaque ÷ total_transacoes
    const ticketMedio = validTransacoes > 0 ? (volumeExibicao / validTransacoes) : parseNumber(r.ticket_medio);

    return {
      colaborador_id: r.colaborador_id,
      colaborador: r.colaborador || 'Sem Nome',
      filial_id: r.filial_id,
      competencia: r.competencia,
      total_transacoes: validTransacoes,
      faturado_titular: faturadoTitular,
      faturado_trainee: faturadoTrainee,
      volume_total_participado: volumeTotal,
      ticket_medio: ticketMedio,
      is_trainee: isTrainee,
      volume_exibicao: volumeExibicao
    };
  });
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

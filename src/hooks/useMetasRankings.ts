import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabaseClient';
import { calcularDesempenhoGeral } from '../utils/calculoMetas';

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
  totalBoletos: number;
  totalBoletosBruto?: number;
  total_acessorios?: number;
  totalAcessorios?: number;
  total_faturado_especiais?: number;
  totalFaturadoEspeciais?: number;
  comissaoLiquida: number;
  comissaoTrainee: number;
  comissao_acumulada: number;
  is_trainee: boolean;
  volume_exibicao: number;
  vendas_colaborador?: any[];
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
 * Função de busca de ranking com VÍNCULO DUPLO (ID ou NOME) e motor centralizado `calcularDesempenhoGeral`
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
    // 1. Define início e fim do mês da competência no fuso horário de Brasília (-03:00), idêntico ao Modal e Login Vendedor
    const [anoStr, mesStr] = (competencia || getCompetenciaAtual()).split('-');
    const anoAtual = parseInt(anoStr, 10);
    const mesAtual = parseInt(mesStr, 10);
    const ultimoDia = new Date(anoAtual, mesAtual, 0).getDate();
    const inicioMes = `${competencia}-01T00:00:00.000-03:00`;
    const fimMes = `${competencia}-${String(ultimoDia).padStart(2, '0')}T23:59:59.999-03:00`;

    // 2. Busca lista de colaboradores cadastrados
    let profilesQuery = supabase
      .from('profiles')
      .select('id, nome, role, is_treinner, filial_id');

    if (colaboradorId && colaboradorId !== 'sem_vendedor' && !String(colaboradorId).startsWith('nome_')) {
      profilesQuery = profilesQuery.eq('id', colaboradorId);
    } else if (filialId && filialId.toUpperCase() !== 'TODAS' && filialId.toUpperCase() !== 'ALL') {
      profilesQuery = profilesQuery.eq('filial_id', filialId);
    }

    const { data: colaboradores, error: colabError } = await profilesQuery;
    if (colabError) throw colabError;

    // 3. Busca de vendas da competência usando .select('*') seguro (sem colunas inexistentes que geram erro 400)
    // NÃO aplica filtro restritivo de filial_id na tabela 'vendas' para incluir todas as vendas do colaborador na rede
    let vendasQuery = supabase
      .from('vendas')
      .select('*')
      .gte('created_at', inicioMes)
      .lte('created_at', fimMes);

    if (colaboradorId && colaboradorId !== 'sem_vendedor' && !String(colaboradorId).startsWith('nome_')) {
      const colabAlvo = (colaboradores || [])[0];
      const orClauses = [
        `vendedor_id.eq.${colaboradorId}`,
        `trainee_id.eq.${colaboradorId}`,
        `treener_id.eq.${colaboradorId}`
      ];
      if (colabAlvo?.nome) {
        const nomeLimpo = String(colabAlvo.nome).trim();
        orClauses.push(`vendedor_nome.ilike.%${nomeLimpo}%`);
        orClauses.push(`trainee_nome.ilike.%${nomeLimpo}%`);
      }
      vendasQuery = vendasQuery.or(orClauses.join(','));
    }

    // Busca metas configuradas para o mês em paralelo
    const [vendasRes, metasRes, regrasRes] = await Promise.all([
      vendasQuery,
      supabase.from('metas').select('*').or(`mes_ano.eq.${competencia},mes_referencia.eq.${competencia}`),
      supabase.from('regras_comissoes').select('*').eq('mes_referencia', competencia)
    ]);

    if (vendasRes.error) throw vendasRes.error;

    const metasMap: Record<string, any> = {};
    (metasRes.data || []).forEach((m: any) => {
      if (m.vendedor_id) metasMap[String(m.vendedor_id)] = m;
    });

    const regrasMap: Record<string, any> = {};
    (regrasRes.data || []).forEach((r: any) => {
      if (r.filial_id) regrasMap[String(r.filial_id)] = r;
    });

    // Filtrar apenas vendas válidas (não canceladas) e pertencentes estritamente à competência em America/Sao_Paulo
    const vendasLista = ((vendasRes.data || []) as any[]).filter(v => {
      const status = String(v.status || '').toUpperCase().trim();
      if (status === 'CANCELADA' || status === 'CANCELADO') return false;

      const rawDate = v.created_at || v.data;
      if (!rawDate) return true;
      try {
        const dt = new Date(rawDate);
        if (isNaN(dt.getTime())) return true;
        const brComp = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Sao_Paulo',
          year: 'numeric',
          month: '2-digit'
        }).format(dt);
        return brComp === competencia;
      } catch {
        return true;
      }
    });

    const colabsLista = colaboradores || [];

    // 4. Mapeamento com VÍNCULO DUPLO (ID ou NOME) e cálculo 100% centralizado via calcularDesempenhoGeral
    const resultado: RankingColaborador[] = colabsLista.map(colab => {
      const colabId = String(colab.id || '').trim();
      const colabNome = String(colab.nome || '').trim().toUpperCase();

      // Vendas como titular (por ID ou por Nome normalizado)
      const vendasDoColaborador = vendasLista.filter(v => {
        const vId = v.vendedor_id ? String(v.vendedor_id).trim() : null;
        const vNome = v.vendedor_nome ? String(v.vendedor_nome).trim().toUpperCase() : null;
        return (vId && vId === colabId) || (vNome && colabNome && (vNome === colabNome || vNome.includes(colabNome)));
      });

      // Vendas onde atuou como trainee participante
      const vendasComoTrainee = vendasLista.filter(v => {
        const tId = v.trainee_id || v.treener_id ? String(v.trainee_id || v.treener_id).trim() : null;
        const tNome = v.trainee_nome ? String(v.trainee_nome).trim().toUpperCase() : null;
        return (tId && tId === colabId) || (tNome && colabNome && (tNome === colabNome || tNome.includes(colabNome)));
      });

      const volumeTitular = vendasDoColaborador.reduce((acc, v) => acc + Number(v.valor_total ?? v.total ?? v.valor ?? 0), 0);
      const faturadoTrainee = vendasComoTrainee.reduce((acc, v) => acc + Number(v.valor_total ?? v.total ?? v.valor ?? 0), 0);

      // Classificação estrita de Trainee (apenas quando o cargo/role for Trainee ou só tiver vendas como trainee)
      const roleUpper = String(colab.role || '').toUpperCase().trim();
      const isOriginalTrainee = roleUpper.includes('TRAINEE') || Boolean(colab.is_treinner);
      const isTrainee = isOriginalTrainee || (volumeTitular === 0 && faturadoTrainee > 0);

      // Conjunto unificado de vendas do colaborador
      const vendasTotaisColab = isTrainee
        ? Array.from(new Map([...vendasDoColaborador, ...vendasComoTrainee].map(v => [String(v.id), v])).values())
        : (vendasDoColaborador.length > 0 ? vendasDoColaborador : vendasComoTrainee);

      const metaColab = metasMap[colabId];
      const regraFilial = colab.filial_id ? regrasMap[String(colab.filial_id)] : null;

      const metaBoleto = Number(metaColab?.meta_boleto) > 0
        ? Number(metaColab.meta_boleto)
        : (isTrainee
          ? (Number(metaColab?.meta_trainee_boleto) || Number(regraFilial?.meta_trainee_boletos) || 35000)
          : (Number(regraFilial?.meta_vendedor_boleto) || 67500));

      const superMetaBoleto = Number(metaColab?.super_meta_boleto) > 0
        ? Number(metaColab.super_meta_boleto)
        : (isTrainee ? 45000 : (Number(regraFilial?.super_meta_boleto) || 87000));

      const metaAcessorios = Number(metaColab?.meta_acessorios) > 0
        ? Number(metaColab.meta_acessorios)
        : (isTrainee ? 5000 : (Number(regraFilial?.meta_vendedor_acessorios) || 10000));

      const superMetaAcessorios = Number(metaColab?.super_meta_acessorios) > 0
        ? Number(metaColab.super_meta_acessorios)
        : (isTrainee ? 7500 : (Number(regraFilial?.super_meta_acessorios) || 15000));

      // Cálculo centralizado único via calcularDesempenhoGeral
      const calc = calcularDesempenhoGeral(vendasTotaisColab, 'COM_APOIO', {
        isTrainee,
        metaBoleto,
        superMetaBoleto,
        metaAcessorios,
        superMetaAcessorios
      });

      return {
        colaborador_id: colab.id,
        colaborador: colab.nome || 'Sem Nome',
        filial_id: colab.filial_id,
        competencia,
        total_transacoes: calc.transacoes,
        faturado_titular: calc.volumeTotal,
        faturado_trainee: faturadoTrainee,
        volume_total_participado: calc.volumeTotal,
        ticket_medio: calc.ticketMedio,
        total_boletos: calc.totalBoletos,
        totalBoletos: calc.totalBoletos,
        totalBoletosBruto: calc.totalBoletosBruto,
        total_acessorios: calc.totalAcessorios,
        totalAcessorios: calc.totalAcessorios,
        total_faturado_especiais: calc.totalFaturadoEspeciais,
        totalFaturadoEspeciais: calc.totalFaturadoEspeciais,
        comissaoLiquida: calc.comissaoLiquida,
        comissaoTrainee: calc.comissaoTrainee,
        comissao_acumulada: calc.comissaoLiquida,
        is_trainee: isTrainee,
        volume_exibicao: calc.volumeTotal,
        vendas_colaborador: vendasTotaisColab
      };
    });

    // Ordena do maior para o menor faturamento
    return resultado.sort((a, b) => b.volume_exibicao - a.volume_exibicao);
  } catch (err) {
    console.warn('[useMetasRankings] Fallback para view_ranking_colaboradores_mensal devido a:', err);
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

    return ((rows || []) as RankingColaboradorRow[]).map(r => {
      const vol = parseNumber(r.faturado_titular) > 0 ? parseNumber(r.faturado_titular) : parseNumber(r.volume_total_participado);
      const bol = parseNumber(r.total_boletos);
      return {
        colaborador_id: r.colaborador_id,
        colaborador: r.colaborador || 'Sem Nome',
        filial_id: r.filial_id,
        competencia: r.competencia,
        total_transacoes: parseInt(String(r.total_transacoes || 0), 10) || 0,
        faturado_titular: parseNumber(r.faturado_titular),
        faturado_trainee: parseNumber(r.faturado_trainee),
        volume_total_participado: parseNumber(r.volume_total_participado),
        ticket_medio: parseNumber(r.ticket_medio),
        total_boletos: bol,
        totalBoletos: bol,
        comissaoLiquida: 0,
        comissaoTrainee: 0,
        comissao_acumulada: 0,
        is_trainee: parseNumber(r.faturado_trainee) > parseNumber(r.faturado_titular) && parseNumber(r.faturado_titular) === 0,
        volume_exibicao: vol
      };
    });
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
    staleTime: 1000 * 60 * 3,
  });

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
  const queryClient = useQueryClient();

  const queryKey = [
    'ranking-colaboradores',
    competencia,
    'todas',
    colaboradorId || 'todos'
  ];

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchRankingColaboradoresMensal({ competencia, colaboradorId }),
    enabled: Boolean(colaboradorId && enabled),
    staleTime: 0,
  });

  const invalidarERefetch = async () => {
    await queryClient.invalidateQueries({
      queryKey: ['ranking-colaboradores', competencia]
    });
    return refetch();
  };

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

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabaseClient';
import { calcularDesempenhoColaborador } from '../utils/calculoMetas';

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
    // 1. Define início e fim do mês da competência (Mês civil completo)
    const [anoStr, mesStr] = (competencia || getCompetenciaAtual()).split('-');
    const anoAtual = parseInt(anoStr, 10);
    const mesAtual = parseInt(mesStr, 10);
    const inicioMes = new Date(anoAtual, mesAtual - 1, 1, 0, 0, 0).toISOString();
    const fimMes = new Date(anoAtual, mesAtual, 0, 23, 59, 59, 999).toISOString();

    // 2. Busca lista de colaboradores cadastrados (Se colaboradorId informado, busca diretamente sem travar por filial)
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

    // 3. Busca de vendas da competência incluindo itens_venda e vendas_pagamentos para cálculo idêntico ao Modal
    // NOTA CRÍTICA: NÃO aplique filtro restritivo de filial_id na tabela 'vendas' para não descartar
    // vendas efetuadas pelo colaborador em outras filiais da rede durante o mês.
    let vendasQuery = supabase
      .from('vendas')
      .select(`
        id, valor_total, comissao_vendedor, comissao, vendedor_id, vendedor_nome, filial_id, created_at, status,
        treener_id, trainee_id, trainee_nome, teve_participacao_trainee, comissao_trainee,
        forma_pagamento, metodo_pagamento, financeira, pagamentos, valor_boleto, valor_pix, valor_dinheiro, valor_cartao,
        produto_nome, descricao, produtos_descricao, itens_resumo, categoria,
        itens_venda (*),
        vendas_pagamentos (*)
      `)
      .gte('created_at', inicioMes)
      .lte('created_at', fimMes)
      .neq('status', 'CANCELADA')
      .neq('status', 'cancelada');

    if (colaboradorId && colaboradorId !== 'sem_vendedor' && !String(colaboradorId).startsWith('nome_')) {
      vendasQuery = vendasQuery.or(`vendedor_id.eq.${colaboradorId},trainee_id.eq.${colaboradorId},treener_id.eq.${colaboradorId}`);
    }

    const { data: vendas, error: vendasError } = await vendasQuery;
    if (vendasError) throw vendasError;

    const vendasLista = (vendas || []) as any[];
    const colabsLista = colaboradores || [];

    // Mapeamento com VÍNCULO DUPLO (ID ou NOME) e sincronização 1:1 com a lógica de metas do Modal:
    const resultado: RankingColaborador[] = colabsLista.map(colab => {
      const colabId = String(colab.id || '').trim();
      const colabNome = String(colab.nome || '').trim().toUpperCase();

      // Vendas do colaborador: agrupamento prioritário por vendedor_id com fallback seguro por nome
      const vendasDoColaborador = vendasLista.filter(v => {
        const vId = v.vendedor_id ? String(v.vendedor_id).trim() : null;
        const vNome = v.vendedor_nome ? String(v.vendedor_nome).trim().toUpperCase() : null;
        return (vId && vId === colabId) || (vNome && colabNome && (vNome === colabNome || vNome.includes(colabNome)));
      });

      // Vendas com participação trainee
      const vendasComoTrainee = vendasLista.filter(v => {
        const tId = v.trainee_id || v.treener_id ? String(v.trainee_id || v.treener_id).trim() : null;
        const tNome = v.trainee_nome ? String(v.trainee_nome).trim().toUpperCase() : null;
        return (tId && tId === colabId) || (tNome && colabNome && (tNome === colabNome || tNome.includes(colabNome)));
      });

      const volumeTitular = vendasDoColaborador.reduce((acc, v) => acc + Number(v.valor_total || 0), 0);
      const faturadoTrainee = vendasComoTrainee.reduce((acc, v) => acc + Number(v.valor_total || 0), 0);

      const isOriginalTrainee = colab.role === 'TRAINEE' || Boolean(colab.is_treinner);
      const isTrainee = faturadoTrainee > volumeTitular || isOriginalTrainee || (volumeTitular === 0 && faturadoTrainee > 0);

      // Todas as vendas em que o colaborador participou (titular ou apoio)
      const vendasTotaisColab = Array.from(
        new Map([...vendasDoColaborador, ...vendasComoTrainee].map(v => [String(v.id), v])).values()
      );

      // Executa o cálculo unificado de desempenho (respeitando exclusão de Produtos Especiais na Meta de Boletos)
      const calc = calcularDesempenhoColaborador(vendasTotaisColab, {
        isTrainee,
        targetVendedorId: colabId,
        targetVendedorNome: colab.nome,
        filtroTipoVendas: 'todas',
        excluirEspeciaisDasMetas: true
      });

      const volumeTotal = calc.totalVendasGeral;
      const transacoes = calc.totalTransacoes;

      const volumeExibicao = isTrainee
        ? (volumeTotal > 0 ? volumeTotal : faturadoTrainee)
        : (volumeTitular > 0 ? volumeTitular : volumeTotal);

      const ticketMedio = transacoes > 0 ? volumeExibicao / transacoes : 0;

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
        total_boletos: calc.totalBoletos,
        totalBoletos: calc.totalBoletos,
        totalBoletosBruto: calc.totalBoletosBruto,
        total_acessorios: calc.totalAcessorios,
        totalAcessorios: calc.totalAcessorios,
        total_faturado_especiais: calc.totalFaturadoEspeciais,
        totalFaturadoEspeciais: calc.totalFaturadoEspeciais,
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
    staleTime: 0, // Sem cache obsoleto para consulta de metas individuais do colaborador
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

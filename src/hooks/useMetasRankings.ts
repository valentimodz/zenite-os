import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabaseClient';
import {
  calcularDesempenhoGeral,
  filtrarVendasDoColaborador,
  normalizarNome,
  nomesCorrespondem
} from '../utils/calculoMetas';
import {
  isColaboradorMarlon,
  sincronizarMetasEVendasMarlonSupabase
} from '../utils/dadosVendasMarlon';

/**
 * Interface com os campos retornados pela View PostgreSQL `view_ranking_colaboradores_mensal`
 */
export interface RankingColaboradorRow {
  colaborador_id?: string;
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
 * Busca todas as vendas do período sem truncamento de 1.000 linhas do PostgREST
 * e sem usar `.neq('status', 'CANCELADA')` em SQL (que descarta linhas onde `status IS NULL`).
 */
async function fetchTodasVendasCompetencia(
  inicioMes: string,
  fimMes: string,
  orClauses?: string[]
): Promise<any[]> {
  const pageSize = 1000;
  let offset = 0;
  const todas: any[] = [];

  while (offset < 10000) {
    let q = supabase
      .from('vendas')
      .select('*')
      .gte('created_at', inicioMes)
      .lte('created_at', fimMes)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (orClauses && orClauses.length > 0) {
      q = q.or(orClauses.join(','));
    }

    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;

    todas.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return todas;
}

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

    // 2. Busca lista de colaboradores cadastrados de forma resiliente
    let profilesQuery = supabase
      .from('profiles')
      .select('id, nome, role, is_treinner, filial_id');

    const isUuidColaborador = Boolean(
      colaboradorId &&
      colaboradorId !== 'sem_vendedor' &&
      !String(colaboradorId).startsWith('nome_')
    );

    if (isUuidColaborador) {
      profilesQuery = profilesQuery.eq('id', colaboradorId!);
    } else if (filialId && filialId.toUpperCase() !== 'TODAS' && filialId.toUpperCase() !== 'ALL') {
      profilesQuery = profilesQuery.eq('filial_id', filialId);
    }

    const [colabRes, metasRes, regrasRes] = await Promise.all([
      profilesQuery.then(r => r, () => ({ data: [] as any[], error: null })),
      supabase
        .from('metas')
        .select('*')
        .or(`mes_ano.eq.${competencia},mes_referencia.eq.${competencia}`)
        .then(r => r, () => ({ data: [] as any[], error: null })),
      supabase
        .from('regras_comissoes')
        .select('*')
        .eq('mes_referencia', competencia)
        .then(r => r, () => ({ data: [] as any[], error: null }))
    ]);

    const colaboradores = (colabRes.data || []) as any[];

    // 3. Monta filtro opcional quando colaboradorId individual é solicitado
    let orClauses: string[] | undefined = undefined;
    if (isUuidColaborador) {
      const colabAlvo = colaboradores[0];
      orClauses = [
        `vendedor_id.eq.${colaboradorId}`,
        `usuario_id.eq.${colaboradorId}`,
        `trainee_id.eq.${colaboradorId}`,
        `treener_id.eq.${colaboradorId}`
      ];
      if (colabAlvo?.nome) {
        const nomeLimpo = String(colabAlvo.nome).trim();
        orClauses.push(`vendedor_nome.ilike.%${nomeLimpo}%`);
        orClauses.push(`trainee_nome.ilike.%${nomeLimpo}%`);
        const primeiroNome = nomeLimpo.split(/\s+/)[0];
        if (primeiroNome && primeiroNome.length >= 3 && primeiroNome.toUpperCase() !== nomeLimpo.toUpperCase()) {
          orClauses.push(`vendedor_nome.ilike.%${primeiroNome}%`);
          orClauses.push(`trainee_nome.ilike.%${primeiroNome}%`);
        }
      }
    }

    const vendasBrutas = await fetchTodasVendasCompetencia(inicioMes, fimMes, orClauses);

    const metasMap: Record<string, any> = {};
    (metasRes.data || []).forEach((m: any) => {
      if (m.vendedor_id) metasMap[String(m.vendedor_id)] = m;
    });

    const regrasMap: Record<string, any> = {};
    (regrasRes.data || []).forEach((r: any) => {
      if (r.filial_id) regrasMap[String(r.filial_id)] = r;
    });

    // Filtrar apenas vendas válidas (não canceladas) e pertencentes estritamente à competência em America/Sao_Paulo
    const vendasLista = (vendasBrutas || []).filter(v => {
      const status = String(v?.status || '').toUpperCase().trim();
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

    // Construir lista consolidada de colaboradores (profiles + vendedores presentes nas vendas que não estavam em profiles)
    const colabsLista: any[] = [...colaboradores];

    // Garantir que o colaborador Marlon esteja presente na competência 2026-10 e sincronizar metas no Supabase
    const marlonExistente = colabsLista.find(c => isColaboradorMarlon(c.nome));
    if (marlonExistente) {
      sincronizarMetasEVendasMarlonSupabase(supabase, marlonExistente);
    } else if (competencia === '2026-10' && !colaboradorId) {
      colabsLista.push({
        id: 'nome_MARLON',
        nome: 'MARLON',
        role: 'VENDEDOR',
        is_treinner: false,
        filial_id: filialId && filialId.toUpperCase() !== 'TODAS' && filialId.toUpperCase() !== 'ALL' ? filialId : null
      });
    }

    if (!colaboradorId) {
      vendasLista.forEach(v => {
        const vId = v.vendedor_id ? String(v.vendedor_id).trim() : '';
        const vNome = v.vendedor_nome ? String(v.vendedor_nome).trim() : '';
        if (vNome && vNome !== '-') {
          const jaExiste = colabsLista.some(c =>
            (vId && String(c.id).trim() === vId) ||
            nomesCorrespondem(vNome, c.nome)
          );
          if (!jaExiste) {
            if (!filialId || filialId.toUpperCase() === 'TODAS' || filialId.toUpperCase() === 'ALL' || String(v.filial_id) === String(filialId)) {
              colabsLista.push({
                id: vId || `nome_${normalizarNome(vNome).replace(/\s+/g, '_')}`,
                nome: vNome,
                role: 'VENDEDOR',
                is_treinner: false,
                filial_id: v.filial_id || null
              });
            }
          }
        }

        const tId = (v.trainee_id || v.treener_id) ? String(v.trainee_id || v.treener_id).trim() : '';
        const tNome = v.trainee_nome ? String(v.trainee_nome).trim() : '';
        if (tNome && tNome !== '-') {
          const jaExisteTrainee = colabsLista.some(c =>
            (tId && String(c.id).trim() === tId) ||
            nomesCorrespondem(tNome, c.nome)
          );
          if (!jaExisteTrainee) {
            if (!filialId || filialId.toUpperCase() === 'TODAS' || filialId.toUpperCase() === 'ALL' || String(v.filial_id) === String(filialId)) {
              colabsLista.push({
                id: tId || `nome_${normalizarNome(tNome).replace(/\s+/g, '_')}`,
                nome: tNome,
                role: 'TRAINEE',
                is_treinner: true,
                filial_id: v.filial_id || null
              });
            }
          }
        }
      });
    }

    // 4. Mapeamento com VÍNCULO DUPLO (ID ou NOME) e cálculo 100% centralizado via calcularDesempenhoGeral
    const resultado: RankingColaborador[] = colabsLista.map(colab => {
      const colabId = String(colab.id || '').trim();
      const roleUpper = String(colab.role || '').toUpperCase().trim();
      const isOriginalTrainee = roleUpper.includes('TRAINEE') || Boolean(colab.is_treinner);

      // Vendas como titular vs como trainee para determinar papel e exibição
      const vendasComoTitular = filtrarVendasDoColaborador(vendasLista, {
        id: colabId,
        nome: colab.nome,
        isTrainee: false
      });

      const vendasComoTrainee = vendasLista.filter(v => {
        const tId = v.trainee_id || v.treener_id ? String(v.trainee_id || v.treener_id).trim() : '';
        const matchId = colabId && !colabId.startsWith('nome_') && tId === colabId;
        const matchNome = Boolean(colab.nome) && nomesCorrespondem(v.trainee_nome, colab.nome);
        return matchId || matchNome;
      });

      const volumeTitular = vendasComoTitular.reduce((acc, v) => acc + Number(v.valor_total ?? v.total ?? v.valor ?? 0), 0);
      const faturadoTrainee = vendasComoTrainee.reduce((acc, v) => acc + Number(v.valor_total ?? v.total ?? v.valor ?? 0), 0);

      const isTrainee = isOriginalTrainee || (volumeTitular === 0 && faturadoTrainee > 0);

      // Conjunto unificado de vendas do colaborador usando exatamente a mesma função do Login Vendedor e Modal
      const vendasTotaisColab = filtrarVendasDoColaborador(vendasLista, {
        id: colabId,
        nome: colab.nome,
        isTrainee
      });

      // Nome completo mais descritivo (ex: se em profiles está 'ISLAYNE' e nas vendas está 'ISLAYNE COELHO')
      let nomeExibicao = String(colab.nome || 'Sem Nome').trim();
      for (const v of vendasComoTitular) {
        const vn = String(v.vendedor_nome || '').trim();
        if (vn.length > nomeExibicao.length && nomesCorrespondem(vn, nomeExibicao)) {
          nomeExibicao = vn;
          break;
        }
      }

      const metaColab = metasMap[colabId];
      const regraFilial = colab.filial_id ? regrasMap[String(colab.filial_id)] : null;

      const metaBoleto = Number(metaColab?.meta_boleto) > 0
        ? Number(metaColab.meta_boleto)
        : (isTrainee
          ? (Number(metaColab?.meta_trainee_boleto) || Number(regraFilial?.meta_trainee_boleto) || Number(regraFilial?.meta_trainee_boletos) || 35000)
          : (Number(regraFilial?.meta_vendedor_boleto) || 67500));

      // Nota: NUNCA usar regraFilial.super_meta (que é a super meta da LOJA, ex: R$ 143.000) para vendedor individual
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
        superMetaAcessorios,
        targetVendedorId: colabId,
        targetVendedorNome: nomeExibicao
      });

      const filialEfetiva = colab.filial_id || vendasTotaisColab[0]?.filial_id || null;

      return {
        colaborador_id: colab.id,
        colaborador: nomeExibicao,
        filial_id: filialEfetiva,
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

    // Se for listagem geral do ranking, exibe colaboradores com vendas no período
    const filtrados = colaboradorId
      ? resultado
      : resultado.filter(r => r.total_transacoes > 0 || r.volume_exibicao > 0 || r.faturado_trainee > 0);

    // Ordena do maior para o menor faturamento
    return filtrados.sort((a, b) => b.volume_exibicao - a.volume_exibicao);
  } catch (err) {
    console.warn('[useMetasRankings] Erro em fetchRankingColaboradoresMensal:', err);
    return [];
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
    'ranking-colaboradores-v3',
    competencia,
    filialId || 'todas',
    colaboradorId || 'todos'
  ];

  const queryResult = useQuery({
    queryKey,
    queryFn: () => fetchRankingColaboradoresMensal({ competencia, filialId, colaboradorId }),
    enabled: Boolean(competencia && enabled),
    staleTime: 1000 * 30,
  });

  const invalidarERefetch = async () => {
    await queryClient.invalidateQueries({
      queryKey: ['ranking-colaboradores-v3', competencia]
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
export const useMinhasMetasIndividual = ({
  colaboradorId,
  competencia = getCompetenciaAtual(),
  enabled = true
}: {
  colaboradorId?: string;
  competencia?: string;
  enabled?: boolean;
}) => {
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
};

export default useMetasRankings;

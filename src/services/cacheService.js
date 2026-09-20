// Utilitário de Cache em memória para dados estáticos e consultas frequentes (Produtos, Caixas, Perfis, Filiais, Categorias)
// Garante staleTime mínimo de 5 minutos (300.000ms) e previne recarregamentos indesejados ao alternar abas ou desfocar janela.

export const DEFAULT_STALE_TIME_MS = 5 * 60 * 1000; // 300.000ms (5 minutos)

/**
 * Configuração global padronizada para React Query / SWR / Contexto de Dados:
 * - refetchOnWindowFocus: false (desativa refetch ao focar ou alternar abas)
 * - refetchOnReconnect: false (desativa refetch desnecessário ao reconectar)
 * - staleTime: 300000 (mínimo de 5 minutos para produtos, caixas, perfis e filiais)
 */
export const queryConfig = {
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: DEFAULT_STALE_TIME_MS,
      gcTime: 10 * 60 * 1000,
    },
  },
};

const memoryCache = new Map();

/**
 * Obtém um item do cache se ainda for válido dentro do TTL/staleTime.
 * @param {string} key - Chave única do cache
 * @returns {any|null} Os dados armazenados ou null se expirado/inexistente.
 */
export function getCache(key) {
  const item = memoryCache.get(key);
  if (!item) return null;

  const now = Date.now();
  if (now > item.expiresAt) {
    memoryCache.delete(key);
    return null;
  }

  return item.data;
}

/**
 * Verifica se uma chave existe no cache e ainda é válida (não expirada).
 * @param {string} key - Chave única do cache
 * @returns {boolean}
 */
export function hasValidCache(key) {
  return getCache(key) !== null;
}

/**
 * Salva um item no cache com tempo de vida (TTL) em minutos.
 * @param {string} key - Chave única do cache
 * @param {any} data - Dados a serem cacheados
 * @param {number} ttlMinutes - Tempo de vida em minutos (padrão: 5 min / 300.000ms)
 */
export function setCache(key, data, ttlMinutes = 5) {
  const expiresAt = Date.now() + ttlMinutes * 60 * 1000;
  memoryCache.set(key, { data, expiresAt });
}

/**
 * Invalida itens do cache por chave exata ou prefixo.
 * @param {string} prefixOrKey - Chave ou prefixo para invalidar
 */
export function invalidateCache(prefixOrKey) {
  if (!prefixOrKey) {
    memoryCache.clear();
    return;
  }

  for (const key of memoryCache.keys()) {
    if (key === prefixOrKey || key.startsWith(prefixOrKey)) {
      memoryCache.delete(key);
    }
  }
}


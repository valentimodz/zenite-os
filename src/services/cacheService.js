// Utilitário de Cache em memória para dados estáticos ou pouco alterados (Filiais, Vendedores/Profiles, Categorias)
// Reduz drasticamente requisições repetidas ao Supabase e consumo de Egress de rede.

const memoryCache = new Map();

/**
 * Obtém um item do cache se ainda for válido dentro do TTL.
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
 * Salva um item no cache com tempo de vida (TTL) em minutos.
 * @param {string} key - Chave única do cache
 * @param {any} data - Dados a serem cacheados
 * @param {number} ttlMinutes - Tempo de vida em minutos (padrão: 5 min)
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

/**
 * Utilitários para formatação e parsing monetário no padrão brasileiro (BRL / pt-BR)
 * e manipulação segura de valores de sessões de caixa (fundo de troco).
 */

/**
 * Converte qualquer entrada (string formatada, string numérica ou número) para float válido.
 * Trata casos como:
 * - "623.00" -> 623.00 (evita bug de remover ponto decimal e transformar em 62300)
 * - "623,00" -> 623.00
 * - "R$ 1.250,50" -> 1250.50
 * - "50" -> 50.00
 * - 623.5 -> 623.50
 */
export const parseMonetaryValue = (val) => {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (val === null || val === undefined) return 0;
  const str = String(val).trim();
  if (!str) return 0;

  // Se contém vírgula, segue o padrão pt-BR onde vírgula é separador decimal
  if (str.includes(',')) {
    // Remove pontos (milhar) e caracteres não-numéricos, mantendo a vírgula
    const cleaned = str.replace(/[^\d,-]/g, '').replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }

  // Se não contém vírgula, verifica a quantidade de pontos
  const dotsCount = (str.match(/\./g) || []).length;
  if (dotsCount === 1) {
    // Ponto único é separador decimal de float padrão (ex: "623.00" ou "62.30")
    const cleaned = str.replace(/[^\d.-]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  } else if (dotsCount > 1) {
    // Múltiplos pontos são separadores de milhar sem decimais (ex: "1.000.000")
    const cleaned = str.replace(/\./g, '').replace(/[^\d-]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }

  // Apenas dígitos ou valor simples
  const cleaned = str.replace(/[^\d-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Formata um valor numérico para exibição em Real brasileiro (R$ 0,00)
 */
export const formatCurrency = (val) => {
  const num = parseMonetaryValue(val);
  return `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Critério único e padronizado para extrair o Fundo de Troco de uma sessão de caixa:
 * sessao.fundo_troco ?? sessao.valor_abertura ?? sessao.saldo_inicial ?? 0
 * Com fallback secundário caso a primeira propriedade encontrada seja 0 e outra contenha valor positivo.
 */
export const getFundoSessao = (sessao) => {
  if (!sessao || typeof sessao !== 'object') return 0;

  // 1. Ordem estrita de precedência solicitada:
  // sessao.fundo_troco ?? sessao.valor_abertura ?? sessao.saldo_inicial ?? 0
  const valorBruto = sessao.fundo_troco ?? sessao.valor_abertura ?? sessao.saldo_inicial ?? sessao.saldo_abertura ?? sessao.valor_inicial ?? 0;
  let valorFinal = parseMonetaryValue(valorBruto);

  // 2. Proteção adicional: se o resultado foi 0 mas alguma outra coluna do registro contém um valor maior que zero
  if (valorFinal === 0) {
    const alternativo = (sessao.fundo_troco && Number(sessao.fundo_troco) > 0) ? sessao.fundo_troco :
      (sessao.valor_abertura && Number(sessao.valor_abertura) > 0) ? sessao.valor_abertura :
      (sessao.saldo_inicial && Number(sessao.saldo_inicial) > 0) ? sessao.saldo_inicial :
      (sessao.saldo_abertura && Number(sessao.saldo_abertura) > 0) ? sessao.saldo_abertura :
      (sessao.valor_inicial && Number(sessao.valor_inicial) > 0) ? sessao.valor_inicial : 0;

    valorFinal = parseMonetaryValue(alternativo);
  }

  return valorFinal;
};

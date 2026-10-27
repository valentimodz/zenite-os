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
 * Formata um valor numérico para exibição em Real brasileiro (R$ 0,00) com exatamente 2 casas decimais.
 */
export const formatarMoeda = (valor) => {
  const numero = typeof valor === 'string' ? parseFloat(valor.replace(',', '.')) : Number(valor);
  if (isNaN(numero) || numero === null || numero === undefined) return 'R$ 0,00';
  
  return numero.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/**
 * Formata um valor numérico para exibição em Real brasileiro (R$ 0,00)
 */
export const formatCurrency = (val) => {
  return formatarMoeda(val);
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

/**
 * Sanitiza identificadores que contenham sufixos (ex.: id_cor ou id_variante),
 * extraindo estritamente a sequência correspondente a um UUID v4 para compatibilidade com o Postgres.
 */
export const obterUuidPuro = (id) => {
  if (typeof id !== 'string') return id;
  // Extrai estritamente a sequência correspondente a um UUID v4
  const uuidMatch = id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return uuidMatch ? uuidMatch[0] : id.split('_')[0];
};

/**
 * Calcula o valor com repasse da taxa da operadora de cartão e o valor da parcela.
 * Fórmula correta para que a loja receba o valor original líquido:
 * ValorTotalComTaxa = ValorOriginal / (1 - (taxaPercentual / 100))
 * ValorDaParcela = ValorTotalComTaxa / numeroDeParcelas
 */
export const calcularParcelaComRepasse = (
  valorOriginal,
  taxaPercentual,
  parcelas
) => {
  const vOriginal = Number(valorOriginal) || 0;
  const numParcelas = parseInt(parcelas, 10) || 1;
  const taxaNum = Number(taxaPercentual) || 0;

  if (numParcelas <= 0 || vOriginal <= 0) return { total: 0, parcela: 0, taxaAplicada: 0 };

  // Se a taxa cadastrada for o fator líquido (ex: 96.06), converte para taxa real: (100 - fator)
  const taxaReal = taxaNum > 50 ? (100 - taxaNum) : taxaNum;

  // Evita divisão por zero ou números negativos caso a taxa seja >= 100
  const fatorDivisao = 1 - (taxaReal / 100);
  const totalComTaxa = fatorDivisao > 0 ? (vOriginal / fatorDivisao) : vOriginal;
  const valorParcela = totalComTaxa / numParcelas;

  return {
    total: Number(totalComTaxa.toFixed(2)),
    parcela: Number(valorParcela.toFixed(2)),
    taxaAplicada: taxaReal
  };
};
export const calcularOpcoesParcelamento = (
  valorOriginal,
  listaTaxas = []
) => {
  const vOriginal = Number(valorOriginal) || 0;
  if (!vOriginal || vOriginal <= 0) return [];

  const lista = Array.isArray(listaTaxas) ? listaTaxas : [];
  return Array.from({ length: 18 }, (_, i) => i + 1).map((n) => {
    const feeObj = lista.find(t => (t.parcela === n || t.parcelas === n));
    const taxaConfigurada = feeObj ? Number(feeObj.taxa) : (1.5 + (n - 1));
    const { total, parcela } = calcularParcelaComRepasse(vOriginal, taxaConfigurada, n);

    return {
      parcelas: n,
      totalCobrado: total,
      valorParcela: parcela,
      label: `${n}x de ${parcela.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (Total: ${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})`
    };
  });
};

/**
 * Coeficientes padrão da Credi Shop (1x a 10x)
 * 1. fator = Number(fator) / 100
 * 2. valorTotal = valorOriginal / fator
 * 3. valorParcela = valorTotal / numeroParcelas
 */
export const TAXAS_PADRAO_CREDISHOP = [
  { parcela: 1,  fator: 95.15 },
  { parcela: 2,  fator: 93.30 },
  { parcela: 3,  fator: 91.45 },
  { parcela: 4,  fator: 89.60 },
  { parcela: 5,  fator: 87.75 },
  { parcela: 6,  fator: 85.90 },
  { parcela: 7,  fator: 84.05 },
  { parcela: 8,  fator: 82.20 },
  { parcela: 9,  fator: 80.35 },
  { parcela: 10, fator: 78.50 },
];

export const calcularParcelamentoCredShop = (
  valorOriginal,
  taxas = TAXAS_PADRAO_CREDISHOP
) => {
  const vOriginal = Number(valorOriginal) || 0;
  if (!vOriginal || vOriginal <= 0) return [];

  const lista = (Array.isArray(taxas) && taxas.length > 0) ? taxas : TAXAS_PADRAO_CREDISHOP;

  return lista
    .filter(t => t.parcela >= 1 && t.parcela <= 10)
    .sort((a, b) => a.parcela - b.parcela)
    .map(item => {
      const taxaNum = Number(item.fator ?? item.taxa ?? 100);

      // Converte o fator (ex: 95.15 vira 0.9515)
      const fator = taxaNum > 1 ? taxaNum / 100 : taxaNum;

      const totalFinal = fator > 0 ? (vOriginal / fator) : vOriginal;
      const valorPorParcela = totalFinal / item.parcela;

      return {
        parcelas: item.parcela,
        totalCobrado: Number(totalFinal.toFixed(2)),
        valorParcela: Number(valorPorParcela.toFixed(2)),
        label: `${item.parcela}x de ${valorPorParcela.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (Total: ${totalFinal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})`
      };
    });
};




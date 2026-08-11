/**
 * Motor Rígido de Validação de Descontos no PDV (Regras de Negócio Inegociáveis)
 * 
 * Regras Inegociáveis:
 * 1. iPhone / Apple: 0% de desconto (Bloqueio Total).
 * 2. Celulares Android: Máximo de 5% de desconto.
 * 3. Acessórios (capas, películas, carregadores, cabos, fones, etc.): Máximo de 15% de desconto.
 * 
 * @param {Object} produto - Objeto do produto contendo nome, categoria, marca, preco, etc.
 * @returns {number} Valor máximo em Reais (R$) que pode ser descontado por unidade
 */
export const calcularDescontoMaximo = (produto) => {
  if (!produto) return 0;

  const nome = (produto.nome || '').toLowerCase();
  const categoria = (produto.categoria || produto.tipo || '').toLowerCase();
  const marca = (produto.marca || '').toLowerCase();
  const preco = Number(produto.preco) || Number(produto.preco_tabela) || 0;

  if (preco <= 0) return 0;

  // Regra 1: Bloqueio Total para iPhone/Apple (0% de desconto)
  if (
    nome.includes('iphone') || 
    nome.includes('apple') || 
    marca.includes('apple') || 
    marca.includes('iphone') || 
    categoria.includes('apple') || 
    categoria.includes('iphone') || 
    categoria.includes('ios')
  ) {
    return 0;
  }

  // Regra 2: Desconto Android (5% de desconto max)
  if (
    categoria.includes('celular') || 
    categoria.includes('smartphone') || 
    categoria.includes('android') || 
    produto.tipo === 'CELULAR'
  ) {
    return preco * 0.05; // 5%
  }

  // Regra 3: Acessórios (15% de desconto max)
  if (
    categoria.includes('acessorio') || 
    categoria.includes('acessório') || 
    categoria.includes('capa') || 
    categoria.includes('pelicula') || 
    categoria.includes('película') || 
    categoria.includes('carregador') || 
    categoria.includes('fone') || 
    categoria.includes('cabo') || 
    categoria.includes('servico') || 
    categoria.includes('serviço') || 
    produto.tipo === 'ACESSORIO'
  ) {
    return preco * 0.15; // 15%
  }

  return 0; // Default: Sem desconto para o que não cair nas regras explicitadas
};

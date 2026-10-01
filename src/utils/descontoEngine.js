/**
 * Motor Rígido de Validação de Descontos no PDV (Regras de Negócio Inegociáveis)
 * 
 * Regras:
 * 1. iPhone / Celular Apple: 0% de desconto para vendedores normais. Administradores/Gerentes/Donos possuem bypass.
 * 2. Celulares Android: Máximo de 5% de desconto.
 * 3. Acessórios (capas, películas, carregadores, cabos, fones, etc., inclusive para iPhone/Apple): Máximo de 15% de desconto.
 * 
 * @param {Object} produto - Objeto do produto contendo nome, categoria, marca, preco, etc.
 * @param {string|null} userRole - Cargo/perfil do usuário autenticado (ADMIN, DONO, GERENTE, etc.)
 * @returns {number} Valor máximo em Reais (R$) que pode ser descontado por unidade
 */
export const calcularDescontoMaximo = (produto, userRole = null) => {
  if (!produto) return 0;

  const nome = (produto.nome || '').toLowerCase();
  const categoria = (produto.categoria || produto.tipo || '').toLowerCase();
  const tipo = (produto.tipo || '').toUpperCase();
  const marca = (produto.marca || '').toLowerCase();
  const preco = Number(produto.preco) || Number(produto.preco_tabela) || 0;

  if (preco <= 0) return 0;

  const roleUpper = String(userRole || '').toUpperCase();
  const isAdminOrGerente = ['ADMIN', 'SUPER_ADMIN', 'GERENTE', 'DONO', 'OWNER', 'DIRETOR'].includes(roleUpper);

  // Bypass completo de regras de teto para Administradores, Donos e Gerentes
  if (isAdminOrGerente) {
    return preco; // Permite desconto flexível até o valor total (com checagem de preço de custo se aplicável)
  }

  // 1. Identificar se é acessório, capa, película, cabo, fone ou serviço
  const isAcessorio = 
    tipo === 'ACESSORIO' ||
    categoria.includes('acessorio') || 
    categoria.includes('acessório') || 
    categoria.includes('capa') || 
    categoria.includes('case') ||
    categoria.includes('pelicula') || 
    categoria.includes('película') || 
    categoria.includes('carregador') || 
    categoria.includes('fonte') || 
    categoria.includes('fone') || 
    categoria.includes('cabo') || 
    categoria.includes('servico') || 
    categoria.includes('serviço') ||
    nome.includes('case') ||
    nome.includes('capa') ||
    nome.includes('pelicula') ||
    nome.includes('película') ||
    nome.includes('carregador') ||
    nome.includes('cabo') ||
    nome.includes('fone');

  if (isAcessorio) {
    return preco * 0.15; // 15% de desconto para qualquer acessório, mesmo que mencione Apple/iPhone
  }

  // 2. Identificar se é aparelho celular / smartphone Apple
  const isAparelho = 
    tipo === 'APARELHO' || 
    tipo === 'CELULAR' ||
    categoria.includes('celular') || 
    categoria.includes('smartphone') || 
    categoria.includes('aparelho');

  const isApple = 
    marca.includes('apple') || 
    nome.includes('iphone') || 
    nome.includes('apple') || 
    categoria.includes('ios') || 
    categoria.includes('iphone');

  // Trava 1: Se for estritamente um APARELHO / CELULAR Apple: 0% de desconto
  if (isApple && (isAparelho || !categoria)) {
    return 0;
  }

  // Trava 2: Demais Celulares / Smartphones Android (5% de desconto max)
  if (
    isAparelho ||
    categoria.includes('android') ||
    nome.includes('xiaomi') ||
    nome.includes('samsung') ||
    nome.includes('motorola') ||
    nome.includes('realme') ||
    nome.includes('infinix')
  ) {
    return preco * 0.05; // 5%
  }

  // Padrão para outros itens: 15% de desconto
  return preco * 0.15;
};

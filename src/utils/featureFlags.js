/**
 * Matriz de Recursos por Plano SaaS (Zênite OS)
 */
export const PLAN_FEATURES = {
  START: [
    'pdv',
    'clientes',
    'estoque',
    'ranking'
  ],
  PRO: [
    'pdv',
    'clientes',
    'estoque',
    'ranking',
    'troca_celular',
    'relatorios_avancados'
  ],
  ULTIMATE: [
    'pdv',
    'clientes',
    'estoque',
    'ranking',
    'troca_celular',
    'relatorios_avancados',
    'emitir_nfe',
    'configuracoes_fiscais'
  ]
};

/**
 * Função auxiliar para verificar se uma funcionalidade específica é permitida para a empresa logada.
 * 
 * @param {Object} company Objeto da empresa vindo da tabela public.companies
 * @param {string} featureName Nome do recurso/módulo (ex: 'emitir_nfe', 'troca_celular')
 * @returns {boolean} true se a funcionalidade é permitida, false caso contrário
 */
export const hasFeature = (company, featureName) => {
  if (!company) return false;

  // Se a assinatura estiver fisicamente bloqueada por inadimplência, nenhum recurso é liberado
  if (company.status_assinatura === 'BLOQUEADO' || company.status === 'INATIVO') {
    return false;
  }

  // Se a empresa for MASTER (Super Admin), libera tudo
  if (company.id === 'MASTER') {
    return true;
  }

  const plano = (company.plano || 'START').toUpperCase();
  const allowedFeatures = PLAN_FEATURES[plano] || PLAN_FEATURES.START;

  return allowedFeatures.includes(featureName);
};

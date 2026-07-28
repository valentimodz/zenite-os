/**
 * Zênite OS - Serviços Fiscais e Emissão de Notas
 * 
 * Este arquivo serve como um módulo isolado para integrações futuras com 
 * APIs de prefeituras, Sefaz ou gateways de nota fiscal (como Focus NFe, eNotas, etc).
 */

/**
 * Função simulada (Stub) para emissão de Nota Fiscal de Serviço Eletrônica (NFS-e).
 * 
 * @param {Object} empresaDados Dados da empresa (CNPJ, Razão Social, etc)
 * @param {Object} faturaDados Dados da fatura (Valor, Mês de Referência, etc)
 * @returns {Promise<Object>} Resposta simulada da API de integração
 */
export const emitirNfseStub = async (empresaDados, faturaDados) => {
  console.log('🔄 [FISCAL] Preparando emissão de NFS-e...');
  console.log('📄 Empresa Destinatária:', empresaDados.nome);
  console.log('🏢 CNPJ (Simulado):', empresaDados.id); // Usando ID como fallback no console
  console.log('💰 Valor do Serviço:', `R$ ${parseFloat(faturaDados.valor || 0).toFixed(2)}`);
  console.log('📅 Mês de Referência:', faturaDados.mes_referencia);

  // Simula o delay de requisição para um webhook externo
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log('✅ [FISCAL] NFS-e gerada com sucesso! (Modo Simulado)');
      resolve({
        sucesso: true,
        mensagem: 'Nota Fiscal emitida com sucesso pela Vextron Lab.',
        nfe_id: `NF-${Math.floor(Math.random() * 100000)}`,
        link_pdf: 'https://exemplo.com/nota-fiscal.pdf'
      });
    }, 1500);
  });
};

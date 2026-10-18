import { supabase } from '../supabaseClient';

/**
 * Atualiza os metadados de uma venda após a criação via RPC.
 * Centraliza e valida apenas as colunas suportadas pela tabela 'vendas'.
 */
export async function atualizarVendaAposCriacao({
    vendaId,
    empresaId,
    filialId,
    caixaId,
    item,
    cliente,
    vendedor,
    formaPagamento,
    trainee
}) {
    if (!vendaId) {
        throw new Error('ID da venda não fornecido para atualização.');
    }

    const payload = {
        empresa_id: empresaId,
        filial_id: filialId,
        caixa_id: caixaId || null,
        produto_nome: item?.produto?.nome || item?.nome || 'Produto',
        imei: item?.imei || null,

        // Dados do Cliente
        cliente_id: cliente?.id || null,
        cliente_nome: cliente?.nome || 'Consumidor Final',
        cliente_cpf_cnpj: cliente?.cpfCnpj || null,
        cliente_telefone: cliente?.telefone || null,
        cliente_email: cliente?.email || null,

        // Dados do Vendedor
        vendedor_id: vendedor?.id || null,
        usuario_id: vendedor?.id || null,
        criado_por: vendedor?.id || null,
        vendedor_nome: vendedor?.nome || 'Vendedor',

        // Pagamento
        forma_pagamento: String(formaPagamento || 'DINHEIRO').toUpperCase().trim(),
        metodo_pagamento: String(formaPagamento || 'DINHEIRO').toUpperCase().trim(),

        // Trainee
        trainee_id: trainee?.id || null,
        trainee_nome: trainee?.nome || null,
        teve_participacao_trainee: Boolean(trainee?.id)
    };

    const { data, error } = await supabase
        .from('vendas')
        .update(payload)
        .eq('id', vendaId);

    if (error) {
        console.error('❌ [vendasService.atualizarVendaAposCriacao]:', error);
        throw error;
    }

    return data;
}
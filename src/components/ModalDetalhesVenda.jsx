import React from 'react';
import { X, Receipt, User, Smartphone, Calendar, DollarSign, FileText } from 'lucide-react';

export default function ModalDetalhesVenda({ venda, onClose, onEmitirNfe }) {
    if (!venda) return null;

    // Blindagem e mapeamento para garantir que NUNCA fique vazio e NUNCA renderize um objeto direto
    const clienteNome = (typeof venda.cliente_nome === 'string' && venda.cliente_nome)
        || (typeof venda.cliente === 'string' && venda.cliente)
        || venda.cliente?.nome
        || venda.clientes?.nome
        || 'Cliente não informado';

    const clienteCpf = (typeof venda.cliente_cpf_cnpj === 'string' && venda.cliente_cpf_cnpj)
        || (typeof venda.cpf === 'string' && venda.cpf)
        || (typeof venda.cnpj === 'string' && venda.cnpj)
        || venda.cliente?.cpf_cnpj
        || venda.clientes?.cpf_cnpj
        || 'Não informado';

    const clienteEmail = (typeof venda.cliente_email === 'string' && venda.cliente_email)
        || (typeof venda.email === 'string' && venda.email)
        || venda.cliente?.email
        || venda.clientes?.email
        || 'Não informado';

    const produtoNome = venda.produto_nome || venda.produtos_descricao || venda.descricao_produto || 'Produto não especificado';
    const imeiProduto = venda.imei || venda.imei_novo || venda.numero_imei || 'Sem IMEI';
    const vendedorNome = venda.vendedor_nome || venda.nome_vendedor || 'Vendedor Padrão';
    const filialNome = venda.filial_nome || venda.nome_filial || 'Matriz';
    const metodoPagto = venda.financeira_parceira || venda.metodo_pagamento || venda.forma_pagamento || 'N/A';
    const statusPagto = venda.status_pagamento || venda.status || 'Concluído';

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-[#0A0A0A] border border-[#222] rounded-xl w-full max-w-2xl overflow-hidden animate-fadeIn">

                {/* Cabeçalho */}
                <div className="p-4 border-b border-[#222] flex justify-between items-center bg-[#111]">
                    <h2 className="text-white font-bold flex items-center gap-2">
                        <Receipt className="text-[#6A0DAD]" />
                        Detalhes da Venda #{venda.numero_venda || venda.codigo || (typeof venda.id === 'string' ? venda.id.substring(0, 8) : venda.id)}
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Corpo dos Dados */}
                <div className="p-6 grid grid-cols-2 gap-6 text-sm">

                    <div className="space-y-4">
                        <div>
                            <span className="text-gray-500 font-bold text-xs flex items-center gap-1 mb-1"><User size={14} /> CLIENTE</span>
                            <p className="text-white font-medium">{clienteNome}</p>
                            <p className="text-gray-400 text-xs">CPF/CNPJ: {clienteCpf}</p>
                            <p className="text-gray-400 text-xs">E-mail: {clienteEmail}</p>
                        </div>

                        <div>
                            <span className="text-gray-500 font-bold text-xs flex items-center gap-1 mb-1"><Smartphone size={14} /> PRODUTO VENDIDO</span>
                            <p className="text-white font-medium">{produtoNome}</p>
                            <p className="text-gray-400 text-xs">IMEI: {imeiProduto}</p>
                            <p className="text-gray-400 text-xs">Vendedor: {vendedorNome}</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <span className="text-gray-500 font-bold text-xs flex items-center gap-1 mb-1"><Calendar size={14} /> DADOS DA VENDA</span>
                            <p className="text-gray-300">Data: {venda.created_at ? new Date(venda.created_at).toLocaleString('pt-BR') : 'Data não informada'}</p>
                            <p className="text-gray-300">Filial: {filialNome}</p>
                        </div>

                        <div className="bg-[#111] border border-[#222] p-3 rounded-lg">
                            <span className="text-gray-500 font-bold text-xs flex items-center gap-1 mb-2"><DollarSign size={14} /> FINANCEIRO</span>
                            <div className="flex justify-between text-gray-300 mb-1">
                                <span>Método:</span>
                                <span className="font-bold text-white uppercase">{metodoPagto}</span>
                            </div>
                            <div className="flex justify-between text-gray-300 mb-1">
                                <span>Status:</span>
                                <span className="text-emerald-400 font-bold">{statusPagto}</span>
                            </div>
                            <div className="flex justify-between items-center mt-3 pt-2 border-t border-[#222]">
                                <span>Total Pago:</span>
                                <span className="text-lg font-bold text-emerald-400">
                                    {Number(venda.valor_pago || venda.valor_total || venda.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Rodapé e Botão de Nota Fiscal */}
                <div className="p-4 bg-[#111] border-t border-[#222] flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 rounded text-gray-400 hover:bg-[#222] transition-colors font-bold text-sm">
                        Fechar
                    </button>

                    <button
                        onClick={() => onEmitirNfe(venda)}
                        className="px-4 py-2 rounded bg-[#6A0DAD] hover:bg-purple-700 text-white font-bold text-sm flex items-center gap-2 transition-colors shadow-lg shadow-purple-900/20"
                    >
                        <FileText size={16} />
                        Gerar Nota Fiscal (NF-e)
                    </button>
                </div>

            </div>
        </div>
    );
}
import React from 'react';
import { X, Receipt, User, Smartphone, Calendar, DollarSign, FileText } from 'lucide-react';

export default function ModalDetalhesVenda({ venda, onClose, onEmitirNfe }) {
    if (!venda) return null;

    // Blindagem e mapeamento para garantir que NUNCA fique vazio e NUNCA renderize um objeto direto
    const clienteNome = (typeof venda.cliente_nome === 'string' && venda.cliente_nome.trim() && venda.cliente_nome.trim().toUpperCase() !== 'CONSUMIDOR FINAL' ? venda.cliente_nome.trim() : null)
        || (typeof venda.cliente?.nome === 'string' && venda.cliente.nome.trim() ? venda.cliente.nome.trim() : null)
        || (typeof venda.clientes?.nome === 'string' && venda.clientes.nome.trim() ? venda.clientes.nome.trim() : null)
        || (typeof venda.cliente === 'string' && venda.cliente.trim() && venda.cliente.trim().toUpperCase() !== 'CONSUMIDOR FINAL' ? venda.cliente.trim() : null)
        || (typeof venda.nome_cliente === 'string' && venda.nome_cliente.trim() ? venda.nome_cliente.trim() : null)
        || venda.cliente_nome
        || 'CONSUMIDOR FINAL';

    const clienteCpf = (typeof venda.cliente_cpf_cnpj === 'string' && venda.cliente_cpf_cnpj.trim() ? venda.cliente_cpf_cnpj.trim() : null)
        || (typeof venda.cliente?.cpf_cnpj === 'string' && venda.cliente.cpf_cnpj.trim() ? venda.cliente.cpf_cnpj.trim() : null)
        || (typeof venda.clientes?.cpf_cnpj === 'string' && venda.clientes.cpf_cnpj.trim() ? venda.clientes.cpf_cnpj.trim() : null)
        || (typeof venda.cliente_cpf === 'string' && venda.cliente_cpf.trim() ? venda.cliente_cpf.trim() : null)
        || (typeof venda.cliente?.cpf === 'string' && venda.cliente.cpf.trim() ? venda.cliente.cpf.trim() : null)
        || (typeof venda.clientes?.cpf === 'string' && venda.clientes.cpf.trim() ? venda.clientes.cpf.trim() : null)
        || (typeof venda.cpf === 'string' && venda.cpf.trim() ? venda.cpf.trim() : null)
        || (typeof venda.cnpj === 'string' && venda.cnpj.trim() ? venda.cnpj.trim() : null)
        || '';

    const clienteTelefone = (typeof venda.cliente_telefone === 'string' && venda.cliente_telefone.trim() ? venda.cliente_telefone.trim() : null)
        || (typeof venda.cliente?.telefone === 'string' && venda.cliente.telefone.trim() ? venda.cliente.telefone.trim() : null)
        || (typeof venda.clientes?.telefone === 'string' && venda.clientes.telefone.trim() ? venda.clientes.telefone.trim() : null)
        || (typeof venda.telefone === 'string' && venda.telefone.trim() ? venda.telefone.trim() : null)
        || (typeof venda.telefone_cliente === 'string' && venda.telefone_cliente.trim() ? venda.telefone_cliente.trim() : null)
        || '';

    const clienteEmail = (typeof venda.cliente_email === 'string' && venda.cliente_email.trim() ? venda.cliente_email.trim() : null)
        || (typeof venda.cliente?.email === 'string' && venda.cliente.email.trim() ? venda.cliente.email.trim() : null)
        || (typeof venda.clientes?.email === 'string' && venda.clientes.email.trim() ? venda.clientes.email.trim() : null)
        || (typeof venda.email === 'string' && venda.email.trim() ? venda.email.trim() : null)
        || (typeof venda.email_cliente === 'string' && venda.email_cliente.trim() ? venda.email_cliente.trim() : null)
        || '';

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
                            {Boolean(clienteCpf) && <p className="text-gray-400 text-xs">CPF/CNPJ: {clienteCpf}</p>}
                            {Boolean(clienteTelefone) && <p className="text-gray-400 text-xs">Telefone: {clienteTelefone}</p>}
                            {Boolean(clienteEmail) && <p className="text-gray-400 text-xs">E-mail: {clienteEmail}</p>}
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
                            {(() => {
                                const pags = (Array.isArray(venda.pagamentos) && venda.pagamentos.length > 0)
                                    ? venda.pagamentos
                                    : (Array.isArray(venda.vendas_pagamentos) && venda.vendas_pagamentos.length > 0 ? venda.vendas_pagamentos : []);
                                if (pags.length > 1) {
                                    return (
                                        <div className="my-2 pt-2 border-t border-[#222] space-y-1">
                                            <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider block">Discriminação:</span>
                                            {pags.map((p, idx) => {
                                                const forma = p.forma || p.metodo || p.metodo_pagamento || 'PAGAMENTO';
                                                const val = Number(p.valor || p.valor_pago || 0);
                                                return (
                                                    <div key={idx} className="flex justify-between text-xs text-gray-400">
                                                        <span>• {String(forma).toUpperCase()}:</span>
                                                        <span className="font-mono text-gray-200">
                                                            {val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                }
                                return null;
                            })()}
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
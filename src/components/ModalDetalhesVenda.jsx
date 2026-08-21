import React from 'react';
import { X, Receipt, User, Smartphone, Calendar, DollarSign, FileText } from 'lucide-react';

export default function ModalDetalhesVenda({ venda, onClose, onEmitirNfe }) {
    if (!venda) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-[#0A0A0A] border border-[#222] rounded-xl w-full max-w-2xl overflow-hidden animate-fadeIn">

                {/* Cabeçalho */}
                <div className="p-4 border-b border-[#222] flex justify-between items-center bg-[#111]">
                    <h2 className="text-white font-bold flex items-center gap-2">
                        <Receipt className="text-[#6A0DAD]" />
                        Detalhes da Transação #{venda.id?.substring(0, 8)}
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
                            <p className="text-white font-medium">{venda.cliente_nome}</p>
                            <p className="text-gray-400 text-xs">CPF/CNPJ: {venda.cliente_cpf_cnpj || 'Não informado'}</p>
                            <p className="text-gray-400 text-xs">E-mail: {venda.cliente_email || 'Não informado'}</p>
                        </div>

                        <div>
                            <span className="text-gray-500 font-bold text-xs flex items-center gap-1 mb-1"><Smartphone size={14} /> PRODUTO VENDIDO</span>
                            <p className="text-white font-medium">{venda.produto_nome || venda.produtos_descricao}</p>
                            <p className="text-gray-400 text-xs">IMEI: {venda.imei || venda.imei_novo || 'Sem IMEI'}</p>
                            <p className="text-gray-400 text-xs">Vendedor: {venda.vendedor_nome}</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <span className="text-gray-500 font-bold text-xs flex items-center gap-1 mb-1"><Calendar size={14} /> DADOS DA VENDA</span>
                            <p className="text-gray-300">Data: {new Date(venda.created_at).toLocaleString('pt-BR')}</p>
                            <p className="text-gray-300">Filial: {venda.filial_nome || 'Matriz'}</p>
                        </div>

                        <div className="bg-[#111] border border-[#222] p-3 rounded-lg">
                            <span className="text-gray-500 font-bold text-xs flex items-center gap-1 mb-2"><DollarSign size={14} /> FINANCEIRO</span>
                            <div className="flex justify-between text-gray-300 mb-1">
                                <span>Método:</span>
                                <span className="font-bold text-white uppercase">{venda.financeira_parceira || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between text-gray-300 mb-1">
                                <span>Status:</span>
                                <span className="text-emerald-400 font-bold">{venda.status_pagamento}</span>
                            </div>
                            <div className="flex justify-between items-center mt-3 pt-2 border-t border-[#222]">
                                <span>Total Pago:</span>
                                <span className="text-lg font-bold text-emerald-400">
                                    {Number(venda.valor_pago || venda.valor_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
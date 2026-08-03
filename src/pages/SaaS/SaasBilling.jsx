import React from 'react';
import { CreditCard, Receipt, Calendar } from 'lucide-react';

export default function SaasBilling() {
  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0C001C] to-black border border-[#6A0DAD]/30 p-8 rounded-2xl shadow-2xl">
        <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-3">
          <CreditCard className="text-[#6A0DAD]" size={32} />
          Gestão de Faturas & Planos SaaS
        </h1>
        <p className="text-gray-400 text-sm mt-2">
          Controle de mensalidades, cobranças recorrentes, planos contratados e histórico financeiro das faturas dos clientes Zênite.
        </p>
      </div>

      {/* Visão de Faturamento */}
      <div className="bg-[#0A0A0A] border border-[#222222] rounded-2xl p-6 shadow-xl">
        <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-[#222222] pb-4 mb-4">
          <Receipt size={20} className="text-[#6A0DAD]" />
          Mensalidades & Assinaturas Emitidas
        </h2>
        <p className="text-xs text-gray-500">
          Acompanhamento centralizado de recebimentos de mensalidades SaaS das lojas clientes.
        </p>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { Award, Calendar } from 'lucide-react';

const RankingVendedores = ({
  colaboradores = [],
  vendas = [],
  filiais = [],
  filtroMes: externalFiltroMes,
  setFiltroMes: externalSetFiltroMes
}) => {
  const [internalFiltroMes, setInternalFiltroMes] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });

  const filtroMes = externalFiltroMes !== undefined ? externalFiltroMes : internalFiltroMes;
  const setFiltroMes = externalSetFiltroMes || setInternalFiltroMes;

  // Filtrar vendas do mês selecionado
  const mesSales = (vendas || []).filter(sale => {
    const rawDate = sale.created_at || sale.data;
    if (!rawDate) return false;
    const saleDate = new Date(rawDate);
    if (isNaN(saleDate.getTime())) return false;
    const [year, month] = (filtroMes || '').split('-');
    if (!year || !month) return true;
    return (
      saleDate.getMonth() === parseInt(month, 10) - 1 &&
      saleDate.getFullYear() === parseInt(year, 10)
    );
  });

  // Métricas consolidadas do time
  const volumeTotal = mesSales.reduce((acc, s) => acc + parseFloat(s.valor_total || s.total || s.valor || 0), 0);
  const comissoesTotal = mesSales.reduce((acc, s) => acc + parseFloat(s.comissao || 0) + parseFloat(s.comissao_trainee || 0), 0);

  // Lista de colaboradores considerados para o ranking (vendedores, trainees, etc.)
  const listaColaboradores = (colaboradores || []).filter(c => {
    if (!c) return false;
    const role = (c.role || c.cargo || '').toUpperCase();
    const isTrainee = c.is_treinner || c.is_trainee || role === 'TRAINEE' || role === 'TREENER';
    const isVendedor = role === 'VENDEDOR' || role === 'OPERADOR' || role === 'GERENTE';
    return isVendedor || isTrainee || !role;
  });

  // Fallback caso o filtro de roles exclua todos os colaboradores passados
  const colabsToUse = listaColaboradores.length > 0 ? listaColaboradores : colaboradores;

  // Cálculo individual do Leaderboard
  const rankingData = colabsToUse.map(colab => {
    const vendasDoColaborador = mesSales.filter(sale => {
      return (
        sale.vendedor_id === colab.id ||
        sale.treener_id === colab.id ||
        sale.trainee_id === colab.id
      );
    });

    const totalSalesVolume = vendasDoColaborador.reduce(
      (acc, s) => acc + parseFloat(s.valor_total || s.total || s.valor || 0),
      0
    );

    const totalComission = vendasDoColaborador.reduce((acc, v) => {
      let soma = 0;
      if (v.vendedor_id === colab.id) {
        soma += Number(v.comissao || 0);
      }
      if (v.treener_id === colab.id || v.trainee_id === colab.id) {
        soma += Number(v.comissao_trainee || 0);
      }
      return acc + soma;
    }, 0);

    const salesCount = vendasDoColaborador.length;
    const ticketMedio = salesCount > 0 ? totalSalesVolume / salesCount : 0;

    return {
      ...colab,
      totalSalesVolume,
      totalComission,
      salesCount,
      ticketMedio
    };
  }).sort((a, b) => b.totalSalesVolume - a.totalSalesVolume);

  const melhorVendedor = rankingData.length > 0 && rankingData[0].totalSalesVolume > 0 ? rankingData[0] : null;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Painel do Mês */}
      <div className="bg-[#0A0A0A] border border-[#222222] p-6 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Award size={20} className="text-[#6A0DAD]" />
            Ranking Geral de Vendas da Equipe
          </h3>
          <p className="text-xs text-gray-500 mt-1">Classificação em tempo real baseada no volume bruto faturado.</p>
        </div>

        <div className="flex items-center gap-2 bg-black border border-[#222222] p-2 rounded">
          <Calendar size={14} className="text-[#6A0DAD]" />
          <span className="text-xs font-semibold text-gray-400">Filtrar Mês:</span>
          <input
            type="month"
            value={filtroMes}
            onChange={(e) => setFiltroMes(e.target.value)}
            className="bg-black text-white text-xs font-bold focus:outline-none"
          />
        </div>
      </div>

      {/* Métricas do Mês do Gerente */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-[#0A0A0A] border border-[#222222] p-6 rounded-xl">
          <span className="text-xs text-gray-500 uppercase font-bold tracking-wider block">Faturamento Bruto</span>
          <span className="text-2xl font-black text-white mt-2 block font-mono">
            R$ {volumeTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </div>
        <div className="bg-[#0A0A0A] border border-[#222222] p-6 rounded-xl border-l-4 border-l-[#6A0DAD]">
          <span className="text-xs text-gray-500 uppercase font-bold tracking-wider block">Total Comissões Pagas</span>
          <span className="text-2xl font-black text-[#6A0DAD] mt-2 block font-mono">
            R$ {comissoesTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </div>
        <div className="bg-[#0A0A0A] border border-[#222222] p-6 rounded-xl">
          <span className="text-xs text-gray-500 uppercase font-bold tracking-wider block">Transações Efetuadas</span>
          <span className="text-2xl font-black text-white mt-2 block">{mesSales.length} vendas</span>
        </div>
        <div className="bg-[#0A0A0A] border border-[#222222] p-6 rounded-xl border-l-4 border-l-yellow-500">
          <span className="text-xs text-gray-500 uppercase font-bold tracking-wider block">Líder de Vendas 🏆</span>
          <span className="text-sm font-extrabold text-white mt-2 block truncate">
            {melhorVendedor ? `${melhorVendedor.nome} (R$ ${melhorVendedor.totalSalesVolume.toLocaleString('pt-BR', { maximumFractionDigits: 0 })})` : 'Nenhum vendedor'}
          </span>
        </div>
      </div>

      {/* Tabela do Leaderboard */}
      <div className="bg-[#0A0A0A] border border-[#222222] rounded-xl p-6">
        <h4 className="text-sm font-bold text-gray-300 mb-4 uppercase tracking-wider">Classificação de Vendedores</h4>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#222222] text-gray-500 font-bold uppercase tracking-wider">
                <th className="pb-3">Posição</th>
                <th className="pb-3">Vendedor</th>
                <th className="pb-3">Filial</th>
                <th className="pb-3">Perfil</th>
                <th className="pb-3 text-center">Transações</th>
                <th className="pb-3">Volume de Vendas</th>
                <th className="pb-3">Ticket Médio</th>
                <th className="pb-3 text-right">Comissão Acumulada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222222]/60">
              {rankingData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-500 italic">
                    Nenhum dado encontrado para o mês selecionado.
                  </td>
                </tr>
              ) : (
                rankingData.map((v, index) => {
                  const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}º`;
                  const filialObj = (filiais || []).find(f => f.id === v.filial_id) || v.filiais || v.filial;
                  const isTrainee = v.is_treinner || v.is_trainee || (v.role || '').toUpperCase() === 'TRAINEE' || (v.role || '').toUpperCase() === 'TREENER';

                  return (
                    <tr key={v.id || index} className="hover:bg-purple-950/5 transition-colors">
                      <td className="py-4 font-black text-sm text-center sm:text-left pr-4">{medal}</td>
                      <td className="py-4 font-extrabold text-white">{v.nome || 'Colaborador'}</td>
                      <td className="py-4 text-gray-400">
                        {filialObj?.nome || v.filial_nome || 'Sem filial'}
                      </td>
                      <td className="py-4">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold ${isTrainee
                          ? 'bg-yellow-950/20 text-yellow-400 border border-yellow-800/20'
                          : 'bg-green-950/20 text-green-400 border border-green-800/20'
                          }`}>
                          {isTrainee ? 'Trainee' : 'Profissional'}
                        </span>
                      </td>
                      <td className="py-4 text-center font-bold text-gray-300">{v.salesCount}</td>
                      <td className="py-4 font-mono font-bold text-white">
                        R$ {v.totalSalesVolume.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 font-mono font-bold text-blue-400">
                        R$ {v.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 font-mono font-bold text-[#6A0DAD] text-right">
                        R$ {v.totalComission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RankingVendedores;

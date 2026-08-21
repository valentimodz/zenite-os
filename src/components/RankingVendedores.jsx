import React, { useMemo } from 'react';
import { Award } from 'lucide-react';

export default function RankingVendedores({ vendedores, vendas, filiais }) {

  const rankingData = useMemo(() => {
    if (!vendedores || !vendas) return [];

    const data = vendedores.map(colab => {
      // Pega as vendas onde o colaborador foi vendedor ou trainee
      const vendasColab = vendas.filter(v =>
        v.vendedor_id === colab.id ||
        v.usuario_id === colab.id ||
        v.treener_id === colab.id
      );

      const transacoes = vendasColab.length;
      const volume = vendasColab.reduce((acc, v) => acc + Number(v.valor_total || v.valor_vendido || v.valor_pago || 0), 0);

      // A Mágica: Separa a comissão pela função exercida na venda
      const comissaoAcumulada = vendasColab.reduce((acc, v) => {
        let ganho = 0;
        if (v.vendedor_id === colab.id || v.usuario_id === colab.id) {
          ganho += Number(v.comissao || 0);
        }
        if (v.treener_id === colab.id) {
          ganho += Number(v.comissao_trainee || 0);
        }
        return acc + ganho;
      }, 0);

      const ticketMedio = transacoes > 0 ? volume / transacoes : 0;
      const filialObj = filiais?.find(f => f.id === colab.filial_id);

      return {
        ...colab,
        transacoes,
        volume,
        ticketMedio,
        comissaoAcumulada,
        filialNome: filialObj?.nome || 'Rede Cred'
      };
    });

    return data.sort((a, b) => b.comissaoAcumulada - a.comissaoAcumulada);
  }, [vendedores, vendas, filiais]);

  return (
    <div className="bg-black border border-[#222] rounded-xl overflow-hidden shadow-md animate-fadeIn mt-4">
      <div className="p-4 bg-[#0E0E0E] border-b border-[#222] flex items-center justify-between">
        <span className="text-sm font-bold text-gray-300 flex items-center gap-2 uppercase tracking-wider">
          <Award size={18} className="text-[#6A0DAD]" />
          Classificação de Vendedores & Trainees
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#0A0A0A] border-b border-[#222] text-gray-500 font-bold uppercase text-[10px]">
              <th className="py-3 px-4">Posição</th>
              <th className="py-3 px-4">Colaborador</th>
              <th className="py-3 px-4">Filial</th>
              <th className="py-3 px-4">Cargo</th>
              <th className="py-3 px-4 text-center">Transações</th>
              <th className="py-3 px-4 text-right">Volume</th>
              <th className="py-3 px-4 text-right">Ticket Médio</th>
              <th className="py-3 px-4 text-right text-emerald-400">Comissão Acumulada</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1A1A1A]">
            {rankingData.map((colab, idx) => (
              <tr key={colab.id} className="hover:bg-white/5 transition-colors">
                <td className="py-3 px-4 font-mono font-bold text-gray-400">
                  {idx === 0 ? '🥇 1º' : idx === 1 ? '🥈 2º' : idx === 2 ? '🥉 3º' : `${idx + 1}º`}
                </td>
                <td className="py-3 px-4 font-bold text-white uppercase">{colab.nome}</td>
                <td className="py-3 px-4 text-gray-500 text-[11px]">{colab.filialNome}</td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${colab.role === 'TRAINEE' || colab.is_treinner
                      ? 'bg-purple-950/40 text-purple-400 border border-purple-800/40'
                      : 'bg-emerald-950/30 text-emerald-500 border border-emerald-800/30'
                    }`}>
                    {colab.role === 'TRAINEE' || colab.is_treinner ? 'Trainee' : 'Profissional'}
                  </span>
                </td>
                <td className="py-3 px-4 text-center font-mono font-bold text-gray-300">{colab.transacoes}</td>
                <td className="py-3 px-4 text-right font-mono text-gray-300">
                  {colab.volume.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td className="py-3 px-4 text-right font-mono text-blue-400">
                  {colab.ticketMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td className="py-3 px-4 text-right font-mono font-bold text-purple-400">
                  {colab.comissaoAcumulada.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
              </tr>
            ))}

            {rankingData.length === 0 && (
              <tr>
                <td colSpan="8" className="py-8 text-center text-gray-500 italic">
                  Nenhum colaborador encontrado para o ranking.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
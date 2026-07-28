import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { LogOut, DollarSign, TrendingDown, TrendingUp, AlertTriangle, Activity, MapPin } from 'lucide-react';

const CeoDashboard = ({ session, profile }) => {
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchKpis = async () => {
      if (!profile) return;
      if (!profile.empresa_id) {
        setLoading(false);
        setError("Perfil de sócio não vinculado a uma empresa ativa.");
        return;
      }
      
      try {
        setLoading(true);
        // Chama a RPC segura do Supabase (que só funciona se for OWNER)
        const { data, error: rpcError } = await supabase.rpc('get_ceo_financial_kpis', {
          p_empresa_id: profile.empresa_id
        });

        if (rpcError) throw rpcError;
        setKpis(data);
      } catch (err) {
        console.error("Erro ao buscar KPIs do CEO:", err);
        setError("Não foi possível carregar os dados financeiros. " + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchKpis();
  }, [profile]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white gap-4">
        <div className="w-10 h-10 border-4 border-[#6A0DAD] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-gray-500 font-medium">Carregando Painel Executivo...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-4">
        <AlertTriangle size={64} className="text-red-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Erro de Acesso</h1>
        <p className="text-gray-400 mb-6 text-center max-w-md">{error}</p>
        <button onClick={() => window.location.href = '/'} className="px-6 py-2 bg-purple-600 rounded-md font-bold hover:bg-purple-700">Voltar ao Início</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Cabeçalho Executivo */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-[#0A0A0A] border border-[#222222] p-6 rounded-xl">
          <div>
            <h1 className="text-3xl font-black text-white flex items-center gap-3">
              <Activity className="text-purple-500" /> Painel Executivo (CEO)
            </h1>
            <p className="text-gray-400 text-sm mt-1">Visão de alto nível financeiro e ranking de filiais.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden md:block">
              <p className="text-sm font-bold text-white">{profile?.nome}</p>
              <p className="text-xs text-purple-400 font-mono">SÓCIO / PROPRIETÁRIO</p>
            </div>
            <button
              onClick={handleSignOut}
              className="bg-transparent border border-red-900/50 hover:bg-red-900/20 hover:border-red-500 text-red-400 p-3 rounded-lg transition-all"
              title="Sair"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>

        {/* KPIs Principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Faturamento (Apenas para referência) */}
          <div className="bg-gradient-to-br from-[#0C001C] to-black border border-[#222222] p-6 rounded-xl relative overflow-hidden group">
            <div className="absolute right-0 top-0 opacity-5 group-hover:opacity-10 transition-opacity">
              <TrendingUp size={120} className="text-purple-400 -mr-4 -mt-4" />
            </div>
            <span className="text-xs text-gray-500 font-bold tracking-widest uppercase">Faturamento Mês</span>
            <div className="mt-4 text-4xl font-black text-gray-300">
              R$ {kpis?.faturamento_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0,00'}
            </div>
          </div>

          {/* Despesas Totais */}
          <div className="bg-gradient-to-br from-[#1A0505] to-black border border-[#331111] p-6 rounded-xl relative overflow-hidden group">
            <div className="absolute right-0 top-0 opacity-5 group-hover:opacity-10 transition-opacity">
              <TrendingDown size={120} className="text-red-500 -mr-4 -mt-4" />
            </div>
            <span className="text-xs text-red-500/70 font-bold tracking-widest uppercase">Despesas (Custos + Comissões)</span>
            <div className="mt-4 text-4xl font-black text-red-400">
              R$ {kpis?.despesas_totais?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0,00'}
            </div>
          </div>

          {/* Lucro Bruto */}
          <div className="bg-gradient-to-br from-[#001C0C] to-black border border-[#003311] p-6 rounded-xl relative overflow-hidden group">
            <div className="absolute right-0 top-0 opacity-5 group-hover:opacity-10 transition-opacity">
              <DollarSign size={120} className="text-green-500 -mr-4 -mt-4" />
            </div>
            <span className="text-xs text-green-500/70 font-bold tracking-widest uppercase">Lucro Bruto Mês</span>
            <div className="mt-4 text-4xl font-black text-green-400">
              R$ {kpis?.lucro_bruto?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0,00'}
            </div>
          </div>
        </div>

        {/* Ranking de Filiais */}
        <div className="bg-[#0A0A0A] border border-[#222222] rounded-xl overflow-hidden">
          <div className="p-6 border-b border-[#222222] bg-gradient-to-r from-black to-[#0A0A0A]">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <MapPin className="text-purple-500" size={20} />
              Ranking de Faturamento por Filial (Lojas)
            </h3>
          </div>
          <div className="p-0">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#111] text-gray-500 text-xs uppercase tracking-wider">
                  <th className="p-4 font-semibold">Posição</th>
                  <th className="p-4 font-semibold">Nome da Loja</th>
                  <th className="p-4 font-semibold text-right">Faturamento Bruto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222222]">
                {kpis?.ranking_filiais?.length > 0 ? (
                  kpis.ranking_filiais.map((filial, index) => (
                    <tr key={index} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 text-gray-400 font-mono">#{index + 1}</td>
                      <td className="p-4 font-bold text-white">{filial.filial_nome}</td>
                      <td className="p-4 text-right font-mono text-purple-400">
                        R$ {filial.faturamento?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="3" className="p-8 text-center text-gray-600 italic">
                      Nenhum faturamento registado nas filiais neste mês.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CeoDashboard;

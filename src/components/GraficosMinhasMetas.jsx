import React, { useState } from 'react';
import { TrendingUp, PieChart, Calendar, DollarSign, Sparkles, Award } from 'lucide-react';

export default function GraficosMinhasMetas({ metasInfo }) {
  const [hoveredDia, setHoveredDia] = useState(null);

  if (!metasInfo) return null;

  const {
    evolucaoDiaria = [],
    totalVendasGeral = 0,
    totalBoletos = 0,
    totalAcessorios = 0,
    totalAVista = 0,
    mesReferencia = ''
  } = metasInfo;

  // Cálculos para o Gráfico 1: Evolução Diária
  const maxFaturamentoDia = Math.max(...evolucaoDiaria.map(d => d.total), 100);
  const diasComVendas = evolucaoDiaria.filter(d => d.total > 0).length;
  const mediaDiaria = diasComVendas > 0 ? totalVendasGeral / diasComVendas : 0;
  const melhorDia = evolucaoDiaria.reduce((max, d) => d.total > max.total ? d : max, { dia: '-', total: 0 });

  // Cálculos para o Gráfico 2: Donut de Composição
  const somaCategorias = (totalBoletos + totalAcessorios + totalAVista) || 1;
  const pctBoleto = Math.round((totalBoletos / somaCategorias) * 100);
  const pctAcessorios = Math.round((totalAcessorios / somaCategorias) * 100);
  const pctAVista = Math.max(0, 100 - pctBoleto - pctAcessorios);

  // SVG Donut calculation
  const radius = 38;
  const circumference = 2 * Math.PI * radius; // ~238.76
  const dashBoleto = (pctBoleto / 100) * circumference;
  const dashAcessorios = (pctAcessorios / 100) * circumference;
  const dashAVista = (pctAVista / 100) * circumference;

  const offsetBoleto = 0;
  const offsetAcessorios = -dashBoleto;
  const offsetAVista = -(dashBoleto + dashAcessorios);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* GRÁFICO 1: EVOLUÇÃO DIÁRIA DE FATURAMENTO (2 colunas) */}
      <div className="lg:col-span-2 bg-[#0A0A0A] border border-[#222222] hover:border-[#6A0DAD]/30 rounded-xl p-5 space-y-4 shadow-xl shadow-purple-950/10 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1A1A1A] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#6A0DAD]/15 text-[#A78BFA] flex items-center justify-center border border-[#6A0DAD]/30">
              <TrendingUp size={16} />
            </div>
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
                Evolução Diária de Faturamento no Mês
              </h4>
              <span className="text-[10px] text-gray-500">
                Faturamento diário de {mesReferencia} (Dias 1 a {evolucaoDiaria.length})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-[11px]">
            <div className="bg-[#111] px-2.5 py-1 rounded-md border border-[#222] flex items-center gap-1.5">
              <span className="text-gray-500 text-[9px] uppercase font-bold">Melhor Dia:</span>
              <span className="text-emerald-400 font-bold font-mono">
                {melhorDia.total > 0 ? `Dia ${melhorDia.dia} (R$ ${melhorDia.total.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })})` : '—'}
              </span>
            </div>
            <div className="bg-[#111] px-2.5 py-1 rounded-md border border-[#222] flex items-center gap-1.5">
              <span className="text-gray-500 text-[9px] uppercase font-bold">Média:</span>
              <span className="text-purple-300 font-bold font-mono">
                R$ {mediaDiaria.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        </div>

        {/* ÁREA SVG DAS BARRAS */}
        <div className="relative pt-3 pb-2">
          {hoveredDia && (
            <div className="absolute top-0 right-2 bg-purple-950/90 border border-purple-600/50 px-2.5 py-1 rounded text-[11px] font-bold text-white shadow-lg animate-fadeIn flex items-center gap-1.5 z-10 font-mono">
              <span className="text-purple-300 font-normal">Dia {hoveredDia.dia}:</span>
              <span>R$ {hoveredDia.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
          )}

          <div className="h-44 w-full flex items-end gap-1 sm:gap-1.5 px-1 border-b border-[#222222]/80 pb-1">
            {evolucaoDiaria.map((d) => {
              const alturaPct = maxFaturamentoDia > 0 ? Math.max(4, Math.round((d.total / maxFaturamentoDia) * 100)) : 4;
              const hasVenda = d.total > 0;
              const isMelhor = d.dia === melhorDia.dia && d.total > 0;

              return (
                <div
                  key={d.dia}
                  className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer"
                  onMouseEnter={() => setHoveredDia(d)}
                  onMouseLeave={() => setHoveredDia(null)}
                >
                  <div
                    className={`w-full rounded-t-sm transition-all duration-300 ${
                      isMelhor
                        ? 'bg-gradient-to-t from-[#6A0DAD] via-[#A78BFA] to-emerald-400 shadow-[0_0_10px_#34d399]'
                        : hasVenda
                        ? 'bg-gradient-to-t from-purple-950 via-[#6A0DAD] to-[#A78BFA] group-hover:from-[#6A0DAD] group-hover:to-pink-400 shadow-[0_0_6px_rgba(168,85,247,0.3)]'
                        : 'bg-[#181818] group-hover:bg-[#252525]'
                    }`}
                    style={{ height: `${alturaPct}%` }}
                  />
                </div>
              );
            })}
          </div>

          {/* EIXO X (Legendas dos Dias) */}
          <div className="flex justify-between text-[9px] font-bold text-gray-500 font-mono mt-1.5 px-1">
            <span>Dia 1</span>
            <span>Dia 5</span>
            <span>Dia 10</span>
            <span>Dia 15</span>
            <span>Dia 20</span>
            <span>Dia 25</span>
            <span>Dia {evolucaoDiaria.length}</span>
          </div>
        </div>
      </div>

      {/* GRÁFICO 2: COMPOSIÇÃO DAS VENDAS (Donut) */}
      <div className="bg-[#0A0A0A] border border-[#222222] hover:border-[#6A0DAD]/30 rounded-xl p-5 space-y-4 shadow-xl shadow-purple-950/10 flex flex-col justify-between transition-colors">
        <div className="flex items-center gap-2.5 border-b border-[#1A1A1A] pb-3">
          <div className="w-8 h-8 rounded-lg bg-pink-950/30 text-pink-400 flex items-center justify-center border border-pink-800/30">
            <PieChart size={16} />
          </div>
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-white">
              Composição das Vendas
            </h4>
            <span className="text-[10px] text-gray-500">Mix de faturamento no período</span>
          </div>
        </div>

        {/* DONUT SVG CENTRAL */}
        <div className="relative flex items-center justify-center py-2">
          <svg className="w-36 h-36 -rotate-90 transform" viewBox="0 0 100 100">
            {/* Círculo de fundo */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              className="text-[#141414]"
              strokeWidth="11"
              stroke="currentColor"
              fill="transparent"
            />
            {/* Segmento Boletos (Âmbar) */}
            {totalBoletos > 0 && (
              <circle
                cx="50"
                cy="50"
                r={radius}
                stroke="#F59E0B"
                strokeWidth="11"
                strokeDasharray={`${dashBoleto} ${circumference}`}
                strokeDashoffset={offsetBoleto}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-700"
              />
            )}
            {/* Segmento Acessórios (Rosa) */}
            {totalAcessorios > 0 && (
              <circle
                cx="50"
                cy="50"
                r={radius}
                stroke="#EC4899"
                strokeWidth="11"
                strokeDasharray={`${dashAcessorios} ${circumference}`}
                strokeDashoffset={offsetAcessorios}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-700"
              />
            )}
            {/* Segmento À Vista / Outros (Ciano) */}
            {totalAVista > 0 && (
              <circle
                cx="50"
                cy="50"
                r={radius}
                stroke="#06B6D4"
                strokeWidth="11"
                strokeDasharray={`${dashAVista} ${circumference}`}
                strokeDashoffset={offsetAVista}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-700"
              />
            )}
          </svg>

          {/* TEXTO DENTRO DO DONUT */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <span className="text-[9px] uppercase font-bold text-gray-400 tracking-wider">Total</span>
            <span className="text-sm font-black text-white font-mono leading-tight">
              R$ {totalVendasGeral.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
            <span className="text-[8px] text-[#A78BFA] font-bold">100% Realizado</span>
          </div>
        </div>

        {/* LEGENDAS COM DETALHES */}
        <div className="space-y-2 pt-2 border-t border-[#1A1A1A] text-xs">
          {/* Boletos */}
          <div className="flex items-center justify-between bg-[#111111] p-2 rounded-lg border border-[#222222]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B] shadow-[0_0_6px_#F59E0B]"></span>
              <span className="text-gray-300 font-semibold text-[11px]">Boletos / Crediário</span>
            </div>
            <div className="text-right font-mono">
              <span className="text-white font-bold text-[11px]">
                R$ {totalBoletos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-amber-400 text-[10px] ml-1.5 font-bold">({pctBoleto}%)</span>
            </div>
          </div>

          {/* Acessórios */}
          <div className="flex items-center justify-between bg-[#111111] p-2 rounded-lg border border-[#222222]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#EC4899] shadow-[0_0_6px_#EC4899]"></span>
              <span className="text-gray-300 font-semibold text-[11px]">Acessórios</span>
            </div>
            <div className="text-right font-mono">
              <span className="text-white font-bold text-[11px]">
                R$ {totalAcessorios.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-pink-400 text-[10px] ml-1.5 font-bold">({pctAcessorios}%)</span>
            </div>
          </div>

          {/* Vendas à Vista */}
          <div className="flex items-center justify-between bg-[#111111] p-2 rounded-lg border border-[#222222]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#06B6D4] shadow-[0_0_6px_#06B6D4]"></span>
              <span className="text-gray-300 font-semibold text-[11px]">À Vista / Pix / Cartão</span>
            </div>
            <div className="text-right font-mono">
              <span className="text-white font-bold text-[11px]">
                R$ {totalAVista.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-cyan-400 text-[10px] ml-1.5 font-bold">({pctAVista}%)</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}

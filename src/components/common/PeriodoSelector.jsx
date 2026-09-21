import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  Clock,
  Sparkles,
  SlidersHorizontal,
  CalendarDays,
  X
} from 'lucide-react';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const MESES_CURTOS = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

// Formata data local para YYYY-MM-DD sem shift de UTC
export function formatLocalYMD(date) {
  const d = new Date(date);
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export function formatarPeriodoLabel({ inicio, fim, mesAno, tipo }) {
  if (tipo === 'dia' && inicio) {
    const hojeStr = formatLocalYMD(new Date());
    const [y, m, d] = inicio.split('-');
    if (inicio === hojeStr) return `Hoje (${d}/${m}/${y})`;
    return `${d}/${m}/${y}`;
  }

  if (tipo === 'mes' || (!inicio && mesAno)) {
    const [ano, m] = (mesAno || '').split('-');
    const idx = parseInt(m, 10) - 1;
    if (idx >= 0 && idx < 12) {
      return `${MESES[idx]} de ${ano}`;
    }
  }

  if (inicio && fim) {
    const [y1, m1, d1] = inicio.split('-');
    const [y2, m2, d2] = fim.split('-');

    if (inicio === fim) {
      const hojeStr = formatLocalYMD(new Date());
      if (inicio === hojeStr) return `Hoje (${d1}/${m1}/${y1})`;
      return `${d1}/${m1}/${y1}`;
    }

    const ultimoDia = new Date(parseInt(y1, 10), parseInt(m1, 10), 0).getDate();
    if (y1 === y2 && m1 === m2 && d1 === '01' && parseInt(d2, 10) === ultimoDia) {
      return `${MESES[parseInt(m1, 10) - 1]} de ${y1}`;
    }

    return `${d1}/${m1}/${y1} - ${d2}/${m2}/${y2}`;
  }

  return 'Selecionar Período';
}

export default function PeriodoSelector({
  tipo = 'range', // 'mes' | 'range' | 'dia'
  dataInicio,
  dataFim,
  mesAno,
  onChange,
  className = '',
  align = 'right',
  mostrarAtalhos = true
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState(() => (tipo === 'mes' ? 'mes' : 'range'));

  // Datas de referência para exibição no calendário
  const hoje = useMemo(() => new Date(), []);
  const hojeYMD = useMemo(() => formatLocalYMD(hoje), [hoje]);

  // Ano e Mês de navegação
  const [navAno, setNavAno] = useState(() => {
    if (mesAno) return parseInt(mesAno.split('-')[0], 10);
    if (dataInicio) return parseInt(dataInicio.split('-')[0], 10);
    return hoje.getFullYear();
  });

  const [navMes, setNavMes] = useState(() => {
    if (mesAno) return parseInt(mesAno.split('-')[1], 10) - 1;
    if (dataInicio) return parseInt(dataInicio.split('-')[1], 10) - 1;
    return hoje.getMonth();
  });

  // Estado de seleção temporária para range de dias
  const [tempInicio, setTempInicio] = useState(dataInicio || hojeYMD);
  const [tempFim, setTempFim] = useState(dataFim || hojeYMD);
  const [hoverData, setHoverData] = useState(null);

  const containerRef = useRef(null);

  // Sincronizar quando props externas mudam
  useEffect(() => {
    if (dataInicio) setTempInicio(dataInicio);
    if (dataFim) setTempFim(dataFim);
    if (mesAno) {
      const [a, m] = mesAno.split('-');
      setNavAno(parseInt(a, 10));
      setNavMes(parseInt(m, 10) - 1);
    }
  }, [dataInicio, dataFim, mesAno]);

  // Listener para fechar ao clicar fora ou pressionar ESC
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Disparar seleção final
  const aplicarSelecao = ({ inicio, fim, novoMesAno }) => {
    const finalInicio = inicio || fim;
    const finalFim = fim || inicio;
    const [y, m] = (novoMesAno || finalInicio.slice(0, 7)).split('-');
    const calculatedMesAno = `${y}-${m}`;
    const label = formatarPeriodoLabel({ inicio: finalInicio, fim: finalFim, mesAno: calculatedMesAno, tipo });

    if (typeof onChange === 'function') {
      onChange({
        inicio: finalInicio,
        fim: finalFim,
        mesAno: calculatedMesAno,
        label
      });
    }
    setIsOpen(false);
  };

  // Atalhos Rápidos
  const handleAtalho = (opcao) => {
    const dHoje = new Date();
    let inicio = '';
    let fim = '';
    let mAno = '';

    if (opcao === 'hoje') {
      inicio = formatLocalYMD(dHoje);
      fim = inicio;
      mAno = inicio.slice(0, 7);
    } else if (opcao === 'ontem') {
      const dOntem = new Date(dHoje);
      dOntem.setDate(dHoje.getDate() - 1);
      inicio = formatLocalYMD(dOntem);
      fim = inicio;
      mAno = inicio.slice(0, 7);
    } else if (opcao === 'semana') {
      const d = new Date(dHoje);
      const diaSemana = d.getDay(); // 0 = Domingo, 1 = Segunda
      const diffSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;
      const dSegunda = new Date(d);
      dSegunda.setDate(d.getDate() + diffSegunda);
      inicio = formatLocalYMD(dSegunda);
      fim = formatLocalYMD(dHoje);
      mAno = fim.slice(0, 7);
    } else if (opcao === 'mes_atual') {
      const y = dHoje.getFullYear();
      const m = String(dHoje.getMonth() + 1).padStart(2, '0');
      const ultimo = new Date(y, dHoje.getMonth() + 1, 0).getDate();
      inicio = `${y}-${m}-01`;
      fim = `${y}-${m}-${String(ultimo).padStart(2, '0')}`;
      mAno = `${y}-${m}`;
    } else if (opcao === 'mes_passado') {
      const dPassado = new Date(dHoje.getFullYear(), dHoje.getMonth() - 1, 1);
      const y = dPassado.getFullYear();
      const m = String(dPassado.getMonth() + 1).padStart(2, '0');
      const ultimo = new Date(y, dPassado.getMonth() + 1, 0).getDate();
      inicio = `${y}-${m}-01`;
      fim = `${y}-${m}-${String(ultimo).padStart(2, '0')}`;
      mAno = `${y}-${m}`;
    }

    setTempInicio(inicio);
    setTempFim(fim);
    aplicarSelecao({ inicio, fim, novoMesAno: mAno });
  };

  // Clique em um mês na Visão Mensal
  const handleSelecionarMes = (mesIdx) => {
    const y = navAno;
    const m = String(mesIdx + 1).padStart(2, '0');
    const ultimo = new Date(y, mesIdx + 1, 0).getDate();
    const inicio = `${y}-${m}-01`;
    const fim = `${y}-${m}-${String(ultimo).padStart(2, '0')}`;
    const mAno = `${y}-${m}`;

    setTempInicio(inicio);
    setTempFim(fim);
    aplicarSelecao({ inicio, fim, novoMesAno: mAno });
  };

  // Clique em um dia na Faixa de Dias
  const handleDiaClick = (dataYMD) => {
    if (tipo === 'dia') {
      setTempInicio(dataYMD);
      setTempFim(dataYMD);
      aplicarSelecao({ inicio: dataYMD, fim: dataYMD, novoMesAno: dataYMD.slice(0, 7) });
      return;
    }

    // Se não há início ou já temos ambos início e fim selecionados, recomeça range
    if (!tempInicio || (tempInicio && tempFim && tempInicio !== tempFim)) {
      setTempInicio(dataYMD);
      setTempFim(null);
    } else if (tempInicio && !tempFim) {
      if (dataYMD < tempInicio) {
        setTempFim(tempInicio);
        setTempInicio(dataYMD);
        aplicarSelecao({ inicio: dataYMD, fim: tempInicio, novoMesAno: dataYMD.slice(0, 7) });
      } else {
        setTempFim(dataYMD);
        aplicarSelecao({ inicio: tempInicio, fim: dataYMD, novoMesAno: tempInicio.slice(0, 7) });
      }
    }
  };

  // Gerar dias do mês para a grade do calendário
  const diasDoMes = useMemo(() => {
    const primeiroDiaSemana = new Date(navAno, navMes, 1).getDay();
    const totalDias = new Date(navAno, navMes + 1, 0).getDate();

    const dias = [];
    // Espaços vazios antes do dia 1
    for (let i = 0; i < primeiroDiaSemana; i++) {
      dias.push({ vazio: true, id: `empty-${i}` });
    }
    // Dias do mês
    for (let d = 1; d <= totalDias; d++) {
      const dStr = String(d).padStart(2, '0');
      const mStr = String(navMes + 1).padStart(2, '0');
      const dataStr = `${navAno}-${mStr}-${dStr}`;
      dias.push({
        vazio: false,
        dia: d,
        data: dataStr
      });
    }
    return dias;
  }, [navAno, navMes]);

  // Label do botão
  const labelBotao = useMemo(() => {
    return formatarPeriodoLabel({
      inicio: dataInicio || tempInicio,
      fim: dataFim || tempFim,
      mesAno: mesAno || `${navAno}-${String(navMes + 1).padStart(2, '0')}`,
      tipo
    });
  }, [dataInicio, dataFim, tempInicio, tempFim, mesAno, navAno, navMes, tipo]);

  return (
    <div className={`relative inline-block text-left ${className}`} ref={containerRef}>
      {/* BOTÃO DISPARADOR COM ÍCONE DE CALENDÁRIO, LABEL E CHEVRON */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2.5 bg-zinc-900/90 hover:bg-zinc-800/90 text-zinc-100 hover:text-white border ${
          isOpen ? 'border-purple-500 shadow-[0_0_15px_rgba(147,51,234,0.3)]' : 'border-zinc-800 hover:border-zinc-700'
        } px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none`}
      >
        <div className="w-6 h-6 rounded-lg bg-purple-950/60 border border-purple-800/40 flex items-center justify-center text-purple-400">
          <CalendarIcon size={13} className="text-purple-300" />
        </div>
        <span className="font-mono tracking-tight font-bold">{labelBotao}</span>
        <ChevronDown
          size={14}
          className={`text-zinc-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-purple-400' : ''}`}
        />
      </button>

      {/* POPOVER ESTILIZADO DARK MODERNO */}
      {isOpen && (
        <div
          className={`absolute ${align === 'left' ? 'left-0' : 'right-0'} mt-2 w-[340px] sm:w-[380px] bg-zinc-950/95 border border-zinc-800 rounded-2xl shadow-2xl backdrop-blur-xl z-50 p-4 space-y-3.5 animate-in fade-in zoom-in-95 duration-150`}
        >
          {/* TOPO COM ABAS DE NAVEGAÇÃO E BOTÃO FECHAR */}
          <div className="flex items-center justify-between border-b border-zinc-850 pb-2.5">
            <div className="flex items-center gap-1 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800 text-[11px] font-bold">
              {tipo !== 'dia' && (
                <button
                  type="button"
                  onClick={() => setAbaAtiva('mes')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
                    abaAtiva === 'mes'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <CalendarDays size={13} />
                  Visão Mensal
                </button>
              )}
              <button
                type="button"
                onClick={() => setAbaAtiva('range')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
                  abaAtiva === 'range' || tipo === 'dia'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <SlidersHorizontal size={13} />
                {tipo === 'dia' ? 'Calendário' : 'Faixa de Dias'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              title="Fechar (ESC)"
            >
              <X size={15} />
            </button>
          </div>

          {/* ATALHOS RÁPIDOS */}
          {mostrarAtalhos && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px] font-semibold font-mono scrollbar-none">
              <button
                type="button"
                onClick={() => handleAtalho('hoje')}
                className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-purple-950/40 text-zinc-300 hover:text-purple-300 border border-zinc-800 hover:border-purple-800/40 transition-colors whitespace-nowrap"
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => handleAtalho('ontem')}
                className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-purple-950/40 text-zinc-300 hover:text-purple-300 border border-zinc-800 hover:border-purple-800/40 transition-colors whitespace-nowrap"
              >
                Ontem
              </button>
              <button
                type="button"
                onClick={() => handleAtalho('semana')}
                className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-purple-950/40 text-zinc-300 hover:text-purple-300 border border-zinc-800 hover:border-purple-800/40 transition-colors whitespace-nowrap"
              >
                Esta Semana
              </button>
              <button
                type="button"
                onClick={() => handleAtalho('mes_atual')}
                className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-purple-950/40 text-zinc-300 hover:text-purple-300 border border-zinc-800 hover:border-purple-800/40 transition-colors whitespace-nowrap"
              >
                Mês Atual
              </button>
              <button
                type="button"
                onClick={() => handleAtalho('mes_passado')}
                className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-purple-950/40 text-zinc-300 hover:text-purple-300 border border-zinc-800 hover:border-purple-800/40 transition-colors whitespace-nowrap"
              >
                Mês Passado
              </button>
            </div>
          )}

          {/* ABA 1: VISÃO MENSAL (GRID DE MESES JAN A DEZ) */}
          {abaAtiva === 'mes' && tipo !== 'dia' && (
            <div className="space-y-3">
              {/* Navegação de Ano */}
              <div className="flex items-center justify-between px-1">
                <button
                  type="button"
                  onClick={() => setNavAno(navAno - 1)}
                  className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition-colors"
                  title="Ano Anterior"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-sm font-black font-mono text-white tracking-wider">
                  {navAno}
                </span>
                <button
                  type="button"
                  onClick={() => setNavAno(navAno + 1)}
                  className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition-colors"
                  title="Próximo Ano"
                >
                  <ChevronRight size={14} />
                </button>
              </div>

              {/* Grid de 12 Meses */}
              <div className="grid grid-cols-3 gap-2">
                {MESES_CURTOS.map((mesNome, idx) => {
                  const mFormat = String(idx + 1).padStart(2, '0');
                  const checkMesAno = `${navAno}-${mFormat}`;
                  const isSelecionado = (mesAno === checkMesAno) || (tempInicio && tempInicio.startsWith(checkMesAno));

                  return (
                    <button
                      key={mesNome}
                      type="button"
                      onClick={() => handleSelecionarMes(idx)}
                      className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 border ${
                        isSelecionado
                          ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-900/40'
                          : 'bg-zinc-900/60 hover:bg-zinc-800/80 border-zinc-800 text-zinc-300 hover:text-white hover:border-purple-800/40'
                      }`}
                    >
                      <span>{mesNome}</span>
                      <span className="text-[9px] opacity-60 font-mono font-normal">
                        {MESES[idx]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ABA 2: FAIXA DE DIAS / CALENDÁRIO */}
          {(abaAtiva === 'range' || tipo === 'dia') && (
            <div className="space-y-3">
              {/* Navegação de Mês e Ano */}
              <div className="flex items-center justify-between px-1">
                <button
                  type="button"
                  onClick={() => {
                    if (navMes === 0) {
                      setNavMes(11);
                      setNavAno(navAno - 1);
                    } else {
                      setNavMes(navMes - 1);
                    }
                  }}
                  className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition-colors"
                  title="Mês Anterior"
                >
                  <ChevronLeft size={14} />
                </button>

                <div className="text-center">
                  <span className="text-xs font-extrabold text-white">
                    {MESES[navMes]} {navAno}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (navMes === 11) {
                      setNavMes(0);
                      setNavAno(navAno + 1);
                    } else {
                      setNavMes(navMes + 1);
                    }
                  }}
                  className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition-colors"
                  title="Próximo Mês"
                >
                  <ChevronRight size={14} />
                </button>
              </div>

              {/* Cabeçalho dos Dias da Semana */}
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-zinc-500 font-mono pb-1 border-b border-zinc-850">
                {DIAS_SEMANA.map((d, i) => (
                  <div key={i}>{d}</div>
                ))}
              </div>

              {/* Grade de Dias */}
              <div className="grid grid-cols-7 gap-1">
                {diasDoMes.map((item, index) => {
                  if (item.vazio) {
                    return <div key={item.id} className="h-8" />;
                  }

                  const dataYMD = item.data;
                  const isHoje = dataYMD === hojeYMD;

                  const isInicio = tempInicio === dataYMD;
                  const isFim = tempFim === dataYMD;
                  const isInRange = tempInicio && tempFim && dataYMD > tempInicio && dataYMD < tempFim;
                  const isHoverInRange = tempInicio && !tempFim && hoverData && dataYMD > tempInicio && dataYMD <= hoverData;

                  let classesDia = 'text-zinc-300 hover:bg-zinc-800 hover:text-white';
                  if (isInicio || isFim) {
                    classesDia = 'bg-purple-600 text-white font-black shadow-md shadow-purple-900/40';
                  } else if (isInRange || isHoverInRange) {
                    classesDia = 'bg-purple-600/25 text-purple-200 font-semibold';
                  }

                  return (
                    <button
                      key={dataYMD}
                      type="button"
                      onClick={() => handleDiaClick(dataYMD)}
                      onMouseEnter={() => setHoverData(dataYMD)}
                      onMouseLeave={() => setHoverData(null)}
                      className={`h-8 rounded-lg text-xs font-mono transition-all flex items-center justify-center relative ${classesDia}`}
                    >
                      <span>{item.dia}</span>
                      {isHoje && !isInicio && !isFim && (
                        <span className="w-1 h-1 rounded-full bg-purple-400 absolute bottom-1" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Status do Intervalo e Botão Confirmar */}
              {tipo !== 'dia' && (
                <div className="pt-2 border-t border-zinc-850 flex items-center justify-between text-xs">
                  <div className="text-[11px] text-zinc-400 font-mono">
                    {tempInicio && !tempFim && (
                      <span className="text-purple-300 italic">Selecione a data final...</span>
                    )}
                    {tempInicio && tempFim && (
                      <span>{tempInicio.split('-').reverse().join('/')} a {tempFim.split('-').reverse().join('/')}</span>
                    )}
                  </div>

                  {tempInicio && tempFim && (
                    <button
                      type="button"
                      onClick={() => aplicarSelecao({ inicio: tempInicio, fim: tempFim, novoMesAno: tempInicio.slice(0, 7) })}
                      className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] shadow-sm flex items-center gap-1 transition-colors"
                    >
                      <Check size={13} />
                      Aplicar
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

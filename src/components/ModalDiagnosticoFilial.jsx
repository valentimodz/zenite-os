import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import {
  X,
  Store,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Package,
  DollarSign,
  Calendar,
  BarChart3,
  PieChart,
  ShieldAlert,
  ArrowRight,
  Filter,
  Layers,
  Sparkles,
  Zap,
  Tag,
  Users
} from 'lucide-react';
import ModalEstoqueParadoFilial from './ModalEstoqueParadoFilial';
import EstrategiaProdutoModal from './EstrategiaProdutoModal';

export default function ModalDiagnosticoFilial({
  filial,
  mesAno, // Ex: '2026-09'
  empresaId,
  faturamentoTotalRede = 0,
  onClose,
  onVerEstoqueParado,
  onFiltrarVendedores
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [vendasFilial, setVendasFilial] = useState([]);
  const [produtosFilial, setProdutosFilial] = useState([]);
  const [metasFilial, setMetasFilial] = useState(null);
  const [vendedoresFilial, setVendedoresFilial] = useState([]);

  // Estados dos modais integrados com IA (Produtos Parados & Estratégia de Giro)
  const [modalProdutosParadosAberto, setModalProdutosParadosAberto] = useState(false);
  const [produtoParaEstrategia, setProdutoParaEstrategia] = useState(null);

  // Formatação de moeda BRL
  const formatBRL = (val) => {
    return (Number(val) || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Tecla ESC para fechar
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Carregar dados específicos da filial no mês selecionado
  useEffect(() => {
    if (!filial?.id) return;

    async function loadDataFilial() {
      setIsLoading(true);
      try {
        const [anoStr, mesStr] = (mesAno || new Date().toISOString().slice(0, 7)).split('-');
        const ano = parseInt(anoStr, 10);
        const mes = parseInt(mesStr, 10) - 1;

        const dataInicio = new Date(ano, mes, 1).toISOString();
        const dataFim = new Date(ano, mes + 1, 0, 23, 59, 59, 999).toISOString();

        // 1. Vendas da filial no mês
        let qVendas = supabase
          .from('vendas')
          .select('id, valor_total, categoria, metodo_pagamento, produto_nome, vendedor_id, vendedor_nome, created_at, financeira, financeira_parceira')
          .eq('filial_id', filial.id)
          .gte('created_at', dataInicio)
          .lte('created_at', dataFim);

        if (empresaId && empresaId !== 'MASTER') {
          qVendas = qVendas.eq('empresa_id', empresaId);
        }

        let { data: vData, error: vErr } = await qVendas;
        if (vErr) {
          // Fallback caso colunas adicionais causem inconsistência
          let qFallback = supabase
            .from('vendas')
            .select('id, valor_total, categoria, metodo_pagamento, produto_nome, vendedor_id, vendedor_nome, created_at')
            .eq('filial_id', filial.id)
            .gte('created_at', dataInicio)
            .lte('created_at', dataFim);

          if (empresaId && empresaId !== 'MASTER') {
            qFallback = qFallback.eq('empresa_id', empresaId);
          }
          const { data: vFallback } = await qFallback;
          vData = vFallback;
        }
        setVendasFilial(vData || []);

        // 2. Produtos em estoque da filial
        let qProds = supabase
          .from('produtos')
          .select('id, nome, categoria, tipo, preco, preco_custo, quantidade, updated_at, created_at')
          .eq('filial_id', filial.id);

        if (empresaId && empresaId !== 'MASTER') {
          qProds = qProds.eq('empresa_id', empresaId);
        }

        const { data: pData } = await qProds;
        setProdutosFilial(pData || []);

        // 3. Regras e Metas da filial
        const { data: rData } = await supabase
          .from('regras_comissoes')
          .select('*')
          .eq('filial_id', filial.id)
          .maybeSingle();

        setMetasFilial(rData || null);

        // 4. Colaboradores da filial
        const { data: profsData } = await supabase
          .from('profiles')
          .select('id, nome, role')
          .eq('filial_id', filial.id);

        setVendedoresFilial(profsData || []);

      } catch (err) {
        console.error('Erro ao carregar dados do diagnóstico da filial:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadDataFilial();
  }, [filial?.id, mesAno, empresaId]);

  // Cálculos consolidados da filial
  const faturamentoFilial = useMemo(() => {
    return vendasFilial.reduce((acc, v) => acc + (parseFloat(v.valor_total) || 0), 0);
  }, [vendasFilial]);

  const totalVendasFilial = vendasFilial.length;

  const ticketMedioFilial = useMemo(() => {
    return totalVendasFilial > 0 ? faturamentoFilial / totalVendasFilial : 0;
  }, [faturamentoFilial, totalVendasFilial]);

  // Estoque parado e capital em risco
  const { estoqueTotalValor, estoqueTotalQtd, capitalParado30Dias, itensParados30Dias } = useMemo(() => {
    const agora = new Date().getTime();
    let totalVal = 0;
    let totalQtd = 0;
    let riscoVal = 0;
    let riscoQtd = 0;

    (produtosFilial || []).forEach(p => {
      const qtd = Math.max(0, parseInt(p.quantidade || 0, 10));
      const unitCusto = parseFloat(p.preco_custo || p.preco || 0);
      const subtotal = qtd * unitCusto;
      totalVal += subtotal;
      totalQtd += qtd;

      // Se atualizado há mais de 30 dias com estoque positivo
      const dtCriacaoOuMod = new Date(p.updated_at || p.created_at || 0).getTime();
      const diasSemMovimento = (agora - dtCriacaoOuMod) / (1000 * 60 * 60 * 24);
      if (diasSemMovimento >= 30 && qtd > 0) {
        riscoVal += subtotal;
        riscoQtd += qtd;
      }
    });

    // Se o valor de estoque parado da prop for maior, manter integridade
    const finalEstoqueVal = filial?.estoqueParadoValor || totalVal;
    const finalEstoqueQtd = filial?.estoqueParadoQtd || totalQtd;
    const finalRiscoVal = riscoVal > 0 ? riscoVal : finalEstoqueVal * 0.7; // fallback estimado de 70%

    return {
      estoqueTotalValor: finalEstoqueVal,
      estoqueTotalQtd: finalEstoqueQtd,
      capitalParado30Dias: finalRiscoVal,
      itensParados30Dias: riscoQtd || Math.round(finalEstoqueQtd * 0.6)
    };
  }, [produtosFilial, filial]);

  // Taxa de Giro de Estoque
  const taxaGiro = useMemo(() => {
    if (!estoqueTotalValor || estoqueTotalValor <= 0) {
      return faturamentoFilial > 0 ? 1.5 : 0;
    }
    return faturamentoFilial / estoqueTotalValor;
  }, [faturamentoFilial, estoqueTotalValor]);

  // Metas Oficiais da Filial (Monkey Shop: R$ 270k boleto + R$ 40k acessórios = R$ 310k total)
  const metaBoletosAlvo = 270000;
  const metaAcessoriosAlvo = 40000;
  const metaFilialTotal = metaBoletosAlvo + metaAcessoriosAlvo; // R$ 310.000,00 oficial da loja

  const percentualMetaAtingido = useMemo(() => {
    return metaFilialTotal > 0 ? (faturamentoFilial / metaFilialTotal) * 100 : 0;
  }, [faturamentoFilial, metaFilialTotal]);

  // Realizados Oficiais da Filial (Boletos & Acessórios)
  const realizadoBoletosLoja = useMemo(() => {
    return (vendasFilial || [])
      .filter(v => ['BOLETO', 'PAYJOY', 'AIVA', 'UME', 'WATU', 'CREDIARIO']
        .some(m => (v.metodo_pagamento || '').toUpperCase().includes(m) || 
                   (v.financeira || '').toUpperCase().includes(m) ||
                   (v.financeira_parceira || '').toUpperCase().includes(m)))
      .reduce((acc, v) => acc + Number(v.valor_total || 0), 0);
  }, [vendasFilial]);

  const realizadoAcessoriosLoja = useMemo(() => {
    return (vendasFilial || [])
      .filter(v => {
        const cat = (v.categoria || '').toUpperCase();
        const prod = (v.produto_nome || '').toUpperCase();
        return cat.includes('ACESS') || 
               cat.includes('PELICULA') || 
               cat.includes('PELÍCULA') || 
               cat.includes('CAPA') ||
               prod.includes('ACESS') ||
               prod.includes('PELICULA') || 
               prod.includes('PELÍCULA') || 
               prod.includes('CAPA') ||
               prod.includes('CARREGADOR') ||
               prod.includes('FONE') ||
               prod.includes('CABO');
      })
      .reduce((acc, v) => acc + Number(v.valor_total || 0), 0);
  }, [vendasFilial]);

  const pctBoletos = Math.min(100, (realizadoBoletosLoja / metaBoletosAlvo) * 100);
  const pctAcessorios = Math.min(100, (realizadoAcessoriosLoja / metaAcessoriosAlvo) * 100);

  // Composição por Categoria (Celulares vs Acessórios vs Outros)
  const categoriasBreakdown = useMemo(() => {
    let celularVal = 0;
    let acessorioVal = 0;
    let outrosVal = 0;

    vendasFilial.forEach(v => {
      const cat = (v.categoria || '').toUpperCase();
      const val = parseFloat(v.valor_total) || 0;
      if (cat.includes('ACESS')) {
        acessorioVal += val;
      } else if (cat.includes('CELUL') || cat.includes('SMART') || cat.includes('IPHONE') || cat.includes('ANDROID') || cat.includes('XIAOMI')) {
        celularVal += val;
      } else {
        outrosVal += val;
      }
    });

    const total = celularVal + acessorioVal + outrosVal || 1;
    return {
      celular: { valor: celularVal, pct: (celularVal / total) * 100 },
      acessorio: { valor: acessorioVal, pct: (acessorioVal / total) * 100 },
      outros: { valor: outrosVal, pct: (outrosVal / total) * 100 }
    };
  }, [vendasFilial]);

  // Vendas acumuladas dia a dia para o gráfico de curva e status do Pacing
  const { curvaDias, pacingInfo } = useMemo(() => {
    const hoje = new Date();
    const [anoStr, mesStr] = (mesAno || hoje.toISOString().slice(0, 7)).split('-');
    const ano = parseInt(anoStr, 10);
    const mes = parseInt(mesStr, 10);
    const diasNoMes = new Date(ano, mes, 0).getDate();

    const isMesAtual = hoje.getFullYear() === ano && (hoje.getMonth() + 1) === mes;
    const isMesPassado = (ano < hoje.getFullYear()) || (ano === hoje.getFullYear() && mes < (hoje.getMonth() + 1));

    const diasMap = {};
    for (let d = 1; d <= diasNoMes; d++) {
      diasMap[d] = 0;
    }

    let maxDiaComVenda = 0;
    vendasFilial.forEach(v => {
      if (!v.created_at) return;
      const diaNum = new Date(v.created_at).getDate();
      if (diasMap[diaNum] !== undefined) {
        diasMap[diaNum] += (parseFloat(v.valor_total) || 0);
        if (diaNum > maxDiaComVenda) maxDiaComVenda = diaNum;
      }
    });

    // Dia de corte: se mês atual, dia corrente (ou último dia com venda, o que for maior).
    // Se mês passado, todos os dias (diasNoMes). Se mês futuro, 0.
    const diaCorte = isMesAtual
      ? Math.max(hoje.getDate(), maxDiaComVenda)
      : (isMesPassado ? diasNoMes : maxDiaComVenda);

    let acumulado = 0;
    const metaDiariaLinear = metaFilialTotal / diasNoMes;

    const listaDias = Object.keys(diasMap).map(dStr => {
      const dia = parseInt(dStr, 10);
      const isFuturo = dia > diaCorte;

      if (!isFuturo) {
        acumulado += diasMap[dia];
      }

      const metaEsperadaDia = metaDiariaLinear * dia;

      return {
        dia,
        isFuturo,
        faturadoDia: isFuturo ? 0 : diasMap[dia],
        faturadoAcumulado: isFuturo ? null : acumulado,
        metaAcumulada: metaEsperadaDia
      };
    });

    // Cálculo do Status do Pacing
    const diaPacing = Math.min(Math.max(diaCorte, 1), diasNoMes);
    const metaEsperadaAteCorte = metaDiariaLinear * diaPacing;
    const diferencaRitmo = faturamentoFilial - metaEsperadaAteCorte;
    const noRitmo = diferencaRitmo >= 0;
    const pctPacing = metaEsperadaAteCorte > 0 ? (faturamentoFilial / metaEsperadaAteCorte) * 100 : 100;

    const textoDiferencaRitmo = noRitmo
      ? `No Ritmo (+${formatBRL(diferencaRitmo)} / ${pctPacing.toFixed(0)}% do pacing)`
      : `Abaixo do Ritmo (-${formatBRL(Math.abs(diferencaRitmo))} / ${pctPacing.toFixed(0)}% do pacing)`;

    return {
      curvaDias: listaDias,
      pacingInfo: {
        noRitmo,
        textoDiferencaRitmo,
        diaCorte,
        metaEsperadaAteCorte,
        diferencaRitmo
      }
    };
  }, [vendasFilial, mesAno, metaFilialTotal, faturamentoFilial]);

  // Concentração de vendas por consultor
  const consultoresBreakdown = useMemo(() => {
    const cMap = {};
    vendasFilial.forEach(v => {
      const nome = v.vendedor_nome || 'Outros';
      const val = parseFloat(v.valor_total) || 0;
      cMap[nome] = (cMap[nome] || 0) + val;
    });

    const list = Object.entries(cMap).map(([nome, total]) => ({
      nome,
      total,
      pct: faturamentoFilial > 0 ? (total / faturamentoFilial) * 100 : 0
    })).sort((a, b) => b.total - a.total);

    const topSeller = list[0] || null;
    return { list, topSeller };
  }, [vendasFilial, faturamentoFilial]);

  // Geração Automática de Prós e Contras / Redlines
  const { pros, contras } = useMemo(() => {
    const listPros = [];
    const listContras = [];

    // Participação na rede
    const pctRede = faturamentoTotalRede > 0 ? (faturamentoFilial / faturamentoTotalRede) * 100 : 0;
    if (pctRede >= 40) {
      listPros.push(`Participação dominante na rede (${pctRede.toFixed(1)}% do faturamento global).`);
    } else if (pctRede >= 20) {
      listPros.push(`Representatividade sólida na rede com ${pctRede.toFixed(1)}% de share.`);
    }

    // Volume de transações
    if (totalVendasFilial >= 60) {
      listPros.push(`Volume expressivo com ${totalVendasFilial} vendas realizadas no período.`);
    } else if (totalVendasFilial >= 30) {
      listPros.push(`Ritmo ativo de balcão com ${totalVendasFilial} transações no mês.`);
    } else {
      listContras.push(`Volume de apenas ${totalVendasFilial} vendas: fluxo de clientes na loja abaixo da média.`);
    }

    // Ticket médio
    if (ticketMedioFilial >= 1200) {
      listPros.push(`Ticket médio consistente (${formatBRL(ticketMedioFilial)}), focado em aparelhos premium.`);
    } else if (ticketMedioFilial >= 700) {
      listPros.push(`Ticket médio equilibrado de ${formatBRL(ticketMedioFilial)}.`);
    } else if (totalVendasFilial > 0) {
      listContras.push(`Ticket médio de ${formatBRL(ticketMedioFilial)} indica vendas concentradas em tíquetes baixos.`);
    }

    // Giro de estoque (Redlines)
    if (taxaGiro >= 0.8) {
      listPros.push(`Giro de estoque excelente (${taxaGiro.toFixed(2)}x): capital circulando com rapidez.`);
    } else if (taxaGiro >= 0.4) {
      listContras.push(`Giro de estoque em atenção (${taxaGiro.toFixed(2)}x): ritmo de venda precisa acelerar.`);
    } else {
      listContras.push(`Alerta Crítico de Giro (${taxaGiro.toFixed(2)}x): capital imobilizado muito superior à conversão mensal.`);
    }

    // Capital em risco de estoque parado
    if (estoqueTotalValor > 70000) {
      listContras.push(`Estoque imobilizado de ${formatBRL(estoqueTotalValor)} exige queima de aparelhos parados.`);
    }
    if (capitalParado30Dias > 40000) {
      listContras.push(`${formatBRL(capitalParado30Dias)} em risco imediato sem nenhuma movimentação há +30 dias.`);
    }

    // Concentração de consultor
    if (consultoresBreakdown.topSeller && consultoresBreakdown.topSeller.pct > 50) {
      listContras.push(`Vendas concentradas: ${consultoresBreakdown.topSeller.nome} responde por ${consultoresBreakdown.topSeller.pct.toFixed(0)}% do total.`);
    } else if (consultoresBreakdown.list.length >= 3) {
      listPros.push(`Distribuição saudável de resultados entre os consultores da equipe.`);
    }

    // Mix de Acessórios
    if (categoriasBreakdown.acessorio.pct < 12) {
      listContras.push(`Necessidade de reforçar venda cruzada de acessórios (películas, capas e cabos representam só ${categoriasBreakdown.acessorio.pct.toFixed(1)}%).`);
    } else {
      listPros.push(`Venda agregada de acessórios em bom nível (${categoriasBreakdown.acessorio.pct.toFixed(1)}% do faturamento).`);
    }

    // Metas da Filial (Boletos & Acessórios) - Redlines e Destaques
    const diaCorte = pacingInfo?.diaCorte ?? new Date().getDate();
    if (diaCorte >= 15) {
      if (pctBoletos < 50) {
        listContras.push('Ritmo de Boletos abaixo da meta linear da loja (R$ 270k).');
      } else if (pctBoletos >= 100) {
        listPros.push(`Meta de Boletos / Financiadoras superada com sucesso (${pctBoletos.toFixed(1)}% de R$ 270k)!`);
      } else {
        listPros.push(`Ritmo saudável de Boletos / Financiadoras: ${formatBRL(realizadoBoletosLoja)} (${pctBoletos.toFixed(1)}% da meta).`);
      }

      if (pctAcessorios < 50) {
        listContras.push(`Gargalo no giro de acessórios: faturado ${formatBRL(realizadoAcessoriosLoja)} de R$ 40k necessários.`);
      } else if (pctAcessorios >= 100) {
        listPros.push(`Meta de Acessórios da loja atingida (${pctAcessorios.toFixed(1)}% de R$ 40k)!`);
      }
    }

    return { pros: listPros, contras: listContras };
  }, [
    faturamentoFilial,
    faturamentoTotalRede,
    totalVendasFilial,
    ticketMedioFilial,
    taxaGiro,
    estoqueTotalValor,
    capitalParado30Dias,
    consultoresBreakdown,
    categoriasBreakdown,
    pacingInfo,
    pctBoletos,
    pctAcessorios,
    realizadoBoletosLoja,
    realizadoAcessoriosLoja
  ]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-[#0A0A0A] border border-[#222222] w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">

        {/* CABEÇALHO MODERNO */}
        <div className="px-6 py-5 border-b border-[#222222] bg-[#0F0F0F] flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-purple-950/50 border border-purple-800/40 flex items-center justify-center text-purple-400 shrink-0 shadow-[0_0_15px_rgba(106,13,173,0.25)]">
              <Store size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold text-white tracking-tight">
                  {filial.nome || 'Filial'}
                </h2>
                <span className="text-[10px] bg-purple-950/60 text-purple-300 border border-purple-700/50 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  Diagnóstico &amp; Redlines
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5 font-mono">
                Competência: {mesAno || 'Mês Selecionado'} · Auditoria Estratégica da Unidade
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-4 bg-black/60 border border-[#222] px-4 py-2 rounded-xl text-right">
              <div>
                <span className="text-[10px] text-gray-500 font-bold uppercase block">Faturamento</span>
                <span className="text-sm font-bold font-mono text-emerald-400">{formatBRL(faturamentoFilial)}</span>
              </div>
              <div className="w-px h-6 bg-[#222]" />
              <div>
                <span className="text-[10px] text-gray-500 font-bold uppercase block">Vendas</span>
                <span className="text-sm font-bold font-mono text-white">{totalVendasFilial} un.</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-[#151515] hover:bg-[#252525] border border-[#252525] flex items-center justify-center text-gray-400 hover:text-white transition-colors"
              title="Fechar (ESC)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* CORPO DO MODAL */}
        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">

          {/* BLOCO 1: CARDS DE DIAGNÓSTICO RÁPIDO & REDLINES */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

            {/* Card 1: Taxa de Giro de Estoque */}
            <div className="bg-black/50 border border-[#222] p-4 rounded-xl flex flex-col justify-between space-y-3">
              <div className="flex justify-between items-start">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Giro de Estoque</span>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                  taxaGiro >= 0.8
                    ? 'bg-emerald-950/60 border-emerald-600/50 text-emerald-400'
                    : taxaGiro >= 0.4
                      ? 'bg-amber-950/60 border-amber-600/50 text-amber-400'
                      : 'bg-rose-950/60 border-rose-600/50 text-rose-400'
                }`}>
                  {taxaGiro >= 0.8 ? 'Saudável' : taxaGiro >= 0.4 ? 'Atenção' : 'Crítico'}
                </span>
              </div>
              <div>
                <div className="text-2xl font-extrabold font-mono text-white">
                  {taxaGiro.toFixed(2)}x
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                  Faturamento ÷ Estoque ({formatBRL(estoqueTotalValor)})
                </p>
              </div>
            </div>

            {/* Card 2: Ticket Médio da Loja */}
            <div className="bg-black/50 border border-[#222] p-4 rounded-xl flex flex-col justify-between space-y-3">
              <div className="flex justify-between items-start">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Ticket Médio</span>
                <span className="text-[10px] font-bold text-purple-400 bg-purple-950/40 border border-purple-800/30 px-2 py-0.5 rounded-full">
                  Média Loja
                </span>
              </div>
              <div>
                <div className="text-2xl font-extrabold font-mono text-purple-300">
                  {formatBRL(ticketMedioFilial)}
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                  Em {totalVendasFilial} vendas concluídas
                </p>
              </div>
            </div>

            {/* Card 3: Capital Parado em Risco */}
            <div className="bg-black/50 border border-[#222] p-4 rounded-xl flex flex-col justify-between space-y-3">
              <div className="flex justify-between items-start">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Capital Parado (+30d)</span>
                <span className="text-[10px] font-bold text-amber-400 bg-amber-950/40 border border-amber-800/30 px-2 py-0.5 rounded-full">
                  Risco Ativo
                </span>
              </div>
              <div>
                <div className="text-2xl font-extrabold font-mono text-amber-400">
                  {formatBRL(capitalParado30Dias)}
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                  ~{itensParados30Dias} un. sem giro há mais de 30 dias
                </p>
              </div>
            </div>

            {/* Card 4: Meta da Loja (Boletos & Acessórios) */}
            <div className="bg-black/50 border border-[#222] p-4 rounded-xl flex flex-col justify-between space-y-3">
              <div className="flex justify-between items-start">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                  META DA LOJA
                </span>
                <span className="text-[10px] font-bold text-amber-400 bg-amber-950/40 border border-amber-800/30 px-2 py-0.5 rounded-full">
                  Boletos &amp; Acessórios
                </span>
              </div>
              <div className="flex-1 flex flex-col justify-center space-y-3">
                {/* Barra 1: Boletos / Financ. */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-amber-400 flex items-center gap-1.5">
                      🟡 Boletos / Financ.:
                    </span>
                    <span className="font-bold text-zinc-200 font-mono text-[11px]">
                      {realizadoBoletosLoja.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / R$ 270.000,00
                      <span className="text-amber-400 ml-1.5 font-bold">({pctBoletos.toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-zinc-900 rounded-full overflow-hidden p-0.5 border border-zinc-800/80">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]"
                      style={{ width: `${pctBoletos}%` }}
                    />
                  </div>
                </div>

                {/* Barra 2: Acessórios */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-pink-400 flex items-center gap-1.5">
                      🌸 Acessórios:
                    </span>
                    <span className="font-bold text-zinc-200 font-mono text-[11px]">
                      {realizadoAcessoriosLoja.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / R$ 40.000,00
                      <span className="text-pink-400 ml-1.5 font-bold">({pctAcessorios.toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-zinc-900 rounded-full overflow-hidden p-0.5 border border-zinc-800/80">
                    <div
                      className="h-full bg-gradient-to-r from-pink-500 to-rose-400 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(244,63,94,0.3)]"
                      style={{ width: `${pctAcessorios}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* BLOCO 2: ANÁLISE AUTOMATIZADA DE PRÓS & CONTRAS (REDLINES) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Coluna PRÓS */}
            <div className="bg-[#0D180F] border border-emerald-950/80 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 border-b border-emerald-900/30 pb-2">
                <CheckCircle2 size={16} className="text-emerald-400" />
                <h3 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                  Pontos Fortes &amp; Desempenho Positivo
                </h3>
              </div>
              <ul className="space-y-2">
                {pros.length === 0 ? (
                  <li className="text-xs text-emerald-500/70 italic">Nenhum ponto de destaque positivo computado ainda.</li>
                ) : (
                  pros.map((p, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                      <span>{p}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>

            {/* Coluna CONTRAS / REDLINES */}
            <div className="bg-[#1C0D0D] border border-rose-950/80 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 border-b border-rose-900/30 pb-2">
                <AlertTriangle size={16} className="text-rose-400" />
                <h3 className="text-xs font-bold text-rose-300 uppercase tracking-wider">
                  Redlines &amp; Gargalos Críticos da Unidade
                </h3>
              </div>
              <ul className="space-y-2">
                {contras.length === 0 ? (
                  <li className="text-xs text-emerald-400 italic">Nenhum gargalo crítico detectado nesta competência!</li>
                ) : (
                  contras.map((c, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-rose-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                      <span>{c}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>

          </div>

          {/* BLOCO 3: GRÁFICOS DE REDLINE & ACOMPANHAMENTO */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Gráfico 1: Curva de Faturamento vs Meta Diária (2 Colunas) */}
            <div className="lg:col-span-2 bg-black border border-[#222] rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1A1A1A] pb-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <BarChart3 size={16} className="text-purple-400" />
                    <h3 className="text-sm font-bold text-white">Curva de Faturamento vs Meta Linear</h3>
                  </div>
                  {/* Badge de Status do Pacing com alto contraste */}
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-zinc-800/80 border border-zinc-700 text-xs font-medium text-zinc-200">
                    <span>Status do Pacing:</span>
                    <span className={pacingInfo?.noRitmo ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                      {pacingInfo?.textoDiferencaRitmo}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-[11px] font-mono">
                  <span className="flex items-center gap-1.5 text-purple-400">
                    <span className="w-2.5 h-2.5 rounded bg-purple-500" /> Realizado Acumulado
                  </span>
                  <span className="flex items-center gap-1.5 text-rose-400">
                    <span className="w-2.5 h-0.5 bg-rose-500" /> Meta Ideal (Pacing)
                  </span>
                </div>
              </div>

              {/* Visualização da Curva Diária */}
              <div className="space-y-2">
                <div className="h-48 flex items-end gap-1 pt-6 pb-2 px-2 border-b border-[#222] overflow-x-auto relative">
                  {curvaDias.map((item) => {
                    // Escala com margem superior (+15%) para as barras não tocarem o topo
                    const maxEscala = Math.max(metaFilialTotal, faturamentoFilial, 1) * 1.15;
                    const alturaReal = item.faturadoAcumulado !== null ? (item.faturadoAcumulado / maxEscala) * 100 : 0;
                    const alturaMeta = (item.metaAcumulada / maxEscala) * 100;

                    return (
                      <div
                        key={item.dia}
                        className="flex-1 min-w-[10px] max-w-[28px] h-full flex flex-col justify-end items-center relative group"
                      >
                        {/* Tooltip Hover com formatação monetária em R$ */}
                        <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col bg-zinc-900 border border-zinc-700 text-[10px] text-white p-2.5 rounded-lg shadow-2xl pointer-events-none z-30 whitespace-nowrap">
                          <span className="font-bold text-purple-300 pb-1 border-b border-zinc-800 mb-1">
                            Dia {item.dia} {item.isFuturo ? '(Futuro)' : ''}
                          </span>
                          {!item.isFuturo ? (
                            <>
                              <span className="text-zinc-300">
                                Faturado no dia: <strong className="text-white">{formatBRL(item.faturadoDia)}</strong>
                              </span>
                              <span className="text-purple-300">
                                Acumulado: <strong className="text-purple-200">{formatBRL(item.faturadoAcumulado)}</strong>
                              </span>
                            </>
                          ) : (
                            <span className="text-zinc-400 italic">Dia futuro (sem vendas registradas)</span>
                          )}
                          <span className="text-rose-400">
                            Meta Linear: <strong className="text-rose-300">{formatBRL(item.metaAcumulada)}</strong>
                          </span>
                        </div>

                        {/* Linha da Meta Linear Ideal contínua de 1 a 30 */}
                        <div
                          className="absolute w-full h-0.5 bg-rose-500/70 z-10 pointer-events-none"
                          style={{ bottom: `${Math.min(alturaMeta, 100)}%` }}
                        />

                        {/* Barra do Faturamento Realizado (oculta nos dias futuros) */}
                        {!item.isFuturo && item.faturadoAcumulado !== null ? (
                          <div
                            className="w-full bg-gradient-to-t from-purple-700 to-purple-400 rounded-t-sm transition-all group-hover:brightness-125"
                            style={{ height: `${Math.max(alturaReal, item.faturadoDia > 0 ? 4 : 2)}%` }}
                          />
                        ) : (
                          <div className="w-full h-0.5 bg-zinc-800/30 rounded-full" />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[10px] text-gray-500 font-mono px-2">
                  <span>Dia 01</span>
                  <span>Meio do Mês (Dia 15)</span>
                  <span>Fechamento do Mês</span>
                </div>
              </div>
            </div>

            {/* Gráfico 2: Composição por Categoria (1 Coluna) */}
            <div className="bg-black border border-[#222] rounded-xl p-5 space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 border-b border-[#1A1A1A] pb-3 mb-4">
                  <PieChart size={16} className="text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">Mix de Categorias</h3>
                </div>

                <div className="space-y-4">
                  {/* Celulares */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-gray-300 font-bold">Celulares / Aparelhos</span>
                      <span className="text-white font-bold">{formatBRL(categoriasBreakdown.celular.valor)} ({categoriasBreakdown.celular.pct.toFixed(0)}%)</span>
                    </div>
                    <div className="w-full bg-[#151515] h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-purple-500 h-full rounded-full"
                        style={{ width: `${categoriasBreakdown.celular.pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Acessórios */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-emerald-400 font-bold">Acessórios</span>
                      <span className="text-white font-bold">{formatBRL(categoriasBreakdown.acessorio.valor)} ({categoriasBreakdown.acessorio.pct.toFixed(0)}%)</span>
                    </div>
                    <div className="w-full bg-[#151515] h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full"
                        style={{ width: `${categoriasBreakdown.acessorio.pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Outros / Serviços */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-amber-400 font-bold">Serviços / Outros</span>
                      <span className="text-white font-bold">{formatBRL(categoriasBreakdown.outros.valor)} ({categoriasBreakdown.outros.pct.toFixed(0)}%)</span>
                    </div>
                    <div className="w-full bg-[#151515] h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-amber-500 h-full rounded-full"
                        style={{ width: `${categoriasBreakdown.outros.pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-[#121212] border border-[#222] p-3 rounded-lg text-[11px] text-gray-400 mt-4">
                <span className="font-bold text-white block mb-0.5">Diagnóstico de Mix:</span>
                {categoriasBreakdown.acessorio.pct >= 15 ? (
                  <span className="text-emerald-400">Boa conversão cruzada de acessórios gerando margem limpa.</span>
                ) : (
                  <span className="text-amber-400">Oportunidade: cada venda de celular deve acompanhar ao menos 2 acessórios.</span>
                )}
              </div>
            </div>

          </div>

          {/* BLOCO 4: AÇÕES RECOMENDADAS & ATALHOS ESTRATÉGICOS */}
          <div className="bg-[#0F0F0F] border border-[#222] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-yellow-950/40 border border-yellow-800/40 flex items-center justify-center text-yellow-400 shrink-0">
                <Zap size={18} />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">Ações Recomendadas para a Gerência:</span>
                <span className="text-[11px] text-gray-400">Atue nos redlines para acelerar o batimento da meta antes do fechamento</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => setModalProdutosParadosAberto(true)}
                className="px-3.5 py-2 rounded-lg bg-black hover:bg-zinc-900 border border-[#333] hover:border-amber-500/60 text-xs font-bold text-amber-300 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm hover:scale-[1.02]"
              >
                <Package size={14} />
                Ver Produtos Parados da Loja
              </button>

              {typeof onFiltrarVendedores === 'function' && (
                <button
                  onClick={onFiltrarVendedores}
                  className="px-3.5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white transition-all flex items-center gap-1.5 shadow-[0_0_15px_rgba(106,13,173,0.3)] hover:scale-[1.02]"
                >
                  <Users size={14} />
                  Filtrar Ranking de Vendedores Desta Filial
                </button>
              )}
            </div>
          </div>

        </div>

        {/* RODAPÉ DO MODAL */}
        <div className="px-6 py-4 border-t border-[#222222] bg-[#0F0F0F] flex items-center justify-between shrink-0">
          <span className="text-xs text-gray-500">
            Zenite OS · Módulo de Diagnóstico Executivo de Filiais
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#222] hover:bg-[#333] text-xs font-bold text-white transition-colors"
          >
            Fechar Diagnóstico
          </button>
        </div>

      </div>

      {/* MODAL 1: PRODUTOS PARADOS DA LOJA */}
      {modalProdutosParadosAberto && (
        <ModalEstoqueParadoFilial
          isOpen={modalProdutosParadosAberto}
          onClose={() => setModalProdutosParadosAberto(false)}
          filial={filial}
          empresaId={empresaId}
          onSelecionarProduto={(prod) => {
            setProdutoParaEstrategia(prod);
          }}
        />
      )}

      {/* MODAL / DRAWER 2: ESTRATÉGIA DE GIRO DO PRODUTO (GEMINI 2.5) */}
      {produtoParaEstrategia && (
        <EstrategiaProdutoModal
          isOpen={Boolean(produtoParaEstrategia)}
          onClose={() => setProdutoParaEstrategia(null)}
          produto={produtoParaEstrategia}
          filialNome={filial?.nome || 'Loja'}
        />
      )}
    </div>
  );
}

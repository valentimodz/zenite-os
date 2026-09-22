import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import {
  X,
  Package,
  Search,
  AlertTriangle,
  Zap,
  Smartphone,
  Tag,
  DollarSign,
  Clock,
  Filter,
  ArrowRight,
  Layers,
  Store,
  Loader2,
  RefreshCw
} from 'lucide-react';

export default function ModalEstoqueParadoFilial({
  isOpen,
  onClose,
  filial,
  empresaId,
  onSelecionarProduto
}) {
  const [produtos, setProdutos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('TODAS');
  const lastLoadedFilialIdRef = useRef(null);

  // Formatação de moeda BRL
  const formatBRL = (val) => {
    return (Number(val) || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // 1. Consulta ao Supabase
  const carregarProdutosParados = async () => {
    if (!filial?.id) return;
    setIsLoading(true);
    try {
      const filialId = filial.id;
      const { data, error } = await supabase
        .from('produtos')
        .select('id, nome, categoria, quantidade, preco_venda, preco, preco_custo, created_at, filial_id')
        .eq('filial_id', filialId)
        .gt('quantidade', 0)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // 2. Tratamento por linha
      const formatados = (data || []).map(item => {
        const dataCriacao = item.created_at ? new Date(item.created_at).getTime() : Date.now();
        const diasSemGiro = Math.max(0, Math.floor((Date.now() - dataCriacao) / (1000 * 60 * 60 * 24)));
        const valorUnitario = Number(item.preco_venda || item.preco || item.preco_custo || 0);
        const valorTotalLinha = valorUnitario * Number(item.quantidade || 1);

        return {
          ...item,
          diasSemGiro,
          valorUnitario,
          valorTotalLinha
        };
      });

      setProdutos(formatados);
    } catch (err) {
      console.error('Erro ao consultar produtos parados da filial:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filialId = filial?.id;

  useEffect(() => {
    if (isOpen && filialId) {
      if (lastLoadedFilialIdRef.current !== filialId) {
        lastLoadedFilialIdRef.current = filialId;
        carregarProdutosParados();
      }
    } else if (!isOpen) {
      lastLoadedFilialIdRef.current = null;
    }
  }, [isOpen, filialId]);

  // Tecla ESC para fechar
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  // 2. Métricas Superiores
  const { totalItens, capitalImobilizadoTotal, itensCriticos30Dias } = useMemo(() => {
    if (!produtos || !Array.isArray(produtos) || produtos.length === 0) {
      return { totalItens: 0, capitalImobilizadoTotal: 0, itensCriticos30Dias: 0 };
    }
    const qtdTotal = produtos.reduce((acc, cur) => acc + Number(cur?.quantidade || 0), 0);
    const capTotal = produtos.reduce((acc, cur) => acc + Number(cur?.valorTotalLinha || 0), 0);
    const critTotal = produtos.filter(p => Number(p?.diasSemGiro || 0) >= 30).reduce((acc, cur) => acc + Number(cur?.quantidade || 0), 0);

    return {
      totalItens: qtdTotal,
      capitalImobilizadoTotal: capTotal,
      itensCriticos30Dias: critTotal
    };
  }, [produtos]);

  // Filtragem de produtos (Busca e Categoria)
  const produtosFiltrados = useMemo(() => {
    if (!produtos || !Array.isArray(produtos) || produtos.length === 0) return [];
    const buscaLimpa = (busca || '').trim().toLowerCase();

    return produtos.filter(p => {
      if (!p) return false;
      const matchBusca = !buscaLimpa ||
        (p.nome && String(p.nome).toLowerCase().includes(buscaLimpa)) ||
        (p.categoria && String(p.categoria).toLowerCase().includes(buscaLimpa));

      if (!matchBusca) return false;

      if (filtroCategoria === 'CELULARES') {
        const cat = String(p.categoria || '').toUpperCase();
        return cat.includes('CEL') || cat.includes('SMART') || cat.includes('APARELHO') || cat.includes('IPHONE') || cat.includes('ANDROID');
      }

      if (filtroCategoria === 'ACESSORIOS') {
        const cat = String(p.categoria || '').toUpperCase();
        return cat.includes('ACESS');
      }

      return true;
    });
  }, [produtos, busca, filtroCategoria]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0D0D0D] border border-[#222222] w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">

        {/* CABEÇALHO */}
        <div className="px-6 py-5 border-b border-[#222222] bg-[#0F0F0F] flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-amber-950/40 border border-amber-800/40 flex items-center justify-center text-amber-400 shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
              <Package size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-white tracking-tight">
                  Produtos Parados em Estoque
                </h2>
                <span className="text-[10px] bg-amber-950/60 text-amber-300 border border-amber-800/50 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  {filial?.nome || 'Filial'}
                </span>
              </div>
              <p className="text-xs text-gray-400 font-mono mt-0.5">
                Leitura direta da tabela 'produtos' · Análise de Giro com Feijão IA
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={carregarProdutosParados}
              className="p-2 rounded-xl bg-[#181818] hover:bg-[#252525] border border-[#333] text-gray-400 hover:text-white transition-colors"
              title="Recarregar Produtos"
            >
              <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-[#181818] hover:bg-[#252525] border border-[#333] text-gray-400 hover:text-white transition-colors"
              title="Fechar (ESC)"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* CARDS DE MÉTRICAS SUPERIORES */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 p-4 bg-black/40 border-b border-[#1A1A1A] shrink-0">
          {/* ITENS PARADOS */}
          <div className="bg-[#121212] border border-[#222] p-3.5 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Itens Parados</span>
              <span className="text-lg font-extrabold text-white font-mono mt-0.5 block">
                {totalItens} unidades
              </span>
            </div>
            <div className="w-9 h-9 rounded-lg bg-purple-950/30 border border-purple-800/30 flex items-center justify-center text-purple-400">
              <Package size={18} />
            </div>
          </div>

          {/* CAPITAL IMOBILIZADO */}
          <div className="bg-[#121212] border border-[#222] p-3.5 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Capital Imobilizado</span>
              <span className="text-lg font-extrabold text-emerald-400 font-mono mt-0.5 block">
                {formatBRL(capitalImobilizadoTotal)}
              </span>
            </div>
            <div className="w-9 h-9 rounded-lg bg-emerald-950/30 border border-emerald-800/30 flex items-center justify-center text-emerald-400">
              <DollarSign size={18} />
            </div>
          </div>

          {/* CRÍTICO (+30 DIAS) */}
          <div className="bg-[#121212] border border-[#222] p-3.5 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Crítico (+30 Dias)</span>
              <span className="text-lg font-extrabold text-amber-400 font-mono mt-0.5 block">
                {itensCriticos30Dias} unidades
              </span>
            </div>
            <div className="w-9 h-9 rounded-lg bg-amber-950/30 border border-amber-800/30 flex items-center justify-center text-amber-400">
              <AlertTriangle size={18} />
            </div>
          </div>
        </div>

        {/* BARRA DE FILTROS E BUSCA */}
        <div className="p-4 border-b border-[#222] flex flex-wrap items-center justify-between gap-3 shrink-0 bg-[#0A0A0A]">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome do produto ou categoria..."
              className="w-full bg-[#141414] border border-[#2A2A2A] focus:border-purple-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 outline-none transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs font-semibold">
            {['TODAS', 'CELULARES', 'ACESSORIOS'].map(cat => (
              <button
                key={cat}
                onClick={() => setFiltroCategoria(cat)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  filtroCategoria === cat
                    ? 'bg-purple-600 text-white shadow-[0_0_10px_rgba(106,13,173,0.3)]'
                    : 'bg-[#151515] text-gray-400 hover:text-white border border-[#222]'
                }`}
              >
                {cat === 'TODAS' ? 'Todas' : cat === 'CELULARES' ? 'Celulares' : 'Acessórios'}
              </button>
            ))}
          </div>
        </div>

        {/* 3. LISTAGEM INTERATIVA (TABELA) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3 text-gray-500">
              <Loader2 size={26} className="animate-spin text-purple-400" />
              <span className="text-xs font-mono">Carregando produtos parados em estoque...</span>
            </div>
          ) : produtosFiltrados.length === 0 ? (
            <div className="py-20 text-center space-y-2">
              <Package size={36} className="mx-auto text-gray-600" />
              <p className="text-sm font-bold text-gray-300">Nenhum produto em estoque parado encontrado.</p>
              <p className="text-xs text-gray-600">Não há produtos com saldo &gt; 0 que atendam aos critérios de busca.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#222222] bg-[#0E0E0E] text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">PRODUTO</th>
                    <th className="py-3 px-3">CATEGORIA</th>
                    <th className="py-3 px-3 text-center">QUANTIDADE</th>
                    <th className="py-3 px-3 text-right">PREÇO UNITÁRIO</th>
                    <th className="py-3 px-3 text-right">CAPITAL TOTAL</th>
                    <th className="py-3 px-3 text-center">DIAS PARADO</th>
                    <th className="py-3 px-4 text-center">AÇÃO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A1A1A]">
                  {produtosFiltrados.map((item) => {
                    const dias = item.diasSemGiro || 0;
                    const isCritico = dias >= 30;
                    const isAtencao = dias >= 15 && dias < 30;

                    return (
                      <tr
                        key={item.id}
                        onClick={() => onSelecionarProduto(item)}
                        className="hover:bg-purple-950/[0.12] transition-colors cursor-pointer group"
                      >
                        {/* PRODUTO */}
                        <td className="py-3.5 px-4 font-medium text-white">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-purple-400 shrink-0 group-hover:scale-105 transition-transform">
                              {item.categoria?.toUpperCase().includes('ACESS') ? (
                                <Tag size={13} className="text-emerald-400" />
                              ) : (
                                <Smartphone size={13} className="text-purple-400" />
                              )}
                            </div>
                            <span className="font-bold text-white group-hover:text-purple-300 transition-colors">
                              {item.nome}
                            </span>
                          </div>
                        </td>

                        {/* CATEGORIA */}
                        <td className="py-3.5 px-3">
                          <span className="text-[10px] font-medium bg-zinc-900 border border-zinc-800 text-gray-300 px-2 py-0.5 rounded">
                            {item.categoria || 'Geral'}
                          </span>
                        </td>

                        {/* QUANTIDADE */}
                        <td className="py-3.5 px-3 text-center font-mono font-bold text-white">
                          {item.quantidade} un.
                        </td>

                        {/* PREÇO UNITÁRIO */}
                        <td className="py-3.5 px-3 text-right font-mono font-semibold text-gray-300">
                          {formatBRL(item.valorUnitario)}
                        </td>

                        {/* CAPITAL TOTAL */}
                        <td className="py-3.5 px-3 text-right font-mono font-bold text-emerald-400">
                          {formatBRL(item.valorTotalLinha)}
                        </td>

                        {/* DIAS PARADO */}
                        <td className="py-3.5 px-3 text-center">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border ${
                            isCritico
                              ? 'bg-rose-950/60 border-rose-700/60 text-rose-300'
                              : isAtencao
                                ? 'bg-amber-950/60 border-amber-700/60 text-amber-300'
                                : 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300'
                          }`}>
                            <Clock size={10} />
                            {dias} dias
                          </span>
                        </td>

                        {/* AÇÃO */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelecionarProduto(item);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-purple-950/60 hover:bg-purple-600 border border-purple-700/60 text-xs font-bold text-purple-200 hover:text-white transition-all inline-flex items-center gap-1.5 shadow-[0_0_10px_rgba(168,85,247,0.25)] group-hover:bg-purple-600 group-hover:text-white"
                          >
                            <Zap size={12} className="text-yellow-300" />
                            <span>⚡ Estratégia Feijão IA</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* RODAPÉ */}
        <div className="px-6 py-4 border-t border-[#222222] bg-[#0A0A0A] flex items-center justify-between text-xs text-gray-500 shrink-0">
          <span>
            Exibindo <strong className="text-white">{produtosFiltrados.length}</strong> de <strong className="text-white">{produtos.length}</strong> produtos
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-bold text-xs transition-colors"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}

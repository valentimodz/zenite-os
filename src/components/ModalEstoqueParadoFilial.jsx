import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import {
  X,
  Package,
  Search,
  AlertTriangle,
  Sparkles,
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
  const [imeisMap, setImeisMap] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('TODAS');

  // Formatação de moeda BRL
  const formatBRL = (val) => {
    return (Number(val) || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Buscar produtos em estoque da filial
  const carregarProdutosParados = async () => {
    if (!filial?.id) return;
    setIsLoading(true);
    try {
      // 1. Buscar produtos com saldo > 0 da filial
      let q = supabase
        .from('produtos')
        .select('id, nome, categoria, tipo, preco, preco_custo, quantidade, created_at, updated_at')
        .eq('filial_id', filial.id)
        .gt('quantidade', 0)
        .order('updated_at', { ascending: true });

      if (empresaId && empresaId !== 'MASTER') {
        q = q.eq('empresa_id', empresaId);
      }

      const { data: prodsData, error: prodsErr } = await q;
      if (prodsErr) throw prodsErr;

      // 2. Buscar IMEIs disponíveis associados aos produtos
      let qImeis = supabase
        .from('imeis')
        .select('id, produto_id, imei, status, created_at')
        .eq('filial_id', filial.id)
        .or('status.ilike.%DISPON%,vendido.eq.false');

      const { data: imeisData } = await qImeis;

      const map = {};
      (imeisData || []).forEach(im => {
        if (im.produto_id) {
          if (!map[im.produto_id]) map[im.produto_id] = [];
          map[im.produto_id].push(im.imei);
        }
      });
      setImeisMap(map);

      // 3. Calcular dias sem giro estimado
      const agora = new Date().getTime();
      const formatados = (prodsData || []).map(p => {
        const dt = new Date(p.updated_at || p.created_at || new Date().toISOString()).getTime();
        const dias = Math.max(1, Math.floor((agora - dt) / (1000 * 60 * 60 * 24)));
        return {
          ...p,
          dias_sem_giro: dias,
          primeiro_imei: map[p.id]?.[0] || null
        };
      }).sort((a, b) => b.dias_sem_giro - a.dias_sem_giro);

      setProdutos(formatados);
    } catch (err) {
      console.error('Erro ao buscar estoque parado da filial:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && filial?.id) {
      carregarProdutosParados();
    }
  }, [isOpen, filial?.id]);

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

  // Métricas do estoque parado
  const { totalItens, totalCapital, itensCriticos30Dias } = useMemo(() => {
    let qtd = 0;
    let cap = 0;
    let crit = 0;

    produtos.forEach(p => {
      const q = parseInt(p.quantidade || 0, 10);
      const val = parseFloat(p.preco || p.preco_custo || 0);
      qtd += q;
      cap += q * val;
      if (p.dias_sem_giro >= 30) {
        crit += q;
      }
    });

    return { totalItens: qtd, totalCapital: cap, itensCriticos30Dias: crit };
  }, [produtos]);

  // Filtragem de produtos
  const produtosFiltrados = useMemo(() => {
    return produtos.filter(p => {
      const matchBusca = !busca.trim() ||
        (p.nome && p.nome.toLowerCase().includes(busca.toLowerCase())) ||
        (p.categoria && p.categoria.toLowerCase().includes(busca.toLowerCase())) ||
        (p.primeiro_imei && p.primeiro_imei.includes(busca.trim()));

      if (!matchBusca) return false;

      if (filtroCategoria === 'CELULARES') {
        const cat = (p.categoria || p.tipo || '').toUpperCase();
        return cat.includes('CEL') || cat.includes('SMART') || cat.includes('APARELHO') || cat.includes('IPHONE') || cat.includes('ANDROID');
      }

      if (filtroCategoria === 'ACESSORIOS') {
        const cat = (p.categoria || p.tipo || '').toUpperCase();
        return cat.includes('ACESS');
      }

      return true;
    });
  }, [produtos, busca, filtroCategoria]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0D0D0D] border border-[#222222] w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[90vh]">

        {/* CABEÇALHO */}
        <div className="px-6 py-5 border-b border-[#222222] bg-[#0F0F0F] flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-950/40 border border-amber-800/40 flex items-center justify-center text-amber-400 shrink-0">
              <Package size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-white tracking-tight">
                  Produtos Parados em Estoque
                </h2>
                <span className="text-[10px] bg-amber-950/60 text-amber-300 border border-amber-800/50 px-2 py-0.5 rounded-full font-bold uppercase">
                  {filial?.nome || 'Filial'}
                </span>
              </div>
              <p className="text-xs text-gray-400 font-mono mt-0.5">
                Auditoria de Mercadoria Imobilizada · Ação de Giro Acelerado
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={carregarProdutosParados}
              className="p-2 rounded-xl bg-[#181818] hover:bg-[#252525] border border-[#333] text-gray-400 hover:text-white transition-colors"
              title="Recarregar Estoque"
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

        {/* METRICAS RÁPIDAS NO TOPO */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-black/40 border-b border-[#1A1A1A] shrink-0">
          <div className="bg-[#121212] border border-[#222] p-3 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[10px] text-gray-500 font-bold uppercase block">Itens Parados</span>
              <span className="text-base font-extrabold text-white font-mono">{totalItens} unidades</span>
            </div>
            <Package size={20} className="text-purple-400 opacity-60" />
          </div>

          <div className="bg-[#121212] border border-[#222] p-3 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[10px] text-gray-500 font-bold uppercase block">Capital Imobilizado</span>
              <span className="text-base font-extrabold text-emerald-400 font-mono">{formatBRL(totalCapital)}</span>
            </div>
            <DollarSign size={20} className="text-emerald-400 opacity-60" />
          </div>

          <div className="bg-[#121212] border border-[#222] p-3 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[10px] text-gray-500 font-bold uppercase block">Crítico (+30 Dias)</span>
              <span className="text-base font-extrabold text-amber-400 font-mono">{itensCriticos30Dias} unidades</span>
            </div>
            <AlertTriangle size={20} className="text-amber-400 opacity-60" />
          </div>
        </div>

        {/* FILTROS E BUSCA */}
        <div className="p-4 border-b border-[#222] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome do produto, IMEI ou categoria..."
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

        {/* LISTA / TABELA DE PRODUTOS PARADOS */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-2">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3 text-gray-500">
              <Loader2 size={24} className="animate-spin text-purple-400" />
              <span className="text-xs font-mono">Buscando itens parados da filial...</span>
            </div>
          ) : produtosFiltrados.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <Package size={32} className="mx-auto text-gray-600" />
              <p className="text-sm font-bold text-gray-400">Nenhum produto parado encontrado.</p>
              <p className="text-xs text-gray-600">O estoque desta loja está fluindo ou não corresponde aos filtros.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {produtosFiltrados.map((item) => {
                const dias = item.dias_sem_giro || 1;
                const isCritico = dias >= 30;
                const isAtencao = dias >= 15 && dias < 30;

                return (
                  <div
                    key={item.id}
                    onClick={() => onSelecionarProduto(item)}
                    className="bg-black/50 border border-[#222] hover:border-purple-500/70 hover:bg-purple-950/[0.08] p-3.5 rounded-xl transition-all cursor-pointer flex flex-wrap items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-purple-400 shrink-0 group-hover:scale-105 transition-transform">
                        {item.categoria?.toUpperCase().includes('ACESS') ? (
                          <Tag size={18} className="text-emerald-400" />
                        ) : (
                          <Smartphone size={18} className="text-purple-400" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white truncate group-hover:text-purple-300 transition-colors">
                            {item.nome}
                          </span>
                          {item.categoria && (
                            <span className="text-[9px] bg-zinc-800 text-gray-400 px-1.5 py-0.5 rounded">
                              {item.categoria}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-gray-400 font-mono mt-0.5">
                          {item.primeiro_imei && (
                            <span className="text-zinc-500">
                              IMEI: ...{item.primeiro_imei.slice(-6)}
                            </span>
                          )}
                          <span>Saldo: <strong className="text-white">{item.quantidade} un.</strong></span>
                          <span>Preço: <strong className="text-emerald-400">{formatBRL(item.preco || item.preco_custo || 0)}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Badge de Dias Parado */}
                      <span className={`text-[10px] font-bold font-mono px-2.5 py-1 rounded-full border flex items-center gap-1 ${
                        isCritico
                          ? 'bg-rose-950/60 border-rose-700/60 text-rose-300'
                          : isAtencao
                            ? 'bg-amber-950/60 border-amber-700/60 text-amber-300'
                            : 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300'
                      }`}>
                        <Clock size={11} />
                        {dias} dias sem giro
                      </span>

                      {/* Botão de Ação IA */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelecionarProduto(item);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-purple-950/50 hover:bg-purple-600 border border-purple-700/50 text-xs font-bold text-purple-200 hover:text-white transition-all flex items-center gap-1.5 shadow-[0_0_12px_rgba(168,85,247,0.25)] group-hover:bg-purple-600 group-hover:text-white"
                      >
                        <Sparkles size={13} className="text-yellow-300" />
                        <span>Gerar Estratégia (IA)</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RODAPÉ */}
        <div className="px-6 py-3.5 border-t border-[#222222] bg-[#0A0A0A] flex items-center justify-between text-xs text-gray-500 shrink-0">
          <span>{produtosFiltrados.length} produto(s) listado(s)</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs transition-colors"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}

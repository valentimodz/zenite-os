import React, { useState, useMemo } from 'react';
import { Search, Zap, X, ShoppingBag, Plus, Tag, Check, Sparkles } from 'lucide-react';

export default function PainelVendaRapida({ isOpen, onClose, produtos = [], onAddToCart, cartItemCount = 0 }) {
  const [busca, setBusca] = useState('');
  const [categoriaAtiva, setCategoriaAtiva] = useState('TUDO');
  const [lastAddedId, setLastAddedId] = useState(null);

  // Filtrar produtos genéricos e acessórios
  const produtosFiltrados = useMemo(() => {
    return produtos.filter((p) => {
      // Priorizar Acessórios, Películas, Capas, Serviços ou produtos por Quantidade / SKU Interno
      const isAcessorioOuGenerico = 
        p.tipo === 'ACESSORIO' || 
        p.tipo === 'Acessório' || 
        p.categoria !== 'IOS' && p.categoria !== 'ANDROID' || 
        (p.codigo_barras && (p.codigo_barras.includes('-') || p.codigo_barras.startsWith('SKU') || p.codigo_barras.startsWith('PEL') || p.codigo_barras.startsWith('CAP')));

      if (!isAcessorioOuGenerico && p.tipo === 'CELULAR') return false;

      const q = busca.toLowerCase().trim();
      const bateBusca = !q || 
        (p.nome && p.nome.toLowerCase().includes(q)) || 
        (p.categoria && p.categoria.toLowerCase().includes(q)) || 
        (p.codigo_barras && p.codigo_barras.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q));

      const catUpper = (p.categoria || p.tipo || '').toUpperCase();
      let bateCategoria = true;
      if (categoriaAtiva === 'PELICULAS') {
        bateCategoria = catUpper.includes('PELÍCUL') || catUpper.includes('PELICUL');
      } else if (categoriaAtiva === 'CAPAS') {
        bateCategoria = catUpper.includes('CAPA') || catUpper.includes('CASE');
      } else if (categoriaAtiva === 'CARREGADORES') {
        bateCategoria = catUpper.includes('CABO') || catUpper.includes('CARREGADOR') || catUpper.includes('FONTE');
      } else if (categoriaAtiva === 'FONES') {
        bateCategoria = catUpper.includes('FONE') || catUpper.includes('AUDIO') || catUpper.includes('SOM');
      } else if (categoriaAtiva === 'SERVICOS') {
        bateCategoria = catUpper.includes('SERVIÇO') || catUpper.includes('SERVICO') || catUpper.includes('MANUTENÇÃO');
      }

      return bateBusca && bateCategoria;
    });
  }, [produtos, busca, categoriaAtiva]);

  if (!isOpen) return null;

  const handleSelect = (produto) => {
    console.log("🔥 [TOUCH PDV - CLIQUE]: O que estou enviando para o carrinho?", produto);
    onAddToCart(produto);
    setLastAddedId(produto.id);
    setTimeout(() => {
      setLastAddedId(null);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-neutral-900 border border-neutral-800 w-full max-w-[96%] sm:max-w-xl md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl max-h-[92vh] sm:max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-neutral-100 font-sans">
        
        {/* Header do Modal */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-neutral-800 bg-neutral-950/80 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-2.5 bg-[#6A0DAD]/20 border border-[#6A0DAD]/40 rounded-xl text-amber-300">
              <Zap className="w-5 h-5 sm:w-6 sm:h-6 fill-amber-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight">Venda Rápida de Acessórios</h2>
                <span className="text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full bg-[#6A0DAD]/30 text-[#c084fc] font-bold border border-[#6A0DAD]/50">
                  Touch PDV
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-neutral-400 hidden sm:block">
                Clique nos produtos para adicionar ao carrinho com 1 toque sem leitor físico
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {cartItemCount > 0 && (
              <div className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-[#6A0DAD]/30 border border-[#6A0DAD]/50 rounded-xl flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-bold text-[#c084fc]">
                <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>{cartItemCount} item(s)</span>
              </div>
            )}

            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Barra de Filtros e Busca */}
        <div className="p-3.5 sm:p-5 border-b border-neutral-800 bg-neutral-950/40 space-y-2.5 sm:space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar acessório rápido por nome, SKU ou código..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full bg-black border border-neutral-800 focus:border-[#6A0DAD] rounded-xl pl-10 pr-4 py-2 sm:py-2.5 text-xs sm:text-sm text-neutral-200 placeholder-neutral-500 outline-none transition-all"
              autoFocus
            />
          </div>

          {/* Categorias Rápidas em Pílulas */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 custom-scrollbar text-[11px] sm:text-xs">
            {[
              { id: 'TUDO', label: 'Todos os Acessórios' },
              { id: 'PELICULAS', label: '📱 Películas' },
              { id: 'CAPAS', label: '🛡️ Capas' },
              { id: 'CARREGADORES', label: '⚡ Carregadores & Cabos' },
              { id: 'FONES', label: '🎧 Fones & Áudio' },
              { id: 'SERVICOS', label: '🛠️ Serviços' }
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategoriaAtiva(cat.id)}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl font-bold whitespace-nowrap transition-all border ${
                  categoriaAtiva === cat.id
                    ? 'bg-gradient-to-r from-[#6A0DAD] to-[#9333EA] text-white border-[#6A0DAD] shadow-md shadow-purple-900/30'
                    : 'bg-black text-neutral-400 border-neutral-800 hover:text-white hover:border-neutral-700'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Grid de Toque Rápido (Mobile-First) */}
        <div className="p-3.5 sm:p-5 overflow-y-auto max-h-[58vh] sm:max-h-[62vh] custom-scrollbar">
          {produtosFiltrados.length === 0 ? (
            <div className="py-12 sm:py-16 text-center text-neutral-500 space-y-2">
              <ShoppingBag className="w-8 h-8 sm:w-10 sm:h-10 mx-auto text-neutral-700" />
              <p className="text-xs sm:text-sm font-semibold text-neutral-300">Nenhum produto encontrado</p>
              <p className="text-[11px] sm:text-xs">Tente buscar por outro termo ou selecione "Todos os Acessórios".</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
              {produtosFiltrados.map((prod) => {
                const isJustAdded = lastAddedId === prod.id;
                const precoFormatado = (parseFloat(prod.preco) || 0).toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                });

                return (
                  <button
                    key={prod.id}
                    onClick={() => handleSelect(prod)}
                    className={`
                      relative text-left p-3.5 sm:p-4 rounded-xl border flex flex-col justify-between transition-all select-none group min-h-[110px] sm:min-h-[120px]
                      ${isJustAdded
                        ? 'bg-green-950/40 border-green-500 shadow-lg shadow-green-950/40 scale-[0.98]'
                        : 'bg-black/70 hover:bg-neutral-900 border-neutral-800 hover:border-[#6A0DAD]/60 hover:shadow-lg hover:shadow-purple-950/20 active:scale-[0.97]'
                      }
                    `}
                  >
                    {/* Badge / Indicador de Adição */}
                    <div className="flex items-center justify-between gap-1 mb-1.5 sm:mb-2">
                      <span className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-[#c084fc]">
                        {prod.categoria || 'Acessório'}
                      </span>
                      {isJustAdded ? (
                        <span className="text-[9px] font-bold text-green-400 flex items-center gap-1 bg-green-900/40 px-1.5 py-0.5 rounded">
                          <Check className="w-3 h-3" /> Adicionado
                        </span>
                      ) : (
                        <div className="p-1 rounded-md bg-[#6A0DAD]/10 text-[#c084fc] group-hover:bg-[#6A0DAD] group-hover:text-white transition-colors">
                          <Plus className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>

                    {/* Nome do Produto */}
                    <div className="my-0.5 sm:my-1">
                      <p className="text-xs font-bold text-neutral-100 group-hover:text-white line-clamp-2 leading-tight">
                        {prod.nome}
                      </p>
                      {prod.codigo_barras && (
                        <p className="text-[10px] text-neutral-500 font-mono mt-0.5 sm:mt-1 truncate">
                          {prod.codigo_barras}
                        </p>
                      )}
                    </div>

                    {/* Preço em Destaque */}
                    <div className="mt-2.5 sm:mt-3 pt-2 border-t border-neutral-900 flex items-center justify-between">
                      <span className="text-xs sm:text-sm font-mono font-extrabold text-purple-300 group-hover:text-purple-200">
                        R$ {precoFormatado}
                      </span>
                      <span className="text-[10px] text-neutral-500 font-medium">
                        Qtd: {prod.quantidade ?? prod.estoque_atual ?? 1}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer do Modal */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-neutral-800 bg-neutral-950/90 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
          <p className="text-[11px] sm:text-xs text-neutral-400 text-center sm:text-left">
            Dica: O painel permanece aberto para você adicionar múltiplos itens.
          </p>

          <div className="flex items-center justify-end w-full sm:w-auto gap-3">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-[#6A0DAD] to-[#9333EA] hover:from-[#7e12ca] hover:to-[#a855f7] text-white font-bold rounded-xl text-xs shadow-lg shadow-purple-900/30 transition-all flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>Concluir ({cartItemCount} itens no carrinho)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

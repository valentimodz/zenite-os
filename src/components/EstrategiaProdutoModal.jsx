import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Loader2,
  Copy,
  Check,
  Smartphone,
  Tag,
  RefreshCw,
  ShoppingBag,
  Flame,
  MessageSquare,
  Gift,
  Zap,
  ArrowRight,
  Share2
} from 'lucide-react';
import { gerarEstrategiaGiroProduto } from '../services/geminiService';

export default function EstrategiaProdutoModal({
  isOpen,
  onClose,
  produto,
  filialNome = 'Loja'
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [estrategiaTexto, setEstrategiaTexto] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState('');

  // Formatação de moeda BRL
  const formatBRL = (val) => {
    return (Number(val) || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Carregar estratégia com a IA quando o modal abre com um produto selecionado
  const carregarEstrategia = async () => {
    if (!produto) return;
    setIsLoading(true);
    setErro('');
    try {
      const texto = await gerarEstrategiaGiroProduto({
        produto,
        filialNome
      });
      setEstrategiaTexto(texto || '');
    } catch (err) {
      console.error('Erro ao gerar estratégia com Gemini:', err);
      setErro(err.message || 'Falha ao conectar com o Gemini para gerar estratégia.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && produto) {
      carregarEstrategia();
    } else {
      setEstrategiaTexto('');
      setCopiado(false);
      setErro('');
    }
  }, [isOpen, produto?.id]);

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

  // Copiar para WhatsApp
  const handleCopiarWhatsApp = () => {
    const precoFormatado = formatBRL(produto?.preco || produto?.preco_custo || 0);
    const msg = `⚡ *PLANO DE DESOVA & GIRO IMEDIATO - ZENITE OS (IA)* ⚡\n` +
      `📍 *Unidade:* ${filialNome}\n` +
      `📦 *Item em Estoque:* ${produto?.nome}\n` +
      `💰 *Preço Tabela:* ${precoFormatado}\n` +
      `⏳ *Dias Imobilizado:* ${produto?.dias_sem_giro || 30} dias\n\n` +
      `${estrategiaTexto}\n\n` +
      `_Ação gerada pela Inteligência Artificial de Varejo do Zenite OS_`;

    navigator.clipboard.writeText(msg);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  if (!isOpen || !produto) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0D0D0D] border border-purple-500/40 w-full max-w-2xl rounded-2xl shadow-[0_0_50px_rgba(106,13,173,0.35)] overflow-hidden flex flex-col my-auto max-h-[92vh]">

        {/* CABEÇALHO COM GRADIENTE NEON */}
        <div className="px-6 py-5 border-b border-[#222] bg-gradient-to-r from-purple-950/50 via-[#100B17] to-black flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-purple-600/30 border border-purple-500/60 flex items-center justify-center text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.4)] shrink-0">
              <Sparkles size={22} className="text-purple-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-white tracking-tight">
                  Estratégia de Giro do Produto
                </h2>
                <span className="text-[10px] bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                  Gemini 2.5
                </span>
              </div>
              <p className="text-xs text-purple-200/70 font-mono mt-0.5">
                Diretoria Comercial de Varejo · {filialNome}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#181818] hover:bg-[#252525] border border-[#333] flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            title="Fechar (ESC)"
          >
            <X size={16} />
          </button>
        </div>

        {/* DETALHES DO PRODUTO SELECIONADO */}
        <div className="bg-black/60 border-b border-[#222] px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Smartphone size={15} className="text-purple-400 shrink-0" />
            <span className="font-bold text-white truncate text-sm">{produto.nome}</span>
            {produto.categoria && (
              <span className="text-[10px] bg-zinc-800 text-gray-300 px-2 py-0.5 rounded border border-zinc-700">
                {produto.categoria}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 font-mono">
            <span className="text-gray-400">
              Saldo: <strong className="text-white">{produto.quantidade || 1} un.</strong>
            </span>
            <span className="text-gray-400">
              Preço: <strong className="text-emerald-400">{formatBRL(produto.preco || produto.preco_custo || 0)}</strong>
            </span>
            <span className="text-amber-400 bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded text-[11px] font-bold">
              {produto.dias_sem_giro || 30} dias parado
            </span>
          </div>
        </div>

        {/* CORPO DO MODAL */}
        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">

          {/* LOADING STATE */}
          {isLoading && (
            <div className="py-14 flex flex-col items-center justify-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-purple-950/60 border border-purple-600 flex items-center justify-center text-purple-400 shadow-[0_0_25px_rgba(147,51,234,0.4)] animate-bounce">
                  <Sparkles size={30} className="text-purple-300" />
                </div>
                <Loader2 size={24} className="animate-spin text-purple-400 absolute -bottom-2 -right-2 bg-black rounded-full p-0.5" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-bold text-white tracking-tight">
                  Consultando Inteligência Comercial (Gemini 2.5)...
                </p>
                <p className="text-xs text-gray-400 font-mono">
                  Calculando margem, combos de acessórios e metas de queima para {produto.nome}.
                </p>
              </div>
            </div>
          )}

          {/* ERRO STATE */}
          {!isLoading && erro && (
            <div className="p-4 bg-rose-950/30 border border-rose-800/40 rounded-xl text-xs text-rose-200 flex items-center justify-between gap-3">
              <span>{erro}</span>
              <button
                onClick={carregarEstrategia}
                className="px-3 py-1.5 rounded-lg bg-rose-900/60 hover:bg-rose-800 text-white font-bold flex items-center gap-1.5 shrink-0"
              >
                <RefreshCw size={12} /> Tentar Novamente
              </button>
            </div>
          )}

          {/* CONTEÚDO DA ESTRATÉGIA FORMATADO */}
          {!isLoading && estrategiaTexto && (
            <div className="space-y-4 text-xs">
              <div className="bg-[#121212] border border-[#262626] rounded-xl p-5 text-gray-200 leading-relaxed font-sans shadow-inner whitespace-pre-line select-text">
                {estrategiaTexto}
              </div>

              {/* DICA DE APLICAÇÃO */}
              <div className="bg-purple-950/20 border border-purple-800/30 p-3.5 rounded-xl flex items-start gap-3 text-[11px] text-purple-200">
                <Zap size={16} className="text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block font-semibold mb-0.5">Dica Executiva de Balcão:</strong>
                  Envie o plano diretamente no grupo de WhatsApp da loja para que os consultores do turno comecem a ofertar imediatamente aos próximos clientes que entrarem na loja.
                </div>
              </div>
            </div>
          )}

        </div>

        {/* RODAPÉ COM AÇÕES */}
        <div className="px-6 py-4 border-t border-[#222] bg-[#0A0A0A] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            onClick={carregarEstrategia}
            disabled={isLoading}
            className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-bold text-gray-300 transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            Gerar Nova Sugestão
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopiarWhatsApp}
              disabled={isLoading || !estrategiaTexto}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold text-xs transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center gap-2 disabled:opacity-50"
            >
              {copiado ? (
                <>
                  <Check size={15} className="text-white" />
                  Copiado para o WhatsApp!
                </>
              ) : (
                <>
                  <Share2 size={15} />
                  Copiar Estratégia para o WhatsApp da Loja
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
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
  const lastLoadedIdRef = useRef(null);

  // Cálculo de dias com fallback na data de referência
  const calcularDias = (dataReferencia) => {
    if (!dataReferencia) return 0;
    const diffMs = Date.now() - new Date(dataReferencia).getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  };

  const getDiasParado = (prod) => {
    if (!prod) return 0;
    const val = prod.dias_parado ?? prod.diasParado ?? prod.diasSemGiro ?? prod.dias_sem_giro ?? prod.dias_sem_venda ?? prod.diasInativo;
    if (val !== undefined && val !== null && !isNaN(Number(val))) {
      return Number(val);
    }
    const dataRef = prod.created_at || prod.data_ultima_venda || prod.data_entrada;
    if (dataRef) {
      return calcularDias(dataRef);
    }
    return 0;
  };

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

    // Adicionar timeout de segurança de 8 segundos
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const precoValor = produto.preco || produto.preco_venda || produto.preco_custo || 0;
      const diasParado = getDiasParado(produto);
      const saldo = produto.quantidade || 1;

      const prompt = `Você é o Feijão IA, consultor executivo da rede de lojas Monkey Shop.
Produto: ${produto.nome} (${produto.categoria || 'Geral'})
Preço: R$ ${precoValor} | Dias parado: ${diasParado} dias | Saldo: ${saldo} un.
Gere uma estratégia rápida de giro em 3 tópicos curtos:
1. Combo com aparelho ou brinde estratégico.
2. Argumento de balcão para os vendedores (Islayne, Regiane, Amanda, Sena).
3. Oferta relâmpago de queima para liberar capital.
Seja direto e comercial.`;

      // 1. Tenta endpoint direto da API se disponível
      let respostaTexto = '';
      try {
        const response = await fetch('/api/feijao-ia/estrategia', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, modelo: 'gemini-1.5-flash' }),
          signal: controller.signal
        });

        if (response.ok) {
          const data = await response.json();
          respostaTexto = data.texto || data.resposta || '';
        }
      } catch (apiErr) {
        if (apiErr?.name === 'AbortError') throw apiErr;
        // Prosseguir para o cliente direto do GeminiService
      }

      // 2. Se a API não respondeu, utiliza o GeminiService resiliente
      if (!respostaTexto) {
        respostaTexto = await gerarEstrategiaGiroProduto({
          produto: {
            ...produto,
            preco: precoValor,
            dias_parado: diasParado,
            diasParado: diasParado,
            dias_sem_giro: diasParado,
            diasSemGiro: diasParado,
            quantidade: saldo
          },
          filialNome,
          promptPersonalizado: prompt,
          signal: controller.signal
        });
      }

      if (!respostaTexto || !respostaTexto.trim()) {
        throw new Error('Falha na resposta da API');
      }

      setEstrategiaTexto(respostaTexto.trim());
    } catch (err) {
      console.error("Erro ao gerar estratégia Feijão IA:", err);
      const fallbackDias = getDiasParado(produto);
      // Fallback tático instantâneo para nunca travar a tela do usuário
      setEstrategiaTexto(
        `🔥 **Estratégia Recomendada:**\n` +
        `• **Combo Venda Casada:** Ofereça este item com 30% de desconto na compra de qualquer celular no crediário/boleto.\n` +
        `• **Ação de Balcão:** Bonifique o vendedor com R$ 5,00 extra no pix pela saída imediata desta peça parada há +${fallbackDias} dias.\n` +
        `• **Queima no Balcão:** Exponha na bandeja de frente de caixa com etiqueta de "Oportunidade da Semana".`
      );
      if (err?.name === 'AbortError') {
        setErro('Tempo limite de 8 segundos atingido. Estratégia recomendada de giro liberada imediatamente.');
      } else {
        setErro('Instabilidade na conexão da IA. Estratégia recomendada de giro liberada imediatamente.');
      }
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false); // CRÍTICO: nunca deixar o loading ativo
    }
  };

  // Resetar estados apenas quando o modal for fechado (sem disparo automático)
  useEffect(() => {
    if (!isOpen) {
      setEstrategiaTexto('');
      setCopiado(false);
      setErro('');
      setIsLoading(false);
    }
  }, [isOpen]);

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
    const precoFormatado = formatBRL(produto?.preco || produto?.preco_venda || produto?.preco_custo || 0);
    const diasImobilizado = getDiasParado(produto);
    const msg = `⚡ *PLANO DE DESOVA & GIRO IMEDIATO - FEIJÃO IA (MONKEY SHOP / ZÊNITE)* ⚡\n` +
      `📍 *Unidade:* ${filialNome}\n` +
      `📦 *Item em Estoque:* ${produto?.nome}\n` +
      `💰 *Preço Tabela:* ${precoFormatado}\n` +
      `⏳ *Dias Imobilizado:* ${diasImobilizado} dias\n\n` +
      `${estrategiaTexto}\n\n` +
      `_Ação gerada pela Feijão IA - Inteligência Comercial de Varejo_`;

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
                  FEIJÃO IA
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
              {produto?.dias_parado ?? produto?.diasParado ?? produto?.diasSemGiro ?? produto?.dias_sem_giro ?? getDiasParado(produto)} dias parado
            </span>
          </div>
        </div>

        {/* CORPO DO MODAL */}
        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">

          {/* ESTADO INICIAL: CONVITE PARA GERAR A ESTRATÉGIA VOLUNTARIAMENTE */}
          {!isLoading && !estrategiaTexto && !erro && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-purple-950/60 border border-purple-500/50 flex items-center justify-center text-purple-300 shadow-[0_0_30px_rgba(168,85,247,0.3)]">
                <Zap size={32} className="text-yellow-400 animate-pulse" />
              </div>
              <div className="max-w-md space-y-1.5">
                <h3 className="text-base font-extrabold text-white">
                  Pronto para acelerar o giro deste item?
                </h3>
                <p className="text-xs text-gray-400">
                  Clique no botão abaixo para consultar a inteligência executiva da Feijão IA e obter combos rápidos, argumentos de balcão e ofertas relâmpago de queima de estoque.
                </p>
              </div>
              <button
                type="button"
                onClick={() => carregarEstrategia()}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs transition-all shadow-[0_0_20px_rgba(168,85,247,0.4)] flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Zap size={16} className="text-yellow-300" />
                ⚡ Gerar Estratégia (Feijão IA)
              </button>
            </div>
          )}

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
                  Consultando Feijão IA...
                </p>
                <p className="text-xs text-gray-400 font-mono">
                  Feijão IA calculando estratégias de margem e combos para {produto.nome}...
                </p>
              </div>
            </div>
          )}

          {/* AVISO / MODO DE CONTINGÊNCIA SE HOUVER ERRO */}
          {!isLoading && erro && (
            <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded-xl text-xs text-amber-200 flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <Flame size={15} className="text-amber-400 shrink-0" />
                {erro}
              </span>
              <button
                type="button"
                onClick={() => carregarEstrategia()}
                disabled={isLoading}
                className="px-2.5 py-1 rounded-lg bg-amber-900/60 hover:bg-amber-800 text-white font-bold flex items-center gap-1.5 shrink-0 text-[11px] cursor-pointer"
              >
                <RefreshCw size={11} className={isLoading ? 'animate-spin' : ''} /> Tentar Novamente
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
            type="button"
            onClick={() => carregarEstrategia()}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl bg-purple-950/80 hover:bg-purple-800 border border-purple-600/60 text-xs font-bold text-purple-200 hover:text-white transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed shadow-[0_0_15px_rgba(168,85,247,0.2)]"
          >
            {isLoading ? (
              <RefreshCw size={14} className="animate-spin text-purple-400" />
            ) : (
              <Zap size={14} className="text-yellow-400" />
            )}
            {estrategiaTexto ? 'Gerar Nova Sugestão' : '⚡ Gerar Estratégia (Feijão IA)'}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleCopiarWhatsApp()}
              disabled={isLoading || !estrategiaTexto}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold text-xs transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center gap-2 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
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

import React from 'react';

/**
 * Dicionário de aliases para tratamento de erros de digitação e variações do banco Supabase.
 */
const COLOR_TYPO_ALIASES = {
  'petro': 'preto',
  'preto/grafite': 'preto',
  'black': 'preto',
  'white': 'branco',
  'blue': 'azul',
  'red': 'vermelho',
  'green': 'verde',
  'pink': 'rosa',
  'gold': 'dourado',
  'silver': 'prateado',
  'gray': 'cinza',
  'grey': 'cinza',
  'purple': 'roxo',
  'space gray': 'cinza',
  'cinza espacial': 'cinza',
  'titanio natural': 'dourado',
  'titânio natural': 'dourado',
  'titanio preto': 'preto',
  'titânio preto': 'preto',
  'titanio branco': 'branco',
  'titânio branco': 'branco',
  'titanio azul': 'azul',
  'titânio azul': 'azul',
};

/**
 * Mapeamento dinâmico de estilos Tailwind para cada cor canônica.
 */
const COLOR_STYLES = {
  preto: {
    badge: 'bg-zinc-950/80 text-zinc-300 border-zinc-700/60 shadow-sm',
    dot: 'bg-zinc-400'
  },
  branco: {
    badge: 'bg-slate-100/10 text-slate-100 border-slate-300/40 shadow-sm',
    dot: 'bg-slate-100 shadow-[0_0_6px_rgba(255,255,255,0.8)]'
  },
  azul: {
    badge: 'bg-blue-950/50 text-blue-300 border-blue-700/50 shadow-sm',
    dot: 'bg-blue-400'
  },
  vermelho: {
    badge: 'bg-red-950/50 text-red-300 border-red-700/50 shadow-sm',
    dot: 'bg-red-500'
  },
  verde: {
    badge: 'bg-emerald-950/50 text-emerald-300 border-emerald-700/50 shadow-sm',
    dot: 'bg-emerald-400'
  },
  rosa: {
    badge: 'bg-pink-950/50 text-pink-300 border-pink-700/50 shadow-sm',
    dot: 'bg-pink-400'
  },
  dourado: {
    badge: 'bg-amber-950/50 text-amber-300 border-amber-600/50 shadow-sm',
    dot: 'bg-amber-400'
  },
  prateado: {
    badge: 'bg-slate-900/60 text-slate-300 border-slate-600/50 shadow-sm',
    dot: 'bg-slate-300'
  },
  cinza: {
    badge: 'bg-stone-900/70 text-stone-300 border-stone-700/50 shadow-sm',
    dot: 'bg-stone-400'
  },
  roxo: {
    badge: 'bg-purple-950/50 text-purple-300 border-purple-700/50 shadow-sm',
    dot: 'bg-purple-400'
  },
  grafite: {
    badge: 'bg-neutral-900/80 text-neutral-300 border-neutral-700/60 shadow-sm',
    dot: 'bg-neutral-400'
  },
  amarelo: {
    badge: 'bg-yellow-950/50 text-yellow-300 border-yellow-600/50 shadow-sm',
    dot: 'bg-yellow-400'
  },
  laranja: {
    badge: 'bg-orange-950/50 text-orange-300 border-orange-600/50 shadow-sm',
    dot: 'bg-orange-400'
  }
};

/**
 * Estilo fallback neutro e resiliente para cores não mapeadas ou nulas.
 */
const DEFAULT_COLOR_STYLE = {
  badge: 'bg-zinc-900/60 text-zinc-400 border-zinc-700/40 font-sans',
  dot: 'bg-zinc-500'
};

/**
 * Normaliza a cor recebida limpando espaços, maiúsculas e erros de digitação.
 */
function normalizeColor(colorStr) {
  if (!colorStr) return '';
  const clean = String(colorStr).trim().toLowerCase();
  return COLOR_TYPO_ALIASES[clean] || clean;
}

/**
 * Componente modular e reutilizável para exibição dinâmica de cores dos aparelhos/IMEIs.
 */
export default function ColorBadge({ cor, className = '', showLabel = false }) {
  const hasCor = Boolean(cor && String(cor).trim());
  const rawColor = hasCor ? String(cor).trim() : 'Sem cor';
  const normalizedKey = normalizeColor(rawColor);

  const style = hasCor
    ? (COLOR_STYLES[normalizedKey] || DEFAULT_COLOR_STYLE)
    : DEFAULT_COLOR_STYLE;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold border transition-all ${style.badge} ${className}`}
    >
      {showLabel && <span className="text-gray-500 font-normal text-[9px]">Cor:</span>}
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
      <span className="truncate max-w-[120px]">{rawColor}</span>
    </span>
  );
}

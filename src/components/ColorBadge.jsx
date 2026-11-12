import React from 'react';

/**
 * Dicionário de aliases para tratamento de erros de digitação e variações do banco Supabase.
 */
const COLOR_TYPO_ALIASES = {
  'petro': 'preto',
  'preto/grafite': 'preto',
  'black': 'preto',
  'obsidian black': 'obsidian black',
  'metallic black': 'metallic black',
  'white': 'branco',
  'veil white': 'veil white',
  'blue': 'azul',
  'red': 'vermelho',
  'green': 'verde',
  'pink': 'rosa',
  'gold': 'dourado',
  'silver': 'prateado',
  'prata': 'prateado',
  'gray': 'cinza',
  'grey': 'cinza',
  'dusk gray': 'dusk gray',
  'dusk gary': 'dusk gray', // Protege contra o erro de digitação comum
  'purple': 'roxo',
  'pulse purple': 'pulse purple',
  'lavender': 'lavanda',
  'brown': 'marrom',
  'marron': 'marrom', // Protege contra erro de digitação comum
  'space gray': 'cinza',
  'cinza espacial': 'cinza',
  'titanio natural': 'titânio natural',
  'titânio natural': 'titânio natural',
  'natural titanium': 'titânio natural',
  'titanio preto': 'titânio preto',
  'titânio preto': 'titânio preto',
  'black titanium': 'titânio preto',
  'titanio branco': 'titânio branco',
  'titânio branco': 'titânio branco',
  'white titanium': 'titânio branco',
  'titanio azul': 'titânio azul',
  'titânio azul': 'titânio azul',
  'blue titanium': 'titânio azul',
  'titanio deserto': 'titânio deserto',
  'titânio deserto': 'titânio deserto',
  'desert titanium': 'titânio deserto',
  'titanio': 'titânio natural',
  'titânio': 'titânio natural',
  'meia noite': 'meia-noite',
  'midnight': 'meia-noite',
  'starlight': 'estelar',
  'forest owl': 'forest owl'
};

/**
 * Mapeamento dinâmico de estilos Tailwind para cada cor canônica.
 */
const COLOR_STYLES = {
  preto: {
    badge: 'bg-zinc-950/80 text-zinc-300 border-zinc-700/60 shadow-sm',
    dot: 'bg-zinc-400'
  },
  'obsidian black': {
    badge: 'bg-zinc-950/90 text-zinc-200 border-zinc-600/70 shadow-sm',
    dot: 'bg-zinc-300 shadow-[0_0_4px_rgba(255,255,255,0.4)]'
  },
  'metallic black': {
    badge: 'bg-neutral-950/90 text-neutral-200 border-neutral-600/70 shadow-sm',
    dot: 'bg-neutral-300'
  },
  branco: {
    badge: 'bg-slate-100/10 text-slate-100 border-slate-300/40 shadow-sm',
    dot: 'bg-slate-100 shadow-[0_0_6px_rgba(255,255,255,0.8)]'
  },
  'veil white': {
    badge: 'bg-slate-100/15 text-slate-100 border-slate-200/50 shadow-sm',
    dot: 'bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)]'
  },
  estelar: {
    badge: 'bg-amber-100/10 text-amber-100 border-amber-200/40 shadow-sm',
    dot: 'bg-amber-100 shadow-[0_0_5px_rgba(254,243,199,0.7)]'
  },
  creme: {
    badge: 'bg-amber-50/10 text-amber-200 border-amber-200/30 shadow-sm',
    dot: 'bg-amber-100'
  },
  bege: {
    badge: 'bg-stone-900/60 text-stone-300 border-stone-600/40 shadow-sm',
    dot: 'bg-[#d2b48c]'
  },
  azul: {
    badge: 'bg-blue-950/50 text-blue-300 border-blue-700/50 shadow-sm',
    dot: 'bg-blue-400'
  },
  'azul claro': {
    badge: 'bg-sky-950/50 text-sky-300 border-sky-600/50 shadow-sm',
    dot: 'bg-sky-400'
  },
  'azul escuro': {
    badge: 'bg-indigo-950/60 text-indigo-300 border-indigo-700/60 shadow-sm',
    dot: 'bg-indigo-400'
  },
  'meia-noite': {
    badge: 'bg-[#0b1329]/90 text-blue-200 border-blue-900/60 shadow-sm',
    dot: 'bg-blue-300 shadow-[0_0_5px_rgba(147,197,253,0.5)]'
  },
  vermelho: {
    badge: 'bg-red-950/50 text-red-300 border-red-700/50 shadow-sm',
    dot: 'bg-red-500'
  },
  verde: {
    badge: 'bg-emerald-950/50 text-emerald-300 border-emerald-700/50 shadow-sm',
    dot: 'bg-emerald-400'
  },
  'verde menta': {
    badge: 'bg-teal-950/50 text-teal-300 border-teal-600/50 shadow-sm',
    dot: 'bg-teal-300'
  },
  'forest owl': {
    badge: 'bg-[#0f241a]/80 text-emerald-200 border-emerald-800/60 shadow-sm',
    dot: 'bg-emerald-500'
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
  'dusk gray': {
    badge: 'bg-zinc-900/80 text-zinc-300 border-zinc-600/60 shadow-sm',
    dot: 'bg-zinc-400'
  },
  grafite: {
    badge: 'bg-neutral-900/80 text-neutral-300 border-neutral-700/60 shadow-sm',
    dot: 'bg-neutral-400'
  },
  roxo: {
    badge: 'bg-purple-950/50 text-purple-300 border-purple-700/50 shadow-sm',
    dot: 'bg-purple-400'
  },
  'pulse purple': {
    badge: 'bg-purple-950/70 text-purple-200 border-purple-500/60 shadow-sm',
    dot: 'bg-purple-300 shadow-[0_0_5px_rgba(216,180,254,0.6)]'
  },
  lavanda: {
    badge: 'bg-indigo-950/50 text-indigo-300 border-indigo-500/50 shadow-sm',
    dot: 'bg-indigo-300'
  },
  amarelo: {
    badge: 'bg-yellow-950/50 text-yellow-300 border-yellow-600/50 shadow-sm',
    dot: 'bg-yellow-400'
  },
  laranja: {
    badge: 'bg-orange-950/50 text-orange-300 border-orange-600/50 shadow-sm',
    dot: 'bg-orange-400'
  },
  marrom: {
    badge: 'bg-[#2b1810]/70 text-amber-200 border-amber-900/50 shadow-sm',
    dot: 'bg-amber-700'
  },
  'titânio natural': {
    badge: 'bg-stone-900/80 text-amber-100 border-stone-600/60 shadow-sm',
    dot: 'bg-[#c5bfae]'
  },
  'titânio preto': {
    badge: 'bg-zinc-950/90 text-zinc-300 border-zinc-700/70 shadow-sm',
    dot: 'bg-zinc-500'
  },
  'titânio branco': {
    badge: 'bg-slate-100/10 text-slate-100 border-slate-300/50 shadow-sm',
    dot: 'bg-slate-200 shadow-[0_0_5px_rgba(255,255,255,0.7)]'
  },
  'titânio azul': {
    badge: 'bg-slate-900/80 text-blue-300 border-blue-800/60 shadow-sm',
    dot: 'bg-blue-400'
  },
  'titânio deserto': {
    badge: 'bg-amber-950/40 text-amber-200 border-amber-700/50 shadow-sm',
    dot: 'bg-[#d8b589]'
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

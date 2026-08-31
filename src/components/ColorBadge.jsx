import React from 'react';

/**
 * Componente modular e reutilizável para exibição elegante de cores dos aparelhos/IMEIs.
 */
export default function ColorBadge({ cor, className = '', showLabel = false }) {
  const hasCor = Boolean(cor && String(cor).trim());
  const valorCor = hasCor ? String(cor).trim() : 'Sem cor';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold border transition-all ${
        hasCor
          ? 'bg-purple-950/30 text-purple-300 border-purple-800/40 font-mono shadow-sm'
          : 'bg-zinc-900/50 text-gray-500 border-zinc-800/40 font-sans'
      } ${className}`}
    >
      {showLabel && <span className="text-gray-500 font-normal text-[9px]">Cor:</span>}
      <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
      <span className="truncate max-w-[120px]">{valorCor}</span>
    </span>
  );
}

import React, { useState, useEffect } from 'react';
import { X, Smartphone, Check, Loader2, Lock, ShieldAlert } from 'lucide-react';
import ColorBadge from './ColorBadge';

// Lista fechada de cores padronizadas no sistema
const CORES_PADRONIZADAS = [
  'Preto',
  'Branco',
  'Azul',
  'Vermelho',
  'Verde',
  'Rosa',
  'Dourado',
  'Prateado',
  'Cinza',
  'Roxo',
  'Grafite',
  'Amarelo',
  'Laranja',
  'Titânio Natural',
  'Titânio Preto',
  'Titânio Branco',
  'Titânio Azul'
];

/**
 * Modal de edição de IMEI/Cor com trava de segurança de IMEI read-only
 * e dropdown fechado com padronização de cores.
 */
export default function ModalEditarImei({ imeiObj, isOpen, onClose, onSave }) {
  const [corSelecionada, setCorSelecionada] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (imeiObj && imeiObj.cor) {
      // Tentar encontrar uma correspondência exata ou insensível a maiúsculas
      const corEncontrada = CORES_PADRONIZADAS.find(
        c => c.toLowerCase() === String(imeiObj.cor).trim().toLowerCase()
      );
      setCorSelecionada(corEncontrada || imeiObj.cor || 'Preto');
    } else {
      setCorSelecionada('Preto');
    }
  }, [imeiObj]);

  if (!isOpen || !imeiObj) return null;

  const handleConfirmSave = async (e) => {
    e.preventDefault();
    if (!corSelecionada || isSaving) return;

    setIsSaving(true);
    try {
      await onSave(imeiObj.id, corSelecionada, imeiObj.produto_id || imeiObj.produto_catalogo_id);
      onClose();
    } catch (err) {
      console.error("Erro ao salvar cor do IMEI:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#0A0A0A] border border-[#6A0DAD]/40 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-6 relative overflow-hidden">
        
        {/* Glow de fundo */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#6A0DAD]/20 rounded-full blur-2xl pointer-events-none" />

        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-[#222222] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#6A0DAD]/20 border border-[#6A0DAD]/40 rounded-xl text-purple-300">
              <Smartphone size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">Editar Aparelho / IMEI</h3>
              <p className="text-xs text-gray-500">Ajuste de cor e conferência de cadastro</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleConfirmSave} className="space-y-4">
          
          {/* Campo 1: IMEI (Read-Only com Trava de Rastreabilidade) */}
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Número de IMEI (Chave Físico)</span>
              <span className="text-[10px] text-amber-400 font-semibold flex items-center gap-1">
                <Lock size={10} /> Somente Leitura
              </span>
            </label>
            <div className="relative">
              <input
                type="text"
                readOnly
                disabled
                value={imeiObj.imei || ''}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-gray-300 font-mono tracking-widest cursor-not-allowed select-all"
              />
              <Lock size={14} className="absolute right-3.5 top-3.5 text-gray-600" />
            </div>
            <div className="mt-1.5 flex items-start gap-1.5 text-[10px] text-gray-500">
              <ShieldAlert size={12} className="text-amber-500 shrink-0 mt-0.5" />
              <span>O IMEI é o identificador único de rastreabilidade do aparelho e não pode ser alterado livremente.</span>
            </div>
          </div>

          {/* Campo 2: Correção de Cor (Select Fechado com Opções Padronizadas) */}
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Cor do Aparelho</span>
              <ColorBadge cor={corSelecionada} />
            </label>
            <select
              value={corSelecionada}
              onChange={(e) => setCorSelecionada(e.target.value)}
              className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-xl px-4 py-2.5 text-sm text-white outline-none transition-all cursor-pointer font-medium"
            >
              <option value="" disabled>Selecione a cor correta...</option>
              {CORES_PADRONIZADAS.map(corOption => (
                <option key={corOption} value={corOption} className="bg-zinc-950 text-white">
                  {corOption}
                </option>
              ))}
              {/* Caso o dado venha com um valor fora do padrão (ex: 'Petro'), manter como opção selecionável para substituição */}
              {!CORES_PADRONIZADAS.includes(corSelecionada) && corSelecionada && (
                <option value={corSelecionada} className="bg-zinc-950 text-amber-400 font-bold">
                  ⚠️ {corSelecionada} (Valor não padronizado no banco)
                </option>
              )}
            </select>
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#222222]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2.5 rounded-xl border border-zinc-800 text-gray-400 hover:text-white hover:bg-zinc-900 text-xs font-bold transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-[#6A0DAD] hover:bg-[#500885] text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>Salvar Cor do IMEI</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}

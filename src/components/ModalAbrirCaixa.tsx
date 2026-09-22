import React, { useState } from 'react';
import { Store, ShieldCheck, CheckCircle2, Loader2, X, AlertCircle } from 'lucide-react';
import { supabase } from '../supabaseClient';

export interface ModalAbrirCaixaProps {
  isOpen: boolean;
  onClose?: () => void;
  filialId?: string;
  filialNome?: string;
  operadorId?: string;
  operadorNome?: string;
  empresaId?: string;
  canClose?: boolean;
  onCaixaAberto?: (caixa: any) => void;
  handleAbrirCaixa?: (data: { fundoTrocoInicial: number; observacaoAbertura: string | null }) => Promise<any> | any;
}

export const ModalAbrirCaixa: React.FC<ModalAbrirCaixaProps> = ({
  isOpen,
  onClose,
  filialId,
  filialNome,
  operadorId,
  operadorNome,
  empresaId,
  canClose = true,
  onCaixaAberto,
  handleAbrirCaixa
}) => {
  const [fundoTrocoInicial, setFundoTrocoInicial] = useState<string>('');
  const [observacaoAbertura, setObservacaoAbertura] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const quickValues = [0, 50, 100, 200, 300, 500];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const valorAbertura = Number(
      parseFloat(String(fundoTrocoInicial).replace(/\./g, '').replace(',', '.')) || 0
    );
    const obsAbertura = observacaoAbertura?.trim() || null;

    setIsSubmitting(true);

    try {
      if (handleAbrirCaixa) {
        const resultado = await handleAbrirCaixa({
          fundoTrocoInicial: valorAbertura,
          observacaoAbertura: obsAbertura
        });
        if (onCaixaAberto && resultado) {
          onCaixaAberto(resultado);
        }
        setFundoTrocoInicial('');
        setObservacaoAbertura('');
        onClose?.();
        return;
      }

      // Payload estrito conforme especificado:
      // {
      //   operador_id: user.id,
      //   filial_id: filialAtivaId,
      //   valor_abertura: Number(fundoTrocoInicial || 0),
      //   status: 'ABERTO',
      //   data_abertura: new Date().toISOString(),
      //   observacao: observacaoAbertura?.trim() || null
      // }
      const payloadCompleto: Record<string, any> = {
        operador_id: operadorId,
        filial_id: filialId,
        valor_abertura: valorAbertura,
        saldo_inicial: valorAbertura,
        status: 'ABERTO',
        data_abertura: new Date().toISOString(),
        observacao: obsAbertura,
        observacao_abertura: obsAbertura,
        observacoes_abertura: obsAbertura,
        ...(empresaId ? { empresa_id: empresaId } : {})
      };

      let insertedData = null;

      // 1. Tentar inserção na tabela 'caixas'
      const { data, error } = await supabase
        .from('caixas')
        .insert(payloadCompleto)
        .select()
        .single();

      if (error) {
        console.warn('[ModalAbrirCaixa] Tentando inserção com colunas padrão de caixas:', error);
        // Fallback caso colunas como valor_abertura / observacao não existam no schema
        const fallbackCaixas = {
          operador_id: operadorId,
          filial_id: filialId,
          saldo_inicial: valorAbertura,
          observacao_abertura: obsAbertura,
          observacoes_abertura: obsAbertura,
          status: 'ABERTO',
          data_abertura: new Date().toISOString(),
          ...(empresaId ? { empresa_id: empresaId } : {})
        };

        const resFallback = await supabase
          .from('caixas')
          .insert(fallbackCaixas)
          .select()
          .single();

        if (resFallback.error) {
          // 2. Tentar inserção alternativa na tabela 'fechamentos_caixa'
          console.warn('[ModalAbrirCaixa] Tentando tabela fechamentos_caixa:', resFallback.error);
          const resFechamentos = await supabase
            .from('fechamentos_caixa')
            .insert({
              operador_id: operadorId,
              filial_id: filialId,
              valor_abertura: valorAbertura,
              status: 'ABERTO',
              data_abertura: new Date().toISOString(),
              observacao: obsAbertura
            })
            .select()
            .single();

          if (resFechamentos.error) {
            throw resFallback.error || resFechamentos.error;
          }
          insertedData = resFechamentos.data;
        } else {
          insertedData = resFallback.data;
        }
      } else {
        insertedData = data;
      }

      setFundoTrocoInicial('');
      setObservacaoAbertura('');
      if (onCaixaAberto) {
        onCaixaAberto(insertedData);
      }
      onClose?.();
    } catch (err: any) {
      console.error('[ModalAbrirCaixa] Erro ao abrir caixa:', err);
      setErrorMsg(err?.message || 'Falha ao registrar a abertura do caixa.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fadeIn">
      <div className="bg-[#0A0A0A] border border-[#6A0DAD]/50 rounded-2xl max-w-md w-full p-6 space-y-5 flex flex-col relative shadow-[0_0_50px_rgba(106,13,173,0.25)] font-sans">
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between pb-3 border-b border-[#222]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#6A0DAD]/20 border border-[#6A0DAD]/40 text-[#c084fc]">
              <Store size={22} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
                Abrir Caixa
                <span className="text-[10px] bg-amber-950/40 text-amber-300 border border-amber-800/40 px-2 py-0.5 rounded-full font-bold uppercase">
                  Início de Turno
                </span>
              </h3>
              <p className="text-xs text-gray-400">
                {filialNome || 'Filial Selecionada'} • Operador: {operadorNome || 'Operador'}
              </p>
            </div>
          </div>

          {canClose && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
              title="Fechar modal de abertura"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Card Informativo */}
          <div className="p-3.5 bg-purple-950/20 border border-[#6A0DAD]/30 rounded-xl flex items-start gap-2.5 text-xs text-purple-200/90">
            <ShieldCheck size={18} className="text-[#c084fc] shrink-0 mt-0.5" />
            <p>
              O PDV requer a abertura do caixa para emissão de pedidos e controle da gaveta nesta filial.
            </p>
          </div>

          {/* Campo Fundo de Troco Inicial (R$) */}
          <div>
            <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Fundo de Troco Inicial (R$) *</span>
              <span className="text-[10px] text-gray-500 font-normal">Dinheiro físico em gaveta</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[#6A0DAD] font-mono">
                R$
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                autoFocus
                value={fundoTrocoInicial}
                onChange={(e) => setFundoTrocoInicial(e.target.value)}
                placeholder="0.00"
                className="w-full bg-black border border-[#333] focus:border-[#6A0DAD] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white font-mono font-bold outline-none transition-all"
              />
            </div>

            {/* Botões Rápidos de Troco */}
            <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1">
              {quickValues.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setFundoTrocoInicial(val.toFixed(2))}
                  className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-[#222] hover:border-[#6A0DAD]/50 rounded-lg text-[10px] font-mono text-gray-300 hover:text-white transition-all cursor-pointer shrink-0"
                >
                  R$ {val}
                </button>
              ))}
            </div>
          </div>

          {/* Campo Observação Geral (Opcional) */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Observação Geral</span>
              <span className="text-[10px] text-gray-500 font-normal">Opcional</span>
            </label>
            <input
              type="text"
              value={observacaoAbertura}
              onChange={(e) => setObservacaoAbertura(e.target.value)}
              placeholder="Ex: Troco inicial conferido na gaveta..."
              className="w-full bg-black border border-[#222] focus:border-[#6A0DAD] rounded-xl px-3.5 py-2 text-xs text-white outline-none transition-all placeholder:text-gray-600"
            />
          </div>

          {/* Mensagem de Erro (se houver) */}
          {errorMsg && (
            <div className="p-3 bg-red-950/40 border border-red-800/40 rounded-xl text-xs text-red-300 flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Botão de Ação */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-[#6A0DAD] hover:bg-[#500885] text-white text-xs font-extrabold rounded-xl transition-all shadow-lg shadow-[#6A0DAD]/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin text-white" />
                  Registrando Abertura de Caixa...
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  Confirmar e Abrir Caixa
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModalAbrirCaixa;

import React, { useState } from 'react';
import { Store, ShieldCheck, CheckCircle2, Loader2, X, AlertCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { parseMonetaryValue, formatCurrency } from '../utils/currencyUtils';

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
  handleAbrirCaixa?: (data: { fundoTrocoInicial: number; observacaoAbertura: string | null; confirmadoAlto?: boolean }) => Promise<any> | any;
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
  const [confirmouValorAlto, setConfirmouValorAlto] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const quickValues = [0, 50, 100, 200, 300, 500];
  const valorAberturaCalculado = parseMonetaryValue(fundoTrocoInicial);
  const isValorAlto = valorAberturaCalculado > 2000;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const valorAbertura = parseMonetaryValue(fundoTrocoInicial);
    const obsAbertura = observacaoAbertura?.trim() || null;

    if (valorAbertura > 2000 && !confirmouValorAlto) {
      setErrorMsg(`O valor de R$ ${valorAbertura.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} é anormalmente alto. Por favor, confirme a autorização marcando a caixa de seleção.`);
      return;
    }

    setIsSubmitting(true);

    try {
      if (handleAbrirCaixa) {
        const resultado = await handleAbrirCaixa({
          fundoTrocoInicial: valorAbertura,
          observacaoAbertura: obsAbertura,
          confirmadoAlto: confirmouValorAlto
        });
        if (onCaixaAberto && resultado) {
          onCaixaAberto(resultado);
        }
        setFundoTrocoInicial('');
        setObservacaoAbertura('');
        setConfirmouValorAlto(false);
        onClose?.();
        return;
      }

      // Payload estrito conforme especificado garantindo compatibilidade com todas as colunas
      const payloadCompleto: Record<string, any> = {
        operador_id: operadorId,
        filial_id: filialId,
        valor_abertura: valorAbertura,
        saldo_inicial: valorAbertura,
        fundo_troco: valorAbertura,
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
        // Fallback caso colunas extras não existam no schema
        const fallbackCaixas = {
          operador_id: operadorId,
          filial_id: filialId,
          saldo_inicial: valorAbertura,
          valor_abertura: valorAbertura,
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
      setConfirmouValorAlto(false);
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
                type="text"
                inputMode="decimal"
                required
                autoFocus
                value={fundoTrocoInicial}
                onChange={(e) => {
                  setErrorMsg(null);
                  setFundoTrocoInicial(e.target.value);
                }}
                placeholder="0,00"
                className="w-full bg-black border border-[#333] focus:border-[#6A0DAD] rounded-xl pl-10 pr-24 py-2.5 text-sm text-white font-mono font-bold outline-none transition-all"
              />
              {fundoTrocoInicial && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-gray-400 font-mono select-none">
                  = R$ {valorAberturaCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              )}
            </div>

            {/* Trava e Alerta de Segurança para Valores Anormalmente Altos (> R$ 2.000,00) */}
            {isValorAlto && (
              <div className="mt-2 p-3 bg-amber-950/40 border border-amber-600/50 rounded-xl space-y-2 text-xs animate-fadeIn">
                <div className="flex items-start gap-2 text-amber-300">
                  <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-400" />
                  <div>
                    <strong className="block font-bold">Atenção: Valor de Troco Anormalmente Alto</strong>
                    <p className="text-amber-200/90 text-[11px] mt-0.5 leading-relaxed">
                      O valor informado é de <strong className="font-mono text-white underline">R$ {valorAberturaCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>. Por segurança, aberturas com troco superior a R$ 2.000,00 exigem conferência.
                    </p>
                  </div>
                </div>

                {/* Sugestão de divisão caso tenha digitado sem vírgula (ex: 62300 em vez de 623,00) */}
                {valorAberturaCalculado >= 10000 && (
                  <div className="flex items-center justify-between bg-black/50 p-2 rounded-lg border border-amber-800/40">
                    <span className="text-[11px] text-gray-300">
                      Você pretendia informar <strong className="text-emerald-400 font-mono">R$ {(valorAberturaCalculado / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>?
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const corrigido = (valorAberturaCalculado / 100).toFixed(2);
                        setFundoTrocoInicial(corrigido);
                      }}
                      className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded text-[10px] font-bold cursor-pointer transition-colors"
                    >
                      Ajustar (/100)
                    </button>
                  </div>
                )}

                {/* Checkbox de confirmação explícita */}
                <label className="flex items-center gap-2 cursor-pointer pt-1 text-amber-200 select-none">
                  <input
                    type="checkbox"
                    checked={confirmouValorAlto}
                    onChange={(e) => setConfirmouValorAlto(e.target.checked)}
                    className="rounded border-amber-600 text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-[11px] font-semibold">
                    Confirmo que o valor de R$ {valorAberturaCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} para troco inicial está correto
                  </span>
                </label>
              </div>
            )}

            {/* Botões Rápidos de Troco */}
            <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1">
              {quickValues.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => {
                    setFundoTrocoInicial(val.toFixed(2));
                    setConfirmouValorAlto(false);
                  }}
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
              disabled={isSubmitting || (isValorAlto && !confirmouValorAlto)}
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

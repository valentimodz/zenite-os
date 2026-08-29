import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { ClipboardCheck, ShieldAlert, EyeOff, Loader2, AlertCircle, CheckCircle2, Package } from 'lucide-react';

export default function ModalAuditoriaCega({ isOpen, activeEmpresaId, session, profile, onSuccess }) {
  const [itens, setItens] = useState([]);
  const [quantidades, setQuantidades] = useState({});
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);

  // 1. Função assíncrona que sorteia os 5 produtos para auditoria cega via RPC
  const sortearAuditoria = async () => {
    if (!activeEmpresaId) return;
    setLoading(true);
    setErro('');
    try {
      const { data, error } = await supabase.rpc('sortear_auditoria_cega', { 
        loja_id: activeEmpresaId 
      });

      if (error) {
        console.error('Erro na RPC sortear_auditoria_cega:', error);
        throw error;
      }

      if (data && Array.isArray(data)) {
        setItens(data);
        // Inicializa o estado de inputs vazio
        const initialQty = {};
        data.forEach(item => {
          const key = item.id_produto || item.id;
          initialQty[key] = '';
        });
        setQuantidades(initialQty);
      } else {
        setItens([]);
      }
    } catch (err) {
      console.error('Falha ao carregar auditoria cega:', err);
      setErro(err.message || 'Falha ao sortear produtos para auditoria.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeEmpresaId) {
      sortearAuditoria();
    }
  }, [isOpen, activeEmpresaId]);

  const handleQtyChange = (produtoId, valor) => {
    setQuantidades(prev => ({
      ...prev,
      [produtoId]: valor
    }));
  };

  // 2. Salvar contagem na tabela auditoria_inventario
  const handleSalvarAuditoria = async (e) => {
    e.preventDefault();
    if (itens.length === 0) return;

    // Validar se todos os itens foram preenchidos
    for (const item of itens) {
      const key = item.id_produto || item.id;
      const val = quantidades[key];
      if (val === '' || val === null || val === undefined || isNaN(Number(val)) || Number(val) < 0) {
        setErro(`Por favor, informe a quantidade física válida contada para o produto "${item.nome_produto || item.nome}".`);
        return;
      }
    }

    setSalvando(true);
    setErro('');

    try {
      const payload = itens.map(item => {
        const key = item.id_produto || item.id;
        return {
          id_produto: key,
          qtd_fisica: parseInt(quantidades[key], 10),
          filial_id: activeEmpresaId,
          empresa_id: profile?.empresa_id || null,
          usuario_id: session?.user?.id || null,
          created_at: new Date().toISOString()
        };
      });

      const { error: insertError } = await supabase
        .from('auditoria_inventario')
        .insert(payload);

      if (insertError) {
        console.error('Erro ao gravar em auditoria_inventario:', insertError);
        throw insertError;
      }

      setSucesso(true);
      setTimeout(() => {
        if (onSuccess) onSuccess();
      }, 1200);

    } catch (err) {
      console.error('Falha ao salvar auditoria inventário:', err);
      setErro('Erro ao salvar auditoria: ' + (err.message || 'Erro de conexão com o banco.'));
    } finally {
      setSalvando(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn select-none"
      // Bloqueio rigoroso: sem fechamento ao clicar fora
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-[#0A0A0A] border border-amber-500/40 rounded-2xl max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-2xl shadow-amber-950/30 relative">
        
        {/* Header do Modal */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-400 mb-1">
            <EyeOff className="w-8 h-8 animate-pulse" />
          </div>
          <div className="flex items-center justify-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-amber-950/60 text-amber-300 border border-amber-500/40">
              Protocolo Gerencial
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Auditoria Matinal Cega de Estoque
          </h2>
          <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
            Faça a contagem física real dos 5 itens sorteados abaixo na sua loja antes de iniciar o expediente.
          </p>
        </div>

        {/* Alerta de Obrigatoriedade */}
        <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-3.5 flex items-start gap-3 text-xs text-amber-200">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="leading-snug">
            <strong className="block text-amber-300 font-bold mb-0.5">Procedimento Obrigatório:</strong>
            Não é possível fechar ou ignorar este modal. Insira a quantidade contada na prateleira/gaveta para liberar o acesso ao sistema.
          </div>
        </div>

        {/* Mensagem de Erro */}
        {erro && (
          <div className="bg-red-950/40 border border-red-500/40 rounded-xl p-3.5 flex items-center gap-2.5 text-xs text-red-200 animate-shake">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        {/* Mensagem de Sucesso */}
        {sucesso && (
          <div className="bg-green-950/40 border border-green-500/40 rounded-xl p-4 flex items-center justify-center gap-2 text-xs text-green-300 font-bold animate-fadeIn">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            Auditoria salva com sucesso! Liberando acesso...
          </div>
        )}

        {/* Lista dos 5 Produtos */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-gray-400">
            <Loader2 className="w-8 h-8 text-[#6A0DAD] animate-spin" />
            <p className="text-xs font-semibold">Sorteando 5 produtos aleatórios no inventário...</p>
          </div>
        ) : (
          <form onSubmit={handleSalvarAuditoria} className="space-y-4">
            <div className="space-y-2.5 max-h-[42vh] overflow-y-auto pr-1 custom-scrollbar">
              {itens.length === 0 ? (
                <div className="p-6 text-center text-gray-500 text-xs border border-[#222] rounded-xl">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  Nenhum item sorteado ou estoque vazio para a filial ativa.
                </div>
              ) : (
                itens.map((item, index) => {
                  const key = item.id_produto || item.id;
                  return (
                    <div 
                      key={key || index} 
                      className="bg-[#111111] border border-[#222222] hover:border-[#333333] rounded-xl p-3.5 flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-black border border-[#333] text-gray-400 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-extrabold text-white truncate">
                            {item.nome_produto || item.nome || 'Produto sem nome'}
                          </p>
                          <span className="text-[10px] text-gray-500 font-mono">
                            Código: {String(key).substring(0, 8)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <label className="text-[10px] uppercase font-bold text-gray-500 hidden sm:block">
                          Qtd Física:
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          required
                          value={quantidades[key] ?? ''}
                          onChange={(e) => handleQtyChange(key, e.target.value)}
                          placeholder="0"
                          disabled={salvando || sucesso}
                          className="w-20 sm:w-24 bg-black border border-[#333333] focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-lg px-3 py-2 text-center text-sm font-mono font-bold text-white outline-none transition-all placeholder:text-gray-600 disabled:opacity-50"
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Botão Salvar */}
            <button
              type="submit"
              disabled={loading || salvando || sucesso || itens.length === 0}
              className="w-full bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-black uppercase tracking-wider text-xs sm:text-sm py-3.5 rounded-xl transition-all shadow-lg shadow-amber-950/40 flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {salvando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                  Salvando Auditoria...
                </>
              ) : (
                <>
                  <ClipboardCheck className="w-4 h-4 text-black" />
                  Salvar Auditoria e Liberar Acesso
                </>
              )}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}

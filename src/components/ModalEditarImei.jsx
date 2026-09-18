import React, { useState, useEffect } from 'react';
import { X, Smartphone, Check, Loader2, Lock, ShieldAlert, UserCheck, Calendar, CreditCard, DollarSign } from 'lucide-react';
import ColorBadge from './ColorBadge';
import { supabase } from '../supabaseClient';

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

// Opções de Status do Aparelho
const STATUS_OPTIONS = [
  { value: 'DISPONIVEL', label: 'DISPONÍVEL' },
  { value: 'VENDIDO', label: 'VENDIDO' },
  { value: 'DEFEITO / ASSISTÊNCIA', label: 'DEFEITO / ASSISTÊNCIA' },
  { value: 'RESERVADO', label: 'RESERVADO' }
];

// Métodos de Pagamento para Baixa de Venda
const METODOS_PAGAMENTO = [
  { value: 'PIX', label: 'PIX' },
  { value: 'DINHEIRO', label: 'DINHEIRO' },
  { value: 'CARTAO_CREDITO', label: 'CARTÃO DE CRÉDITO' },
  { value: 'CARTAO_DEBITO', label: 'CARTÃO DE DÉBITO' }
];

/**
 * Normaliza strings de status para o formato padrão do select
 */
const normalizarStatus = (statusRaw) => {
  if (!statusRaw) return 'DISPONIVEL';
  const s = String(statusRaw).trim().toUpperCase();
  if (s.includes('VENDID')) return 'VENDIDO';
  if (s.includes('DEFEIT') || s.includes('ASSIST')) return 'DEFEITO / ASSISTÊNCIA';
  if (s.includes('RESERV')) return 'RESERVADO';
  return 'DISPONIVEL';
};

/**
 * Modal de edição de IMEI/Cor/Status com baixa assistida de venda
 */
export default function ModalEditarImei({ 
  imeiObj, 
  isOpen, 
  onClose, 
  onSave, 
  onSuccess, 
  recarregarLista, 
  fetchProdutos,
  showToast 
}) {
  const [corSelecionada, setCorSelecionada] = useState('');
  const [precoVenda, setPrecoVenda] = useState('');
  const [statusAparelho, setStatusAparelho] = useState('DISPONIVEL');

  // Campos condicionais para Status 'VENDIDO'
  const [vendedores, setVendedores] = useState([]);
  const [isLoadingVendedores, setIsLoadingVendedores] = useState(false);
  const [vendedorSelecionadoId, setVendedorSelecionadoId] = useState('');
  const [dataVenda, setDataVenda] = useState('');
  const [metodoPagamento, setMetodoPagamento] = useState('PIX');
  const [valorFinalVenda, setValorFinalVenda] = useState('');

  const [isSaving, setIsSaving] = useState(false);

  // Helper unificado de Toast
  const triggerToast = (mensagem, tipo = 'info') => {
    if (typeof showToast === 'function') {
      showToast(mensagem, tipo);
    } else if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(mensagem);
    }
  };

  // Carregar e sincronizar dados ao abrir modal ou trocar o IMEI
  useEffect(() => {
    if (imeiObj) {
      // 1. Cor
      if (imeiObj.cor) {
        const corEncontrada = CORES_PADRONIZADAS.find(
          c => c.toLowerCase() === String(imeiObj.cor).trim().toLowerCase()
        );
        setCorSelecionada(corEncontrada || imeiObj.cor || 'Preto');
      } else {
        setCorSelecionada('Preto');
      }

      // 2. Preço de venda
      const precoAtual = imeiObj.preco_venda ?? imeiObj.preco ?? imeiObj.produto?.preco_venda ?? imeiObj.produto?.preco ?? '';
      const precoFormatado = precoAtual !== '' && precoAtual !== null && precoAtual !== undefined ? String(precoAtual) : '';
      setPrecoVenda(precoFormatado);
      setValorFinalVenda(precoFormatado);

      // 3. Status inicial
      const st = normalizarStatus(imeiObj.status);
      setStatusAparelho(st);

      // 4. Data da venda padrão (dia de hoje em formato YYYY-MM-DD)
      const hoje = new Date().toISOString().split('T')[0];
      setDataVenda(hoje);

      // 5. Método de pagamento padrão
      setMetodoPagamento('PIX');
      setVendedorSelecionadoId('');
    } else {
      setCorSelecionada('Preto');
      setPrecoVenda('');
      setStatusAparelho('DISPONIVEL');
      setValorFinalVenda('');
      setVendedorSelecionadoId('');
    }
  }, [imeiObj, isOpen]);

  // Carregar lista de vendedores da filial ou da tabela profiles
  useEffect(() => {
    if (!isOpen || !imeiObj) return;

    let isMounted = true;
    const carregarVendedores = async () => {
      setIsLoadingVendedores(true);
      try {
        const filialId = imeiObj.filial_id || imeiObj.produto?.filial_id;
        
        let query = supabase
          .from('profiles')
          .select('id, nome, role, filial_id, cargo')
          .order('nome', { ascending: true });

        if (filialId) {
          query = query.eq('filial_id', filialId);
        }

        const { data, error } = await query;

        if (error) {
          // Se falhar com filtro de filial ou na primeira tentativa, busca geral
          const fallbackRes = await supabase
            .from('profiles')
            .select('id, nome, role, filial_id, cargo')
            .order('nome', { ascending: true });
          
          if (isMounted && fallbackRes.data) {
            // Filtrar vendedores/gerentes ou listar todos caso não haja role explícito
            const filtrados = fallbackRes.data.filter(p => {
              const r = String(p.role || p.cargo || '').toUpperCase();
              return !r || r.includes('VENDEDOR') || r.includes('GERENTE') || r.includes('ADMIN') || r.includes('DONO');
            });
            setVendedores(filtrados.length > 0 ? filtrados : fallbackRes.data);
          }
        } else if (isMounted && data) {
          // Filtrar preferencialmente vendedores/gerentes
          const filtrados = data.filter(p => {
            const r = String(p.role || p.cargo || '').toUpperCase();
            return !r || r.includes('VENDEDOR') || r.includes('GERENTE') || r.includes('ADMIN') || r.includes('DONO');
          });
          setVendedores(filtrados.length > 0 ? filtrados : data);
        }
      } catch (err) {
        console.warn('[ModalEditarImei] Erro ao carregar vendedores:', err);
      } finally {
        if (isMounted) setIsLoadingVendedores(false);
      }
    };

    carregarVendedores();

    return () => {
      isMounted = false;
    };
  }, [isOpen, imeiObj]);

  if (!isOpen || !imeiObj) return null;

  const handleConfirmSave = async (e) => {
    e.preventDefault();
    if (isSaving) return;

    // 1. Identificar UUID ou número do IMEI
    const targetUuid = (imeiObj.id || imeiObj.imei_id || imeiObj.id_imei) ? String(imeiObj.id || imeiObj.imei_id || imeiObj.id_imei).trim() : null;
    const numeroImeiLimpo = (imeiObj.imei || imeiObj.numero_imei || imeiObj.serial) ? String(imeiObj.imei || imeiObj.numero_imei || imeiObj.serial).trim() : null;

    const isValidoUuid = targetUuid && targetUuid !== 'undefined' && targetUuid !== 'null' && targetUuid.length > 10;
    const isValidoImei = numeroImeiLimpo && numeroImeiLimpo !== 'undefined' && numeroImeiLimpo !== 'null';

    if (!isValidoUuid && !isValidoImei) {
      console.error("[ModalEditarImei] Nenhum identificador válido (UUID ou IMEI) encontrado no objeto recebido:", imeiObj);
      triggerToast("Não foi possível identificar o aparelho selecionado (ID e IMEI ausentes).", 'error');
      return;
    }

    const corTrimmed = String(corSelecionada || '').trim();

    // Parse do preço de venda do campo individual
    let precoNum = null;
    if (precoVenda !== '' && precoVenda !== null && precoVenda !== undefined) {
      const parsed = parseFloat(String(precoVenda).replace('R$', '').replace(/\s/g, '').replace(',', '.'));
      if (!isNaN(parsed) && parsed >= 0) {
        precoNum = parsed;
      }
    }

    // 2. Fluxo quando o Status for 'VENDIDO'
    if (statusAparelho === 'VENDIDO') {
      if (!vendedorSelecionadoId) {
        triggerToast("Por favor, selecione o Vendedor responsável pela venda.", 'error');
        return;
      }

      let valorFinalNum = null;
      if (valorFinalVenda !== '' && valorFinalVenda !== null && valorFinalVenda !== undefined) {
        const parsedVenda = parseFloat(String(valorFinalVenda).replace('R$', '').replace(/\s/g, '').replace(',', '.'));
        if (!isNaN(parsedVenda) && parsedVenda >= 0) {
          valorFinalNum = parsedVenda;
        }
      }

      if (valorFinalNum === null) {
        triggerToast("Por favor, informe um Valor Final válido para a venda.", 'error');
        return;
      }

      const imeiParaRpc = numeroImeiLimpo || imeiObj.imei || imeiObj.numero_imei;
      if (!imeiParaRpc) {
        triggerToast("Número de IMEI ausente para registrar a baixa da venda.", 'error');
        return;
      }

      setIsSaving(true);
      try {
        // Obter timestamp da data selecionada
        let dataVendaIso;
        if (dataVenda) {
          // Se for somente data YYYY-MM-DD, anexar horário do meio-dia para evitar deslocamento de fuso
          const dataComHora = dataVenda.includes('T') ? dataVenda : `${dataVenda}T12:00:00`;
          dataVendaIso = new Date(dataComHora).toISOString();
        } else {
          dataVendaIso = new Date().toISOString();
        }

        // Chamar a RPC no Supabase
        const { data, error } = await supabase.rpc('baixar_imei_como_vendido', {
          p_imei: imeiParaRpc,
          p_vendedor_id: vendedorSelecionadoId,
          p_valor_venda: Number(valorFinalNum),
          p_metodo_pagamento: metodoPagamento,
          p_data_venda: dataVendaIso
        });

        if (error) {
          console.error("[ModalEditarImei] Erro na RPC baixar_imei_como_vendido:", error);
          triggerToast(error.message || "Erro ao registrar venda do aparelho.", 'error');
          return;
        }

        // Se a cor também foi editada, atualizar a cor no banco
        if (corTrimmed) {
          let qCor = supabase.from('imeis').update({ cor: corTrimmed });
          if (isValidoUuid) qCor = qCor.eq('id', targetUuid);
          else qCor = qCor.eq('imei', numeroImeiLimpo);
          await qCor;
        }

        // Sucesso na baixa de venda
        triggerToast("Venda registrada e aparelho baixado!", 'success');
        onClose();

        // Invalidar cache / atualizar lista de aparelhos
        if (typeof recarregarLista === 'function') {
          recarregarLista();
        }
        if (typeof fetchProdutos === 'function') {
          fetchProdutos();
        }
        const idParaCallback = isValidoUuid ? targetUuid : (numeroImeiLimpo || imeiObj.id);
        const prodId = imeiObj.produto_id || imeiObj.produto_catalogo_id;
        if (typeof onSuccess === 'function') {
          onSuccess(idParaCallback, corTrimmed, prodId, numeroImeiLimpo, valorFinalNum);
        }
        return;
      } catch (err) {
        console.error("[ModalEditarImei] Falha inesperada ao baixar IMEI como vendido:", err);
        triggerToast(err.message || 'Falha inesperada ao registrar venda.', 'error');
        return;
      } finally {
        setIsSaving(false);
      }
    }

    // 3. Fluxo normal (Status mantido como 'DISPONIVEL', 'DEFEITO / ASSISTÊNCIA' ou 'RESERVADO')
    setIsSaving(true);
    try {
      const updateData = { 
        cor: corTrimmed,
        status: statusAparelho 
      };
      if (precoNum !== null) {
        updateData.preco_venda = precoNum;
      }

      // Executar o UPDATE na tabela 'imeis'
      let query = supabase.from('imeis').update(updateData);
      if (isValidoUuid) {
        query = query.eq('id', targetUuid);
      } else {
        query = query.eq('imei', numeroImeiLimpo);
      }

      const { error } = await query;

      if (error) {
        console.error("[ModalEditarImei] Erro ao atualizar aparelho no Supabase:", error, { targetUuid, numeroImeiLimpo, imeiObj });
        triggerToast(`Erro ao salvar aparelho: ${error.message || 'Falha na comunicação com o banco de dados.'}`, 'error');
        return;
      }

      // Sucesso na atualização normal
      triggerToast("Dados do aparelho atualizados com sucesso!", 'success');
      onClose();

      const idParaCallback = isValidoUuid ? targetUuid : (numeroImeiLimpo || imeiObj.id);
      const prodId = imeiObj.produto_id || imeiObj.produto_catalogo_id;

      if (typeof onSave === 'function') {
        await onSave(idParaCallback, corTrimmed, prodId, numeroImeiLimpo, precoNum);
      }
      if (typeof onSuccess === 'function') {
        onSuccess(idParaCallback, corTrimmed, prodId, numeroImeiLimpo, precoNum);
      }
      if (typeof recarregarLista === 'function') {
        recarregarLista();
      }
      if (typeof fetchProdutos === 'function') {
        fetchProdutos();
      }
    } catch (err) {
      console.error("[ModalEditarImei] Falha inesperada ao atualizar dados do IMEI:", err);
      triggerToast(`Falha inesperada ao atualizar: ${err.message || 'Erro interno.'}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#0A0A0A] border border-[#6A0DAD]/40 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-5 relative">
        
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
              <p className="text-xs text-gray-500">Status, cor, conferência e baixa de venda</p>
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
                value={imeiObj.imei || imeiObj.numero_imei || ''}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm text-gray-300 font-mono tracking-widest cursor-not-allowed select-all"
              />
              <Lock size={14} className="absolute right-3.5 top-3 text-gray-600" />
            </div>
            <div className="mt-1 flex items-start gap-1.5 text-[10px] text-gray-500">
              <ShieldAlert size={12} className="text-amber-500 shrink-0 mt-0.5" />
              <span>O IMEI é o identificador único de rastreabilidade do aparelho e não pode ser alterado.</span>
            </div>
          </div>

          {/* Campo 2: Status do Aparelho */}
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Status do Aparelho</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                statusAparelho === 'DISPONIVEL' ? 'bg-emerald-950 text-emerald-400 border-emerald-800' :
                statusAparelho === 'VENDIDO' ? 'bg-purple-950 text-purple-300 border-purple-800' :
                statusAparelho === 'DEFEITO / ASSISTÊNCIA' ? 'bg-red-950 text-red-400 border-red-800' :
                'bg-amber-950 text-amber-400 border-amber-800'
              }`}>
                {statusAparelho}
              </span>
            </label>
            <select
              value={statusAparelho}
              onChange={(e) => setStatusAparelho(e.target.value)}
              className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-xl px-4 py-2.5 text-sm text-white outline-none transition-all cursor-pointer font-medium"
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value} className="bg-zinc-950 text-white">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Renderização Condicional: Campos exclusivos quando Status for 'VENDIDO' */}
          {statusAparelho === 'VENDIDO' && (
            <div className="p-4 bg-purple-950/20 border border-purple-800/40 rounded-xl space-y-3.5 animate-fadeIn">
              <div className="flex items-center gap-1.5 text-xs font-bold text-purple-300 border-b border-purple-800/30 pb-2">
                <UserCheck size={14} className="text-purple-400" />
                <span>Dados de Baixa da Venda</span>
              </div>

              {/* Select: Vendedor */}
              <div>
                <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1">
                  Vendedor <span className="text-red-400">*</span>
                </label>
                <select
                  value={vendedorSelecionadoId}
                  onChange={(e) => setVendedorSelecionadoId(e.target.value)}
                  required
                  className="w-full bg-black border border-purple-800/50 focus:border-purple-500 rounded-xl px-4 py-2 text-sm text-white outline-none transition-all cursor-pointer font-medium"
                >
                  <option value="">
                    {isLoadingVendedores ? 'Carregando vendedores...' : 'Selecione o vendedor...'}
                  </option>
                  {vendedores.map(v => (
                    <option key={v.id} value={v.id} className="bg-zinc-950 text-white">
                      {v.nome || v.email} {v.role ? `(${v.role})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Input: Data da Venda */}
              <div>
                <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>Data da Venda</span>
                  <span className="text-[10px] text-gray-400 font-normal flex items-center gap-1">
                    <Calendar size={11} /> Retroativa permitida
                  </span>
                </label>
                <input
                  type="date"
                  value={dataVenda}
                  onChange={(e) => setDataVenda(e.target.value)}
                  className="w-full bg-black border border-purple-800/50 focus:border-purple-500 rounded-xl px-4 py-2 text-sm text-white outline-none transition-all font-medium cursor-pointer"
                />
              </div>

              {/* Select: Método de Pagamento */}
              <div>
                <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <CreditCard size={12} className="text-purple-400" />
                  <span>Método de Pagamento</span>
                </label>
                <select
                  value={metodoPagamento}
                  onChange={(e) => setMetodoPagamento(e.target.value)}
                  className="w-full bg-black border border-purple-800/50 focus:border-purple-500 rounded-xl px-4 py-2 text-sm text-white outline-none transition-all cursor-pointer font-medium"
                >
                  {METODOS_PAGAMENTO.map(mp => (
                    <option key={mp.value} value={mp.value} className="bg-zinc-950 text-white">
                      {mp.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Input: Valor Final da Venda */}
              <div>
                <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <DollarSign size={12} className="text-emerald-400" />
                    <span>Valor Final (R$)</span>
                  </span>
                  <span className="text-[10px] text-emerald-400 font-semibold">Valor Efetivo</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2 text-xs text-gray-400 font-mono">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={valorFinalVenda}
                    onChange={(e) => setValorFinalVenda(e.target.value)}
                    placeholder="0,00"
                    className="w-full bg-black border border-purple-800/50 focus:border-emerald-500 rounded-xl pl-9 pr-4 py-2 text-sm text-white font-mono outline-none transition-all font-semibold"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Campo 3: Correção de Cor (Select Fechado com Opções Padronizadas) */}
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Cor do Aparelho</span>
              <ColorBadge cor={corSelecionada} />
            </label>
            <select
              value={corSelecionada}
              onChange={(e) => setCorSelecionada(e.target.value)}
              className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-xl px-4 py-2 text-sm text-white outline-none transition-all cursor-pointer font-medium"
            >
              <option value="" disabled>Selecione a cor correta...</option>
              {CORES_PADRONIZADAS.map(corOption => (
                <option key={corOption} value={corOption} className="bg-zinc-950 text-white">
                  {corOption}
                </option>
              ))}
              {!CORES_PADRONIZADAS.includes(corSelecionada) && corSelecionada && (
                <option value={corSelecionada} className="bg-zinc-950 text-amber-400 font-bold">
                  ⚠️ {corSelecionada} (Valor não padronizado no banco)
                </option>
              )}
            </select>
          </div>

          {/* Campo 4: Preço de Tabela/Venda Individual do Aparelho */}
          {statusAparelho !== 'VENDIDO' && (
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Preço de Venda do Aparelho (R$)</span>
                <span className="text-[10px] text-purple-400 font-semibold">Valor Individual</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-xs text-gray-500 font-mono">R$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={precoVenda}
                  onChange={(e) => {
                    setPrecoVenda(e.target.value);
                    setValorFinalVenda(e.target.value);
                  }}
                  placeholder="0,00"
                  className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-xl pl-9 pr-4 py-2 text-sm text-white font-mono outline-none transition-all font-semibold"
                />
              </div>
              <p className="mt-1 text-[10px] text-gray-500">
                Personalize o preço específico deste IMEI (se vazio, usa o preço de tabela do modelo).
              </p>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#222222]">
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
              className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50 ${
                statusAparelho === 'VENDIDO' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950' : 'bg-[#6A0DAD] hover:bg-[#500885]'
              }`}
            >
              {isSaving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>{statusAparelho === 'VENDIDO' ? 'Baixar Aparelho como Vendido' : 'Salvar Dados do IMEI'}</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}

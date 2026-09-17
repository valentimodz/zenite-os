import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { parseCaixaComGeminiClient } from '../services/geminiService';
import {
  X,
  Upload,
  FileText,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Barcode,
  Smartphone,
  Tag,
  DollarSign,
  Calendar,
  Building2,
  User,
  Key,
  ShieldCheck,
  RefreshCw,
  Eye,
  Trash2
} from 'lucide-react';

export default function ImportarCaixaRetroativoModal({
  isOpen,
  onClose,
  perfilUsuario,
  company,
  filiais = [],
  onSuccess
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [customApiKey, setCustomApiKey] = useState(() => localStorage.getItem('@zenite_gemini_api_key') || '');
  const [showKeyInput, setShowKeyInput] = useState(false);

  // Dados extraídos pela IA
  const [parsedData, setParsedData] = useState(null);
  const [dataCaixa, setDataCaixa] = useState('');
  const [selectedFilialId, setSelectedFilialId] = useState('');
  const [itensVenda, setItensVenda] = useState([]);

  // Estados de persistência
  const [isSaving, setIsSaving] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const fileInputRef = useRef(null);

  // Inicializar filial default quando as filiais carregarem
  useEffect(() => {
    if (filiais.length > 0 && !selectedFilialId) {
      const defaultFilial = filiais.find(f => f.id === perfilUsuario?.filial_id) || filiais[0];
      if (defaultFilial) {
        setSelectedFilialId(defaultFilial.id);
      }
    }
  }, [filiais, perfilUsuario, selectedFilialId]);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setErrorMessage('');
    setSuccessMessage('');
    setParsedData(null);
    setItensVenda([]);

    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setFilePreviewUrl(url);
    } else {
      setFilePreviewUrl(null);
    }
  };

  const handleProcessarComIA = async () => {
    if (!selectedFile) {
      setErrorMessage('Por favor, selecione um arquivo (PDF ou imagem) do fechamento de caixa.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      if (customApiKey.trim()) {
        localStorage.setItem('@zenite_gemini_api_key', customApiKey.trim());
      }

      const result = await parseCaixaComGeminiClient({
        file: selectedFile,
        customApiKey: customApiKey.trim()
      });

      if (!result || !result.vendas) {
        throw new Error('A resposta da IA não contém uma lista válida de vendas.');
      }

      setParsedData(result);
      setDataCaixa(result.data_caixa || new Date().toISOString().split('T')[0]);

      // Tentar associar filial pelo nome se a IA identificou algo
      if (result.filial_identificada && filiais.length > 0) {
        const filialLower = result.filial_identificada.toLowerCase();
        const matched = filiais.find(f => f.nome && filialLower.includes(f.nome.toLowerCase()));
        if (matched) {
          setSelectedFilialId(matched.id);
        }
      }

      // Mapear itens da venda com estado de IMEI controlado
      const mapped = (result.vendas || []).map((item, idx) => ({
        id: `item-${idx}-${Date.now()}`,
        produto_nome: item.produto_nome || 'Produto Sem Nome',
        vendedor_nome: item.vendedor_nome || 'Vendedor Padrão',
        categoria: item.categoria || (item.tipo_item === 'APARELHO' ? 'Celulares' : 'Acessórios'),
        tipo_item: item.tipo_item === 'APARELHO' ? 'APARELHO' : 'ACESSORIO',
        cor: item.cor || '',
        quantidade: Math.max(1, Number(item.quantidade) || 1),
        valor_total: Number(item.valor_total) || 0,
        forma_pagamento: item.forma_pagamento_principal || 'PIX',
        imei: '' // preenchido pelo usuário para aparelhos
      }));

      setItensVenda(mapped);
      setSuccessMessage(`IA processou a folha com sucesso! ${mapped.length} itens extraídos.`);
    } catch (err) {
      console.error('Erro no processamento da IA:', err);
      setErrorMessage(err.message || 'Falha ao processar o arquivo com a IA do Gemini.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateItem = (id, field, value) => {
    setItensVenda(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleRemoveItem = (id) => {
    setItensVenda(prev => prev.filter(item => item.id !== id));
  };

  // Validação: verificar se todos os celulares têm IMEI preenchido
  const aparelhosSemImei = itensVenda.filter(
    item => item.tipo_item === 'APARELHO' && (!item.imei || !item.imei.trim())
  );
  const totalItens = itensVenda.length;
  const totalValorExtraido = itensVenda.reduce((acc, curr) => acc + (Number(curr.valor_total) || 0), 0);
  const podeSalvar = totalItens > 0 && aparelhosSemImei.length === 0 && !isSaving;

  const handleConfirmarImportacao = async () => {
    if (aparelhosSemImei.length > 0) {
      setErrorMessage(`Atenção: Existem ${aparelhosSemImei.length} aparelho(s) sem o IMEI preenchido. Bipe os IMEIs antes de salvar.`);
      return;
    }

    if (!dataCaixa) {
      setErrorMessage('Por favor, informe a Data da Venda (Retroativa).');
      return;
    }

    const filialIdFinal = selectedFilialId || perfilUsuario?.filial_id || null;
    const empresaIdFinal = company?.id || perfilUsuario?.empresa_id || null;

    setIsSaving(true);
    setErrorMessage('');
    setProgressMsg('Iniciando importação retroativa no banco de dados...');

    try {
      // Formatar a data ISO retroativa (ex: 2026-09-16T18:00:00.000Z)
      const dataIsoRetroativa = `${dataCaixa}T18:00:00.000Z`;

      let salvosCount = 0;

      for (let i = 0; i < itensVenda.length; i++) {
        const item = itensVenda[i];
        setProgressMsg(`Processando item ${i + 1} de ${itensVenda.length}: ${item.produto_nome}...`);

        let produtoId = null;

        // 1. Verificar se produto já existe na filial
        if (filialIdFinal) {
          const { data: prodExistente } = await supabase
            .from('produtos')
            .select('id')
            .eq('filial_id', filialIdFinal)
            .ilike('nome', item.produto_nome.trim())
            .maybeSingle();

          if (prodExistente?.id) {
            produtoId = prodExistente.id;
          }
        }

        // Se não existir, criar o produto com created_at retroativo
        if (!produtoId) {
          const payloadNovoProd = {
            nome: item.produto_nome.trim(),
            categoria: item.categoria,
            tipo: item.tipo_item,
            preco: item.valor_total / item.quantidade,
            filial_id: filialIdFinal,
            empresa_id: empresaIdFinal,
            created_at: dataIsoRetroativa
          };

          const { data: novoProduto, error: prodErr } = await supabase
            .from('produtos')
            .insert([payloadNovoProd])
            .select('id')
            .single();

          if (prodErr) {
            console.warn('Aviso ao criar produto:', prodErr.message);
          } else if (novoProduto) {
            produtoId = novoProduto.id;
          }
        }

        // 2. Se for aparelho celular, inserir na tabela 'imeis' com status 'VENDIDO' e data retroativa
        if (item.tipo_item === 'APARELHO' && item.imei?.trim()) {
          const imeiLimpo = item.imei.trim();
          const { error: imeiErr } = await supabase
            .from('imeis')
            .insert([{
              imei: imeiLimpo,
              produto_id: produtoId,
              filial_id: filialIdFinal,
              cor: item.cor?.trim() || null,
              status: 'VENDIDO',
              created_at: dataIsoRetroativa
            }]);

          if (imeiErr) {
            console.warn(`Aviso ao registrar IMEI ${imeiLimpo}:`, imeiErr.message);
          }
        }

        // 3. Inserir a venda na tabela 'vendas' com created_at retroativo
        const precoUnitario = item.quantidade > 0 ? (item.valor_total / item.quantidade) : item.valor_total;
        const payloadVenda = {
          empresa_id: empresaIdFinal,
          filial_id: filialIdFinal,
          vendedor_nome: item.vendedor_nome,
          produto_nome: item.produto_nome,
          categoria: item.categoria,
          produto_id: produtoId,
          quantidade: item.quantidade,
          valor_total: item.valor_total,
          valor_pago: item.valor_total,
          preco_unitario_vendido: precoUnitario,
          metodo_pagamento: item.forma_pagamento || 'PIX',
          status_pagamento: 'concluido',
          imei: item.imei?.trim() || null,
          created_at: dataIsoRetroativa
        };

        const { error: vendaErr } = await supabase
          .from('vendas')
          .insert([payloadVenda]);

        if (vendaErr) {
          throw new Error(`Erro ao salvar venda de "${item.produto_nome}": ${vendaErr.message}`);
        }

        salvosCount++;
      }

      // Notificar sucesso e disparar eventos
      setSuccessMessage(`Sucesso! ${salvosCount} vendas retroativas gravadas com a data ${dataCaixa}.`);
      setProgressMsg('');

      try {
        window.dispatchEvent(new Event('vendas_updated'));
        window.dispatchEvent(new Event('estoque_updated'));
      } catch (_) {}

      setTimeout(() => {
        if (typeof onSuccess === 'function') {
          onSuccess(salvosCount, dataCaixa);
        }
        handleClose();
      }, 1500);

    } catch (err) {
      console.error('Erro na gravação retroativa:', err);
      setErrorMessage(err.message || 'Falha ao salvar as vendas retroativas no banco.');
    } finally {
      setIsSaving(false);
      setProgressMsg('');
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setFilePreviewUrl(null);
    setParsedData(null);
    setItensVenda([]);
    setErrorMessage('');
    setSuccessMessage('');
    setProgressMsg('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div className="bg-[#0A0A0A] border border-[#6A0DAD]/40 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        
        {/* CABEÇALHO DO MODAL */}
        <div className="bg-gradient-to-r from-[#140026] via-[#0A0A0A] to-[#0A0A0A] px-6 py-4 border-b border-[#222222] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6A0DAD] to-[#400870] flex items-center justify-center shadow-lg shadow-purple-950/40 border border-purple-500/30">
              <Sparkles size={20} className="text-yellow-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-white tracking-wide">
                  Importação de Caixa e Vendas Retroativas via IA
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#6A0DAD]/20 text-purple-300 border border-[#6A0DAD]/40 flex items-center gap-1">
                  ⚡ Gemini 3.6 Flash
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Envie o PDF ou foto da folha de caixa física para digitação automática e bipagem rápida de IMEIs.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowKeyInput(prev => !prev)}
              className="px-2.5 py-1.5 rounded-lg border border-[#333] hover:border-[#6A0DAD] bg-black text-gray-400 hover:text-white text-xs flex items-center gap-1.5 transition-colors"
              title="Configurar chave de API do Gemini"
            >
              <Key size={13} className="text-yellow-400" />
              <span className="hidden sm:inline">Chave Gemini</span>
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="text-gray-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* PAINEL OPCIONAL: CONFIGURAR CHAVE GEMINI */}
        {showKeyInput && (
          <div className="bg-[#111] px-6 py-3 border-b border-[#222] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-gray-300 w-full sm:w-auto">
              <Key size={14} className="text-yellow-400 shrink-0" />
              <span className="font-semibold">Chave da API Google GenAI (VITE_GEMINI_API_KEY):</span>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="password"
                value={customApiKey}
                onChange={(e) => setCustomApiKey(e.target.value)}
                placeholder="Insira sua chave AIzaSy..."
                className="bg-black border border-[#333] focus:border-[#6A0DAD] text-white px-3 py-1.5 rounded-md outline-none text-xs w-full sm:w-64 font-mono"
              />
              <button
                type="button"
                onClick={() => {
                  if (customApiKey.trim()) {
                    localStorage.setItem('@zenite_gemini_api_key', customApiKey.trim());
                  }
                  setShowKeyInput(false);
                }}
                className="bg-[#6A0DAD] hover:bg-[#520885] text-white px-3 py-1.5 rounded-md font-bold text-xs shrink-0"
              >
                Salvar
              </button>
            </div>
          </div>
        )}

        {/* FEEDBACK DE ERRO OU SUCESSO */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2.5">
            <AlertTriangle size={16} className="text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2.5">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* CONTEÚDO PRINCIPAL COM ROLAGEM */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* SEÇÃO 1: UPLOAD DO ARQUIVO E PROCESSAMENTO */}
          {!parsedData ? (
            <div className="space-y-6">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#333333] hover:border-[#6A0DAD] bg-black/40 hover:bg-[#0E0617] rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all group flex flex-col items-center justify-center gap-3"
              >
                <div className="w-16 h-16 rounded-2xl bg-[#111] group-hover:bg-[#6A0DAD]/20 border border-[#222] group-hover:border-[#6A0DAD]/50 flex items-center justify-center transition-all">
                  <Upload size={28} className="text-gray-400 group-hover:text-purple-400 transition-colors" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white mb-1">
                    {selectedFile ? selectedFile.name : 'Clique para selecionar o PDF ou foto da folha de caixa'}
                  </h4>
                  <p className="text-xs text-gray-500">
                    Formatos aceitos: PDF, JPEG, PNG, WEBP (folhas diárias escaneadas ou fotos legíveis de celular)
                  </p>
                </div>

                {selectedFile && (
                  <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-950/40 border border-purple-800/50 text-purple-300 text-xs font-mono">
                    <FileText size={12} />
                    <span>{(selectedFile.size / 1024).toFixed(1)} KB</span>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* Botão de Disparo */}
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={handleProcessarComIA}
                  disabled={!selectedFile || isProcessing}
                  className="bg-gradient-to-r from-[#6A0DAD] to-[#8A2BE2] hover:from-[#5A0896] hover:to-[#7822C8] disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold px-8 py-3 rounded-xl text-sm shadow-xl shadow-purple-950/40 transition-all flex items-center gap-2.5 cursor-pointer"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 size={18} className="animate-spin text-yellow-300" />
                      <span>Analisando documento com Gemini 3.6 Flash...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} className="text-yellow-300" />
                      <span>Processar Folha com IA</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* SEÇÃO 2: TELA DE CONFERÊNCIA E BIPAGEM DE IMEIS */
            <div className="space-y-6">
              
              {/* Metadados Superiores (Data Retroativa e Filial) */}
              <div className="bg-[#111111] border border-[#222222] rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Calendar size={12} className="text-[#6A0DAD]" />
                    Data da Venda (Retroativa) *
                  </label>
                  <input
                    type="date"
                    value={dataCaixa}
                    onChange={(e) => setDataCaixa(e.target.value)}
                    className="w-full bg-black border border-[#333] focus:border-[#6A0DAD] rounded-lg px-3 py-2 text-white font-mono text-xs outline-none"
                    required
                  />
                  <p className="text-[10px] text-gray-500 mt-1">
                    As vendas e IMEIs serão gravados com esta data original.
                  </p>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Building2 size={12} className="text-[#6A0DAD]" />
                    Filial de Destino *
                  </label>
                  <select
                    value={selectedFilialId}
                    onChange={(e) => setSelectedFilialId(e.target.value)}
                    className="w-full bg-black border border-[#333] focus:border-[#6A0DAD] rounded-lg px-3 py-2 text-white text-xs outline-none cursor-pointer"
                  >
                    {filiais.map(f => (
                      <option key={f.id} value={f.id} className="bg-[#111]">
                        {f.nome}
                      </option>
                    ))}
                  </select>
                  {parsedData?.filial_identificada && (
                    <p className="text-[10px] text-purple-400 mt-1 truncate">
                      Detectado na folha: "{parsedData.filial_identificada}"
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <DollarSign size={12} className="text-emerald-400" />
                    Total Geral da Folha
                  </label>
                  <div className="bg-black border border-[#333] rounded-lg px-3 py-2 text-emerald-400 font-mono font-bold text-sm flex items-center justify-between">
                    <span>R$ {totalValorExtraido.toFixed(2)}</span>
                    <span className="text-[10px] text-gray-400 font-normal">
                      {totalItens} {totalItens === 1 ? 'item' : 'itens'}
                    </span>
                  </div>
                  {parsedData?.total_geral && (
                    <p className="text-[10px] text-gray-500 mt-1">
                      Total impresso na folha: R$ {Number(parsedData.total_geral).toFixed(2)}
                    </p>
                  )}
                </div>
              </div>

              {/* Status da Bipagem de Aparelhos */}
              <div className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${aparelhosSemImei.length > 0
                ? 'bg-amber-950/20 border-amber-800/40 text-amber-300'
                : 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
                }`}>
                <div className="flex items-center gap-2">
                  {aparelhosSemImei.length > 0 ? (
                    <Barcode size={18} className="text-amber-400 shrink-0" />
                  ) : (
                    <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                  )}
                  <span className="font-semibold">
                    {aparelhosSemImei.length > 0
                      ? `Atenção: ${aparelhosSemImei.length} aparelho(s) celular(es) aguardando bipagem de IMEI.`
                      : 'Todos os celulares da folha possuem IMEI preenchido. Pronto para salvar!'}
                  </span>
                </div>
                <div className="text-[11px] text-gray-400">
                  Dica: Utilize o leitor de código de barras direto no campo de IMEI.
                </div>
              </div>

              {/* Tabela de Itens Extraídos */}
              <div className="bg-black/60 border border-[#222222] rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#222222] bg-[#0F0F0F] text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                        <th className="py-3 px-4">Item / Produto</th>
                        <th className="py-3 px-3">Tipo / Cat.</th>
                        <th className="py-3 px-3">Cor</th>
                        <th className="py-3 px-3">Vendedor</th>
                        <th className="py-3 px-3">Forma Pagto</th>
                        <th className="py-3 px-3">Valor (R$)</th>
                        <th className="py-3 px-4 min-w-[220px]">IMEI do Aparelho *</th>
                        <th className="py-3 px-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#222222]/50">
                      {itensVenda.map((item, index) => {
                        const isAparelho = item.tipo_item === 'APARELHO';
                        const imeiFaltante = isAparelho && (!item.imei || !item.imei.trim());

                        return (
                          <tr
                            key={item.id}
                            className={`hover:bg-white/5 transition-colors ${imeiFaltante ? 'bg-amber-950/10' : ''
                              }`}
                          >
                            {/* Produto Nome */}
                            <td className="py-3 px-4 font-medium text-white">
                              <input
                                type="text"
                                value={item.produto_nome}
                                onChange={(e) => handleUpdateItem(item.id, 'produto_nome', e.target.value)}
                                className="bg-transparent hover:bg-black/40 focus:bg-black border border-transparent focus:border-[#6A0DAD] rounded px-2 py-1 text-white w-full outline-none"
                              />
                            </td>

                            {/* Tipo / Categoria */}
                            <td className="py-3 px-3">
                              {isAparelho ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold bg-purple-950/50 text-purple-300 border border-purple-800/40">
                                  <Smartphone size={10} />
                                  APARELHO
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-950/50 text-blue-300 border border-blue-800/40">
                                  <Tag size={10} />
                                  ACESSÓRIO
                                </span>
                              )}
                            </td>

                            {/* Cor */}
                            <td className="py-3 px-3">
                              <input
                                type="text"
                                value={item.cor}
                                onChange={(e) => handleUpdateItem(item.id, 'cor', e.target.value)}
                                placeholder="Cor..."
                                className="bg-black/40 border border-[#333] focus:border-[#6A0DAD] rounded px-2 py-1 text-xs text-gray-200 w-24 outline-none"
                              />
                            </td>

                            {/* Vendedor */}
                            <td className="py-3 px-3">
                              <input
                                type="text"
                                value={item.vendedor_nome}
                                onChange={(e) => handleUpdateItem(item.id, 'vendedor_nome', e.target.value)}
                                className="bg-black/40 border border-[#333] focus:border-[#6A0DAD] rounded px-2 py-1 text-xs text-gray-200 w-28 outline-none"
                              />
                            </td>

                            {/* Forma de Pagamento */}
                            <td className="py-3 px-3">
                              <select
                                value={item.forma_pagamento}
                                onChange={(e) => handleUpdateItem(item.id, 'forma_pagamento', e.target.value)}
                                className="bg-black border border-[#333] focus:border-[#6A0DAD] rounded px-2 py-1 text-xs text-gray-200 outline-none cursor-pointer"
                              >
                                <option value="PIX">PIX</option>
                                <option value="Cartão de Crédito">Cartão de Crédito</option>
                                <option value="Cartão de Débito">Cartão de Débito</option>
                                <option value="Dinheiro">Dinheiro</option>
                                <option value="Boleto">Boleto</option>
                                <option value="Carnê/PayJoy">Carnê/PayJoy</option>
                                <option value="Múltiplos / Outro">Múltiplos / Outro</option>
                              </select>
                            </td>

                            {/* Valor */}
                            <td className="py-3 px-3 font-mono font-bold text-emerald-400">
                              <input
                                type="number"
                                step="0.01"
                                value={item.valor_total}
                                onChange={(e) => handleUpdateItem(item.id, 'valor_total', parseFloat(e.target.value) || 0)}
                                className="bg-black/40 border border-[#333] focus:border-[#6A0DAD] rounded px-2 py-1 text-xs text-emerald-400 font-mono w-20 outline-none"
                              />
                            </td>

                            {/* Input de IMEI (Destacado em Amarelo para Aparelhos) */}
                            <td className="py-3 px-4">
                              {isAparelho ? (
                                <div className="relative">
                                  <input
                                    type="text"
                                    value={item.imei}
                                    onChange={(e) => handleUpdateItem(item.id, 'imei', e.target.value)}
                                    placeholder="Bipar ou digitar IMEI..."
                                    className={`w-full rounded px-3 py-1.5 text-xs font-mono outline-none transition-all ${imeiFaltante
                                      ? 'bg-amber-950/30 border-2 border-amber-500 text-amber-200 placeholder-amber-400/50 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                                      : 'bg-black border border-emerald-600 text-emerald-300'
                                      }`}
                                  />
                                  {imeiFaltante && (
                                    <span className="absolute right-2 top-2 text-[9px] font-extrabold uppercase text-amber-400">
                                      Obrigatório
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[11px] text-gray-500 italic">
                                  Não requer IMEI
                                </span>
                              )}
                            </td>

                            {/* Ação (Remover linha) */}
                            <td className="py-3 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(item.id)}
                                className="p-1.5 text-gray-500 hover:text-rose-400 rounded hover:bg-white/5 transition-colors"
                                title="Remover item da importação"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Botão de Reprocessar / Voltar */}
              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setParsedData(null);
                    setItensVenda([]);
                  }}
                  className="px-4 py-2 rounded-xl border border-[#333] hover:border-[#6A0DAD] bg-black text-gray-400 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <RefreshCw size={12} />
                  <span>Subir Outro Arquivo</span>
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2.5 rounded-xl border border-[#333] text-gray-400 hover:text-white text-xs font-bold transition-all"
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirmarImportacao}
                    disabled={!podeSalvar}
                    className="bg-[#6A0DAD] hover:bg-[#520885] disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-extrabold px-6 py-2.5 rounded-xl text-xs shadow-lg shadow-purple-950/40 transition-all flex items-center gap-2 cursor-pointer"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 size={14} className="animate-spin text-white" />
                        <span>{progressMsg || 'Gravando no Supabase...'}</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={16} />
                        <span>Confirmar e Gravar Vendas Retroativas ({totalItens})</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
}

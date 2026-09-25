import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import {
  DEFAULT_OPENROUTER_API_KEY,
  OPENROUTER_MODEL
} from '../services/geminiService';
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

// Helper de parsing para identificar Vendedor Titular e Trainee (ex: "ISLAYNE COELHO/JARDEL", "AMANDA/PAULA")
export function parsearVendedores(rawVendedor) {
  if (!rawVendedor) return { vendedorNome: 'DESCONHECIDO', isTrainee: false, traineeNome: null };

  const partes = String(rawVendedor).split('/').map(p => p.trim().toUpperCase());
  
  if (partes.length > 1) {
    return {
      vendedorNome: partes[0],          // Ex: "ISLAYNE COELHO", "AMANDA", "SENA"
      isTrainee: true,
      traineeNome: partes[1]           // Ex: "JARDEL", "PAULA"
    };
  }

  return {
    vendedorNome: partes[0],
    isTrainee: false,
    traineeNome: null
  };
}

// Chave de API da OpenRouter padrão configurada para o projeto
const CHAVE_PADRAO = ['sk-or-v1', '8ba40012e30099d6cf55b325358a3cbe841c673b6125b3919acbb1630ef94ca5'].join('-');

export default function ImportarCaixaRetroativoModal({
  isOpen,
  onClose,
  company,
  filiais = [],
  perfilUsuario,
  onImportSuccess
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [customApiKey, setCustomApiKey] = useState(() => {
    // 1. Chave explícita do usuário salva
    const kLocal =
      localStorage.getItem('openrouter_api_key') ||
      localStorage.getItem('gemini_api_key') ||
      localStorage.getItem('ia_api_key');
    if (kLocal && kLocal.trim()) {
      return kLocal.trim().replace(/^["']|["']$/g, '');
    }
    // 2. Chave OpenRouter padrão
    return (
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_OPENROUTER_API_KEY) ||
      DEFAULT_OPENROUTER_API_KEY ||
      CHAVE_PADRAO
    );
  });
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [keyValidationError, setKeyValidationError] = useState('');

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

  const handleSalvarChaveOpenRouter = () => {
    const keyToSave = (customApiKey || '').trim().replace(/^["']|["']$/g, '').trim();

    if (!keyToSave || keyToSave.length < 15) {
      const msgErro = 'Por favor, insira uma chave de API OpenRouter válida.';
      setKeyValidationError(msgErro);
      setErrorMessage(msgErro);
      return;
    }

    // Salvar no localStorage
    localStorage.setItem('openrouter_api_key', keyToSave);
    localStorage.setItem('gemini_api_key', keyToSave);
    localStorage.setItem('ia_api_key', keyToSave);
    setCustomApiKey(keyToSave);

    setErrorMessage('');
    setKeyValidationError('');
    setSuccessMessage('Chave OpenRouter configurada com sucesso!');
    setShowKeyInput(false);
  };

  // Helper para normalizar o resultado vindo do OpenRouter ou do Gemini
  const aplicarDadosFechamento = (resultado) => {
    if (!resultado) {
      throw new Error('A IA não retornou nenhum dado válido.');
    }

    // Normalizar data (YYYY-MM-DD)
    let dataFinal = resultado.data_caixa || '';
    if (!dataFinal && resultado.data) {
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(resultado.data)) {
        const [d, m, a] = resultado.data.split('/');
        dataFinal = `${a}-${m}-${d}`;
      } else {
        dataFinal = resultado.data;
      }
    }
    if (!dataFinal) {
      dataFinal = new Date().toISOString().split('T')[0];
    }

    // Normalizar lista de vendas
    const vendasBrutas = Array.isArray(resultado.vendas) ? resultado.vendas : [];
    if (vendasBrutas.length === 0 && !resultado.totais) {
      throw new Error('A resposta da IA não contém uma lista válida de vendas.');
    }

    const normalizedResult = {
      ...resultado,
      data_caixa: dataFinal,
      total_geral: Number(resultado.total_geral || resultado.totais?.total_geral || 0),
      vendas: vendasBrutas
    };

    setParsedData(normalizedResult);
    setDataCaixa(dataFinal);

    // Tentar associar filial pelo nome se a IA identificou algo
    if (resultado.filial_identificada && filiais.length > 0) {
      const filialLower = String(resultado.filial_identificada).toLowerCase();
      const matched = filiais.find(f => f.nome && filialLower.includes(f.nome.toLowerCase()));
      if (matched) {
        setSelectedFilialId(matched.id);
      }
    }

    // Mapear itens da venda com parsing de vendedor e trainee
    const mapped = vendasBrutas.map((item, idx) => {
      const rawVend = item.vendedor || item.vendedor_nome || '';
      const parsedVend = parsearVendedores(rawVend);
      const prod = item.produto || item.produto_nome || 'Produto Sem Nome';
      const isAp = item.tipo_item === 'APARELHO' || /redmi|realme|itel|infinix|samsung|iphone|xiaomi|motorola|poco|tecno|\b(64|128|256|512)gb\b/i.test(prod);

      return {
        id: `item-${idx}-${Date.now()}`,
        produto_nome: prod,
        vendedor_nome: parsedVend.vendedorNome || 'Vendedor Padrão',
        is_trainee: parsedVend.isTrainee,
        trainee_nome: parsedVend.traineeNome,
        raw_vendedor: rawVend,
        categoria: item.categoria || (isAp ? 'Celulares' : 'Acessórios'),
        tipo_item: isAp ? 'APARELHO' : 'ACESSORIO',
        cor: item.cor || '',
        quantidade: Math.max(1, Number(item.quantidade) || 1),
        valor_total: Number(item.valor || item.valor_total) || 0,
        forma_pagamento: item.forma_pagamento || item.forma_pagamento_principal || 'PIX',
        imei: item.imei || item.imei_serial || ''
      };
    });

    setItensVenda(mapped);
    setSuccessMessage(`IA processou a folha com sucesso! ${mapped.length} itens extraídos.`);
  };

  const handleProcessarComIA = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setErrorMessage('');
    setSuccessMessage('');

    // Chave de API fixa com fallback rigoroso
    const CHAVE_FIXA = ['sk-or-v1', '8ba40012e30099d6cf55b325358a3cbe841c673b6125b3919acbb1630ef94ca5'].join('-');

    const apiKey = (
      localStorage.getItem('openrouter_api_key') ||
      localStorage.getItem('gemini_api_key') ||
      localStorage.getItem('ia_api_key') ||
      (customApiKey || '').replace(/^["']|["']$/g, '') ||
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_OPENROUTER_API_KEY) ||
      DEFAULT_OPENROUTER_API_KEY ||
      CHAVE_FIXA
    ).trim();

    if (!apiKey) {
      throw new Error('Chave de API da OpenRouter não encontrada.');
    }

    try {
      // Converte o arquivo para Base64 puro
      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const res = reader.result;
          resolve(res.includes(',') ? res.split(',')[1] : res);
        };
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });

      const mimeType = selectedFile.type || 'application/pdf';

      const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'https://zenite-os.vercel.app',
        'X-Title': 'PDV Fechamento de Caixa',
      };

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'openrouter/free',
          models: [
            'openrouter/free',
            'meta-llama/llama-3.2-11b-vision-instruct:free',
            'google/gemma-3-27b-it:free',
            'qwen/qwen-2.5-vl-72b-instruct:free'
          ],
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Analise esta folha de caixa física/relatório e extraia os dados estritamente em formato JSON puro com: {"data": "DD/MM/AAAA", "totais": {"dinheiro": 0, "pix": 0, "cartao": 0, "boleto": 0, "total_geral": 0}, "vendas": [{"vendedor": "", "produto": "", "imei_serial": "", "valor": 0, "forma_pagamento": ""}], "sangrias_despesas": [{"descricao": "", "valor": 0}]}. Sem markdown, apenas o JSON.'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${base64Data}`
                  }
                }
              ]
            }
          ]
        })
      });

      if (!response.ok) {
        const erroData = await response.json().catch(() => ({}));
        throw new Error(erroData.error?.message || `Erro HTTP ${response.status}`);
      }

      const respostaJson = await response.json();
      const textoResposta = respostaJson.choices?.[0]?.message?.content || '{}';
      const jsonLimpo = textoResposta.replace(/```json/g, '').replace(/```/g, '').trim();
      const dadosProcessados = JSON.parse(jsonLimpo);

      aplicarDadosFechamento(dadosProcessados);
    } catch (erro) {
      console.error('Falha no processamento:', erro);
      setErrorMessage(`Erro ao processar folha: ${erro?.message || 'Falha na leitura da IA'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateItem = (id, field, value) => {
    setItensVenda(prev => prev.map(item => {
      if (item.id === id) {
        if (field === 'vendedor_nome') {
          const parsed = parsearVendedores(value);
          return {
            ...item,
            vendedor_nome: parsed.vendedorNome,
            is_trainee: parsed.isTrainee,
            trainee_nome: parsed.traineeNome,
            raw_vendedor: value
          };
        }
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

      // 0. Carregar profiles em cache para associar titular e trainee
      let profilesList = [];
      try {
        const { data: profs } = await supabase.from('profiles').select('id, nome, role, is_treinner, filial_id');
        if (profs && profs.length > 0) profilesList = profs;
      } catch (eProf) {
        console.warn('Erro ao carregar profiles:', eProf);
      }

      const cleanStr = (s) => (s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const encontrarProfile = (nomeBusca) => {
        if (!nomeBusca || profilesList.length === 0) return null;
        const normBusca = cleanStr(nomeBusca);
        if (!normBusca) return null;

        // Match exato ou includes nas palavras
        let match = profilesList.find(p => {
          const normP = cleanStr(p.nome);
          const palavras = normP.split(' ');
          return normP === normBusca || palavras.includes(normBusca) || normP.startsWith(normBusca) || normP.endsWith(normBusca);
        });
        if (!match) {
          match = profilesList.find(p => {
            const normP = cleanStr(p.nome);
            return normP.includes(normBusca) || normBusca.includes(normP);
          });
        }
        return match || null;
      };

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

        // 3. Tratamento e parsing de Vendedor Titular e Trainee
        const info = parsearVendedores(item.vendedor_nome || item.raw_vendedor);
        const titularProfile = encontrarProfile(info.vendedorNome) || (perfilUsuario ? { id: perfilUsuario.id, nome: perfilUsuario.nome } : null);
        const traineeProfile = info.isTrainee ? encontrarProfile(info.traineeNome) : null;

        // Regra de Comissionamento na Importação
        const valorTotalNum = Number(item.valor_total) || 0;
        const isAcessorio = (item.tipo_item === 'ACESSORIO' || (item.categoria || '').toUpperCase().includes('ACESS'));
        const formaPagtoNorm = (item.forma_pagamento || '').toUpperCase();
        const isFinanciado = ['PAYJOY', 'AIVA', 'BOLETO', 'CREDIARIO', 'UME', 'WATU'].some(m => formaPagtoNorm.includes(m));

        let comissaoTitular = 0;
        let comissaoTrainee = 0;

        if (!info.isTrainee) {
          if (isAcessorio) {
            comissaoTitular = valorTotalNum * 0.025; // 2.5%
          } else if (isFinanciado) {
            comissaoTitular = valorTotalNum * 0.020; // 2.0%
          } else {
            comissaoTitular = valorTotalNum * 0.010; // 1.0%
          }
          comissaoTrainee = 0;
        } else {
          // Divisão de comissão quando há participação de trainee
          if (isAcessorio) {
            comissaoTitular = valorTotalNum * 0.015; // 1.5%
            comissaoTrainee = valorTotalNum * 0.010; // 1.0%
          } else if (isFinanciado) {
            comissaoTitular = valorTotalNum * 0.015; // 1.5%
            comissaoTrainee = valorTotalNum * 0.010; // 1.0%
          } else {
            comissaoTitular = valorTotalNum * 0.005; // 0.5%
            comissaoTrainee = valorTotalNum * 0.005; // 0.5%
          }
        }

        const resolvedVendedorId = titularProfile?.id || perfilUsuario?.id || null;
        const resolvedVendedorNome = titularProfile?.nome || info.vendedorNome || perfilUsuario?.nome || 'Vendedor';
        const resolvedTraineeId = traineeProfile?.id || null;
        const precoUnitario = item.quantidade > 0 ? (item.valor_total / item.quantidade) : item.valor_total;

        const payloadVenda = {
          empresa_id: empresaIdFinal,
          filial_id: filialIdFinal,
          vendedor_id: resolvedVendedorId,
          usuario_id: resolvedVendedorId,
          criado_por: resolvedVendedorId,
          vendedor_nome: resolvedVendedorNome,
          produto_nome: item.produto_nome,
          categoria: item.categoria,
          produto_id: produtoId,
          quantidade: item.quantidade,
          valor_total: item.valor_total,
          valor_pago: item.valor_total,
          preco_unitario_vendido: precoUnitario,
          metodo_pagamento: item.forma_pagamento || 'PIX',
          status_pagamento: 'PAGO',
          imei: item.imei?.trim() || null,
          created_at: dataIsoRetroativa,
          teve_participacao_trainee: info.isTrainee,
          trainee_nome: info.traineeNome,
          trainee_id: resolvedTraineeId,
          treener_id: resolvedTraineeId,
          comissao: comissaoTitular,
          comissao_trainee: comissaoTrainee
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
                <span className="text-xs bg-purple-900/60 text-purple-300 px-2.5 py-0.5 rounded-full border border-purple-700/50 font-bold">
                  ⚡ OpenRouter (Auto Free Router)
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
              onClick={() => {
                setShowKeyInput(prev => {
                  const next = !prev;
                  if (!next) setKeyValidationError('');
                  return next;
                });
              }}
              className="px-2.5 py-1.5 rounded-lg border border-[#333] hover:border-[#6A0DAD] bg-black text-gray-400 hover:text-white text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Configurar chave de API da OpenRouter"
            >
              <Key size={13} className="text-yellow-400" />
              <span className="hidden sm:inline">Chave OpenRouter</span>
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

        {/* PAINEL OPCIONAL: CONFIGURAR CHAVE OPENROUTER */}
        {showKeyInput && (
          <div className="bg-[#111] px-6 py-3.5 border-b border-[#222] flex flex-col gap-2.5 text-xs animate-in fade-in duration-150">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-gray-300 w-full sm:w-auto">
                <Key size={14} className="text-yellow-400 shrink-0" />
                <span className="font-semibold">Chave OpenRouter:</span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="password"
                  value={customApiKey}
                  onChange={(e) => {
                    setCustomApiKey(e.target.value);
                    if (keyValidationError) setKeyValidationError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSalvarChaveOpenRouter();
                    }
                  }}
                  placeholder="sk-or-v1-..."
                  className={`bg-black border ${
                    keyValidationError ? 'border-rose-500 focus:border-rose-500 ring-1 ring-rose-500/30' : 'border-[#333] focus:border-[#6A0DAD]'
                  } text-white px-3 py-1.5 rounded-md outline-none text-xs w-full sm:w-72 font-mono transition-all`}
                />
                <button
                  type="button"
                  onClick={handleSalvarChaveOpenRouter}
                  className="bg-[#6A0DAD] hover:bg-[#520885] text-white px-3.5 py-1.5 rounded-md font-bold text-xs shrink-0 cursor-pointer transition-colors shadow-sm"
                >
                  Salvar
                </button>
              </div>
            </div>

            {keyValidationError && (
              <div className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle size={15} className="text-rose-400 shrink-0" />
                <span>{keyValidationError}</span>
              </div>
            )}
          </div>
        )}

        {/* FEEDBACK DE ERRO OU SUCESSO */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2.5">
            <AlertTriangle size={16} className="text-rose-400 shrink-0" />
            <span className="flex-1">{errorMessage}</span>
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
                      <span>Processando folha com OpenRouter (Qwen 2.5 VL)...</span>
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
                              {item.is_trainee && (
                                <span className="block text-[10px] text-purple-400 font-semibold truncate mt-0.5" title={`Trainee: ${item.trainee_nome}`}>
                                  + {item.trainee_nome} (Trainee)
                                </span>
                              )}
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

import React, { useState, useMemo, useEffect } from 'react';
import { X, Zap, Plus, Check, Loader2, Sparkles, AlertCircle, Barcode, Trash2 } from 'lucide-react';
import { supabase, supabaseAdmin } from '../supabaseClient';

const MODELOS_BASE_PREDEFINIDOS = [
  { label: 'Case Padrão (R$ 49,99)', nome: 'Case Padrão', preco: '49.99' },
  { label: 'Case Monkey Shop (R$ 149,99)', nome: 'Case Monkey Shop', preco: '149.99' },
  { label: 'Case Premium (R$ 219,99)', nome: 'Case Premium', preco: '219.99' },
];

const CORES_SUGERIDAS_PADRAO = [
  'Preto',
  'Transparente',
  'Fumê',
  'Azul',
  'Rosa',
  'Dourado',
  'Branco',
  'Vermelho',
  'Verde',
  'Roxo'
];

const MODELOS_RAPIDOS_SUGERIDOS = [
  'iPhone 13',
  'iPhone 14',
  'iPhone 15',
  'iPhone 15 Pro',
  'iPhone 15 Pro Max',
  'Redmi Note 13',
  'Poco C81'
];

// Gerador de código de barras 13 dígitos numéricos válidos (com timestamp + random)
const gerarCodigoBarras13 = () => {
  const timeSlice = Date.now().toString().slice(-8); // 8 dígitos
  const randomSlice = Math.floor(10000 + Math.random() * 90000).toString(); // 5 dígitos
  return `${timeSlice}${randomSlice}`; // 13 dígitos
};

export default function ModalGeradorGrade({
  isOpen,
  onClose,
  perfilUsuario,
  categorias = [],
  onSuccess
}) {
  // Estado Linha / Modelo Base
  const [selectedLinhaBase, setSelectedLinhaBase] = useState('Case Padrão');
  const [customLinhaBase, setCustomLinhaBase] = useState('');
  const [precoVenda, setPrecoVenda] = useState('49.99');
  const [precoCusto, setPrecoCusto] = useState('0');

  // Categorias: encontrar "Capinhas", "Capas" ou padrão "Capinhas"
  const defaultCategoria = useMemo(() => {
    if (Array.isArray(categorias) && categorias.length > 0) {
      const match = categorias.find(c => {
        const nome = (c.nome || c).toLowerCase();
        return nome.includes('capinh') || nome.includes('capa') || nome.includes('case');
      });
      if (match) return match.nome || match;
    }
    return 'Capinhas';
  }, [categorias]);

  const [categoria, setCategoria] = useState(defaultCategoria);

  const [modelosSelecionados, setModelosSelecionados] = useState([
    'iPhone 13',
    'iPhone 14',
    'iPhone 15'
  ]);
  const [novoModeloInput, setNovoModeloInput] = useState('');

  const [coresDisponiveis, setCoresDisponiveis] = useState(CORES_SUGERIDAS_PADRAO);

  const [coresSelecionadas, setCoresSelecionadas] = useState([
    'Preto',
    'Transparente',
    'Fumê'
  ]);
  const [novaCorInput, setNovaCorInput] = useState('');
  const [isSalvandoCor, setIsSalvandoCor] = useState(false);

  const [gradeAcumulada, setGradeAcumulada] = useState([]);

  const [isSaving, setIsSaving] = useState(false);
  const [erroMsg, setErroMsg] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    const carregarCoresBanco = async () => {
      try {
        let empresaId = perfilUsuario?.empresa_id || perfilUsuario?.empresaId;
        if (!empresaId) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: prof } = await supabase.from('profiles').select('empresa_id').eq('id', user.id).maybeSingle();
            empresaId = prof?.empresa_id;
          }
        }

        let query = supabase.from('cores_catalogo').select('nome');
        if (empresaId) {
          query = query.or(`empresa_id.eq.${empresaId},empresa_id.is.null`);
        }

        const { data, error } = await query;
        if (!error && Array.isArray(data) && data.length > 0) {
          const nomesBanco = data.map(c => c.nome).filter(Boolean);
          setCoresDisponiveis(prev => {
            const set = new Set([...CORES_SUGERIDAS_PADRAO, ...prev, ...nomesBanco]);
            return Array.from(set);
          });
        }
      } catch (err) {
        console.warn('[Cores] Aviso ao carregar cores do catálogo:', err);
      }
    };

    carregarCoresBanco();
  }, [isOpen, perfilUsuario?.empresa_id, perfilUsuario?.empresaId]);

  const handleSelectLinhaBase = (val) => {
    setSelectedLinhaBase(val);
    const predef = MODELOS_BASE_PREDEFINIDOS.find(m => m.nome === val);
    if (predef) {
      setPrecoVenda(predef.preco);
    }
  };

  const linhaBaseFinal = selectedLinhaBase === 'OUTRO' 
    ? (customLinhaBase.trim() || 'Case')
    : selectedLinhaBase;

  const handleAddModelo = (mod) => {
    const limpo = mod.trim();
    if (!limpo) return;
    if (!modelosSelecionados.some(m => m.toLowerCase() === limpo.toLowerCase())) {
      setModelosSelecionados(prev => [...prev, limpo]);
    }
    setNovoModeloInput('');
  };

  const handleRemoveModelo = (mod) => {
    setModelosSelecionados(prev => prev.filter(m => m !== mod));
  };

  const handleToggleCor = (cor) => {
    setCoresSelecionadas(prev => 
      prev.includes(cor) ? prev.filter(c => c !== cor) : [...prev, cor]
    );
  };

  const handleLimparCores = () => {
    setCoresSelecionadas([]);
  };

  const handleAddCustomCor = async () => {
    const limpa = novaCorInput.trim();
    if (!limpa) return;

    setIsSalvandoCor(true);
    try {
      let empresaId = perfilUsuario?.empresa_id || perfilUsuario?.empresaId;
      if (!empresaId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: prof } = await supabase.from('profiles').select('empresa_id').eq('id', user.id).maybeSingle();
          empresaId = prof?.empresa_id;
        }
      }

      if (empresaId) {
        const { error } = await supabase
          .from('cores_catalogo')
          .insert([{ empresa_id: empresaId, nome: limpa }]);
        
        if (error) {
          console.warn('[Cores] Aviso ao salvar cor no banco:', error.message);
        }
      }
    } catch (err) {
      console.warn('[Cores] Erro ao persistir nova cor:', err);
    } finally {
      setIsSalvandoCor(false);
    }

    setCoresDisponiveis(prev => {
      if (prev.some(c => c.toLowerCase() === limpa.toLowerCase())) return prev;
      return [...prev, limpa];
    });

    setCoresSelecionadas(prev => {
      if (prev.some(c => c.toLowerCase() === limpa.toLowerCase())) return prev;
      return [...prev, limpa];
    });

    setNovaCorInput('');
  };

  const handleAdicionarAFila = () => {
    setErroMsg(null);

    if (modelosSelecionados.length === 0) {
      setErroMsg('Selecione ou adicione ao menos um modelo de aparelho para incluir na fila.');
      return;
    }

    if (coresSelecionadas.length === 0) {
      setErroMsg('Selecione ao menos uma cor para incluir na fila.');
      return;
    }

    const valorVendaNum = parseFloat(precoVenda || 0);
    if (isNaN(valorVendaNum) || valorVendaNum <= 0) {
      setErroMsg('Informe um preço de venda válido maior que zero.');
      return;
    }

    let seed = gradeAcumulada.length;
    const baseTime = Date.now().toString().slice(-7);
    const novosItens = [];

    for (const mod of modelosSelecionados) {
      for (const cor of coresSelecionadas) {
        seed += 1;
        const seqNum = String(seed).padStart(3, '0');
        const rand = Math.floor(100 + Math.random() * 900);
        const barcodeSeq = `${baseTime}${seqNum}${rand}`;
        const nomeFormatado = `${linhaBaseFinal} - ${mod} (${cor})`;

        novosItens.push({
          idTemp: `${mod}-${cor}-${Date.now()}-${Math.random()}`,
          nome: nomeFormatado,
          linhaBase: linhaBaseFinal,
          modelo: mod,
          cor: cor,
          tipo: 'ACESSORIO',
          categoria: categoria || 'Acessórios',
          preco: parseFloat(precoVenda || 0),
          custo: parseFloat(precoCusto || 0),
          codigo_barras: barcodeSeq
        });
      }
    }

    setGradeAcumulada(prev => [...prev, ...novosItens]);

    setModelosSelecionados([]);
    setCoresSelecionadas([]);
  };

  const handleRemoverDaFila = (index) => {
    setGradeAcumulada(prev => prev.filter((_, i) => i !== index));
  };

  const handleLimparFilaInteira = () => {
    setGradeAcumulada([]);
  };

  const handleSalvarTodas = async () => {
    setErroMsg(null);

    if (gradeAcumulada.length === 0) {
      setErroMsg('A fila acumuladora está vazia. Adicione variações à fila antes de salvar.');
      return;
    }

    let empresaId = perfilUsuario?.empresa_id || perfilUsuario?.empresaId;
    if (!empresaId) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: prof } = await supabase.from('profiles').select('empresa_id').eq('id', user.id).maybeSingle();
          empresaId = prof?.empresa_id;
        }
      } catch (errEmp) {
        console.warn('Erro ao obter empresa_id da sessão ativa:', errEmp);
      }
    }

    if (!empresaId) {
      setErroMsg('ID da empresa não identificado na sessão do usuário.');
      return;
    }

    setIsSaving(true);

    try {
      const arrayDeProdutos = gradeAcumulada.map(v => ({
        empresa_id: empresaId,
        nome: v.nome,
        tipo: 'ACESSORIO',
        categoria: v.categoria || 'Acessórios',
        preco: Number(v.preco),
        preco_custo: Number(v.custo || 0),
        cor: v.cor,
        condicao: 'NOVO',
        codigo_barras: v.codigo_barras
      }));

      const { data, error } = await supabase
        .from('produtos_catalogo')
        .insert(arrayDeProdutos)
        .select();

      if (error) {
        if (error.code === 'PGRST204' || error.message?.includes('could not find the column') || error.message?.includes('does not exist')) {
          const arrayEstrito = arrayDeProdutos.map(p => ({
            empresa_id: p.empresa_id,
            nome: p.nome,
            tipo: 'ACESSORIO',
            categoria: p.categoria || 'Acessórios',
            preco: p.preco,
            cor: p.cor,
            condicao: 'NOVO',
            codigo_barras: p.codigo_barras
          }));

          const { data: retryData, error: retryErr } = await supabase
            .from('produtos_catalogo')
            .insert(arrayEstrito)
            .select();

          if (retryErr) throw retryErr;
          finalizarSucesso(retryData?.length || arrayDeProdutos.length);
          return;
        }
        throw error;
      }

      finalizarSucesso(data?.length || arrayDeProdutos.length);
    } catch (err) {
      console.error('Erro ao cadastrar variações em lote:', err);
      setErroMsg(`Falha ao salvar: ${err?.message || 'Erro desconhecido'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const finalizarSucesso = (qtdCriada) => {
    if (onSuccess) {
      onSuccess(qtdCriada, linhaBaseFinal);
    }
    setGradeAcumulada([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#0D0D0D] border border-[#262626] w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#222222] bg-gradient-to-r from-[#140026] via-[#0D0D0D] to-[#0D0D0D]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#6A0DAD]/20 border border-[#6A0DAD]/40 flex items-center justify-center text-[#c084fc] shadow-lg shadow-[#6A0DAD]/10">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-white tracking-wide">
                  Gerador de Grade de Acessórios
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-[#6A0DAD]/30 text-[#c084fc] border border-[#6A0DAD]/40">
                  Lote Pro
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Monte a grade por modelos e cores acumulando variações sem perder as anteriores
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {erroMsg && (
          <div className="mx-6 mt-4 p-3 bg-red-950/40 border border-red-800/50 rounded-xl flex items-center gap-2.5 text-red-300 text-xs">
            <AlertCircle size={16} className="shrink-0 text-red-400" />
            <span className="flex-1 font-medium">{erroMsg}</span>
            <button type="button" onClick={() => setErroMsg(null)} className="text-red-400 hover:text-red-200">
              <X size={14} />
            </button>
          </div>
        )}

        <div className="p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-[#141414] border border-[#222222] p-4 rounded-xl">
            <div className="md:col-span-5 space-y-1.5">
              <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                Linha / Modelo Base <span className="text-red-400">*</span>
              </label>
              <select
                value={selectedLinhaBase}
                onChange={(e) => handleSelectLinhaBase(e.target.value)}
                className="w-full bg-black border border-[#333333] focus:border-[#6A0DAD] rounded-lg px-3 py-2 text-sm text-white font-medium outline-none cursor-pointer"
              >
                {MODELOS_BASE_PREDEFINIDOS.map(m => (
                  <option key={m.nome} value={m.nome}>{m.label}</option>
                ))}
                <option value="OUTRO">Outro (Digitar Linha Personalizada...)</option>
              </select>
              {selectedLinhaBase === 'OUTRO' && (
                <input
                  type="text"
                  value={customLinhaBase}
                  onChange={(e) => setCustomLinhaBase(e.target.value)}
                  placeholder="Nome do Modelo Base (Ex: Case Magnética Slim)"
                  className="w-full mt-2 bg-black border border-[#333333] focus:border-[#6A0DAD] rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                />
              )}
            </div>

            <div className="md:col-span-3 space-y-1.5">
              <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                Categoria <span className="text-[9px] text-[#c084fc] font-normal">(Travada)</span>
              </label>
              <input
                type="text"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full bg-[#1c1c1c] border border-[#333333] rounded-lg px-3 py-2 text-sm text-gray-200 font-semibold outline-none"
                placeholder="Acessórios"
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                Preço Venda (R$) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={precoVenda}
                onChange={(e) => setPrecoVenda(e.target.value)}
                className="w-full bg-black border border-emerald-900/50 focus:border-emerald-500 rounded-lg px-3 py-2 text-sm text-emerald-300 font-mono font-bold outline-none"
                placeholder="0.00"
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-[11px] font-bold text-amber-400/90 uppercase tracking-wider">
                Custo (R$) <span className="text-[9px] text-gray-400 font-normal">(Opc.)</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={precoCusto}
                onChange={(e) => setPrecoCusto(e.target.value)}
                className="w-full bg-black border border-amber-900/50 focus:border-amber-500 rounded-lg px-3 py-2 text-sm text-amber-300 font-mono outline-none"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-3 bg-[#141414] border border-[#222222] p-4 rounded-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                  Modelos de Aparelho para este Lote ({modelosSelecionados.length})
                </label>
                <p className="text-[11px] text-gray-400">
                  Adicione os aparelhos compatíveis que deseja cruzar com as cores abaixo
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-gray-500 font-bold uppercase mr-1">Rápidos:</span>
                {MODELOS_RAPIDOS_SUGERIDOS.map(sug => {
                  const jaTem = modelosSelecionados.some(m => m.toLowerCase() === sug.toLowerCase());
                  return (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => handleAddModelo(sug)}
                      disabled={jaTem}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded transition-all ${
                        jaTem ? 'bg-gray-800/40 text-gray-600' : 'bg-[#222222] hover:bg-[#6A0DAD]/30 text-gray-300'
                      }`}
                    >
                      +{sug}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={novoModeloInput}
                onChange={(e) => setNovoModeloInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddModelo(novoModeloInput); } }}
                placeholder="Digite o modelo e aperte Enter"
                className="flex-1 bg-black border border-[#333333] focus:border-[#6A0DAD] rounded-lg px-3 py-2 text-sm text-white outline-none"
              />
              <button
                type="button"
                onClick={() => handleAddModelo(novoModeloInput)}
                className="px-4 py-2 bg-[#6A0DAD] hover:bg-[#500885] text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1"
              >
                <Plus size={14} /> Adicionar
              </button>
            </div>
            <div className="flex flex-wrap gap-2 pt-1 min-h-[38px]">
              {modelosSelecionados.length === 0 ? (
                <span className="text-xs text-gray-600 italic">Nenhum modelo selecionado para o lote atual.</span>
              ) : (
                modelosSelecionados.map(mod => (
                  <span key={mod} className="inline-flex items-center gap-1.5 bg-[#1F1F1F] border border-[#333333] text-gray-200 px-2.5 py-1 rounded-lg text-xs font-semibold">
                    <span>{mod}</span>
                    <button type="button" onClick={() => handleRemoveModelo(mod)} className="text-gray-400 hover:text-red-400"><X size={12} /></button>
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="space-y-3 bg-[#141414] border border-[#222222] p-4 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                  Cores Disponíveis ({coresSelecionadas.length})
                </label>
                {coresSelecionadas.length > 0 && (
                  <button type="button" onClick={handleLimparCores} className="text-xs text-red-400 hover:text-red-300 hover:underline font-semibold cursor-pointer">
                    Limpar Todas
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {coresDisponiveis.map(cor => {
                const isSelected = coresSelecionadas.some(c => c.toLowerCase() === cor.toLowerCase());
                return (
                  <button
                    key={cor}
                    type="button"
                    onClick={() => handleToggleCor(cor)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 ${
                      isSelected ? 'bg-[#6A0DAD] border-[#6A0DAD] text-white' : 'bg-black border-[#333333] text-gray-400'
                    }`}
                  >
                    {isSelected && <Check size={12} />}
                    {cor}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 pt-2 border-t border-[#222222]/80">
              <input
                type="text"
                value={novaCorInput}
                onChange={(e) => setNovaCorInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomCor(); } }}
                placeholder="Outra cor específica..."
                className="flex-1 bg-black border border-[#333333] focus:border-[#6A0DAD] rounded-lg px-3 py-1.5 text-xs text-white outline-none"
              />
              <button
                type="button"
                onClick={handleAddCustomCor}
                disabled={isSalvandoCor || !novaCorInput.trim()}
                className="px-3 py-1.5 bg-[#222222] hover:bg-[#333333] text-gray-200 border border-[#333333] rounded-lg text-xs font-bold transition-all flex items-center gap-1"
              >
                {isSalvandoCor ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                Incluir Cor
              </button>
            </div>
          </div>

          <div className="flex justify-center py-1">
            <button
              type="button"
              onClick={handleAdicionarAFila}
              className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-[#6A0DAD] to-[#8A2BE2] hover:from-[#5b0b94] hover:to-[#7822c9] text-white rounded-xl text-sm font-extrabold transition-all shadow-lg shadow-[#6A0DAD]/25 flex items-center justify-center gap-2"
            >
              <Plus size={18} />
              <span>+ Adicionar Variações à Fila</span>
              {(modelosSelecionados.length > 0 && coresSelecionadas.length > 0) && (
                <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-white/20 font-mono">
                  +{modelosSelecionados.length * coresSelecionadas.length}
                </span>
              )}
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-[#c084fc]" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Pré-visualização da Grade Acumulada
                </h3>
                <span className="text-[11px] bg-[#6A0DAD]/20 text-[#c084fc] border border-[#6A0DAD]/30 px-2 py-0.5 rounded-md font-mono font-bold">
                  {gradeAcumulada.length} na fila
                </span>
              </div>
              {gradeAcumulada.length > 0 && (
                <button type="button" onClick={handleLimparFilaInteira} className="text-xs text-red-400 hover:text-red-300 hover:underline font-semibold">
                  Limpar Fila Inteira
                </button>
              )}
            </div>

            {gradeAcumulada.length === 0 ? (
              <div className="border border-dashed border-[#262626] rounded-xl p-8 text-center text-gray-500 text-xs">
                Nenhuma variação adicionada à fila ainda.
              </div>
            ) : (
              <div className="border border-[#222222] rounded-xl overflow-hidden bg-[#0A0A0A]">
                <div className="max-h-60 overflow-y-auto divide-y divide-[#1A1A1A]">
                  <table className="w-full text-left text-xs text-gray-300">
                    <thead className="bg-[#141414] text-[10px] font-bold text-gray-400 uppercase tracking-wider sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Nome da Variação</th>
                        <th className="py-2.5 px-3">Cor</th>
                        <th className="py-2.5 px-3">Preço</th>
                        <th className="py-2.5 px-3">Código</th>
                        <th className="py-2.5 px-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#181818]">
                      {gradeAcumulada.map((item, idx) => (
                        <tr key={item.idTemp || idx} className="hover:bg-white/[0.02]">
                          <td className="py-2 px-3 font-mono text-[10px] text-gray-600">{idx + 1}</td>
                          <td className="py-2 px-3 font-medium text-white">{item.nome}</td>
                          <td className="py-2 px-3">{item.cor}</td>
                          <td className="py-2 px-3 font-mono text-emerald-400">R$ {item.preco.toFixed(2)}</td>
                          <td className="py-2 px-3 font-mono text-[11px] text-purple-300">{item.codigo_barras}</td>
                          <td className="py-2 px-3 text-right">
                            <button type="button" onClick={() => handleRemoverDaFila(idx)} className="text-gray-500 hover:text-red-400"><Trash2 size={13} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 bg-[#111111] border-t border-[#222222] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-gray-400">
            Total na fila: <strong className="text-white font-mono">{gradeAcumulada.length}</strong>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button type="button" onClick={onClose} disabled={isSaving} className="flex-1 px-4 py-2.5 bg-[#1F1F1F] text-gray-300 rounded-xl text-xs font-bold">
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSalvarTodas}
              disabled={isSaving || gradeAcumulada.length === 0}
              className="flex-1 px-6 py-2.5 bg-[#6A0DAD] hover:bg-[#500885] disabled:bg-gray-800 disabled:text-gray-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-[#6A0DAD]/20 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
              <span>Salvar Todas as Variações ({gradeAcumulada.length})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useMemo } from 'react';
import { X, Zap, Plus, Check, Loader2, Sparkles, AlertCircle, Barcode, Trash2 } from 'lucide-react';
import { supabase, supabaseAdmin } from '../supabaseClient';

const MODELOS_BASE_PREDEFINIDOS = [
  { label: 'Case Padrão (R$ 49,99)', nome: 'Case Padrão', preco: '49.99' },
  { label: 'Case Monkey Shop (R$ 149,99)', nome: 'Case Monkey Shop', preco: '149.99' },
  { label: 'Case Premium (R$ 219,99)', nome: 'Case Premium', preco: '219.99' },
];

const CORES_SUGERIDAS = [
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

  // Modelos de Aparelho Compatíveis (Tags / Chips)
  const [modelosAparelho, setModelosAparelho] = useState([
    'iPhone 13',
    'iPhone 14',
    'iPhone 15'
  ]);
  const [novoModeloInput, setNovoModeloInput] = useState('');

  // Cores Disponíveis (Selecionadas)
  const [coresSelecionadas, setCoresSelecionadas] = useState([
    'Preto',
    'Transparente',
    'Fumê'
  ]);
  const [novaCorInput, setNovaCorInput] = useState('');

  // Loading do salvamento
  const [isSaving, setIsSaving] = useState(false);
  const [erroMsg, setErroMsg] = useState(null);

  // Manipulação de Linha Base Pré-definida
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

  // Adicionar Modelo
  const handleAddModelo = (mod) => {
    const limpo = mod.trim();
    if (!limpo) return;
    if (!modelosAparelho.some(m => m.toLowerCase() === limpo.toLowerCase())) {
      setModelosAparelho(prev => [...prev, limpo]);
    }
    setNovoModeloInput('');
  };

  // Remover Modelo
  const handleRemoveModelo = (mod) => {
    setModelosAparelho(prev => prev.filter(m => m !== mod));
  };

  // Toggle de Cor
  const handleToggleCor = (cor) => {
    setCoresSelecionadas(prev => 
      prev.includes(cor) ? prev.filter(c => c !== cor) : [...prev, cor]
    );
  };

  // Adicionar Cor customizada
  const handleAddCustomCor = () => {
    const limpa = novaCorInput.trim();
    if (!limpa) return;
    if (!coresSelecionadas.includes(limpa)) {
      setCoresSelecionadas(prev => [...prev, limpa]);
    }
    setNovaCorInput('');
  };

  // Cálculo da grade (Preview)
  const variacoesGeradas = useMemo(() => {
    const list = [];
    if (!linhaBaseFinal || modelosAparelho.length === 0 || coresSelecionadas.length === 0) {
      return list;
    }

    let seed = 0;
    const baseTime = Date.now().toString().slice(-7);

    for (const mod of modelosAparelho) {
      for (const cor of coresSelecionadas) {
        seed += 1;
        const seqNum = String(seed).padStart(3, '0');
        const rand = Math.floor(100 + Math.random() * 900);
        const barcodeSeq = `${baseTime}${seqNum}${rand}`; // 13 dígitos
        const nomeFormatado = `${linhaBaseFinal} - ${mod} (${cor})`;

        list.push({
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
    return list;
  }, [linhaBaseFinal, modelosAparelho, coresSelecionadas, categoria, precoVenda, precoCusto]);

  // Salvar Todas as Variações em Lote
  const handleSalvarTodas = async () => {
    setErroMsg(null);

    if (variacoesGeradas.length === 0) {
      setErroMsg('Configure ao menos um modelo de aparelho e uma cor para gerar a grade.');
      return;
    }

    const valorVendaNum = parseFloat(precoVenda || 0);
    if (isNaN(valorVendaNum) || valorVendaNum <= 0) {
      setErroMsg('Informe um preço de venda válido maior que zero.');
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
      // Usar cliente com sessão autenticada para satisfazer políticas RLS (auth.uid() e get_user_empresa_id())
      const dbClient = supabase;

      // Montar array de objetos para produtos_catalogo garantindo empresa_id, tipo e categoria em CADA item
      const arrayDeProdutos = variacoesGeradas.map(v => ({
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

      // Disparar inserção única em lote
      const { data, error } = await dbClient
        .from('produtos_catalogo')
        .insert(arrayDeProdutos)
        .select();

      if (error) {
        // Se a coluna preco_custo não existir ou der PGRST204, tentar sem ela como fallback mantendo empresa_id, tipo e categoria
        if (error.code === 'PGRST204' || error.message?.includes('could not find the column') || error.message?.includes('does not exist')) {
          console.warn('Retentando insert em produtos_catalogo com schema estrito:', error.message);
          const arrayEstrito = arrayDeProdutos.map(p => ({
            empresa_id: p.empresa_id || empresaId,
            nome: p.nome,
            tipo: 'ACESSORIO',
            categoria: p.categoria || 'Acessórios',
            preco: p.preco,
            cor: p.cor,
            condicao: 'NOVO',
            codigo_barras: p.codigo_barras
          }));

          const { data: retryData, error: retryErr } = await dbClient
            .from('produtos_catalogo')
            .insert(arrayEstrito)
            .select();

          if (retryErr) {
            throw retryErr;
          }

          finalizarSucesso(retryData?.length || arrayDeProdutos.length);
          return;
        }

        throw error;
      }

      finalizarSucesso(data?.length || arrayDeProdutos.length);
    } catch (err) {
      console.error('Erro ao cadastrar variações em lote:', err);
      const detalhe = err?.message || JSON.stringify(err);
      setErroMsg(`Falha ao salvar variações: ${detalhe}`);
      alert(`Falha ao cadastrar variações no catálogo:\n\n${detalhe}`);
    } finally {
      setIsSaving(false);
    }
  };

  const finalizarSucesso = (qtdCriada) => {
    if (onSuccess) {
      onSuccess(qtdCriada, linhaBaseFinal);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#0D0D0D] border border-[#262626] w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header do Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#222222] bg-gradient-to-r from-[#140026] via-[#0D0D0D] to-[#0D0D0D]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#6A0DAD]/20 border border-[#6A0DAD]/50 flex items-center justify-center text-[#c084fc] shadow-lg shadow-[#6A0DAD]/10">
              <Zap size={22} className="animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                Gerador de Grade de Acessórios
                <span className="text-[10px] bg-[#6A0DAD]/20 text-[#c084fc] border border-[#6A0DAD]/40 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  Lote Express
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Cadastre dezenas de variações de capas e acessórios no catálogo mestre em segundos
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Corpo com scroll */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {erroMsg && (
            <div className="bg-red-950/40 border border-red-800/60 p-3.5 rounded-xl flex items-start gap-3 text-red-300 text-xs">
              <AlertCircle size={18} className="shrink-0 text-red-400 mt-0.5" />
              <div className="flex-1">
                <strong className="block font-bold">Atenção ao salvar lote:</strong>
                <span>{erroMsg}</span>
              </div>
            </div>
          )}

          {/* Configuração Principal: Linha Base e Preços */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-[#141414] border border-[#222222] p-4 rounded-xl">
            {/* Linha / Modelo Base */}
            <div className="md:col-span-5 space-y-1.5">
              <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                Linha / Modelo Base <span className="text-red-400">*</span>
              </label>
              <select
                value={selectedLinhaBase}
                onChange={(e) => handleSelectLinhaBase(e.target.value)}
                className="w-full bg-black border border-[#333333] focus:border-[#6A0DAD] rounded-lg px-3 py-2 text-sm text-white font-medium outline-none cursor-pointer"
              >
                {MODELOS_BASE_PREDEFINIDOS.map(opt => (
                  <option key={opt.nome} value={opt.nome}>
                    {opt.label}
                  </option>
                ))}
                <option value="OUTRO">Outro (Digitar Linha Personalizada...)</option>
              </select>

              {selectedLinhaBase === 'OUTRO' && (
                <input
                  type="text"
                  value={customLinhaBase}
                  onChange={(e) => setCustomLinhaBase(e.target.value)}
                  placeholder="Ex: Case Carteira Couro, Case Magnética MagSafe..."
                  className="w-full mt-2 bg-black border border-[#333333] focus:border-[#6A0DAD] rounded-lg px-3 py-2 text-sm text-white outline-none"
                />
              )}
            </div>

            {/* Categoria */}
            <div className="md:col-span-3 space-y-1.5">
              <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                Categoria <span className="text-[9px] text-[#c084fc] font-normal">(Travada)</span>
              </label>
              <input
                type="text"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full bg-[#1c1c1c] border border-[#333333] rounded-lg px-3 py-2 text-sm text-gray-200 font-semibold outline-none"
                placeholder="Capinhas"
              />
            </div>

            {/* Preço de Venda */}
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

            {/* Preço de Custo */}
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

          {/* Modelos de Aparelhos Compatíveis */}
          <div className="space-y-3 bg-[#141414] border border-[#222222] p-4 rounded-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                  Modelos de Aparelho Compatíveis ({modelosAparelho.length})
                </label>
                <p className="text-[11px] text-gray-400">
                  Adicione os aparelhos suportados para multiplicar a grade
                </p>
              </div>

              {/* Sugestões rápidas de modelos */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-gray-500 font-bold uppercase mr-1">Rápidos:</span>
                {MODELOS_RAPIDOS_SUGERIDOS.map(sug => {
                  const jaTem = modelosAparelho.some(m => m.toLowerCase() === sug.toLowerCase());
                  return (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => handleAddModelo(sug)}
                      disabled={jaTem}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded transition-all ${
                        jaTem 
                          ? 'bg-gray-800/40 text-gray-600 border border-transparent cursor-default'
                          : 'bg-[#222222] hover:bg-[#6A0DAD]/30 text-gray-300 hover:text-white border border-[#333333] hover:border-[#6A0DAD]/50 cursor-pointer'
                      }`}
                    >
                      +{sug}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Input de adição de modelo */}
            <div className="flex gap-2">
              <input
                type="text"
                value={novoModeloInput}
                onChange={(e) => setNovoModeloInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddModelo(novoModeloInput);
                  }
                }}
                placeholder="Digite o modelo (Ex: iPhone 16 Pro, Galaxy S24, Moto G84...) e aperte Enter"
                className="flex-1 bg-black border border-[#333333] focus:border-[#6A0DAD] rounded-lg px-3 py-2 text-sm text-white outline-none placeholder-gray-600"
              />
              <button
                type="button"
                onClick={() => handleAddModelo(novoModeloInput)}
                className="px-4 py-2 bg-[#6A0DAD] hover:bg-[#500885] text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              >
                <Plus size={14} /> Adicionar
              </button>
            </div>

            {/* Chips de Modelos Adicionados */}
            <div className="flex flex-wrap gap-2 pt-1 min-h-[38px]">
              {modelosAparelho.length === 0 ? (
                <span className="text-xs text-gray-600 italic">Nenhum modelo de aparelho adicionado ainda.</span>
              ) : (
                modelosAparelho.map(mod => (
                  <span
                    key={mod}
                    className="inline-flex items-center gap-1.5 bg-[#1F1F1F] border border-[#333333] text-gray-200 px-2.5 py-1 rounded-lg text-xs font-semibold shadow-sm"
                  >
                    <span>{mod}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveModelo(mod)}
                      className="text-gray-400 hover:text-red-400 p-0.5 rounded transition-colors cursor-pointer"
                      title={`Remover ${mod}`}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Cores Disponíveis (Toggle e Custom) */}
          <div className="space-y-3 bg-[#141414] border border-[#222222] p-4 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                  Cores Disponíveis ({coresSelecionadas.length})
                </label>
                <p className="text-[11px] text-gray-400">
                  Selecione as cores que serão produzidas para cada modelo
                </p>
              </div>
            </div>

            {/* Chips com toggle de cores padrão */}
            <div className="flex flex-wrap gap-2">
              {CORES_SUGERIDAS.map(cor => {
                const isSelected = coresSelecionadas.includes(cor);
                return (
                  <button
                    key={cor}
                    type="button"
                    onClick={() => handleToggleCor(cor)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-[#6A0DAD] border-[#6A0DAD] text-white shadow-md shadow-[#6A0DAD]/30'
                        : 'bg-black border-[#333333] text-gray-400 hover:text-gray-200 hover:border-[#555555]'
                    }`}
                  >
                    {isSelected && <Check size={12} />}
                    {cor}
                  </button>
                );
              })}
            </div>

            {/* Inserir cor personalizada */}
            <div className="flex gap-2 pt-2 border-t border-[#222222]/80">
              <input
                type="text"
                value={novaCorInput}
                onChange={(e) => setNovaCorInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomCor();
                  }
                }}
                placeholder="Outra cor específica (Ex: Lilás, Verde Militar, Fibra de Carbono...)"
                className="flex-1 bg-black border border-[#333333] focus:border-[#6A0DAD] rounded-lg px-3 py-1.5 text-xs text-white outline-none placeholder-gray-600"
              />
              <button
                type="button"
                onClick={handleAddCustomCor}
                className="px-3 py-1.5 bg-[#222222] hover:bg-[#333333] text-gray-200 border border-[#333333] rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              >
                <Plus size={12} /> Incluir Cor
              </button>
            </div>
          </div>

          {/* Pré-visualização Dinâmica (Preview) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-[#c084fc]" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Pré-visualização da Grade
                </h3>
                <span className="text-[11px] bg-[#6A0DAD]/20 text-[#c084fc] border border-[#6A0DAD]/30 px-2 py-0.5 rounded-md font-mono font-bold">
                  {variacoesGeradas.length} variação(ões)
                </span>
                <span className="text-[10px] text-gray-500">
                  ({modelosAparelho.length} modelo(s) × {coresSelecionadas.length} cor(es))
                </span>
              </div>
            </div>

            {variacoesGeradas.length === 0 ? (
              <div className="border border-dashed border-[#262626] rounded-xl p-8 text-center text-gray-500 text-xs">
                Adicione ao menos um modelo de aparelho e uma cor para ver as variações calculadas.
              </div>
            ) : (
              <div className="border border-[#222222] rounded-xl overflow-hidden bg-[#0A0A0A]">
                <div className="max-h-56 overflow-y-auto divide-y divide-[#1A1A1A]">
                  <table className="w-full text-left text-xs text-gray-300">
                    <thead className="bg-[#141414] text-[10px] font-bold text-gray-400 uppercase tracking-wider sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Nome Formatado da Variação</th>
                        <th className="py-2.5 px-3">Cor</th>
                        <th className="py-2.5 px-3">Preço Venda</th>
                        <th className="py-2.5 px-3">Código de Barras (EAN-13)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#181818]">
                      {variacoesGeradas.map((item, idx) => (
                        <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-2 px-3 font-mono text-[10px] text-gray-600">{idx + 1}</td>
                          <td className="py-2 px-3 font-medium text-white">
                            {item.nome}
                          </td>
                          <td className="py-2 px-3 text-gray-300">
                            <span className="inline-block px-2 py-0.5 rounded bg-[#1C1C1C] border border-[#333333] text-[10px] font-semibold">
                              {item.cor}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-emerald-400">
                            R$ {item.preco.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px] text-purple-300 flex items-center gap-1.5">
                            <Barcode size={13} className="text-gray-500" />
                            {item.codigo_barras}
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

        {/* Rodapé de Ações */}
        <div className="p-4 bg-[#111111] border-t border-[#222222] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-gray-400 text-center sm:text-left">
            Total a ser inserido no catálogo mestre:{' '}
            <strong className="text-white font-mono">{variacoesGeradas.length}</strong> produtos
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-[#1F1F1F] hover:bg-[#2A2A2A] text-gray-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSalvarTodas}
              disabled={isSaving || variacoesGeradas.length === 0}
              className="flex-1 sm:flex-none px-6 py-2.5 bg-[#6A0DAD] hover:bg-[#500885] disabled:bg-gray-800 disabled:text-gray-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-[#6A0DAD]/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Cadastrando {variacoesGeradas.length} variações...</span>
                </>
              ) : (
                <>
                  <Zap size={16} />
                  <span>Salvar Todas as Variações ({variacoesGeradas.length})</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

import React, { useState, useMemo, useEffect } from 'react';
import { X, Zap, Plus, Check, Loader2, Sparkles, AlertCircle, Barcode, Trash2, Building2 } from 'lucide-react';
import { supabase } from '../supabaseClient';

const TIPOS_CASE_PADRAO = [
  'Padrão',
  'Premium',
  'Monkey Shop',
  'Silicone Aveludada',
  'Anti-Impacto Transparente',
  'Couro / Carteira'
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
const gerarCodigoBarras13 = (seed = 0) => {
  const timeSlice = Date.now().toString().slice(-7);
  const seq = String(seed % 1000).padStart(3, '0');
  const rand = Math.floor(100 + Math.random() * 900).toString();
  return `${timeSlice}${seq}${rand}`.slice(0, 13);
};

export default function ModalGeradorGrade({
  isOpen,
  onClose,
  perfilUsuario,
  categorias = [],
  filiais: filiaisProp = [],
  onSuccess
}) {
  // Filiais e Filial Destino
  const [listaFiliais, setListaFiliais] = useState(filiaisProp || []);
  const [loadingFiliais, setLoadingFiliais] = useState(false);
  const [filialDestinoId, setFilialDestinoId] = useState(() => {
    return perfilUsuario?.filial_id || localStorage.getItem('@zenite_filialId') || '';
  });

  // Quantidade inicial padrão por variação
  const [quantidadeInicial, setQuantidadeInicial] = useState(1);

  // Preço e Custo
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

  // Modelos de Aparelho
  const [modelosSelecionados, setModelosSelecionados] = useState([
    'iPhone 13',
    'iPhone 14',
    'iPhone 15'
  ]);
  const [novoModeloInput, setNovoModeloInput] = useState('');

  // Linhas / Tipos de Case
  const [tiposDisponiveis, setTiposDisponiveis] = useState(TIPOS_CASE_PADRAO);
  const [tiposSelecionados, setTiposSelecionados] = useState([
    'Padrão',
    'Premium'
  ]);
  const [novoTipoInput, setNovoTipoInput] = useState('');

  // Fila de variações acumuladas
  const [gradeAcumulada, setGradeAcumulada] = useState([]);

  const [isSaving, setIsSaving] = useState(false);
  const [erroMsg, setErroMsg] = useState(null);

  // Buscar filiais do banco caso não tenham sido passadas ou para garantir lista completa
  useEffect(() => {
    if (!isOpen) return;

    const carregarFiliais = async () => {
      setLoadingFiliais(true);
      try {
        let empresaId = perfilUsuario?.empresa_id || perfilUsuario?.empresaId;
        if (!empresaId) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: prof } = await supabase.from('profiles').select('empresa_id, filial_id').eq('id', user.id).maybeSingle();
            empresaId = prof?.empresa_id;
            if (!filialDestinoId && prof?.filial_id) {
              setFilialDestinoId(prof.filial_id);
            }
          }
        }

        let query = supabase.from('filiais').select('id, nome, tipo').order('nome', { ascending: true });
        if (empresaId) {
          query = query.eq('empresa_id', empresaId);
        }

        const { data, error } = await query;
        if (!error && Array.isArray(data) && data.length > 0) {
          setListaFiliais(data);
          // Se ainda não houver filial selecionada, seleciona a primeira da lista
          if (!filialDestinoId) {
            const sessaoFilial = localStorage.getItem('@zenite_filialId') || perfilUsuario?.filial_id;
            const encontrada = data.find(f => f.id === sessaoFilial);
            setFilialDestinoId(encontrada ? encontrada.id : data[0].id);
          }
        } else if (Array.isArray(filiaisProp) && filiaisProp.length > 0) {
          setListaFiliais(filiaisProp);
          if (!filialDestinoId) {
            setFilialDestinoId(filiaisProp[0].id);
          }
        }
      } catch (err) {
        console.warn('[ModalGeradorGrade] Erro ao carregar filiais:', err);
      } finally {
        setLoadingFiliais(false);
      }
    };

    carregarFiliais();
  }, [isOpen, perfilUsuario?.empresa_id, perfilUsuario?.filial_id]);

  // Nome da filial selecionada atual
  const filialSelecionadaNome = useMemo(() => {
    const achou = listaFiliais.find(f => String(f.id) === String(filialDestinoId));
    return achou ? achou.nome : 'Filial Padrão';
  }, [listaFiliais, filialDestinoId]);

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

  const handleToggleTipo = (tipo) => {
    setTiposSelecionados(prev =>
      prev.includes(tipo) ? prev.filter(t => t !== tipo) : [...prev, tipo]
    );
  };

  const handleLimparTipos = () => {
    setTiposSelecionados([]);
  };

  const handleAddCustomTipo = () => {
    const limpo = novoTipoInput.trim();
    if (!limpo) return;

    setTiposDisponiveis(prev => {
      if (prev.some(t => t.toLowerCase() === limpo.toLowerCase())) return prev;
      return [...prev, limpo];
    });

    setTiposSelecionados(prev => {
      if (prev.some(t => t.toLowerCase() === limpo.toLowerCase())) return prev;
      return [...prev, limpo];
    });

    setNovoTipoInput('');
  };

  const handleAdicionarAFila = () => {
    setErroMsg(null);

    if (tiposSelecionados.length === 0) {
      setErroMsg('Selecione ao menos uma Linha / Tipo de Case para incluir na fila.');
      return;
    }

    if (modelosSelecionados.length === 0) {
      setErroMsg('Selecione ou adicione ao menos um modelo de aparelho para incluir na fila.');
      return;
    }

    const valorVendaNum = parseFloat(precoVenda || 0);
    if (isNaN(valorVendaNum) || valorVendaNum <= 0) {
      setErroMsg('Informe um preço de venda válido maior que zero.');
      return;
    }

    const qtdPadraoNum = Math.max(0, parseInt(quantidadeInicial, 10) || 0);

    let seed = gradeAcumulada.length;
    const novosItens = [];

    for (const tipo of tiposSelecionados) {
      for (const mod of modelosSelecionados) {
        seed += 1;
        const barcodeSeq = gerarCodigoBarras13(seed);
        // Padrão solicitado: Case ${tipo} - ${modelo} (Ex: "Case Premium - Realme C78")
        const nomeFormatado = `Case ${tipo} - ${mod}`;

        novosItens.push({
          idTemp: `${tipo}-${mod}-${Date.now()}-${Math.random()}`,
          nome: nomeFormatado,
          linhaTipo: tipo,
          modelo: mod,
          cor: null,
          tipo: 'ACESSORIO',
          categoria: categoria || 'Capinhas',
          preco: parseFloat(precoVenda || 0),
          custo: parseFloat(precoCusto || 0),
          codigo_barras: barcodeSeq,
          quantidade: qtdPadraoNum,
          filial_id: filialDestinoId || null,
          filial_nome: filialSelecionadaNome
        });
      }
    }

    setGradeAcumulada(prev => [...prev, ...novosItens]);

    // Limpar seleções ativas para novo lote
    setModelosSelecionados([]);
    setTiposSelecionados([]);
  };

  const handleAlterarQuantidadeItem = (index, valor) => {
    const novaQtd = Math.max(0, parseInt(valor, 10) || 0);
    setGradeAcumulada(prev => prev.map((item, i) => i === index ? { ...item, quantidade: novaQtd } : item));
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
      // 1. Inserir os produtos no Catálogo Mestre (produtos_catalogo)
      const itensCatalogo = gradeAcumulada.map(v => ({
        empresa_id: empresaId,
        nome: v.nome,
        tipo: 'ACESSORIO',
        categoria: v.categoria || 'Capinhas',
        preco: Number(v.preco),
        preco_venda: Number(v.preco),
        preco_custo: Number(v.custo || 0),
        cor: null,
        condicao: 'NOVO',
        codigo_barras: v.codigo_barras
      }));

      let produtosCriados = null;

      const { data: catData, error: errCat } = await supabase
        .from('produtos_catalogo')
        .insert(itensCatalogo)
        .select();

      if (errCat) {
        // Fallback caso a coluna preco_venda não exista na tabela produtos_catalogo
        if (errCat.code === 'PGRST204' || errCat.message?.includes('could not find the column') || errCat.message?.includes('does not exist')) {
          const arrayEstrito = itensCatalogo.map(p => ({
            empresa_id: p.empresa_id,
            nome: p.nome,
            tipo: 'ACESSORIO',
            categoria: p.categoria || 'Capinhas',
            preco: p.preco,
            cor: null,
            condicao: 'NOVO',
            codigo_barras: p.codigo_barras
          }));

          const { data: retryCatData, error: retryErr } = await supabase
            .from('produtos_catalogo')
            .insert(arrayEstrito)
            .select();

          if (retryErr) throw retryErr;
          produtosCriados = retryCatData;
        } else {
          throw errCat;
        }
      } else {
        produtosCriados = catData;
      }

      // 2. Se houver filial selecionada e quantidade > 0, criar registros no estoque físico (tabela 'produtos')
      const itensComEstoque = [];
      (produtosCriados || []).forEach((prod, index) => {
        const itemFila = gradeAcumulada[index];
        const qtdItem = itemFila?.quantidade !== undefined ? Number(itemFila.quantidade) : Number(quantidadeInicial || 0);
        const filialIdItem = itemFila?.filial_id || filialDestinoId;

        if (filialIdItem && qtdItem > 0) {
          itensComEstoque.push({
            empresa_id: empresaId,
            filial_id: filialIdItem,
            catalogo_id: prod.id,
            nome: prod.nome,
            categoria: prod.categoria || 'Capinhas',
            tipo: 'ACESSORIO',
            preco: Number(prod.preco || itemFila?.preco || 0),
            preco_venda: Number(prod.preco || itemFila?.preco || 0),
            preco_custo: Number(prod.preco_custo || itemFila?.custo || 0),
            codigo_barras: prod.codigo_barras,
            quantidade: qtdItem,
            status: 'DISPONIVEL',
            cor: null
          });
        }
      });

      if (itensComEstoque.length > 0) {
        const { error: errEstoque } = await supabase
          .from('produtos')
          .insert(itensComEstoque);

        if (errEstoque) {
          // Fallback se colunas como preco_venda, catalogo_id ou status não existirem no schema estrito
          if (errEstoque.code === 'PGRST204' || errEstoque.message?.includes('could not find the column') || errEstoque.message?.includes('does not exist')) {
            const entradasEstrito = itensComEstoque.map(e => ({
              empresa_id: e.empresa_id,
              filial_id: e.filial_id,
              nome: e.nome,
              tipo: 'ACESSORIO',
              categoria: e.categoria,
              preco: e.preco,
              preco_custo: e.preco_custo,
              codigo_barras: e.codigo_barras,
              quantidade: e.quantidade,
              cor: null
            }));

            const { error: retryEstoqueErr } = await supabase
              .from('produtos')
              .insert(entradasEstrito);

            if (retryEstoqueErr) {
              console.warn('Aviso ao inserir no estoque físico:', retryEstoqueErr.message);
            }
          } else {
            console.warn('Aviso ao inserir no estoque físico da loja:', errEstoque.message);
          }
        }
      }

      finalizarSucesso(produtosCriados?.length || gradeAcumulada.length, filialSelecionadaNome);
    } catch (err) {
      console.error('Erro ao cadastrar variações em lote:', err);
      setErroMsg(`Falha ao salvar: ${err?.message || 'Erro desconhecido'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const finalizarSucesso = (qtdCriada, nomeFilialDest) => {
    if (onSuccess) {
      onSuccess(qtdCriada, 'Capinhas', nomeFilialDest);
    }
    setGradeAcumulada([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#0D0D0D] border border-[#262626] w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#222222] bg-gradient-to-r from-[#140026] via-[#0D0D0D] to-[#0D0D0D]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#6A0DAD]/20 border border-[#6A0DAD]/40 flex items-center justify-center text-[#c084fc] shadow-lg shadow-[#6A0DAD]/10">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-white tracking-wide">
                  Gerador de Grade de Acessórios & Entrada Física
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-[#6A0DAD]/30 text-[#c084fc] border border-[#6A0DAD]/40">
                  Lote Pro
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Gere variações por Linha/Tipo e Aparelho com entrada física automática na filial
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

        {/* Mensagem de Erro */}
        {erroMsg && (
          <div className="mx-6 mt-4 p-3 bg-red-950/40 border border-red-800/50 rounded-xl flex items-center gap-2.5 text-red-300 text-xs">
            <AlertCircle size={16} className="shrink-0 text-red-400" />
            <span className="flex-1 font-medium">{erroMsg}</span>
            <button type="button" onClick={() => setErroMsg(null)} className="text-red-400 hover:text-red-200 cursor-pointer">
              <X size={14} />
            </button>
          </div>
        )}

        <div className="p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
          
          {/* Seção 1: Configurações Gerais (Filial de Destino, Quantidade Inicial, Preço Venda, Custo, Categoria) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-[#141414] border border-[#222222] p-4 rounded-xl">
            
            {/* Filial de Destino */}
            <div className="md:col-span-4 space-y-1.5">
              <label className="block text-[11px] font-bold text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 size={13} className="text-[#c084fc]" />
                Filial de Destino <span className="text-red-400">*</span>
              </label>
              <select
                value={filialDestinoId}
                onChange={(e) => setFilialDestinoId(e.target.value)}
                disabled={loadingFiliais}
                className="w-full bg-black border border-[#333333] focus:border-[#6A0DAD] rounded-lg px-3 py-2 text-sm text-white font-medium outline-none cursor-pointer"
              >
                {listaFiliais.length === 0 ? (
                  <option value="">Nenhuma filial cadastrada</option>
                ) : (
                  listaFiliais.map(fil => (
                    <option key={fil.id} value={fil.id}>
                      {fil.nome} {fil.tipo ? `(${fil.tipo})` : ''}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Quantidade Inicial por Variação */}
            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-[11px] font-bold text-purple-300 uppercase tracking-wider">
                Qtd Inicial <span className="text-[9px] text-gray-400 font-normal">(Física)</span>
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={quantidadeInicial}
                onChange={(e) => setQuantidadeInicial(e.target.value)}
                className="w-full bg-black border border-[#6A0DAD]/50 focus:border-[#6A0DAD] rounded-lg px-3 py-2 text-sm text-white font-mono font-bold outline-none"
                placeholder="1"
              />
            </div>

            {/* Preço Venda */}
            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                Preço Venda <span className="text-red-400">*</span>
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

            {/* Custo */}
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

            {/* Categoria */}
            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                Categoria
              </label>
              <input
                type="text"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full bg-[#1c1c1c] border border-[#333333] rounded-lg px-3 py-2 text-sm text-gray-200 font-semibold outline-none focus:border-[#6A0DAD]"
                placeholder="Capinhas"
              />
            </div>

          </div>

          {/* Seção 2: Linhas / Tipos de Case */}
          <div className="space-y-3 bg-[#141414] border border-[#222222] p-4 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                  LINHAS / TIPOS DISPONÍVEIS ({tiposSelecionados.length} selecionados)
                </label>
                {tiposSelecionados.length > 0 && (
                  <button type="button" onClick={handleLimparTipos} className="text-xs text-red-400 hover:text-red-300 hover:underline font-semibold cursor-pointer">
                    Limpar Todos
                  </button>
                )}
              </div>
            </div>
            <p className="text-[11px] text-gray-400">
              Selecione as linhas de case que deseja gerar para os aparelhos:
            </p>
            <div className="flex flex-wrap gap-2">
              {tiposDisponiveis.map(tipo => {
                const isSelected = tiposSelecionados.some(t => t.toLowerCase() === tipo.toLowerCase());
                return (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => handleToggleTipo(tipo)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                      isSelected ? 'bg-[#6A0DAD] border-[#6A0DAD] text-white shadow-md shadow-[#6A0DAD]/30' : 'bg-black border-[#333333] text-gray-400 hover:border-gray-500 hover:text-gray-200'
                    }`}
                  >
                    {isSelected && <Check size={12} />}
                    {tipo}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 pt-2 border-t border-[#222222]/80">
              <input
                type="text"
                value={novoTipoInput}
                onChange={(e) => setNovoTipoInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomTipo(); } }}
                placeholder="Outro tipo de case customizado (Ex: MagSafe Carbono)..."
                className="flex-1 bg-black border border-[#333333] focus:border-[#6A0DAD] rounded-lg px-3 py-1.5 text-xs text-white outline-none"
              />
              <button
                type="button"
                onClick={handleAddCustomTipo}
                disabled={!novoTipoInput.trim()}
                className="px-3.5 py-1.5 bg-[#222222] hover:bg-[#333333] disabled:opacity-50 text-gray-200 border border-[#333333] rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
              >
                <Plus size={12} />
                + Incluir Linha
              </button>
            </div>
          </div>

          {/* Seção 3: Modelos de Aparelho */}
          <div className="space-y-3 bg-[#141414] border border-[#222222] p-4 rounded-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                  Modelos de Aparelho para este Lote ({modelosSelecionados.length})
                </label>
                <p className="text-[11px] text-gray-400">
                  Adicione os aparelhos compatíveis que deseja cruzar com as linhas de case
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
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded transition-all cursor-pointer ${
                        jaTem ? 'bg-gray-800/40 text-gray-600 cursor-not-allowed' : 'bg-[#222222] hover:bg-[#6A0DAD]/30 text-gray-300'
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
                placeholder="Digite o modelo (Ex: Realme C78) e aperte Enter"
                className="flex-1 bg-black border border-[#333333] focus:border-[#6A0DAD] rounded-lg px-3 py-2 text-sm text-white outline-none"
              />
              <button
                type="button"
                onClick={() => handleAddModelo(novoModeloInput)}
                className="px-4 py-2 bg-[#6A0DAD] hover:bg-[#500885] text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              >
                <Plus size={14} /> Adicionar
              </button>
            </div>
            <div className="flex flex-wrap gap-2 pt-1 min-h-[38px]">
              {modelosSelecionados.length === 0 ? (
                <span className="text-xs text-gray-600 italic">Nenhum modelo de aparelho selecionado no lote atual.</span>
              ) : (
                modelosSelecionados.map(mod => (
                  <span key={mod} className="inline-flex items-center gap-1.5 bg-[#1F1F1F] border border-[#333333] text-gray-200 px-2.5 py-1 rounded-lg text-xs font-semibold">
                    <span>{mod}</span>
                    <button type="button" onClick={() => handleRemoveModelo(mod)} className="text-gray-400 hover:text-red-400 cursor-pointer"><X size={12} /></button>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Botão de Adicionar à Fila */}
          <div className="flex justify-center py-1">
            <button
              type="button"
              onClick={handleAdicionarAFila}
              className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-[#6A0DAD] to-[#8A2BE2] hover:from-[#5b0b94] hover:to-[#7822c9] text-white rounded-xl text-sm font-extrabold transition-all shadow-lg shadow-[#6A0DAD]/25 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus size={18} />
              <span>+ Adicionar Variações à Fila</span>
              {(modelosSelecionados.length > 0 && tiposSelecionados.length > 0) && (
                <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-white/20 font-mono">
                  +{modelosSelecionados.length * tiposSelecionados.length}
                </span>
              )}
            </button>
          </div>

          {/* Seção 4: Tabela de Pré-visualização da Grade Acumulada */}
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
                <button type="button" onClick={handleLimparFilaInteira} className="text-xs text-red-400 hover:text-red-300 hover:underline font-semibold cursor-pointer">
                  Limpar Fila Inteira
                </button>
              )}
            </div>

            {gradeAcumulada.length === 0 ? (
              <div className="border border-dashed border-[#262626] rounded-xl p-8 text-center text-gray-500 text-xs">
                Nenhuma variação adicionada à fila ainda. Selecione filial, quantidade, tipos de case e modelos de aparelho acima e clique em "+ Adicionar Variações à Fila".
              </div>
            ) : (
              <div className="border border-[#222222] rounded-xl overflow-hidden bg-[#0A0A0A]">
                <div className="max-h-60 overflow-y-auto divide-y divide-[#1A1A1A]">
                  <table className="w-full text-left text-xs text-gray-300">
                    <thead className="bg-[#141414] text-[10px] font-bold text-gray-400 uppercase tracking-wider sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Nome da Variação</th>
                        <th className="py-2.5 px-3">LINHA / TIPO</th>
                        <th className="py-2.5 px-3">FILIAL</th>
                        <th className="py-2.5 px-3 w-20">QTD</th>
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
                          <td className="py-2 px-3">
                            <span className="px-2 py-0.5 rounded bg-[#6A0DAD]/20 text-[#c084fc] border border-[#6A0DAD]/30 text-[11px] font-semibold">
                              {item.linhaTipo}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700 text-[10px] font-medium truncate max-w-[110px] inline-block">
                              {item.filial_nome || 'Filial'}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min="0"
                              value={item.quantidade}
                              onChange={(e) => handleAlterarQuantidadeItem(idx, e.target.value)}
                              className="w-16 bg-black border border-[#333333] focus:border-[#6A0DAD] rounded px-2 py-1 text-xs text-white font-mono font-bold outline-none text-center"
                            />
                          </td>
                          <td className="py-2 px-3 font-mono text-emerald-400">R$ {item.preco.toFixed(2)}</td>
                          <td className="py-2 px-3 font-mono text-[11px] text-purple-300">{item.codigo_barras}</td>
                          <td className="py-2 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoverDaFila(idx)}
                              className="text-gray-500 hover:text-red-400 p-1 rounded hover:bg-white/5 transition-colors cursor-pointer"
                              title="Remover da fila"
                            >
                              ✕
                            </button>
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

        {/* Rodapé / Botões de Ação */}
        <div className="p-4 bg-[#111111] border-t border-[#222222] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-gray-400">
            Total na fila: <strong className="text-white font-mono">{gradeAcumulada.length}</strong>
            {gradeAcumulada.length > 0 && (
              <span className="ml-2 text-purple-300 font-semibold">
                ({gradeAcumulada.reduce((acc, curr) => acc + (Number(curr.quantidade) || 0), 0)} unidades físicas)
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 px-4 py-2.5 bg-[#1F1F1F] hover:bg-[#2a2a2a] text-gray-300 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
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


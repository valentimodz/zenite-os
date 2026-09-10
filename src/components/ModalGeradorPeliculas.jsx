import React, { useState, useMemo, useEffect } from 'react';
import { X, Zap, Plus, Check, Loader2, Sparkles, AlertCircle, Trash2, Building2, Shield } from 'lucide-react';
import { supabase } from '../supabaseClient';

const TIPOS_PELICULA_PADRAO = [
  'Vidro 3D',
  'Privacidade',
  'Cerâmica 9D',
  'Hidrogel Fosca',
  'Hidrogel Transparente',
  'Vidro Tradicional',
  'Película de Câmera'
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

// Gerador de código de barras 13 dígitos numéricos (com timestamp + random)
const gerarCodigoBarras13 = (seed = 0) => {
  const timeSlice = Date.now().toString().slice(-7);
  const seq = String(seed % 1000).padStart(3, '0');
  const rand = Math.floor(100 + Math.random() * 900).toString();
  return `${timeSlice}${seq}${rand}`.slice(0, 13);
};

export default function ModalGeradorPeliculas({
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

  // Quantidade Padrão por Variação (input numérico, default: 5)
  const [quantidadePadrao, setQuantidadePadrao] = useState(5);

  // Preço de Venda e Preço de Custo
  const [precoVenda, setPrecoVenda] = useState('29.99');
  const [precoCusto, setPrecoCusto] = useState('5.00');

  // Categoria fixa ou pré-preenchida: 'Películas'
  const categoria = 'Películas';

  // Tipos / Materiais de Película
  const [tiposDisponiveis, setTiposDisponiveis] = useState(TIPOS_PELICULA_PADRAO);
  const [tiposSelecionados, setTiposSelecionados] = useState(['Vidro 3D', 'Privacidade']);
  const [novoTipoInput, setNovoTipoInput] = useState('');

  // Modelos de Aparelho
  const [modelosSelecionados, setModelosSelecionados] = useState([
    'iPhone 13',
    'iPhone 14',
    'iPhone 15'
  ]);
  const [novoModeloInput, setNovoModeloInput] = useState('');

  // Fila de Películas Acumuladas
  const [filaPeliculas, setFilaPeliculas] = useState([]);

  const [isSaving, setIsSaving] = useState(false);
  const [erroMsg, setErroMsg] = useState(null);

  // Carregar filiais
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
        console.warn('[ModalGeradorPeliculas] Erro ao carregar filiais:', err);
      } finally {
        setLoadingFiliais(false);
      }
    };

    carregarFiliais();
  }, [isOpen, perfilUsuario?.empresa_id, perfilUsuario?.filial_id]);

  // Nome da filial selecionada atual
  const filialSelecionadaNome = useMemo(() => {
    const achou = listaFiliais.find(f => String(f.id) === String(filialDestinoId));
    return achou ? achou.nome : 'Filial Ativa';
  }, [listaFiliais, filialDestinoId]);

  // Manipulação de Tipos / Materiais
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

  // Manipulação de Modelos de Aparelho
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

  // Adicionar Películas à Fila
  const handleAdicionarAFila = () => {
    setErroMsg(null);

    if (tiposSelecionados.length === 0) {
      setErroMsg('Selecione ao menos um Tipo/Material de Película para incluir na fila.');
      return;
    }

    if (modelosSelecionados.length === 0) {
      setErroMsg('Selecione ou digite ao menos um modelo de aparelho para incluir na fila.');
      return;
    }

    const valorVendaNum = parseFloat(precoVenda || 0);
    if (isNaN(valorVendaNum) || valorVendaNum <= 0) {
      setErroMsg('Informe um preço de venda válido maior que zero.');
      return;
    }

    const qtdPadraoNum = Math.max(0, parseInt(quantidadePadrao, 10) || 0);

    let seed = filaPeliculas.length;
    const novosItens = [];

    for (const tipo of tiposSelecionados) {
      for (const mod of modelosSelecionados) {
        seed += 1;
        const barcodeSeq = gerarCodigoBarras13(seed);
        const nomeFormatado = `Película ${tipo} - ${mod}`;

        novosItens.push({
          idTemp: `${tipo}-${mod}-${Date.now()}-${Math.random()}`,
          nome: nomeFormatado,
          tipo: 'PELICULA',
          material: tipo,
          modelo: mod,
          categoria: 'Películas',
          filial_id: filialDestinoId || null,
          filial_nome: filialSelecionadaNome,
          preco_venda: parseFloat(precoVenda || 0),
          preco_custo: parseFloat(precoCusto || 0),
          quantidade: qtdPadraoNum,
          codigo_barras: barcodeSeq
        });
      }
    }

    setFilaPeliculas(prev => [...prev, ...novosItens]);

    // Reseta seleção temporária de tipos e modelos
    setModelosSelecionados([]);
    setTiposSelecionados([]);
  };

  const handleAlterarQuantidadeItem = (index, valor) => {
    const novaQtd = Math.max(0, parseInt(valor, 10) || 0);
    setFilaPeliculas(prev => prev.map((item, i) => i === index ? { ...item, quantidade: novaQtd } : item));
  };

  const handleRemoverDaFila = (index) => {
    setFilaPeliculas(prev => prev.filter((_, i) => i !== index));
  };

  const handleLimparFilaInteira = () => {
    setFilaPeliculas([]);
  };

  // Gravação Final no Supabase
  const handleSalvarTodas = async () => {
    setErroMsg(null);

    if (filaPeliculas.length === 0) {
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
      // a) Grava no catálogo mestre: .from('produtos_catalogo').insert(itensCatalogo).select()
      const itensCatalogo = filaPeliculas.map(item => ({
        empresa_id: empresaId,
        nome: item.nome,
        tipo: 'PELICULA',
        categoria: 'Películas',
        preco: Number(item.preco_venda),
        preco_venda: Number(item.preco_venda),
        preco_custo: Number(item.preco_custo || 0),
        condicao: 'NOVO',
        codigo_barras: item.codigo_barras
      }));

      let produtosCriados = null;

      const { data: catData, error: errCat } = await supabase
        .from('produtos_catalogo')
        .insert(itensCatalogo)
        .select();

      if (errCat) {
        // Fallback caso a tabela catálogo tenha validação estrita de colunas
        if (errCat.code === 'PGRST204' || errCat.message?.includes('could not find the column') || errCat.message?.includes('does not exist')) {
          const arrayEstrito = itensCatalogo.map(p => ({
            empresa_id: p.empresa_id,
            nome: p.nome,
            tipo: 'PELICULA',
            categoria: 'Películas',
            preco: p.preco,
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

      // b) Cria as entradas no estoque físico da loja: .from('produtos').insert(entradasLoja)
      const entradasLoja = [];
      (produtosCriados || []).forEach((prod, index) => {
        const itemFila = filaPeliculas[index];
        const qtdItem = itemFila?.quantidade !== undefined ? Number(itemFila.quantidade) : Number(quantidadePadrao || 0);
        const filialIdItem = itemFila?.filial_id || filialDestinoId;

        if (filialIdItem && qtdItem > 0) {
          entradasLoja.push({
            empresa_id: empresaId,
            filial_id: filialIdItem,
            catalogo_id: prod.id,
            nome: prod.nome,
            tipo: 'PELICULA',
            categoria: 'Películas',
            preco: Number(prod.preco || prod.preco_venda || itemFila?.preco_venda || 0),
            preco_venda: Number(prod.preco_venda || prod.preco || itemFila?.preco_venda || 0),
            preco_custo: Number(prod.preco_custo || itemFila?.preco_custo || 0),
            codigo_barras: prod.codigo_barras,
            quantidade: qtdItem,
            status: 'DISPONIVEL'
          });
        }
      });

      if (entradasLoja.length > 0) {
        const { error: errEstoque } = await supabase
          .from('produtos')
          .insert(entradasLoja);

        if (errEstoque) {
          // Fallback caso colunas opcionais não existam
          if (errEstoque.code === 'PGRST204' || errEstoque.message?.includes('could not find the column') || errEstoque.message?.includes('does not exist')) {
            const entradasEstrito = entradasLoja.map(e => ({
              empresa_id: e.empresa_id,
              filial_id: e.filial_id,
              nome: e.nome,
              tipo: 'PELICULA',
              categoria: e.categoria,
              preco: e.preco,
              preco_custo: e.preco_custo,
              codigo_barras: e.codigo_barras,
              quantidade: e.quantidade
            }));

            const { error: retryEstoqueErr } = await supabase
              .from('produtos')
              .insert(entradasEstrito);

            if (retryEstoqueErr) {
              console.warn('Aviso ao inserir no estoque físico de películas:', retryEstoqueErr.message);
            }
          } else {
            console.warn('Aviso ao inserir no estoque físico da loja:', errEstoque.message);
          }
        }
      }

      // c) Notifica com toast e limpa o estado
      if (onSuccess) {
        onSuccess(produtosCriados?.length || filaPeliculas.length, filialSelecionadaNome);
      }
      setFilaPeliculas([]);
      onClose();
    } catch (err) {
      console.error('Erro ao cadastrar películas em lote:', err);
      setErroMsg(`Falha ao salvar: ${err?.message || 'Erro desconhecido'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Totalizadores
  const totalVariacoesFila = filaPeliculas.length;
  const saldoTotalItens = filaPeliculas.reduce((acc, curr) => acc + (Number(curr.quantidade) || 0), 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#0D0D0D] border border-[#262626] w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#222222] bg-gradient-to-r from-[#002b20] via-[#0D0D0D] to-[#0D0D0D]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
              <Shield size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-white tracking-wide">
                  Gerador de Grade de Películas (Lote Express)
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Lote Express
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Gere variações por Material/Tipo e Aparelho com entrada física direta no estoque da filial
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
          
          {/* 1. Cabeçalho / Parâmetros do Lote */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-[#141414] border border-[#222222] p-4 rounded-xl">
            
            {/* Categoria: 'Películas' (fixo) */}
            <div className="md:col-span-3 space-y-1.5">
              <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                Categoria
              </label>
              <input
                type="text"
                value={categoria}
                disabled
                className="w-full bg-[#1c1c1c] border border-[#333333] rounded-lg px-3 py-2 text-sm text-emerald-400 font-bold outline-none cursor-not-allowed opacity-90"
              />
            </div>

            {/* Filial de Destino: Dropdown com as filiais cadastradas (default: filial ativa) */}
            <div className="md:col-span-3 space-y-1.5">
              <label className="block text-[11px] font-bold text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 size={13} className="text-emerald-400" />
                Filial de Destino <span className="text-red-400">*</span>
              </label>
              <select
                value={filialDestinoId}
                onChange={(e) => setFilialDestinoId(e.target.value)}
                disabled={loadingFiliais}
                className="w-full bg-black border border-[#333333] focus:border-emerald-500 rounded-lg px-3 py-2 text-sm text-white font-medium outline-none cursor-pointer"
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

            {/* Preço de Venda (R$) */}
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
                placeholder="29.99"
              />
            </div>

            {/* Preço de Custo (R$) */}
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
                placeholder="5.00"
              />
            </div>

            {/* Quantidade Padrão por Variação (input numérico, default: 5) */}
            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-[11px] font-bold text-emerald-300 uppercase tracking-wider">
                Qtd Padrão <span className="text-[9px] text-gray-400 font-normal">(Variação)</span>
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={quantidadePadrao}
                onChange={(e) => setQuantidadePadrao(e.target.value)}
                className="w-full bg-black border border-emerald-500/50 focus:border-emerald-500 rounded-lg px-3 py-2 text-sm text-white font-mono font-bold outline-none"
                placeholder="5"
              />
            </div>

          </div>

          {/* 2. Tipos de Película / Material (Seleção por botões) */}
          <div className="space-y-3 bg-[#141414] border border-[#222222] p-4 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                  Tipos de Película / Material ({tiposSelecionados.length} selecionados)
                </label>
                {tiposSelecionados.length > 0 && (
                  <button type="button" onClick={handleLimparTipos} className="text-xs text-red-400 hover:text-red-300 hover:underline font-semibold cursor-pointer">
                    Limpar Todos
                  </button>
                )}
              </div>
            </div>
            <p className="text-[11px] text-gray-400">
              Selecione múltiplos tipos/materiais que deseja gerar para os aparelhos:
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
                      isSelected
                        ? 'bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-600/30'
                        : 'bg-black border-[#333333] text-gray-400 hover:border-gray-500 hover:text-gray-200'
                    }`}
                  >
                    {isSelected && <Check size={12} />}
                    {tipo}
                  </button>
                );
              })}
            </div>
            {/* Input para "+ Incluir Novo Tipo" customizado */}
            <div className="flex gap-2 pt-2 border-t border-[#222222]/80">
              <input
                type="text"
                value={novoTipoInput}
                onChange={(e) => setNovoTipoInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomTipo(); } }}
                placeholder="Outro tipo/material customizado (Ex: Hidrogel UV, Matte Anti-Reflexo)..."
                className="flex-1 bg-black border border-[#333333] focus:border-emerald-500 rounded-lg px-3 py-1.5 text-xs text-white outline-none"
              />
              <button
                type="button"
                onClick={handleAddCustomTipo}
                disabled={!novoTipoInput.trim()}
                className="px-3.5 py-1.5 bg-[#222222] hover:bg-[#333333] disabled:opacity-50 text-gray-200 border border-[#333333] rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
              >
                <Plus size={12} />
                + Incluir Novo Tipo
              </button>
            </div>
          </div>

          {/* 3. Modelos de Aparelho */}
          <div className="space-y-3 bg-[#141414] border border-[#222222] p-4 rounded-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                  Modelos de Aparelho ({modelosSelecionados.length})
                </label>
                <p className="text-[11px] text-gray-400">
                  Adicione os modelos compatíveis para cruzar com os tipos de películas selecionados
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
                        jaTem ? 'bg-gray-800/40 text-gray-600 cursor-not-allowed' : 'bg-[#222222] hover:bg-emerald-600/30 text-gray-300'
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
                placeholder="Digite o modelo de aparelho (Ex: iPhone 16 Pro) e aperte Enter"
                className="flex-1 bg-black border border-[#333333] focus:border-emerald-500 rounded-lg px-3 py-2 text-sm text-white outline-none"
              />
              <button
                type="button"
                onClick={() => handleAddModelo(novoModeloInput)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
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

          {/* 4. Botão "+ Adicionar Películas à Fila" */}
          <div className="flex justify-center py-1">
            <button
              type="button"
              onClick={handleAdicionarAFila}
              className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-sm font-extrabold transition-all shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus size={18} />
              <span>+ Adicionar Películas à Fila</span>
              {(modelosSelecionados.length > 0 && tiposSelecionados.length > 0) && (
                <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-white/20 font-mono">
                  +{modelosSelecionados.length * tiposSelecionados.length}
                </span>
              )}
            </button>
          </div>

          {/* 5. Tabela de Pré-visualização da Fila */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-emerald-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Pré-visualização da Fila
                </h3>
                <span className="text-[11px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-md font-mono font-bold">
                  {totalVariacoesFila} na fila
                </span>
              </div>
              {filaPeliculas.length > 0 && (
                <button type="button" onClick={handleLimparFilaInteira} className="text-xs text-red-400 hover:text-red-300 hover:underline font-semibold cursor-pointer">
                  Limpar Fila Inteira
                </button>
              )}
            </div>

            {filaPeliculas.length === 0 ? (
              <div className="border border-dashed border-[#262626] rounded-xl p-8 text-center text-gray-500 text-xs">
                Nenhuma película adicionada à fila ainda. Selecione filial, preços, tipos/materiais e modelos de aparelho acima e clique em "+ Adicionar Películas à Fila".
              </div>
            ) : (
              <div className="border border-[#222222] rounded-xl overflow-hidden bg-[#0A0A0A]">
                <div className="max-h-60 overflow-y-auto divide-y divide-[#1A1A1A]">
                  <table className="w-full text-left text-xs text-gray-300">
                    <thead className="bg-[#141414] text-[10px] font-bold text-gray-400 uppercase tracking-wider sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Descrição</th>
                        <th className="py-2.5 px-3">Material</th>
                        <th className="py-2.5 px-3">Filial</th>
                        <th className="py-2.5 px-3 w-20">Qtd</th>
                        <th className="py-2.5 px-3">Preço Venda</th>
                        <th className="py-2.5 px-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#181818]">
                      {filaPeliculas.map((item, idx) => (
                        <tr key={item.idTemp || idx} className="hover:bg-white/[0.02]">
                          <td className="py-2 px-3 font-mono text-[10px] text-gray-600">{idx + 1}</td>
                          <td className="py-2 px-3 font-medium text-white">{item.nome}</td>
                          <td className="py-2 px-3">
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold">
                              {item.material}
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
                              className="w-16 bg-black border border-[#333333] focus:border-emerald-500 rounded px-2 py-1 text-xs text-white font-mono font-bold outline-none text-center"
                            />
                          </td>
                          <td className="py-2 px-3 font-mono text-emerald-400 font-bold">R$ {Number(item.preco_venda).toFixed(2)}</td>
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

        {/* 6. Rodapé com totalizador e Gravação Final */}
        <div className="p-4 bg-[#111111] border-t border-[#222222] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-gray-400">
            Total de variações na fila: <strong className="text-white font-mono">{totalVariacoesFila}</strong> | Saldo total de itens: <strong className="text-emerald-400 font-mono">{saldoTotalItens}</strong>
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
              disabled={isSaving || filaPeliculas.length === 0}
              className="flex-1 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-800 disabled:text-gray-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
              <span>Salvar Todas as Películas ({filaPeliculas.length})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

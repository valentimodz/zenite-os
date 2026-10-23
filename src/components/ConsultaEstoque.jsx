import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import {
  Search,
  Filter,
  X,
  Package,
  Smartphone,
  Tag,
  Building2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  QrCode,
  ArrowRightLeft,
  ChevronDown,
  Layers,
  Sparkles,
  SlidersHorizontal,
  ExternalLink,
  History
} from 'lucide-react';
import { formatCurrency, formatarMoeda } from '../utils/currencyUtils';

export default function ConsultaEstoque({
  filiais = [],
  activeFilialId = null,
  profile,
  onNavigateToTransferencias,
  onOpenDetalhesProduto
}) {
  // 1. Estados dos Filtros
  const [busca, setBusca] = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');
  
  // Inicia com a filial ativa do contexto do sistema se existir, senão 'TODAS'
  const [filialSelecionada, setFilialSelecionada] = useState(() => {
    if (activeFilialId && activeFilialId !== 'null' && activeFilialId !== 'undefined') {
      return String(activeFilialId);
    }
    return 'TODAS';
  });

  const [categoriaSelecionada, setCategoriaSelecionada] = useState('TODAS');
  const [statusFiltro, setStatusFiltro] = useState('TODOS'); // 'TODOS' | 'CRITICO' | 'ZERADO' | 'DISPONIVEL'

  // 2. Estados dos Dados
  const [loading, setLoading] = useState(false);
  const [produtos, setProdutos] = useState([]);
  const [produtosCatalogo, setProdutosCatalogo] = useState([]);
  const [imeisDisponiveis, setImeisDisponiveis] = useState([]);
  const [categoriasLista, setCategoriasLista] = useState([]);

  // 3. Estado do Modal de IMEIs Disponíveis
  const [modalImeisAberto, setModalImeisAberto] = useState(false);
  const [produtoImeisModal, setProdutoImeisModal] = useState(null);
  const [imeisDoProdutoModal, setImeisDoProdutoModal] = useState([]);

  // Debounce na busca de texto
  useEffect(() => {
    const timer = setTimeout(() => {
      setBuscaDebounced(busca);
    }, 250);
    return () => clearTimeout(timer);
  }, [busca]);

  // Sincronizar filial selecionada caso activeFilialId mude inicialmente
  useEffect(() => {
    if (activeFilialId && filialSelecionada === 'TODAS' && activeFilialId !== 'null') {
      setFilialSelecionada(String(activeFilialId));
    }
  }, [activeFilialId]);

  // 4. Carregar Dados do Supabase com Resiliência (.select('*'))
  const carregarDadosEstoque = useCallback(async () => {
    setLoading(true);
    try {
      const empresaId = profile?.empresa_id;

      // 4.1 Carregar produtos físicos da tabela 'produtos' com .select('*')
      let qProdutos = supabase.from('produtos').select('*');
      if (empresaId) {
        qProdutos = qProdutos.eq('empresa_id', empresaId);
      }
      const { data: dataProdutos, error: errProdutos } = await qProdutos;
      if (errProdutos) {
        console.warn('Erro ao carregar produtos:', errProdutos);
      }

      // 4.2 Carregar catálogo mestre de produtos_catalogo com .select('*')
      let qCatalogo = supabase.from('produtos_catalogo').select('*');
      if (empresaId) {
        qCatalogo = qCatalogo.eq('empresa_id', empresaId);
      }
      const { data: dataCatalogo, error: errCatalogo } = await qCatalogo;
      if (errCatalogo) {
        console.warn('Erro ao carregar produtos_catalogo:', errCatalogo);
      }

      // 4.3 Carregar IMEIs disponíveis com .select('*')
      let qImeis = supabase
        .from('imeis')
        .select('*')
        .or('vendido.is.null,vendido.eq.false');
      
      if (empresaId) {
        qImeis = qImeis.eq('empresa_id', empresaId);
      }
      const { data: dataImeis, error: errImeis } = await qImeis;
      if (errImeis) {
        console.warn('Erro ao carregar imeis:', errImeis);
      }

      // 4.4 Carregar categorias distintas
      let qCategorias = supabase.from('categorias').select('*');
      if (empresaId) {
        qCategorias = qCategorias.eq('empresa_id', empresaId);
      }
      const { data: dataCategorias } = await qCategorias;

      const prods = dataProdutos || [];
      const catsMestre = dataCatalogo || [];
      const ims = (dataImeis || []).filter((im) => {
        const st = String(im.status || '').toUpperCase();
        return !im.vendido && !st.includes('VEND') && st !== 'DEFEITO' && st !== 'RESERVADO_OUTRO';
      });

      setProdutos(prods);
      setProdutosCatalogo(catsMestre);
      setImeisDisponiveis(ims);

      // Consolidar lista de categorias
      const catsSet = new Set();
      (dataCategorias || []).forEach((c) => {
        if (c.nome && c.nome.trim()) catsSet.add(c.nome.trim().toUpperCase());
      });
      prods.forEach((p) => {
        if (p.categoria && p.categoria.trim()) catsSet.add(p.categoria.trim().toUpperCase());
      });
      catsMestre.forEach((c) => {
        if (c.categoria && c.categoria.trim()) catsSet.add(c.categoria.trim().toUpperCase());
      });
      setCategoriasLista(Array.from(catsSet).sort());
    } catch (error) {
      console.error('Falha geral ao carregar dados do estoque:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.empresa_id]);

  useEffect(() => {
    carregarDadosEstoque();
  }, [carregarDadosEstoque]);

  // 5. Agrupamento e Consolidação dos Produtos
  const produtosConsolidados = useMemo(() => {
    const mapa = new Map();

    // 1º Passo: Alimentar com o Catálogo Mestre
    (produtosCatalogo || []).forEach(cat => {
      const nomeNorm = String(cat.nome || '').trim();
      if (!nomeNorm) return;
      const key = `${nomeNorm.toLowerCase()}_${String(cat.categoria || 'GERAL').toLowerCase()}`;

      const tipoStr = String(cat.tipo || '').toUpperCase();
      const catStr = String(cat.categoria || '').toUpperCase();
      const isCelular = tipoStr.includes('CELULAR') || tipoStr.includes('SMARTPHONE') || catStr === 'IOS' || catStr === 'ANDROID';

      mapa.set(key, {
        id: cat.id,
        nome: cat.nome,
        sku: cat.sku || '',
        codigo_barras: cat.codigo_barras || '',
        categoria: cat.categoria || 'GERAL',
        tipo: cat.tipo || (isCelular ? 'CELULAR' : 'ACESSORIO'),
        preco: Number(cat.preco || cat.preco_venda || 0),
        isCelular,
        itensFisicos: [],
        catalogoItem: cat
      });
    });

    // 2º Passo: Adicionar ou complementar com itens da tabela 'produtos'
    (produtos || []).forEach(prod => {
      const nomeNorm = String(prod.nome || '').trim();
      if (!nomeNorm) return;
      const key = `${nomeNorm.toLowerCase()}_${String(prod.categoria || 'GERAL').toLowerCase()}`;

      const tipoStr = String(prod.tipo || '').toUpperCase();
      const catStr = String(prod.categoria || '').toUpperCase();
      const isCelular = tipoStr.includes('CELULAR') || tipoStr.includes('SMARTPHONE') || catStr === 'IOS' || catStr === 'ANDROID';

      if (!mapa.has(key)) {
        mapa.set(key, {
          id: prod.id,
          nome: prod.nome,
          sku: prod.sku || '',
          codigo_barras: prod.codigo_barras || '',
          categoria: prod.categoria || 'GERAL',
          tipo: prod.tipo || (isCelular ? 'CELULAR' : 'ACESSORIO'),
          preco: Number(prod.preco || prod.preco_venda || 0),
          isCelular,
          itensFisicos: [prod]
        });
      } else {
        const itemExistente = mapa.get(key);
        itemExistente.itensFisicos.push(prod);
        if (!itemExistente.sku && prod.sku) itemExistente.sku = prod.sku;
        if (!itemExistente.codigo_barras && prod.codigo_barras) itemExistente.codigo_barras = prod.codigo_barras;
        if (Number(prod.preco || prod.preco_venda || 0) > 0 && itemExistente.preco === 0) {
          itemExistente.preco = Number(prod.preco || prod.preco_venda || 0);
        }
      }
    });

    return Array.from(mapa.values());
  }, [produtos, produtosCatalogo]);

  // 6. Cálculo Dinâmico de Quantidades (Na Filial Selecionada & Na Rede)
  const itensCalculados = useMemo(() => {
    return produtosConsolidados.map(item => {
      const produtoIds = new Set();
      if (item.id) produtoIds.add(String(item.id));
      item.itensFisicos.forEach(p => {
        if (p.id) produtoIds.add(String(p.id));
      });

      let qtdFilial = 0;
      let qtdRede = 0;

      if (item.isCelular) {
        const imeisDoItem = (imeisDisponiveis || []).filter(im => {
          if (im.produto_id && produtoIds.has(String(im.produto_id))) return true;
          return false;
        });

        if (imeisDoItem.length > 0) {
          qtdRede = imeisDoItem.length;
          if (filialSelecionada === 'TODAS') {
            qtdFilial = qtdRede;
          } else {
            qtdFilial = imeisDoItem.filter(im => String(im.filial_id || '') === String(filialSelecionada)).length;
          }
        } else {
          item.itensFisicos.forEach(p => {
            const q = Number(p.quantidade || 0);
            qtdRede += q;
            if (filialSelecionada !== 'TODAS' && String(p.filial_id || '') === String(filialSelecionada)) {
              qtdFilial += q;
            }
          });
          if (filialSelecionada === 'TODAS') {
            qtdFilial = qtdRede;
          }
        }
      } else {
        item.itensFisicos.forEach(p => {
          const q = Number(p.quantidade || 0);
          qtdRede += q;
          if (filialSelecionada !== 'TODAS' && String(p.filial_id || '') === String(filialSelecionada)) {
            qtdFilial += q;
          }
        });
        if (filialSelecionada === 'TODAS') {
          qtdFilial = qtdRede;
        }
      }

      return {
        ...item,
        qtdFilial,
        qtdRede,
        statusEstoque: qtdFilial === 0 ? 'ZERADO' : qtdFilial < 5 ? 'CRITICO' : 'DISPONIVEL'
      };
    });
  }, [produtosConsolidados, imeisDisponiveis, filialSelecionada]);

  // 7. Filtros de Interface (Busca Textual, Categoria e Pílulas de Status)
  const itensFiltrados = useMemo(() => {
    return itensCalculados.filter(item => {
      // Filtro de Categoria
      if (categoriaSelecionada !== 'TODAS') {
        const catItem = String(item.categoria || '').toUpperCase();
        if (catItem !== categoriaSelecionada.toUpperCase()) return false;
      }

      // Filtro de Status de Estoque
      if (statusFiltro !== 'TODOS') {
        if (item.statusEstoque !== statusFiltro) return false;
      }

      // Busca Textual (Nome, SKU ou Código de Barras)
      if (buscaDebounced.trim()) {
        const termo = buscaDebounced.toLowerCase().trim();
        const nome = String(item.nome || '').toLowerCase();
        const sku = String(item.sku || '').toLowerCase();
        const barcode = String(item.codigo_barras || '').toLowerCase();

        const match = nome.includes(termo) || sku.includes(termo) || barcode.includes(termo);
        if (!match) return false;
      }

      return true;
    });
  }, [itensCalculados, categoriaSelecionada, statusFiltro, buscaDebounced]);

  // Contadores para as Pílulas de Status
  const contadores = useMemo(() => {
    let todos = itensCalculados.length;
    let critico = 0;
    let zerado = 0;
    let disponivel = 0;

    itensCalculados.forEach(i => {
      if (i.qtdFilial === 0) zerado++;
      else if (i.qtdFilial < 5) critico++;
      else disponivel++;
    });

    return { todos, critico, zerado, disponivel };
  }, [itensCalculados]);

  // Abrir Modal de IMEIs para o Produto
  const handleAbrirImeis = (item) => {
    const produtoIds = new Set();
    if (item.id) produtoIds.add(String(item.id));
    item.itensFisicos?.forEach((p) => {
      if (p.id) produtoIds.add(String(p.id));
    });

    const imeisRelacionados = (imeisDisponiveis || []).filter(im => {
      const matchProd = im.produto_id && produtoIds.has(String(im.produto_id));
      if (!matchProd) return false;

      if (filialSelecionada !== 'TODAS') {
        return String(im.filial_id || '') === String(filialSelecionada);
      }
      return true;
    });

    setProdutoImeisModal(item);
    setImeisDoProdutoModal(imeisRelacionados);
    setModalImeisAberto(true);
  };

  // Nome da filial ativa selecionada para display
  const nomeFilialAtiva = useMemo(() => {
    if (filialSelecionada === 'TODAS') return 'Todas as Filiais (Rede Completa)';
    const f = filiais.find(fil => String(fil.id) === String(filialSelecionada));
    return f ? f.nome : 'Filial Selecionada';
  }, [filialSelecionada, filiais]);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* 1. Menu e Cabeçalho */}
      <div className="bg-gradient-to-r from-[#0d0914] via-[#120d1c] to-[#0a0a0a] border border-[#8B5CF6]/30 p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-44 h-44 bg-[#8B5CF6]/10 rounded-full blur-3xl pointer-events-none" />
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 rounded-xl text-[#A78BFA] shadow-sm">
              <Package size={22} className="text-[#8B5CF6]" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                Posição de Estoque & Auditoria
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Consulte a disponibilidade de produtos por filial e na rede com alertas de estoque crítico e zerado.
              </p>
            </div>
          </div>
        </div>

        {/* Botão de Atualização Rápida */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={carregarDadosEstoque}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 bg-black/60 hover:bg-[#1a1226] border border-[#33254d] hover:border-[#8B5CF6]/60 text-purple-300 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
            title="Recarregar Dados"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-[#8B5CF6]' : ''} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* 2. Barra de Filtros e Busca */}
      <div className="bg-[#0e0e11] border border-[#222228] rounded-2xl p-5 space-y-4 shadow-lg">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
          {/* Campo de Busca em Tempo Real */}
          <div className="md:col-span-5 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
            <input
              type="text"
              placeholder="Buscar por nome do produto, SKU ou código..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full bg-black/70 border border-[#282830] focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#8B5CF6]/40 text-xs text-white placeholder-gray-500 rounded-xl pl-10 pr-9 py-2.5 outline-none font-medium transition-all"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors p-1"
                title="Limpar busca"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Dropdown de Filiais */}
          <div className="md:col-span-4 relative">
            <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8B5CF6] pointer-events-none" size={15} />
            <select
              value={filialSelecionada}
              onChange={(e) => setFilialSelecionada(e.target.value)}
              className="w-full bg-black/70 border border-[#282830] focus:border-[#8B5CF6] text-xs text-white rounded-xl pl-10 pr-8 py-2.5 outline-none font-semibold cursor-pointer appearance-none transition-all"
            >
              <option value="TODAS">🏢 Todas as Filiais (Rede Completa)</option>
              {filiais.map(f => (
                <option key={f.id} value={String(f.id)}>
                  📍 {f.nome}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={14} />
          </div>

          {/* Dropdown de Categorias */}
          <div className="md:col-span-3 relative">
            <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8B5CF6] pointer-events-none" size={15} />
            <select
              value={categoriaSelecionada}
              onChange={(e) => setCategoriaSelecionada(e.target.value)}
              className="w-full bg-black/70 border border-[#282830] focus:border-[#8B5CF6] text-xs text-white rounded-xl pl-10 pr-8 py-2.5 outline-none font-semibold cursor-pointer appearance-none transition-all"
            >
              <option value="TODAS">Todas as Categorias</option>
              {categoriasLista.map(cat => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={14} />
          </div>
        </div>

        {/* Pílulas/Abas de Status de Estoque (Filtro Rápido em 1 clique) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#1f1f26]">
          <div className="flex flex-wrap items-center gap-2">
            {/* Todos os Itens */}
            <button
              type="button"
              onClick={() => setStatusFiltro('TODOS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                statusFiltro === 'TODOS'
                  ? 'bg-[#8B5CF6] border-[#8B5CF6] text-white shadow-md shadow-[#8B5CF6]/30'
                  : 'bg-black/50 border-[#282830] text-gray-400 hover:text-white hover:border-gray-600'
              }`}
            >
              <Layers size={13} />
              <span>Todos os Itens</span>
              <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-black/30 font-mono">
                {contadores.todos}
              </span>
            </button>

            {/* Crítico (< 5 un) */}
            <button
              type="button"
              onClick={() => setStatusFiltro('CRITICO')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                statusFiltro === 'CRITICO'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-md shadow-amber-500/20'
                  : 'bg-black/50 border-[#282830] text-amber-400/70 hover:text-amber-300 hover:border-amber-500/40'
              }`}
            >
              <AlertTriangle size={13} className="text-amber-400" />
              <span>Crítico (&lt; 5 un)</span>
              <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-amber-950/60 text-amber-300 border border-amber-800/40 font-mono">
                {contadores.critico}
              </span>
            </button>

            {/* Estoque Zerado */}
            <button
              type="button"
              onClick={() => setStatusFiltro('ZERADO')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                statusFiltro === 'ZERADO'
                  ? 'bg-rose-500/20 border-rose-500 text-rose-300 shadow-md shadow-rose-500/20'
                  : 'bg-black/50 border-[#282830] text-rose-400/70 hover:text-rose-300 hover:border-rose-500/40'
              }`}
            >
              <XCircle size={13} className="text-rose-400" />
              <span>Estoque Zerado</span>
              <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-rose-950/60 text-rose-300 border border-rose-800/40 font-mono">
                {contadores.zerado}
              </span>
            </button>

            {/* Disponível (≥ 5 un) */}
            <button
              type="button"
              onClick={() => setStatusFiltro('DISPONIVEL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                statusFiltro === 'DISPONIVEL'
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-500/20'
                  : 'bg-black/50 border-[#282830] text-emerald-400/70 hover:text-emerald-300 hover:border-emerald-500/40'
              }`}
            >
              <CheckCircle2 size={13} className="text-emerald-400" />
              <span>Disponível (≥ 5 un)</span>
              <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 font-mono">
                {contadores.disponivel}
              </span>
            </button>
          </div>

          {/* Indicador de Filtro Ativo */}
          <div className="text-[11px] text-gray-400 font-medium">
            Exibindo <span className="text-white font-bold">{itensFiltrados.length}</span> produtos em <span className="text-[#A78BFA] font-semibold">{nomeFilialAtiva}</span>
          </div>
        </div>
      </div>

      {/* 3. Cards dos Produtos (Grid Responsivo) */}
      {loading ? (
        <div className="py-20 text-center flex flex-col items-center justify-center space-y-3">
          <RefreshCw size={32} className="animate-spin text-[#8B5CF6]" />
          <p className="text-sm font-semibold text-gray-400">Carregando dados de estoque e filiais...</p>
        </div>
      ) : itensFiltrados.length === 0 ? (
        <div className="py-16 px-4 text-center bg-[#0e0e11] border border-dashed border-[#222228] rounded-2xl flex flex-col items-center justify-center space-y-3">
          <div className="p-4 bg-purple-950/30 border border-purple-800/40 rounded-full text-purple-400">
            <Search size={32} />
          </div>
          <h4 className="text-base font-bold text-white">Nenhum produto encontrado</h4>
          <p className="text-xs text-gray-400 max-w-md mx-auto">
            Não encontramos itens com os critérios de busca e filtros selecionados. Tente limpar os filtros ou buscar por outro termo.
          </p>
          {(busca || categoriaSelecionada !== 'TODAS' || statusFiltro !== 'TODOS') && (
            <button
              type="button"
              onClick={() => {
                setBusca('');
                setCategoriaSelecionada('TODAS');
                setStatusFiltro('TODOS');
              }}
              className="mt-2 px-4 py-2 bg-[#8B5CF6]/20 hover:bg-[#8B5CF6]/30 border border-[#8B5CF6]/50 text-purple-300 font-bold rounded-xl text-xs transition-all flex items-center gap-1.5"
            >
              <X size={14} />
              <span>Limpar Todos os Filtros</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {itensFiltrados.map((item) => {
            const isEsgotado = item.qtdFilial === 0;
            const isCritico = item.qtdFilial > 0 && item.qtdFilial < 5;
            const isDisponivel = item.qtdFilial >= 5;

            return (
              <div
                key={item.id + item.nome}
                className="bg-[#0e0e11] border border-[#202028] hover:border-[#8B5CF6]/50 rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all duration-200 group hover:shadow-xl hover:shadow-[#8B5CF6]/5 relative overflow-hidden"
              >
                {/* Linha 1: Badge de Categoria e Preço de Venda */}
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] bg-[#1a1228] text-purple-300 border border-[#3b255e] px-2.5 py-0.5 rounded-md font-bold uppercase tracking-wider flex items-center gap-1">
                      {item.isCelular ? <Smartphone size={11} className="text-[#8B5CF6]" /> : <Tag size={11} className="text-[#8B5CF6]" />}
                      {item.categoria || 'Geral'}
                    </span>
                    <span className="text-sm font-mono font-extrabold text-emerald-400">
                      {formatCurrency(item.preco)}
                    </span>
                  </div>

                  {/* Nome do Produto em Destaque e SKU */}
                  <h3 className="text-sm font-extrabold text-white mt-2.5 group-hover:text-purple-300 transition-colors line-clamp-2">
                    {item.nome}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] text-gray-500 font-mono">
                      SKU: <strong className="text-gray-400">{item.sku || 'N/D'}</strong>
                    </span>
                    {item.codigo_barras && (
                      <span className="text-[10px] text-gray-500 font-mono border-l border-gray-800 pl-2">
                        EAN: {item.codigo_barras}
                      </span>
                    )}
                  </div>
                </div>

                {/* Caixa de Destaque de Estoque */}
                <div className="bg-black/60 border border-[#22222a] rounded-xl p-3.5 space-y-2.5">
                  {/* Na Filial Selecionada */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                        Na Filial Selecionada
                      </span>
                      <span className="text-xs text-gray-500 truncate max-w-[140px] block font-medium">
                        {filialSelecionada === 'TODAS' ? 'Média / Rede' : nomeFilialAtiva}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-lg font-extrabold text-white font-mono">
                        {item.qtdFilial} <span className="text-[11px] text-gray-400 font-sans">un</span>
                      </span>

                      {/* Badge Dinâmico de Status */}
                      {isEsgotado && (
                        <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/50 px-2 py-0.5 rounded-md font-extrabold tracking-wide">
                          ESGOTADO
                        </span>
                      )}
                      {isCritico && (
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/50 px-2 py-0.5 rounded-md font-extrabold tracking-wide">
                          CRÍTICO
                        </span>
                      )}
                      {isDisponivel && (
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 px-2 py-0.5 rounded-md font-extrabold tracking-wide">
                          DISPONÍVEL
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Separador */}
                  <div className="border-t border-[#1a1a22]" />

                  {/* Disponível na Rede */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400 font-medium flex items-center gap-1">
                      <Building2 size={13} className="text-[#8B5CF6]" />
                      Disponível na Rede:
                    </span>
                    <span className="text-xs font-mono font-bold text-purple-300">
                      {item.qtdRede} {item.qtdRede === 1 ? 'unidade' : 'unidades'}
                    </span>
                  </div>
                </div>

                {/* Rodapé do Card */}
                <div className="pt-1">
                  {item.isCelular ? (
                    <button
                      type="button"
                      onClick={() => handleAbrirImeis(item)}
                      className="w-full bg-[#1b122c] hover:bg-[#281845] border border-[#8B5CF6]/50 hover:border-[#8B5CF6] text-purple-300 hover:text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-sm active:scale-98"
                    >
                      <QrCode size={14} className="text-[#8B5CF6]" />
                      <span>Ver IMEIs Disponíveis</span>
                    </button>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (onOpenDetalhesProduto) {
                            onOpenDetalhesProduto(item.itensFisicos?.[0] || item);
                          }
                        }}
                        className="w-full bg-black/60 hover:bg-[#1a1226] border border-[#2b2b36] hover:border-[#8B5CF6]/50 text-gray-300 hover:text-white font-bold py-2 px-2.5 rounded-xl text-[11px] flex items-center justify-center gap-1.5 transition-all"
                        title="Ver histórico e ajustes"
                      >
                        <History size={13} className="text-[#8B5CF6]" />
                        <span>Histórico / Ajuste</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (onNavigateToTransferencias) {
                            onNavigateToTransferencias();
                          }
                        }}
                        className="w-full bg-[#8B5CF6]/20 hover:bg-[#8B5CF6]/30 border border-[#8B5CF6]/50 text-purple-300 hover:text-white font-bold py-2 px-2.5 rounded-xl text-[11px] flex items-center justify-center gap-1.5 transition-all"
                        title="Solicitar transferência entre filiais"
                      >
                        <ArrowRightLeft size={13} className="text-[#8B5CF6]" />
                        <span>Transferir</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Modal Simples de IMEIs Disponíveis */}
      {modalImeisAberto && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#0e0e11] border border-[#2a2a36] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-start justify-between gap-3 border-b border-[#202028] pb-4">
              <div>
                <span className="text-[10px] bg-purple-950/40 text-purple-300 border border-purple-800/40 px-2 py-0.5 rounded font-bold uppercase">
                  Disponibilidade de Aparelhos
                </span>
                <h3 className="text-base font-extrabold text-white mt-1">
                  {produtoImeisModal?.nome}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Filtrando por: <strong className="text-purple-300">{nomeFilialAtiva}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalImeisAberto(false);
                  setProdutoImeisModal(null);
                  setImeisDoProdutoModal([]);
                }}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Lista de IMEIs */}
            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {imeisDoProdutoModal.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-xs">
                  Nenhum IMEI disponível encontrado para esta filial.
                </div>
              ) : (
                imeisDoProdutoModal.map((im, idx) => {
                  const filialDoImei = filiais.find(f => String(f.id) === String(im.filial_id))?.nome || 'Filial não identificada';
                  return (
                    <div
                      key={im.id || idx}
                      className="bg-black/60 border border-[#22222a] p-3 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <span className="font-mono font-bold text-white text-xs block tracking-wide">
                          {im.imei}
                        </span>
                        <span className="text-[11px] text-gray-400 flex items-center gap-1">
                          <Building2 size={11} className="text-[#8B5CF6]" />
                          {filialDoImei}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-bold uppercase">
                          DISPONÍVEL
                        </span>
                        {im.cor && (
                          <span className="text-[10px] text-gray-400 block mt-0.5">
                            Cor: {im.cor}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Rodapé do Modal */}
            <div className="pt-2 border-t border-[#202028] flex justify-between items-center text-xs text-gray-400">
              <span>Total: <strong className="text-white">{imeisDoProdutoModal.length}</strong> disponível(is)</span>
              <button
                type="button"
                onClick={() => {
                  setModalImeisAberto(false);
                  setProdutoImeisModal(null);
                  setImeisDoProdutoModal([]);
                }}
                className="px-4 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-[#8B5CF6]/20"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

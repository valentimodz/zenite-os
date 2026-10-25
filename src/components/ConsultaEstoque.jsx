import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  History,
  Store,
  ChevronUp,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { formatCurrency, formatarMoeda } from '../utils/currencyUtils';
import ModalDetalheEstoqueProduto from './ModalDetalheEstoqueProduto';

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

  // Paginação para desempenho de renderização ultra-rápido (evita travar o navegador com milhares de cards)
  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 24;

  // Reset da página atual ao alterar qualquer filtro
  useEffect(() => {
    setPaginaAtual(1);
  }, [buscaDebounced, categoriaSelecionada, filialSelecionada, statusFiltro]);

  // 2. Estados dos Dados
  const [loading, setLoading] = useState(false);
  const [filiaisCarregadas, setFiliaisCarregadas] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [produtosCatalogo, setProdutosCatalogo] = useState([]);
  const [imeisDisponiveis, setImeisDisponiveis] = useState([]);
  const [categoriasLista, setCategoriasLista] = useState([]);

  // 3. Estado dos Modais
  const [produtoSelecionadoModal, setProdutoSelecionadoModal] = useState(null);
  const [modalImeisAberto, setModalImeisAberto] = useState(false);
  const [produtoImeisModal, setProdutoImeisModal] = useState(null);
  const [filialImeisModal, setFilialImeisModal] = useState(null);
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
    if (activeFilialId && filialSelecionada === 'TODAS' && activeFilialId !== 'null' && activeFilialId !== 'undefined') {
      setFilialSelecionada(String(activeFilialId));
    }
  }, [activeFilialId]);

  // Refs de controle para evitar chamadas concorrentes contínuas e loops de re-renderização
  const isFetchingRef = useRef(false);
  const isMountedRef = useRef(true);
  const empresaIdPrimitivo = profile?.empresa_id ? String(profile.empresa_id) : '';

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 4. Carregar Dados do Supabase com Resiliência (.select('*'))
  const carregarDadosEstoque = useCallback(async (forcedEmpresaId = null) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (isMountedRef.current) setLoading(true);

    try {
      const empresaId = forcedEmpresaId || empresaIdPrimitivo;

      // 4.0 Carregar filiais diretamente para garantir presença na rede
      let qFiliais = supabase.from('filiais').select('*').order('nome', { ascending: true });
      if (empresaId) {
        qFiliais = qFiliais.eq('empresa_id', empresaId);
      }
      const { data: dataFiliais, error: errFiliais } = await qFiliais;
      if (errFiliais) {
        console.warn('Erro ao carregar filiais:', errFiliais);
      } else if (dataFiliais && Array.isArray(dataFiliais)) {
        setFiliaisCarregadas(dataFiliais);
      }

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

      if (!isMountedRef.current) return;

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
      isFetchingRef.current = false;
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [empresaIdPrimitivo]);

  useEffect(() => {
    carregarDadosEstoque();
  }, [carregarDadosEstoque]);

  // Lista unificada e garantida de Filiais da Rede
  const listaFiliais = useMemo(() => {
    const mapa = new Map();

    // 1. Filiais passadas via props
    if (Array.isArray(filiais)) {
      filiais.forEach(f => {
        if (f && f.id) mapa.set(String(f.id), f);
      });
    }

    // 2. Filiais carregadas diretamente do banco
    if (Array.isArray(filiaisCarregadas)) {
      filiaisCarregadas.forEach(f => {
        if (f && f.id && !mapa.has(String(f.id))) {
          mapa.set(String(f.id), f);
        }
      });
    }

    // 3. Fallback: Filiais presentes nos produtos físicos se houver filial_id
    produtos.forEach(p => {
      if (p.filial_id && !mapa.has(String(p.filial_id))) {
        mapa.set(String(p.filial_id), {
          id: p.filial_id,
          nome: p.filial_nome || `Filial ${String(p.filial_id).slice(0, 6)}`
        });
      }
    });

    return Array.from(mapa.values()).sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || '')));
  }, [filiais, filiaisCarregadas, produtos]);

  // 5. Agrupamento Base dos Modelos de Produtos (Catálogo + Produtos Físicos)
  const produtosConsolidados = useMemo(() => {
    const mapa = new Map();

    // 1º Passo: Catálogo Mestre
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

    // 2º Passo: Produtos Físicos
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

  // 6. Cálculo dos Saldos por Filial para cada Produto
  // Cada item recebe: totalRede + detalhamentoPorFilial [{ filial_id, filial_nome, quantidade }]
  const produtosComSaldosPorFilial = useMemo(() => {
    return produtosConsolidados.map(item => {
      const produtoIds = new Set();
      if (item.id) produtoIds.add(String(item.id));
      item.itensFisicos.forEach(p => {
        if (p.id) produtoIds.add(String(p.id));
      });

      // Mapear saldos para cada filial cadastrada na rede
      let qtdRede = 0;
      const saldosFiliaisMap = new Map();

      // Inicializa todas as filiais cadastradas com 0
      listaFiliais.forEach(f => {
        saldosFiliaisMap.set(String(f.id), {
          filial_id: String(f.id),
          filial_nome: f.nome,
          quantidade: 0
        });
      });

      if (item.isCelular) {
        // Contabiliza IMEIs disponíveis por filial
        const imeisDoItem = (imeisDisponiveis || []).filter(im => {
          return im.produto_id && produtoIds.has(String(im.produto_id));
        });

        if (imeisDoItem.length > 0) {
          qtdRede = imeisDoItem.length;
          imeisDoItem.forEach(im => {
            const fId = String(im.filial_id || '');
            if (saldosFiliaisMap.has(fId)) {
              saldosFiliaisMap.get(fId).quantidade += 1;
            } else if (fId) {
              const filObj = listaFiliais.find(f => String(f.id) === fId);
              saldosFiliaisMap.set(fId, {
                filial_id: fId,
                filial_nome: filObj ? filObj.nome : 'Filial ' + fId.slice(0, 6),
                quantidade: 1
              });
            }
          });
        } else {
          // Fallback para quantidade numérica direta em produtos
          item.itensFisicos.forEach(p => {
            const q = Number(p.quantidade || 0);
            qtdRede += q;
            const fId = String(p.filial_id || '');
            if (saldosFiliaisMap.has(fId)) {
              saldosFiliaisMap.get(fId).quantidade += q;
            } else if (fId) {
              const filObj = listaFiliais.find(f => String(f.id) === fId);
              saldosFiliaisMap.set(fId, {
                filial_id: fId,
                filial_nome: filObj ? filObj.nome : 'Filial ' + fId.slice(0, 6),
                quantidade: q
              });
            }
          });
        }
      } else {
        // Acessórios / Gerais: soma as quantidades da tabela 'produtos'
        item.itensFisicos.forEach(p => {
          const q = Number(p.quantidade || 0);
          qtdRede += q;
          const fId = String(p.filial_id || '');
          if (saldosFiliaisMap.has(fId)) {
            saldosFiliaisMap.get(fId).quantidade += q;
          } else if (fId) {
            const filObj = listaFiliais.find(f => String(f.id) === fId);
            saldosFiliaisMap.set(fId, {
              filial_id: fId,
              filial_nome: filObj ? filObj.nome : 'Filial ' + fId.slice(0, 6),
              quantidade: q
            });
          }
        });
      }

      const detalhamentoPorFilial = Array.from(saldosFiliaisMap.values());

      return {
        ...item,
        qtdRede,
        detalhamentoPorFilial
      };
    });
  }, [produtosConsolidados, imeisDisponiveis, listaFiliais]);

  // 7. Desdobramento dos Cards:
  // - Quando filialSelecionada === 'TODAS' (Rede Completa) OU quando há termo de busca digitado:
  //   Gera UM CARD INDIVIDUAL PARA CADA FILIAL da rede (ou que possui saldo/registro).
  // - Quando uma filial específica for selecionada (e sem busca de rede):
  //   Gera o card apenas daquela filial selecionada.
  const cardsDesdobrados = useMemo(() => {
    const lista = [];
    const temBuscaAtiva = Boolean(buscaDebounced && buscaDebounced.trim());
    const deveDesdobrarTodasFiliais = filialSelecionada === 'TODAS' || temBuscaAtiva;

    produtosComSaldosPorFilial.forEach(prod => {
      if (deveDesdobrarTodasFiliais) {
        // Se temos lista de filiais da rede, desdobra 1 card para cada filial
        if (listaFiliais.length > 0) {
          listaFiliais.forEach(f => {
            const saldoFilial = prod.detalhamentoPorFilial.find(df => String(df.filial_id) === String(f.id))?.quantidade || 0;
            const statusEstoque = saldoFilial === 0 ? 'ZERADO' : saldoFilial < 5 ? 'CRITICO' : 'DISPONIVEL';

            lista.push({
              ...prod,
              cardKey: `${prod.id}_${f.id}`,
              filialIdCard: String(f.id),
              filialNomeCard: f.nome,
              qtdFilial: saldoFilial,
              statusEstoque,
              isMultiLojaDesdobrado: true
            });
          });
        } else {
          // Fallback caso não haja filiais cadastradas ainda
          prod.detalhamentoPorFilial.forEach(df => {
            const saldoFilial = df.quantidade || 0;
            const statusEstoque = saldoFilial === 0 ? 'ZERADO' : saldoFilial < 5 ? 'CRITICO' : 'DISPONIVEL';

            lista.push({
              ...prod,
              cardKey: `${prod.id}_${df.filial_id}`,
              filialIdCard: String(df.filial_id),
              filialNomeCard: df.filial_nome,
              qtdFilial: saldoFilial,
              statusEstoque,
              isMultiLojaDesdobrado: true
            });
          });
        }
      } else {
        // Exibe somente para a filial ativa selecionada
        const fObj = listaFiliais.find(f => String(f.id) === String(filialSelecionada));
        const fNome = fObj ? fObj.nome : 'Filial Selecionada';
        const saldoFilial = prod.detalhamentoPorFilial.find(df => String(df.filial_id) === String(filialSelecionada))?.quantidade || 0;
        const statusEstoque = saldoFilial === 0 ? 'ZERADO' : saldoFilial < 5 ? 'CRITICO' : 'DISPONIVEL';

        lista.push({
          ...prod,
          cardKey: `${prod.id}_${filialSelecionada}`,
          filialIdCard: String(filialSelecionada),
          filialNomeCard: fNome,
          qtdFilial: saldoFilial,
          statusEstoque,
          isMultiLojaDesdobrado: false
        });
      }
    });

    return lista;
  }, [produtosComSaldosPorFilial, filialSelecionada, listaFiliais, buscaDebounced]);

  // 8. Filtros de Interface (Busca Textual, Categoria e Status de Estoque)
  const itensFiltrados = useMemo(() => {
    return cardsDesdobrados.filter(item => {
      // Filtro de Categoria
      if (categoriaSelecionada !== 'TODAS') {
        const catItem = String(item.categoria || '').toUpperCase();
        if (catItem !== categoriaSelecionada.toUpperCase()) return false;
      }

      // Filtro de Status de Estoque:
      // CRITICO: saldo entre 1 e 4 (item.qtdFilial > 0 && item.qtdFilial < 5)
      // ZERADO: saldo 0 (item.qtdFilial === 0)
      // DISPONIVEL: saldo >= 5 (item.qtdFilial >= 5)
      if (statusFiltro === 'CRITICO') {
        if (!(item.qtdFilial > 0 && item.qtdFilial < 5)) return false;
      } else if (statusFiltro === 'ZERADO') {
        if (item.qtdFilial !== 0) return false;
      } else if (statusFiltro === 'DISPONIVEL') {
        if (item.qtdFilial < 5) return false;
      }

      // Busca Textual (Nome, SKU, Código de Barras ou Nome da Filial)
      if (buscaDebounced && buscaDebounced.trim()) {
        const termo = buscaDebounced.toLowerCase().trim();
        const nome = String(item.nome || '').toLowerCase();
        const sku = String(item.sku || '').toLowerCase();
        const barcode = String(item.codigo_barras || '').toLowerCase();
        const filial = String(item.filialNomeCard || '').toLowerCase();

        const match = nome.includes(termo) || sku.includes(termo) || barcode.includes(termo) || filial.includes(termo);
        if (!match) return false;
      }

      return true;
    });
  }, [cardsDesdobrados, categoriaSelecionada, statusFiltro, buscaDebounced]);

  // 9. Fatiamento dos Dados com Paginação (Garante performance ultra-rápida sem travar o navegador)
  const totalPaginas = Math.max(1, Math.ceil(itensFiltrados.length / itensPorPagina));
  const paginaValida = Math.min(Math.max(1, paginaAtual), totalPaginas);
  const indiceInicio = (paginaValida - 1) * itensPorPagina;
  const indiceFim = Math.min(indiceInicio + itensPorPagina, itensFiltrados.length);
  const cardsExibidos = useMemo(() => {
    return itensFiltrados.slice(indiceInicio, indiceFim);
  }, [itensFiltrados, indiceInicio, indiceFim]);

  // Contadores para as Pílulas de Status
  const contadores = useMemo(() => {
    let todos = cardsDesdobrados.length;
    let critico = 0;
    let zerado = 0;
    let disponivel = 0;

    cardsDesdobrados.forEach(i => {
      if (i.qtdFilial === 0) zerado++;
      else if (i.qtdFilial < 5) critico++;
      else disponivel++;
    });

    return { todos, critico, zerado, disponivel };
  }, [cardsDesdobrados]);

  // Abrir Modal de IMEIs para o Produto e Filial do Card
  const handleAbrirImeis = (item) => {
    const produtoIds = new Set();
    if (item.id) produtoIds.add(String(item.id));
    item.itensFisicos?.forEach((p) => {
      if (p.id) produtoIds.add(String(p.id));
    });

    const targetFilialId = item.filialIdCard;
    const imeisRelacionados = (imeisDisponiveis || []).filter(im => {
      const matchProd = im.produto_id && produtoIds.has(String(im.produto_id));
      if (!matchProd) return false;

      if (targetFilialId && targetFilialId !== 'TODAS') {
        return String(im.filial_id || '') === String(targetFilialId);
      }
      return true;
    });

    setProdutoImeisModal(item);
    setFilialImeisModal(item.filialNomeCard);
    setImeisDoProdutoModal(imeisRelacionados);
    setModalImeisAberto(true);
  };

  // Nome da filial ativa selecionada para display no cabeçalho
  const nomeFilialAtiva = useMemo(() => {
    if (filialSelecionada === 'TODAS') return 'Todas as Filiais (Rede Completa)';
    const f = listaFiliais.find(fil => String(fil.id) === String(filialSelecionada));
    return f ? f.nome : 'Filial Selecionada';
  }, [filialSelecionada, listaFiliais]);

  return (
    <div className="w-full max-w-7xl mx-auto overflow-x-hidden space-y-6 animate-fadeIn pb-12">
      {/* 1. Menu e Cabeçalho */}
      <div className="bg-gradient-to-r from-[#0d0914] via-[#120d1c] to-[#0a0a0a] border border-[#8B5CF6]/30 p-4 md:p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl relative overflow-hidden w-full">
        <div className="absolute -right-10 -bottom-10 w-44 h-44 bg-[#8B5CF6]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="w-full md:w-auto">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 rounded-xl text-[#A78BFA] shadow-sm shrink-0">
              <Package size={22} className="text-[#8B5CF6]" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                Posição de Estoque & Auditoria
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Consulte a disponibilidade de produtos por filial e na rede com alertas de estoque crítico e zerado.
              </p>
            </div>
          </div>
        </div>

        {/* Botão de Atualização Rápida */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <button
            type="button"
            onClick={carregarDadosEstoque}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-3.5 py-2 bg-black/60 hover:bg-[#1a1226] border border-[#33254d] hover:border-[#8B5CF6]/60 text-purple-300 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer w-full md:w-auto"
            title="Recarregar Dados"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-[#8B5CF6]' : ''} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* 2. Barra de Filtros e Busca */}
      <div className="w-full bg-[#0e0e11] border border-[#222228] rounded-2xl p-4 md:p-5 space-y-4 shadow-lg">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3.5 w-full">
          {/* Campo de Busca em Tempo Real */}
          <div className="w-full md:flex-1 relative">
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
          <div className="w-full md:w-64 relative">
            <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8B5CF6] pointer-events-none" size={15} />
            <select
              value={filialSelecionada}
              onChange={(e) => setFilialSelecionada(e.target.value)}
              className="w-full bg-black/70 border border-[#282830] focus:border-[#8B5CF6] text-xs text-white rounded-xl pl-10 pr-8 py-2.5 outline-none font-semibold cursor-pointer appearance-none transition-all truncate"
            >
              <option value="TODAS">🏢 Todas as Filiais (Rede Completa)</option>
              {listaFiliais.map(f => (
                <option key={f.id} value={String(f.id)}>
                  📍 {f.nome}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={14} />
          </div>

          {/* Dropdown de Categorias */}
          <div className="w-full md:w-56 relative">
            <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8B5CF6] pointer-events-none" size={15} />
            <select
              value={categoriaSelecionada}
              onChange={(e) => setCategoriaSelecionada(e.target.value)}
              className="w-full bg-black/70 border border-[#282830] focus:border-[#8B5CF6] text-xs text-white rounded-xl pl-10 pr-8 py-2.5 outline-none font-semibold cursor-pointer appearance-none transition-all truncate"
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2 border-t border-[#1f1f26] w-full">
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Todos os Itens */}
            <button
              type="button"
              onClick={() => setStatusFiltro('TODOS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border cursor-pointer flex-1 sm:flex-initial ${
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
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border cursor-pointer flex-1 sm:flex-initial ${
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
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border cursor-pointer flex-1 sm:flex-initial ${
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
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border cursor-pointer flex-1 sm:flex-initial ${
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
          <div className="text-[11px] text-gray-400 font-medium w-full md:w-auto text-left md:text-right pt-1 md:pt-0">
            Exibindo <span className="text-white font-bold">{itensFiltrados.length}</span> cards em <span className="text-[#A78BFA] font-semibold">{nomeFilialAtiva}</span>
          </div>
        </div>
      </div>

      {/* 3. Cards dos Produtos (Grid Responsivo Desdobrado por Filial) */}
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
              className="mt-2 px-4 py-2 bg-[#8B5CF6]/20 hover:bg-[#8B5CF6]/30 border border-[#8B5CF6]/50 text-purple-300 font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <X size={14} />
              <span>Limpar Todos os Filtros</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cardsExibidos.map((item) => {
            const isEsgotado = item.qtdFilial === 0;
            const isCritico = item.qtdFilial > 0 && item.qtdFilial < 5;
            const isDisponivel = item.qtdFilial >= 5;

            return (
              <div
                key={item.cardKey}
                className="bg-[#0d1117] border border-zinc-800/80 hover:border-purple-500/50 rounded-xl p-4 flex flex-col justify-between gap-3 transition-all duration-200 group hover:shadow-xl hover:shadow-purple-950/20 relative"
              >
                {/* 1. Cabeçalho do Card (Clicável para abrir Detalhes / Ajuste) */}
                <div
                  onClick={() => setProdutoSelecionadoModal(item.itensFisicos?.[0] || item)}
                  className="cursor-pointer group/header"
                  title="Clique para ver detalhes e ajustes do produto"
                >
                  {/* Topo Superior: Ícone de loja + [NOME DA FILIAL] e Preço Verde Vibrante */}
                  <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-zinc-800/60">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Store size={15} className="text-cyan-400 shrink-0" />
                      <span className="text-xs font-black uppercase tracking-wider text-cyan-300 truncate">
                        [{item.filialNomeCard}]
                      </span>
                    </div>
                    <span className="text-sm font-mono font-bold text-emerald-400 shrink-0 tracking-tight">
                      {formatCurrency(item.preco)}
                    </span>
                  </div>

                  {/* Linha Secundária: Tag/Pill de categoria e SKU */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] bg-purple-950/60 text-purple-300 border border-purple-800/60 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                      {item.isCelular ? <Smartphone size={10} className="text-purple-400" /> : <Tag size={10} className="text-purple-400" />}
                      {item.categoria || 'Geral'}
                    </span>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      SKU: <strong className="text-zinc-300">{item.sku || 'N/D'}</strong>
                    </span>
                  </div>

                  {/* Nome do Produto: Em branco brilhante com tracking-wide */}
                  <h3 className="text-xs md:text-sm font-bold text-white tracking-wide mt-2 group-hover/header:text-purple-300 transition-colors line-clamp-2 leading-snug">
                    {item.nome}
                  </h3>
                  {item.codigo_barras && (
                    <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block truncate">
                      EAN: {item.codigo_barras}
                    </span>
                  )}
                </div>

                {/* 2. Bloco Central de Estoque (Painel interno com bg-black/40 e borda sutil) */}
                <div className="bg-black/40 border border-zinc-800/60 rounded-lg p-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">
                        ESTOQUE NESTA FILIAL
                      </span>
                      <span className="text-xs font-bold text-cyan-300 truncate max-w-[140px] block mt-0.5">
                        {item.filialNomeCard}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span className="text-xl font-bold text-white font-mono leading-none">
                        {item.qtdFilial} <span className="text-[11px] text-gray-400 font-sans font-normal">un</span>
                      </span>

                      {/* Badges de Status com fundo escuro, borda e texto vivo */}
                      {isEsgotado && (
                        <span className="text-[10px] bg-red-950/80 text-red-400 border border-red-600/80 px-2 py-0.5 rounded font-bold tracking-wide">
                          ESGOTADO
                        </span>
                      )}
                      {isCritico && (
                        <span className="text-[10px] bg-amber-950/80 text-amber-300 border border-amber-500/80 px-2 py-0.5 rounded font-bold tracking-wide">
                          CRÍTICO
                        </span>
                      )}
                      {isDisponivel && (
                        <span className="text-[10px] bg-emerald-950/80 text-emerald-400 border border-emerald-500/80 px-2 py-0.5 rounded font-bold tracking-wide">
                          DISPONÍVEL
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Rodapé interno do bloco: Ícone de rede + "Disponível na Rede: X unidades" */}
                  <div className="border-t border-zinc-800/60 pt-2 flex items-center justify-between text-[11px]">
                    <span className="text-gray-400 font-medium flex items-center gap-1.5">
                      <Building2 size={13} className="text-purple-400" />
                      Disponível na Rede:
                    </span>
                    <span className="font-mono font-bold text-purple-300">
                      {item.qtdRede} {item.qtdRede === 1 ? 'unidade' : 'unidades'}
                    </span>
                  </div>
                </div>

                {/* 3. Botões de Ação no Rodapé */}
                <div className="space-y-1.5 pt-0.5">
                  {item.isCelular && (
                    <button
                      type="button"
                      onClick={() => handleAbrirImeis(item)}
                      className="w-full bg-[#1b122c] hover:bg-[#281845] border border-purple-500/40 hover:border-purple-400 text-purple-200 hover:text-white font-bold py-1.5 px-2.5 rounded-lg text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                    >
                      <QrCode size={13} className="text-purple-400" />
                      <span>Ver IMEIs nesta Filial</span>
                    </button>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const targetProd = item.itensFisicos?.[0] || item;
                        setProdutoSelecionadoModal(targetProd);
                        if (onOpenDetalhesProduto) {
                          onOpenDetalhesProduto(targetProd);
                        }
                      }}
                      className="w-full bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/60 hover:border-zinc-500 text-zinc-300 hover:text-white font-medium py-2 px-2.5 rounded-lg text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer truncate shadow-sm"
                      title="Ver histórico e ajustes"
                    >
                      <History size={13} className="text-zinc-400 shrink-0" />
                      <span className="truncate">Histórico / Ajuste</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (onNavigateToTransferencias) {
                          onNavigateToTransferencias();
                        }
                      }}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-2.5 rounded-lg text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer truncate shadow-md shadow-purple-900/30"
                      title="Solicitar transferência entre filiais"
                    >
                      <ArrowRightLeft size={13} className="text-white shrink-0" />
                      <span className="truncate font-semibold">Transferir</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          </div>

          {/* Barra de Paginação Simples no Rodapé */}
          {totalPaginas > 1 && (
            <div className="bg-[#0e0e11] border border-[#222228] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
              {/* Indicação de Cards Exibidos */}
              <div className="text-xs text-gray-400">
                Mostrando <span className="font-bold text-white font-mono">{itensFiltrados.length === 0 ? 0 : indiceInicio + 1}</span> - <span className="font-bold text-white font-mono">{indiceFim}</span> de <span className="font-bold text-purple-400 font-mono">{itensFiltrados.length}</span> cards
                <span className="ml-2 text-zinc-600">|</span>
                <span className="ml-2 text-zinc-400">Página <strong className="text-white">{paginaValida}</strong> de <strong className="text-white">{totalPaginas}</strong></span>
              </div>

              {/* Controles de Navegação */}
              <div className="flex items-center gap-2">
                {/* Botão Anterior */}
                <button
                  type="button"
                  onClick={() => setPaginaAtual(prev => Math.max(1, prev - 1))}
                  disabled={paginaValida <= 1}
                  className="flex items-center gap-1 px-3 py-1.5 bg-black/60 hover:bg-[#1a1226] border border-[#282830] hover:border-purple-500/50 text-xs font-semibold text-zinc-300 hover:text-white rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronLeft size={14} />
                  <span>Anterior</span>
                </button>

                {/* Botões Numéricos Inteligentes */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPaginas || Math.abs(p - paginaValida) <= 1)
                    .reduce((acc, p, idx, arr) => {
                      if (idx > 0 && p - arr[idx - 1] > 1) {
                        acc.push(-1 * p); // Marca ellipsis
                      }
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, idx) => {
                      if (p < 0) {
                        return (
                          <span key={`ellipsis-${idx}`} className="px-1 text-xs text-zinc-600">
                            ...
                          </span>
                        );
                      }
                      const isAtiva = p === paginaValida;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPaginaAtual(p)}
                          className={`min-w-[32px] h-8 px-2 text-xs font-bold rounded-xl transition-all cursor-pointer font-mono ${
                            isAtiva
                              ? 'bg-purple-600 text-white shadow-md shadow-purple-900/40 border border-purple-500'
                              : 'bg-black/50 text-zinc-400 hover:text-white hover:bg-zinc-800/80 border border-[#282830]'
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                </div>

                {/* Botão Próxima */}
                <button
                  type="button"
                  onClick={() => setPaginaAtual(prev => Math.min(totalPaginas, prev + 1))}
                  disabled={paginaValida >= totalPaginas}
                  className="flex items-center gap-1 px-3 py-1.5 bg-black/60 hover:bg-[#1a1226] border border-[#282830] hover:border-purple-500/50 text-xs font-semibold text-zinc-300 hover:text-white rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <span>Próxima</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
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
                  Filial: <strong className="text-purple-300">[{filialImeisModal || nomeFilialAtiva}]</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalImeisAberto(false);
                  setProdutoImeisModal(null);
                  setFilialImeisModal(null);
                  setImeisDoProdutoModal([]);
                }}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
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
                  const filialDoImei = listaFiliais.find(f => String(f.id) === String(im.filial_id))?.nome || 'Filial não identificada';
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
                  setFilialImeisModal(null);
                  setImeisDoProdutoModal([]);
                }}
                className="px-4 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-[#8B5CF6]/20 cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Modal de Detalhes, Histórico e Ajuste de Estoque */}
      {produtoSelecionadoModal && (
        <ModalDetalheEstoqueProduto
          produtoId={produtoSelecionadoModal.id || produtoSelecionadoModal.produto_id}
          produto={produtoSelecionadoModal}
          filialId={filialSelecionada !== 'TODAS' ? filialSelecionada : activeFilialId}
          filiais={listaFiliais}
          isOpen={!!produtoSelecionadoModal}
          onClose={() => setProdutoSelecionadoModal(null)}
          onRefresh={() => {
            carregarDadosEstoque();
          }}
          onSuccess={() => {
            // Recarrega os dados de estoque atualizados após salvar a edição
            carregarDadosEstoque();
          }}
          onTransferir={() => {
            setProdutoSelecionadoModal(null);
            if (onNavigateToTransferencias) {
              onNavigateToTransferencias();
            }
          }}
        />
      )}
    </div>
  );
}

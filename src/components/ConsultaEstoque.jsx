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
  History,
  Store,
  ChevronLeft,
  ChevronRight,
  Plus
} from 'lucide-react';
import { formatCurrency } from '../utils/currencyUtils';
import ModalDetalheEstoqueProduto from './ModalDetalheEstoqueProduto';
import ModalAdicionarProdutoFilial from './ModalAdicionarProdutoFilial';
import ModalRastrearImei from './ModalRastrearImei';

/**
 * Verifica estritamente se um registro da tabela `public.imeis` está DISPONÍVEL para venda/conferência.
 * Regra obrigatória: status === 'DISPONIVEL' (ou 'DISPONÍVEL') E vendido === false.
 */
function isImeiEstritamenteDisponivel(im) {
  if (!im) return false;
  if (im.vendido !== false) return false;
  const stNorm = String(im.status || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return stNorm === 'DISPONIVEL';
}

/**
 * Identifica se um registro de produto ou catálogo pertence à categoria de Celulares / Aparelhos.
 */
function verificarSeEhCelular(obj) {
  if (!obj) return false;
  const tipoStr = String(obj.tipo || '').trim().toUpperCase();
  const catStr = String(obj.categoria || '').trim().toUpperCase();
  return (
    tipoStr.includes('CELULAR') ||
    tipoStr.includes('SMARTPHONE') ||
    tipoStr.includes('APARELHO') ||
    catStr.includes('CELULAR') ||
    catStr.includes('SMARTPHONE') ||
    catStr.includes('APARELHO') ||
    catStr === 'IOS' ||
    catStr === 'ANDROID'
  );
}

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
  // Por padrão 'TODOS' exibe APENAS produtos com quantidade > 0 (Ocultar Zerados por padrão)
  const [statusFiltro, setStatusFiltro] = useState('TODOS'); // 'TODOS' (> 0) | 'CRITICO' | 'ZERADO' | 'DISPONIVEL'

  // Paginação para desempenho de renderização ultra-rápido
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
  const [idsProdutosComHistoricoImei, setIdsProdutosComHistoricoImei] = useState(new Set());
  const [categoriasLista, setCategoriasLista] = useState([]);

  // 3. Estado dos Modais
  const [produtoSelecionadoModal, setProdutoSelecionadoModal] = useState(null);
  const [modalImeisAberto, setModalImeisAberto] = useState(false);
  const [produtoImeisModal, setProdutoImeisModal] = useState(null);
  const [filialImeisModal, setFilialImeisModal] = useState(null);
  const [imeisDoProdutoModal, setImeisDoProdutoModal] = useState([]);
  const [modalAdicionarProdutoAberto, setModalAdicionarProdutoAberto] = useState(false);
  const [modalRastrearImeiAberto, setModalRastrearImeiAberto] = useState(false);
  const [imeiInicialRastreio, setImeiInicialRastreio] = useState('');
  const [sucessoToast, setSucessoToast] = useState(null);

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

  // Refs de controle para evitar chamadas concorrentes contínuas
  const isFetchingRef = useRef(false);
  const isMountedRef = useRef(true);
  const empresaIdPrimitivo = profile?.empresa_id ? String(profile.empresa_id) : '';

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 4. Carregar Dados do Supabase
  const carregarDadosEstoque = useCallback(async (forcedEmpresaId = null, force = false) => {
    if (force) {
      isFetchingRef.current = false;
    }
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

      // 4.1 Carregar produtos físicos da tabela 'produtos'
      let qProdutos = supabase.from('produtos').select('*, filiais(id, nome)');
      if (empresaId) {
        qProdutos = qProdutos.eq('empresa_id', empresaId);
      }
      let prods = [];
      try {
        const { data: dataProdutosAtivos, error: errAtivos } = await qProdutos.eq('ativo', true);
        if (!errAtivos && dataProdutosAtivos && dataProdutosAtivos.length > 0) {
          prods = dataProdutosAtivos.filter(p => p.status !== 'INATIVO' && p.ativo !== false);
        } else {
          let qFallback = supabase.from('produtos').select('*');
          if (empresaId) qFallback = qFallback.eq('empresa_id', empresaId);
          const { data: dataProdutos, error: errProdutos } = await qFallback;
          if (errProdutos) console.warn('Erro ao carregar produtos:', errProdutos);
          prods = (dataProdutos || []).filter(p => p.status !== 'INATIVO' && p.ativo !== false);
        }
      } catch (e) {
        const { data: dataProdutos } = await supabase.from('produtos').select('*');
        prods = (dataProdutos || []).filter(p => p.status !== 'INATIVO' && p.ativo !== false);
      }

      // 4.2 Carregar catálogo mestre de produtos_catalogo
      let qCatalogo = supabase.from('produtos_catalogo').select('*');
      if (empresaId) {
        qCatalogo = qCatalogo.eq('empresa_id', empresaId);
      }
      let catsMestre = [];
      try {
        const { data: dataCatAtivos, error: errCatAtivos } = await qCatalogo.eq('ativo', true);
        if (!errCatAtivos && dataCatAtivos && dataCatAtivos.length > 0) {
          catsMestre = dataCatAtivos.filter(c => c.status !== 'INATIVO' && c.ativo !== false);
        } else {
          const { data: dataCatalogo, error: errCatalogo } = await qCatalogo;
          if (errCatalogo) console.warn('Erro ao carregar produtos_catalogo:', errCatalogo);
          catsMestre = (dataCatalogo || []).filter(c => c.status !== 'INATIVO' && c.ativo !== false);
        }
      } catch (e) {
        const { data: dataCatalogo } = await qCatalogo;
        catsMestre = (dataCatalogo || []).filter(c => c.status !== 'INATIVO' && c.ativo !== false);
      }

      // 4.3 Carregar IMEIs da tabela `public.imeis`
      // Filtramos obrigatoriamente status === 'DISPONIVEL' e vendido === false para a contagem física
      let qImeis = supabase
        .from('imeis')
        .select('*')
        .eq('vendido', false);

      if (empresaId) {
        qImeis = qImeis.eq('empresa_id', empresaId);
      }
      const { data: dataImeis, error: errImeis } = await qImeis;
      if (errImeis) {
        console.warn('Erro ao carregar imeis:', errImeis);
      }

      // Identificar também quais produto_ids já tiveram qualquer IMEI (mesmo vendido) para nunca cair em fallback de acessório
      let qTodosImeisIds = supabase.from('imeis').select('produto_id');
      if (empresaId) {
        qTodosImeisIds = qTodosImeisIds.eq('empresa_id', empresaId);
      }
      const { data: dataTodosImeisIds } = await qTodosImeisIds;
      const setProdIdsComImei = new Set();
      (dataTodosImeisIds || []).forEach(r => {
        if (r && r.produto_id) setProdIdsComImei.add(String(r.produto_id));
      });

      // 4.4 Carregar categorias distintas
      let qCategorias = supabase.from('categorias').select('*');
      if (empresaId) {
        qCategorias = qCategorias.eq('empresa_id', empresaId);
      }
      const { data: dataCategorias } = await qCategorias;

      if (!isMountedRef.current) return;

      // Filtro OBRIGATÓRIO e ESTRITO: somente status === 'DISPONIVEL' e vendido === false
      const imsDisponiveis = (dataImeis || []).filter(isImeiEstritamenteDisponivel);

      setProdutos(prods);
      setProdutosCatalogo(catsMestre);
      setImeisDisponiveis(imsDisponiveis);
      setIdsProdutosComHistoricoImei(setProdIdsComImei);

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

  // Listener para eventos globais de atualização de catálogo e estoque
  useEffect(() => {
    const handleAtualizacao = () => {
      carregarDadosEstoque(null, true);
    };

    window.addEventListener('catalogo_updated', handleAtualizacao);
    window.addEventListener('estoque_updated', handleAtualizacao);

    return () => {
      window.removeEventListener('catalogo_updated', handleAtualizacao);
      window.removeEventListener('estoque_updated', handleAtualizacao);
    };
  }, [carregarDadosEstoque]);

  // Lista unificada e garantida de Filiais da Rede
  const listaFiliais = useMemo(() => {
    const mapa = new Map();

    if (Array.isArray(filiais)) {
      filiais.forEach(f => {
        if (f && f.id) mapa.set(String(f.id), f);
      });
    }

    if (Array.isArray(filiaisCarregadas)) {
      filiaisCarregadas.forEach(f => {
        if (f && f.id && !mapa.has(String(f.id))) {
          mapa.set(String(f.id), f);
        }
      });
    }

    produtos.forEach(p => {
      if (p.filial_id && !mapa.has(String(p.filial_id))) {
        mapa.set(String(p.filial_id), {
          id: p.filial_id,
          nome: p.filiais?.nome || p.filial_nome || `Filial ${String(p.filial_id).slice(0, 6)}`
        });
      }
    });

    return Array.from(mapa.values()).sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || '')));
  }, [filiais, filiaisCarregadas, produtos]);

  // 5. Agrupamento Base dos Modelos de Produtos por UPPER(TRIM(nome))
  const produtosConsolidados = useMemo(() => {
    const mapaPorNome = new Map();

    // 1º Passo: Catálogo Mestre agrupado por UPPER(TRIM(nome))
    (produtosCatalogo || []).forEach(cat => {
      const nomeLimpo = String(cat.nome || '').trim();
      if (!nomeLimpo) return;
      const chaveNomeUpper = nomeLimpo.toUpperCase();

      const isCelular =
        verificarSeEhCelular(cat) ||
        (cat.id && idsProdutosComHistoricoImei.has(String(cat.id)));

      if (!mapaPorNome.has(chaveNomeUpper)) {
        mapaPorNome.set(chaveNomeUpper, {
          id: cat.id,
          nome: nomeLimpo,
          sku: cat.sku || '',
          codigo_barras: cat.codigo_barras || '',
          categoria: cat.categoria || (isCelular ? 'CELULARES' : 'GERAL'),
          tipo: cat.tipo || (isCelular ? 'CELULAR' : 'ACESSORIO'),
          preco: Number(cat.preco_venda || cat.preco || 0),
          isCelular,
          itensFisicos: [],
          catalogoItem: cat
        });
      }
    });

    // 2º Passo: Produtos Físicos agrupados por UPPER(TRIM(nome)) (ou EAN/Catálogo correspondente)
    (produtos || []).forEach(prod => {
      const nomeLimpo = String(prod.nome || '').trim();
      if (!nomeLimpo) return;
      const chaveNomeUpper = nomeLimpo.toUpperCase();
      const prodEan = prod.codigo_barras ? String(prod.codigo_barras).trim().toLowerCase() : '';

      const isCelularProd =
        verificarSeEhCelular(prod) ||
        (prod.id && idsProdutosComHistoricoImei.has(String(prod.id)));

      let itemExistente = mapaPorNome.get(chaveNomeUpper);

      // Se não achou pelo nome exato, tenta casar pelo produto_catalogo_id ou código de barras
      if (!itemExistente && (prod.produto_catalogo_id || prodEan)) {
        for (const v of mapaPorNome.values()) {
          if (prod.produto_catalogo_id && String(v.id) === String(prod.produto_catalogo_id)) {
            itemExistente = v;
            break;
          }
          if (prodEan && v.codigo_barras && String(v.codigo_barras).trim().toLowerCase() === prodEan) {
            itemExistente = v;
            break;
          }
        }
      }

      if (!itemExistente) {
        mapaPorNome.set(chaveNomeUpper, {
          id: prod.id,
          nome: nomeLimpo,
          sku: prod.sku || '',
          codigo_barras: prod.codigo_barras || '',
          categoria: prod.categoria || (isCelularProd ? 'CELULARES' : 'GERAL'),
          tipo: prod.tipo || (isCelularProd ? 'CELULAR' : 'ACESSORIO'),
          preco: Number(prod.preco_venda || prod.preco || 0),
          isCelular: isCelularProd,
          itensFisicos: [prod]
        });
      } else {
        itemExistente.itensFisicos.push(prod);
        if (isCelularProd) itemExistente.isCelular = true;
        if (!itemExistente.sku && prod.sku) itemExistente.sku = prod.sku;
        if (!itemExistente.codigo_barras && prod.codigo_barras) itemExistente.codigo_barras = prod.codigo_barras;
        const prodPreco = Number(prod.preco_venda || prod.preco || 0);
        if (prodPreco > 0) {
          itemExistente.preco = prodPreco;
        }
      }
    });

    return Array.from(mapaPorNome.values());
  }, [produtos, produtosCatalogo, idsProdutosComHistoricoImei]);

  // 6. Cálculo dos Saldos por Filial para cada Modelo
  // REGRA CRÍTICA: Para Celulares (`item.isCelular === true`), a quantidade disponível
  // é calculada EXCLUSIVAMENTE pelos registros de `imeisDisponiveis` (`status === 'DISPONIVEL'` e `vendido === false`).
  // NUNCA usa fallback de `produtos.quantidade` para celulares, eliminando aparelhos fantasmas!
  const produtosComSaldosPorFilial = useMemo(() => {
    return produtosConsolidados.map(item => {
      const produtoIds = new Set();
      if (item.id) produtoIds.add(String(item.id));
      item.itensFisicos.forEach(p => {
        if (p.id) produtoIds.add(String(p.id));
      });

      let qtdRede = 0;
      const saldosFiliaisMap = new Map();

      // Inicializa todas as filiais cadastradas com 0
      listaFiliais.forEach(f => {
        const fId = String(f.id || '').trim();
        if (fId) {
          saldosFiliaisMap.set(fId, {
            filial_id: fId,
            filial_nome: f.nome,
            quantidade: 0
          });
        }
      });

      // Verifica IMEIs estritamente disponíveis (`status === 'DISPONIVEL'` & `vendido === false`) vinculados a este modelo
      const imeisDoItem = (imeisDisponiveis || []).filter(im => {
        return im.produto_id && produtoIds.has(String(im.produto_id)) && isImeiEstritamenteDisponivel(im);
      });

      const ehCelularOuTemImei = item.isCelular || imeisDoItem.length > 0;

      if (ehCelularOuTemImei) {
        // Contagem 100% baseada nos IMEIs disponíveis (status === 'DISPONIVEL' e vendido === false)
        qtdRede = imeisDoItem.length;
        imeisDoItem.forEach(im => {
          // Usa o filial_id do IMEI; se vazio, busca o filial_id do registro físico do produto
          let fId = String(im.filial_id || '').trim();
          if (!fId) {
            const prodFisico = (item.itensFisicos || []).find(p => String(p.id) === String(im.produto_id));
            if (prodFisico?.filial_id) fId = String(prodFisico.filial_id).trim();
          }
          if (!fId) return;

          let entry = saldosFiliaisMap.get(fId);
          if (!entry) {
            const matchedKey = Array.from(saldosFiliaisMap.keys()).find(k => k.toLowerCase() === fId.toLowerCase());
            if (matchedKey) entry = saldosFiliaisMap.get(matchedKey);
          }

          if (entry) {
            entry.quantidade += 1;
          } else {
            const filObj = listaFiliais.find(f => String(f.id || '').toLowerCase() === fId.toLowerCase());
            saldosFiliaisMap.set(fId, {
              filial_id: fId,
              filial_nome: filObj ? filObj.nome : 'Filial ' + fId.slice(0, 6),
              quantidade: 1
            });
          }
        });
      } else {
        // Acessórios / Gerais (capas, películas, chips, cabos): lê a coluna 'quantidade' por filial
        (item.itensFisicos || []).forEach(p => {
          const fId = String(p.filial_id || '').trim();
          if (!fId) return;

          const q = Math.max(0, Number(p.quantidade || 0));
          qtdRede += q;

          let entry = saldosFiliaisMap.get(fId);
          if (!entry) {
            const matchedKey = Array.from(saldosFiliaisMap.keys()).find(k => k.toLowerCase() === fId.toLowerCase());
            if (matchedKey) entry = saldosFiliaisMap.get(matchedKey);
          }

          if (entry) {
            entry.quantidade += q;
          } else {
            const filObj = listaFiliais.find(f => String(f.id || '').toLowerCase() === fId.toLowerCase());
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
        isCelular: ehCelularOuTemImei,
        qtdRede,
        detalhamentoPorFilial
      };
    });
  }, [produtosConsolidados, imeisDisponiveis, listaFiliais]);

  // 7. Montagem dos Cards:
  // - Quando filialSelecionada === 'TODAS' ("Todas as Filiais (Rede Completa)"):
  //   Agrupa por nome (UPPER(TRIM(nome))) gerando 1 ÚNICO CARD CONSOLIDADO por modelo somando a quantidade disponível da rede!
  // - Quando uma filial específica está selecionada:
  //   Exibe o card daquela filial com a quantidade real disponível na filial.
  const cardsDesdobrados = useMemo(() => {
    const lista = [];
    const isVisaoConsolidadaRede = filialSelecionada === 'TODAS';

    const getSaldoFilial = (prod, filialId) => {
      const fIdClean = String(filialId || '').trim().toLowerCase();
      if (!fIdClean) return 0;

      const entry = (prod.detalhamentoPorFilial || []).find(
        df => String(df.filial_id || '').trim().toLowerCase() === fIdClean
      );
      if (entry && typeof entry.quantidade === 'number') {
        return entry.quantidade;
      }

      // Nunca usar fallback de itensFisicos.quantidade se for celular!
      if (prod.isCelular) {
        return 0;
      }

      const registros = (prod.itensFisicos || []).filter(
        p => String(p.filial_id || '').trim().toLowerCase() === fIdClean
      );
      if (registros.length > 0) {
        return registros.reduce((sum, p) => sum + Math.max(0, Number(p.quantidade || 0)), 0);
      }

      return 0;
    };

    produtosComSaldosPorFilial.forEach(prod => {
      if (isVisaoConsolidadaRede) {
        // Visão Consolidada em "Todas as Filiais": 1 único card por modelo com a soma da rede
        const saldoRede = prod.qtdRede;
        const statusEstoque = saldoRede === 0 ? 'ZERADO' : saldoRede < 5 ? 'CRITICO' : 'DISPONIVEL';

        const filiaisComSaldo = (prod.detalhamentoPorFilial || []).filter(df => df.quantidade > 0);

        lista.push({
          ...prod,
          cardKey: `rede_${prod.id}_${String(prod.nome || '').toUpperCase()}`,
          filialIdCard: 'TODAS',
          filialNomeCard: 'Todas as Filiais (Rede)',
          qtdFilial: saldoRede,
          filiaisComSaldo,
          statusEstoque,
          isConsolidadoRede: true
        });
      } else {
        // Visão de Filial Específica
        const fClean = String(filialSelecionada).trim().toLowerCase();
        const fObj = listaFiliais.find(f => String(f.id).trim().toLowerCase() === fClean);
        const fNome = fObj ? fObj.nome : 'Filial Selecionada';

        const itensFisicosFilial = (prod.itensFisicos || []).filter(
          p => String(p.filial_id || '').trim().toLowerCase() === fClean
        );

        const saldoFilial = getSaldoFilial(prod, filialSelecionada);

        // Não exibir itens órfãos de catálogo que não possuem vínculo nem saldo nesta filial
        if (itensFisicosFilial.length === 0 && saldoFilial === 0) {
          return;
        }

        const statusEstoque = saldoFilial === 0 ? 'ZERADO' : saldoFilial < 5 ? 'CRITICO' : 'DISPONIVEL';
        const itemFisicoFilial = itensFisicosFilial[0];
        const precoFilial = Number(itemFisicoFilial?.preco_venda || itemFisicoFilial?.preco || prod.preco || 0);
        const nomeRealFilial = itemFisicoFilial?.filiais?.nome || itemFisicoFilial?.filial_nome || fNome;

        lista.push({
          ...prod,
          preco: precoFilial,
          cardKey: `${prod.id}_${filialSelecionada}`,
          filialIdCard: String(filialSelecionada),
          filialNomeCard: nomeRealFilial,
          qtdFilial: saldoFilial,
          filiaisComSaldo: [],
          statusEstoque,
          isConsolidadoRede: false
        });
      }
    });

    // Ordenar colocando modelos com maior saldo ou ordem alfabética limpa
    return lista.sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || '')));
  }, [produtosComSaldosPorFilial, filialSelecionada, listaFiliais]);

  // 8. Filtros de Interface (Ocultar Zerados por padrão + Busca + Categoria + Status)
  const itensFiltrados = useMemo(() => {
    return cardsDesdobrados.filter(item => {
      // Filtro de Categoria
      if (categoriaSelecionada !== 'TODAS') {
        const catItem = String(item.categoria || '').trim().toUpperCase();
        if (catItem !== categoriaSelecionada.trim().toUpperCase()) return false;
      }

      // Filtro de Status de Estoque:
      // REGRA OBRIGATÓRIA: Por padrão ('TODOS'), exibe APENAS modelos com quantidade disponível > 0!
      // Os itens zerados (0 un) só aparecem quando o usuário clica explicitamente em "Estoque Zerado" ('ZERADO').
      if (statusFiltro === 'TODOS') {
        if (item.qtdFilial <= 0) return false;
      } else if (statusFiltro === 'CRITICO') {
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

  // 9. Paginação
  const totalPaginas = Math.max(1, Math.ceil(itensFiltrados.length / itensPorPagina));
  const paginaValida = Math.min(Math.max(1, paginaAtual), totalPaginas);
  const indiceInicio = (paginaValida - 1) * itensPorPagina;
  const indiceFim = Math.min(indiceInicio + itensPorPagina, itensFiltrados.length);
  const cardsExibidos = useMemo(() => {
    return itensFiltrados.slice(indiceInicio, indiceFim);
  }, [itensFiltrados, indiceInicio, indiceFim]);

  // Contadores para as Pílulas de Status (respeitando categoria e busca)
  const contadores = useMemo(() => {
    const base = cardsDesdobrados.filter(item => {
      if (categoriaSelecionada !== 'TODAS') {
        const catItem = String(item.categoria || '').trim().toUpperCase();
        if (catItem !== categoriaSelecionada.trim().toUpperCase()) return false;
      }
      if (buscaDebounced && buscaDebounced.trim()) {
        const termo = buscaDebounced.toLowerCase().trim();
        const nome = String(item.nome || '').toLowerCase();
        const sku = String(item.sku || '').toLowerCase();
        const barcode = String(item.codigo_barras || '').toLowerCase();
        const filial = String(item.filialNomeCard || '').toLowerCase();
        if (!nome.includes(termo) && !sku.includes(termo) && !barcode.includes(termo) && !filial.includes(termo)) {
          return false;
        }
      }
      return true;
    });

    let emEstoque = 0; // quantidade > 0
    let critico = 0;   // 1 a 4
    let zerado = 0;    // 0
    let disponivel = 0; // >= 5

    base.forEach(i => {
      if (i.qtdFilial === 0) {
        zerado++;
      } else {
        emEstoque++;
        if (i.qtdFilial < 5) critico++;
        else disponivel++;
      }
    });

    return { todos: emEstoque, critico, zerado, disponivel };
  }, [cardsDesdobrados, categoriaSelecionada, buscaDebounced]);

  // Abrir Modal de IMEIs Disponíveis para o Produto e Filial do Card
  // Filtra EXCLUSIVAMENTE status === 'DISPONIVEL' e vendido === false
  const handleAbrirImeis = (item) => {
    const produtoIds = new Set();
    if (item.id) produtoIds.add(String(item.id));
    item.itensFisicos?.forEach((p) => {
      if (p.id) produtoIds.add(String(p.id));
    });

    const targetFilialId = item.filialIdCard;
    const imeisRelacionados = (imeisDisponiveis || []).filter(im => {
      if (!isImeiEstritamenteDisponivel(im)) return false;
      const matchProd = im.produto_id && produtoIds.has(String(im.produto_id));
      if (!matchProd) return false;

      if (targetFilialId && targetFilialId !== 'TODAS') {
        let fIdImei = String(im.filial_id || '').trim();
        if (!fIdImei) {
          const prodFisico = (item.itensFisicos || []).find(p => String(p.id) === String(im.produto_id));
          if (prodFisico?.filial_id) fIdImei = String(prodFisico.filial_id).trim();
        }
        return fIdImei.toLowerCase() === String(targetFilialId).trim().toLowerCase();
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
      {/* Toast Flutuante de Sucesso */}
      {sucessoToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-950/95 border border-emerald-500/60 text-emerald-300 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 animate-fadeIn backdrop-blur-md">
          <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          <span className="text-xs font-bold">{sucessoToast}</span>
        </div>
      )}

      {/* 1. Menu e Cabeçalho com botão de destaque "🔍 Rastrear IMEI / Vendas" */}
      <div className="bg-gradient-to-r from-[#0d0914] via-[#120d1c] to-[#0a0a0a] border border-[#8B5CF6]/30 p-4 md:p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl relative overflow-hidden w-full">
        <div className="absolute -right-10 -bottom-10 w-44 h-44 bg-[#8B5CF6]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="w-full md:w-auto">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 rounded-xl text-[#A78BFA] shadow-sm shrink-0">
              <Package size={22} className="text-[#8B5CF6]" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                Posição de Estoque & Auditoria de Prateleira
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Conferência física de aparelhos e produtos disponíveis em loja, separada do histórico de vendas.
              </p>
            </div>
          </div>
        </div>

        {/* Botões de Ação no Cabeçalho: Rastrear IMEI / Vendas + Atualizar */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
          <button
            type="button"
            onClick={() => {
              setImeiInicialRastreio('');
              setModalRastrearImeiAberto(true);
            }}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 border border-purple-400/40 text-white rounded-xl text-xs font-extrabold transition-all shadow-lg shadow-purple-900/40 active:scale-95 cursor-pointer flex-1 sm:flex-initial"
          >
            <Search size={15} className="text-purple-100" />
            <span>🔍 Rastrear IMEI / Vendas</span>
          </button>

          <button
            type="button"
            onClick={() => carregarDadosEstoque(null, true)}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-3.5 py-2.5 bg-black/60 hover:bg-[#1a1226] border border-[#33254d] hover:border-[#8B5CF6]/60 text-purple-300 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
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
              placeholder="Buscar modelo na prateleira por nome, SKU ou código de barras..."
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

        {/* Pílulas de Status de Estoque (Oculta Zerados por padrão!) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2 border-t border-[#1f1f26] w-full">
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Em Estoque (> 0 un) — PADRÃO */}
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
              <span>Em Estoque (&gt; 0)</span>
              <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-black/30 font-mono">
                {contadores.todos}
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
              <span>Crítico (1 a 4 un)</span>
              <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-amber-950/60 text-amber-300 border border-amber-800/40 font-mono">
                {contadores.critico}
              </span>
            </button>

            {/* Estoque Zerado (0 un — Oculto por padrão, visível apenas quando clicado) */}
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
          </div>

          {/* Indicador de Filtro Ativo */}
          <div className="text-[11px] text-gray-400 font-medium w-full md:w-auto text-left md:text-right pt-1 md:pt-0">
            Exibindo <span className="text-white font-bold">{itensFiltrados.length}</span> modelos em <span className="text-[#A78BFA] font-semibold">{nomeFilialAtiva}</span>
          </div>
        </div>
      </div>

      {/* 3. Grade Limpa de Cards para Auditoria de Prateleira */}
      {loading ? (
        <div className="py-20 text-center flex flex-col items-center justify-center space-y-3">
          <RefreshCw size={32} className="animate-spin text-[#8B5CF6]" />
          <p className="text-sm font-semibold text-gray-400">Carregando posição física de estoque...</p>
        </div>
      ) : itensFiltrados.length === 0 ? (
        <div className="space-y-6">
          {filialSelecionada !== 'TODAS' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div
                onClick={() => setModalAdicionarProdutoAberto(true)}
                className="group border-2 border-dashed border-purple-500/40 hover:border-purple-400 bg-purple-950/10 hover:bg-purple-950/25 rounded-xl p-6 flex flex-col items-center justify-center text-center gap-3 transition-all duration-200 cursor-pointer hover:shadow-xl hover:shadow-purple-950/30 min-h-[220px]"
                title={`Vincular novo produto do catálogo à ${nomeFilialAtiva}`}
              >
                <div className="w-12 h-12 rounded-2xl bg-purple-950/60 border border-purple-500/50 group-hover:scale-110 group-hover:bg-purple-900/60 text-purple-300 group-hover:text-white flex items-center justify-center transition-all shadow-lg shadow-purple-950/50">
                  <Plus size={24} />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">
                    Adicionar Produto à Filial
                  </h4>
                  <p className="text-xs text-zinc-400">
                    Vincular item de <strong className="text-purple-300">{nomeFilialAtiva}</strong>
                  </p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 bg-purple-950/80 border border-purple-500/30 px-3 py-1 rounded-full group-hover:bg-purple-600 group-hover:text-white transition-all">
                  + Vincular Catálogo
                </span>
              </div>
            </div>
          )}

          <div className="py-16 px-4 text-center bg-[#0e0e11] border border-dashed border-[#222228] rounded-2xl flex flex-col items-center justify-center space-y-3">
            <div className="p-4 bg-purple-950/30 border border-purple-800/40 rounded-full text-purple-400">
              <Search size={32} />
            </div>
            <h4 className="text-base font-bold text-white">Nenhum modelo com saldo neste filtro</h4>
            <p className="text-xs text-gray-400 max-w-md mx-auto">
              Os itens esgotados (0 un) ficam ocultos por padrão para facilitar a conferência de prateleira. Clique em &quot;Estoque Zerado&quot; caso queira visualizá-los, ou use o botão &quot;🔍 Rastrear IMEI / Vendas&quot; para consultar aparelhos vendidos.
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
                <span>Voltar para Estoque Disponível (&gt; 0)</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Card Interativo: Adicionar Produto à Filial */}
            {filialSelecionada !== 'TODAS' && paginaValida === 1 && (
              <div
                onClick={() => setModalAdicionarProdutoAberto(true)}
                className="group border-2 border-dashed border-purple-500/40 hover:border-purple-400 bg-purple-950/10 hover:bg-purple-950/25 rounded-xl p-5 flex flex-col items-center justify-center text-center gap-3 transition-all duration-200 cursor-pointer hover:shadow-xl hover:shadow-purple-950/30 min-h-[220px]"
                title={`Vincular novo produto do catálogo à ${nomeFilialAtiva}`}
              >
                <div className="w-12 h-12 rounded-2xl bg-purple-950/60 border border-purple-500/50 group-hover:scale-110 group-hover:bg-purple-900/60 text-purple-300 group-hover:text-white flex items-center justify-center transition-all shadow-lg shadow-purple-950/50">
                  <Plus size={24} />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">
                    Adicionar Produto à Filial
                  </h4>
                  <p className="text-xs text-zinc-400">
                    Vincular à <strong className="text-cyan-300">{nomeFilialAtiva}</strong>
                  </p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 bg-purple-950/80 border border-purple-500/30 px-3 py-1 rounded-full group-hover:bg-purple-600 group-hover:text-white transition-all">
                  + Vincular Catálogo
                </span>
              </div>
            )}

            {cardsExibidos.map((item) => {
              const isEsgotado = item.qtdFilial === 0;
              const isCritico = item.qtdFilial > 0 && item.qtdFilial < 5;
              const isDisponivel = item.qtdFilial >= 5;

              return (
                <div
                  key={item.cardKey}
                  className="bg-[#0d1117] border border-zinc-800/80 hover:border-purple-500/50 rounded-xl p-4 flex flex-col justify-between gap-3.5 transition-all duration-200 group hover:shadow-xl hover:shadow-purple-950/20 relative"
                >
                  {/* 1. Cabeçalho Limpo e Objetivo: Filial/Rede + Preço + Nome do Modelo */}
                  <div
                    onClick={() => {
                      const itemFisicoFilial =
                        item.filialIdCard !== 'TODAS'
                          ? (item.itensFisicos || []).find(p => String(p.filial_id) === String(item.filialIdCard))
                          : item.itensFisicos?.[0];
                      const targetProd = {
                        ...(itemFisicoFilial || item.itensFisicos?.[0] || item),
                        id: itemFisicoFilial?.id || item.itensFisicos?.[0]?.id || item.id,
                        filial_id:
                          item.filialIdCard !== 'TODAS'
                            ? item.filialIdCard
                            : (itemFisicoFilial?.filial_id || item.itensFisicos?.[0]?.filial_id || activeFilialId),
                        filialNome: item.filialNomeCard
                      };
                      setProdutoSelecionadoModal(targetProd);
                    }}
                    className="cursor-pointer group/header"
                    title="Clique para abrir ajustes e distribuição do modelo"
                  >
                    <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-zinc-800/60">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Store size={14} className="text-cyan-400 shrink-0" />
                        <span className="text-[11px] font-black uppercase tracking-wider text-cyan-300 truncate">
                          [{item.filialNomeCard}]
                        </span>
                      </div>
                      <span className="text-sm font-mono font-bold text-emerald-400 shrink-0 tracking-tight">
                        {formatCurrency(item.preco)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] bg-purple-950/60 text-purple-300 border border-purple-800/60 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                        {item.isCelular ? <Smartphone size={10} className="text-purple-400" /> : <Tag size={10} className="text-purple-400" />}
                        {item.categoria || 'Geral'}
                      </span>
                      {item.sku && (
                        <span className="text-[10px] text-zinc-400 font-mono">
                          SKU: <strong className="text-zinc-300">{item.sku}</strong>
                        </span>
                      )}
                    </div>

                    {/* Nome do Modelo em Destaque */}
                    <h3 className="text-sm md:text-base font-extrabold text-white tracking-wide mt-2 group-hover/header:text-purple-300 transition-colors line-clamp-2 leading-snug">
                      {item.nome}
                    </h3>
                  </div>

                  {/* 2. Bloco Central de Auditoria Física: Quantidade Real Disponível */}
                  <div className="bg-black/50 border border-zinc-800/70 rounded-xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block">
                          {item.isConsolidadoRede ? 'DISPONÍVEL NA REDE' : 'DISPONÍVEL NA FILIAL'}
                        </span>
                        <span className="text-xs font-bold text-cyan-300 truncate max-w-[160px] block mt-0.5">
                          {item.filialNomeCard}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl font-black text-white font-mono leading-none">
                          {item.qtdFilial} <span className="text-xs text-gray-400 font-sans font-semibold">un</span>
                        </span>

                        {isEsgotado && (
                          <span className="text-[10px] bg-red-950/80 text-red-400 border border-red-600/80 px-2 py-0.5 rounded font-bold tracking-wide">
                            ZERADO
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

                    {/* Se estiver na visão consolidada da rede, mostra resumo rápido de quais filiais têm saldo */}
                    {item.isConsolidadoRede && item.filiaisComSaldo?.length > 0 ? (
                      <div className="border-t border-zinc-800/60 pt-2 flex flex-wrap gap-1.5">
                        {item.filiaisComSaldo.map(df => (
                          <span
                            key={df.filial_id}
                            className="text-[10px] bg-zinc-900/90 border border-zinc-700/70 text-zinc-300 px-2 py-0.5 rounded-md font-medium"
                          >
                            {df.filial_nome}: <strong className="text-emerald-400 font-mono">{df.quantidade}</strong>
                          </span>
                        ))}
                      </div>
                    ) : (
                      !item.isConsolidadoRede && (
                        <div className="border-t border-zinc-800/60 pt-2 flex items-center justify-between text-[11px]">
                          <span className="text-gray-400 font-medium flex items-center gap-1.5">
                            <Building2 size={12} className="text-purple-400" />
                            Total na Rede:
                          </span>
                          <span className="font-mono font-bold text-purple-300">
                            {item.qtdRede} {item.qtdRede === 1 ? 'unidade' : 'unidades'}
                          </span>
                        </div>
                      )
                    )}
                  </div>

                  {/* 3. Botões de Conferência de Prateleira e Ações */}
                  <div className="space-y-2 pt-0.5">
                    {item.isCelular && (
                      <button
                        type="button"
                        onClick={() => handleAbrirImeis(item)}
                        className="w-full bg-gradient-to-r from-[#201435] to-[#2c1b4b] hover:from-[#2c1b4b] hover:to-[#3b2364] border border-purple-500/50 hover:border-purple-400 text-purple-100 hover:text-white font-extrabold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-purple-950/30"
                      >
                        <QrCode size={14} className="text-purple-300 shrink-0" />
                        <span>Conferir IMEIs Disponíveis ({item.qtdFilial})</span>
                      </button>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const itemFisicoFilial =
                            item.filialIdCard !== 'TODAS'
                              ? (item.itensFisicos || []).find(p => String(p.filial_id) === String(item.filialIdCard))
                              : item.itensFisicos?.[0];
                          const targetProd = {
                            ...(itemFisicoFilial || item.itensFisicos?.[0] || item),
                            id: itemFisicoFilial?.id || item.itensFisicos?.[0]?.id || item.id,
                            filial_id:
                              item.filialIdCard !== 'TODAS'
                                ? item.filialIdCard
                                : (itemFisicoFilial?.filial_id || item.itensFisicos?.[0]?.filial_id || activeFilialId),
                            filialNome: item.filialNomeCard
                          };
                          setProdutoSelecionadoModal(targetProd);
                          if (onOpenDetalhesProduto) {
                            onOpenDetalhesProduto(targetProd);
                          }
                        }}
                        className="w-full bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/60 hover:border-zinc-500 text-zinc-300 hover:text-white font-semibold py-2 px-2.5 rounded-lg text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer truncate shadow-sm"
                        title="Ajustar preço ou saldo"
                      >
                        <History size={13} className="text-zinc-400 shrink-0" />
                        <span className="truncate">Ajustar / Preço</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (onNavigateToTransferencias) {
                            onNavigateToTransferencias();
                          }
                        }}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-2.5 rounded-lg text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer truncate shadow-md shadow-purple-900/30"
                        title="Solicitar transferência entre filiais"
                      >
                        <ArrowRightLeft size={13} className="text-white shrink-0" />
                        <span className="truncate">Transferir</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Barra de Paginação */}
          {totalPaginas > 1 && (
            <div className="bg-[#0e0e11] border border-[#222228] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
              <div className="text-xs text-gray-400">
                Mostrando <span className="font-bold text-white font-mono">{itensFiltrados.length === 0 ? 0 : indiceInicio + 1}</span> - <span className="font-bold text-white font-mono">{indiceFim}</span> de <span className="font-bold text-purple-400 font-mono">{itensFiltrados.length}</span> modelos
                <span className="ml-2 text-zinc-600">|</span>
                <span className="ml-2 text-zinc-400">Página <strong className="text-white">{paginaValida}</strong> de <strong className="text-white">{totalPaginas}</strong></span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPaginaAtual(prev => Math.max(1, prev - 1))}
                  disabled={paginaValida <= 1}
                  className="flex items-center gap-1 px-3 py-1.5 bg-black/60 hover:bg-[#1a1226] border border-[#282830] hover:border-purple-500/50 text-xs font-semibold text-zinc-300 hover:text-white rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronLeft size={14} />
                  <span>Anterior</span>
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPaginas || Math.abs(p - paginaValida) <= 1)
                    .reduce((acc, p, idx, arr) => {
                      if (idx > 0 && p - arr[idx - 1] > 1) {
                        acc.push(-1 * p);
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

      {/* 4. Modal de Conferência de IMEIs Disponíveis na Prateleira */}
      {modalImeisAberto && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#0e0e11] border border-[#2a2a36] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-start justify-between gap-3 border-b border-[#202028] pb-4">
              <div>
                <span className="text-[10px] bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded font-bold uppercase">
                  Conferência Física de Prateleira (Somente Disponíveis)
                </span>
                <h3 className="text-base font-extrabold text-white mt-1.5">
                  {produtoImeisModal?.nome}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Local: <strong className="text-cyan-300">[{filialImeisModal || nomeFilialAtiva}]</strong>
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

            {/* Lista de IMEIs Disponíveis */}
            <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
              {imeisDoProdutoModal.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-xs">
                  Nenhum IMEI disponível na prateleira para esta seleção.
                </div>
              ) : (
                imeisDoProdutoModal.map((im, idx) => {
                  const filialDoImei =
                    listaFiliais.find(f => String(f.id) === String(im.filial_id))?.nome ||
                    filialImeisModal ||
                    'Filial identificada';
                  return (
                    <div
                      key={im.id || idx}
                      className="bg-black/60 border border-[#22222a] hover:border-purple-500/40 p-3 rounded-xl flex items-center justify-between gap-2 text-xs transition-colors"
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
                      <div className="text-right flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-bold uppercase">
                            DISPONÍVEL
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setModalImeisAberto(false);
                              setImeiInicialRastreio(im.imei);
                              setModalRastrearImeiAberto(true);
                            }}
                            className="text-[10px] bg-purple-950/80 hover:bg-purple-800 text-purple-300 hover:text-white border border-purple-500/40 px-2 py-0.5 rounded font-bold transition-colors cursor-pointer"
                            title="Abrir histórico completo deste IMEI"
                          >
                            🔍 Rastrear
                          </button>
                        </div>
                        {im.cor && (
                          <span className="text-[10px] text-gray-400 block">
                            Cor: <strong className="text-gray-200">{im.cor}</strong>
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
              <span>
                Total em gaveta/vitrine: <strong className="text-emerald-400 font-mono">{imeisDoProdutoModal.length}</strong> disponível(is)
              </span>
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

      {/* 5. Novo Modal: "🔍 Rastrear IMEI & Histórico de Vendas" */}
      <ModalRastrearImei
        isOpen={modalRastrearImeiAberto}
        onClose={() => {
          setModalRastrearImeiAberto(false);
          setImeiInicialRastreio('');
        }}
        empresaId={profile?.empresa_id}
        filiais={listaFiliais}
        produtos={produtos}
        initialSearch={imeiInicialRastreio}
      />

      {/* 6. Modal de Detalhes e Ajuste de Estoque */}
      {produtoSelecionadoModal && (
        <ModalDetalheEstoqueProduto
          produtoId={produtoSelecionadoModal.id || produtoSelecionadoModal.produto_id}
          produto={produtoSelecionadoModal}
          filialId={
            produtoSelecionadoModal.filial_id && String(produtoSelecionadoModal.filial_id) !== 'TODAS'
              ? produtoSelecionadoModal.filial_id
              : (filialSelecionada !== 'TODAS' ? filialSelecionada : activeFilialId)
          }
          filiais={listaFiliais}
          isOpen={!!produtoSelecionadoModal}
          onClose={() => setProdutoSelecionadoModal(null)}
          onRefresh={() => {
            carregarDadosEstoque(null, true);
          }}
          onSuccess={() => {
            carregarDadosEstoque(null, true);
          }}
          onAtualizar={() => {
            carregarDadosEstoque(null, true);
          }}
          onTransferir={() => {
            setProdutoSelecionadoModal(null);
            if (onNavigateToTransferencias) {
              onNavigateToTransferencias();
            }
          }}
        />
      )}

      {/* 7. Modal de Adicionar Produto à Filial */}
      {modalAdicionarProdutoAberto && (
        <ModalAdicionarProdutoFilial
          isOpen={modalAdicionarProdutoAberto}
          onClose={() => setModalAdicionarProdutoAberto(false)}
          filialId={filialSelecionada}
          filialNome={nomeFilialAtiva}
          produtosCatalogo={produtosCatalogo}
          produtosFisicos={produtos}
          empresaId={profile?.empresa_id}
          userId={profile?.id}
          onSuccess={(novoProd) => {
            setSucessoToast(`Produto "${novoProd.nome}" adicionado com sucesso à ${nomeFilialAtiva}!`);
            setTimeout(() => setSucessoToast(null), 4500);
            carregarDadosEstoque(null, true);
          }}
        />
      )}
    </div>
  );
}

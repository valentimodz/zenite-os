import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import {
  X,
  Package,
  Smartphone,
  Tag,
  Store,
  Layers,
  ArrowRightLeft,
  AlertCircle,
  Loader2,
  Calendar,
  CheckCircle2,
  Barcode,
  Palette,
  Edit2,
  Trash2,
  Plus,
  Minus,
  Check,
  DollarSign
} from 'lucide-react';
import { formatCurrency, formatarMoeda, parseMonetaryValue } from '../utils/currencyUtils';

/**
 * Sanitização e conversão segura de qualquer input monetário digitado para float numérico válido (2 casas decimais).
 * Evita erro 400 de sintaxe numeric / invalid input syntax no Postgres.
 */
function parsePrecoToNumeric(valor: string | number): number {
  if (typeof valor === 'number') return isNaN(valor) ? 0 : Number(valor.toFixed(2));
  if (!valor) return 0;
  // Remove R$, espaços e converte formato 1.234,56 ou 29,99 para 29.99
  const limpo = String(valor).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const numero = parseFloat(limpo);
  return isNaN(numero) ? 0 : Number(numero.toFixed(2));
}

interface ModalDetalheEstoqueProdutoProps {
  isOpen: boolean;
  onClose: () => void;
  produto: any;
  filialId?: string | number | null;
  filiais?: Array<{ id: string | number; nome: string }>;
  onTransferir?: (produto: any) => void;
  onUpdateProdutoField?: (produtoId: any, nome: string, field: string, value: any, itemFilialId?: any) => Promise<any>;
  onDeleteProduto?: (produto: any) => Promise<any>;
  onRefresh?: () => void;
  onSuccess?: () => void;
  onAtualizar?: () => void;
  produtoId?: string | number;
}

interface ItemProdutoDetalhado {
  id: string;
  nome: string;
  filial_id: string;
  filial_nome: string;
  categoria: string;
  cor: string;
  preco: number;
  preco_venda: number;
  preco_custo?: number;
  quantidade: number;
  imeis: string[];
  updated_at?: string;
  created_at?: string;
  isSynthetic?: boolean;
}

interface EstoquePorFilialItem {
  filial_id: string;
  filial_nome: string;
  quantidadeTotal: number;
  itens: ItemProdutoDetalhado[];
  status: 'EM_ESTOQUE' | 'ESTOQUE_BAIXO' | 'ESGOTADO';
  ultima_movimentacao?: string | null;
}

interface VariacaoCorItem {
  cor: string;
  quantidadeTotal: number;
  itens: ItemProdutoDetalhado[];
  filiaisMap: { [filialNome: string]: number };
}

export default function ModalDetalheEstoqueProduto({
  isOpen,
  onClose,
  produto,
  filialId: propFilialId,
  filiais = [],
  onTransferir,
  onUpdateProdutoField,
  onDeleteProduto,
  onRefresh,
  onSuccess,
  onAtualizar
}: ModalDetalheEstoqueProdutoProps) {
  // Notificador unificado de sucesso / atualização para o componente pai
  const dispararAtualizacao = useCallback(() => {
    if (onRefresh) onRefresh();
    if (onSuccess) onSuccess();
    if (onAtualizar) onAtualizar();
    try {
      window.dispatchEvent(new CustomEvent('catalogo_updated'));
      window.dispatchEvent(new CustomEvent('estoque_updated'));
    } catch (_) {}
  }, [onRefresh, onSuccess, onAtualizar]);
  const [loading, setLoading] = useState(false);
  const [produtosIrmaos, setProdutosIrmaos] = useState<ItemProdutoDetalhado[]>([]);
  const [abaAtiva, setAbaAtiva] = useState<'filiais' | 'variacoes'>('filiais');

  // Estados de Edição de Nome do Produto no Cabeçalho
  const [nomeEditado, setNomeEditado] = useState<string>('');
  const [editandoNomeGeral, setEditandoNomeGeral] = useState(false);
  const [salvandoNomeGeral, setSalvandoNomeGeral] = useState(false);
  // Toast local leve no modal
  const [toastModal, setToastModal] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showModalToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToastModal({ message, type });
    setTimeout(() => {
      setToastModal(prev => (prev?.message === message ? null : prev));
    }, 4000);
  }, []);

  // Estados de Edição de Preço Global do Cabeçalho
  const [editandoPrecoGeral, setEditandoPrecoGeral] = useState(false);
  const [valorPrecoGeral, setValorPrecoGeral] = useState('');
  const [salvandoPrecoGeral, setSalvandoPrecoGeral] = useState(false);

  // Estados de Edição Inline por Item (preco, cor, quantidade)
  const [itemEditandoId, setItemEditandoId] = useState<string | null>(null);
  const [campoEditando, setCampoEditando] = useState<string | null>(null);
  const [valorEditando, setValorEditando] = useState('');
  const [salvandoInline, setSalvandoInline] = useState(false);

  // Exclusão de Item
  const [itemParaExcluir, setItemParaExcluir] = useState<ItemProdutoDetalhado | null>(null);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);

  // Identificadores do Produto
  const produtoNomeBase = produto?.nome || produto?.produto_nome || 'Produto sem nome';
  const produtoNome = nomeEditado || produtoNomeBase;
  const produtoId = produto?.id || produto?.produto_id || '-';
  const produtoEan = produto?.codigo_barras || produto?.ean || produto?.codigoBarras || null;
  const produtoSku = produto?.sku || null;
  const categoria = produto?.categoria || produto?.tipo || 'GERAL';
  const corAtual = produto?.cor || produto?.cor_nome || 'Padrão';
  const precoBaseVenda = Number(produto?.preco_venda || produto?.preco || 0);
  const precoBaseCusto = Number(produto?.preco_custo || 0);

  // Mapeamento de Filiais por ID para lookup rápido
  const mapaFiliaisNome = useMemo(() => {
    const mapa: { [key: string]: string } = {};
    (filiais || []).forEach(f => {
      mapa[String(f.id)] = f.nome;
    });
    return mapa;
  }, [filiais]);

  // Resolução da filial real vinculada a este registro de produto
  const filialIdProdutoOrigem = propFilialId || produto?.filial_id || null;
  const filialNomeProdutoOrigem = (filialIdProdutoOrigem && mapaFiliaisNome[String(filialIdProdutoOrigem)]) ||
    produto?.filialNome ||
    produto?.filial_nome ||
    (produto?.filiais?.nome) ||
    null;

  const categoriaNome = String(produto?.categoria || produto?.categoria_nome || categoria || '').toUpperCase();
  const nomeProdutoTexto = String(produtoNome || '').toUpperCase();

  const ehAcessorioGarantido = (nome: string, cat: string) => {
    const termos = [
      'SUPORTE', 'CAPA', 'CASE', 'PELIC', 'CABO', 'FONE',
      'CARREGADOR', 'FONTE', 'ADAPTADOR', 'CHIP', 'BRINDE',
      'POWER BANK', 'FILME', 'BRACADEIRA'
    ];
    const str = `${nome || ''} ${cat || ''}`.toUpperCase();
    return termos.some(termo => str.includes(termo));
  };

  // Se tiver palavras como SUPORTE, CAPA, CABO etc., NUNCA será celular e NUNCA pedirá IMEI:
  const ehCelular = !ehAcessorioGarantido(nomeProdutoTexto, categoriaNome) && (
    produto?.controla_imei === true ||
    String(produto?.tipo || '').toUpperCase() === 'APARELHO' ||
    categoriaNome === 'CELULARES' ||
    categoriaNome === 'SMARTPHONES' ||
    categoriaNome === 'APARELHOS'
  );

  const ehCelularOuSerial = ehCelular;
  const isCelular = ehCelular;

  // Estado para Adicionar Novo IMEI por Item/Filial
  const [itemParaAdicionarImei, setItemParaAdicionarImei] = useState<ItemProdutoDetalhado | null>(null);
  const [novoImeiInput, setNovoImeiInput] = useState('');
  const [salvandoNovoImei, setSalvandoNovoImei] = useState(false);
  const [erroNovoImei, setErroNovoImei] = useState<string | null>(null);

  // Função para buscar e consolidar todos os itens/filiais/cores deste produto
  const carregarDetalhesEstoque = useCallback(async () => {
    if (!produto) return;
    setLoading(true);
    try {
      const nomeTrim = String(produtoNome).trim();
      const catalogoId = produto?.produto_catalogo_id || null;
      const eanTrim = produtoEan ? String(produtoEan).trim() : null;
      const skuTrim = produtoSku ? String(produtoSku).trim() : null;

      let query = supabase
        .from('produtos')
        .select(`
          id,
          nome,
          filial_id,
          categoria,
          cor,
          preco,
          preco_venda,
          preco_custo,
          quantidade,
          status,
          codigo_barras,
          updated_at,
          created_at,
          filiais (id, nome),
          imeis (
            id,
            imei,
            status,
            vendido,
            filial_id,
            cor
          )
        `);

      // Construção dinâmica de filtros OR abrangendo todas as filiais por catálogo, nome, EAN/código de barras ou SKU
      const orConditions: string[] = [];
      if (catalogoId) {
        orConditions.push(`produto_catalogo_id.eq.${catalogoId}`);
      }
      if (nomeTrim && nomeTrim !== 'Produto sem nome') {
        orConditions.push(`nome.ilike.${nomeTrim}`);
      }
      if (eanTrim) {
        orConditions.push(`codigo_barras.eq.${eanTrim}`);
      }
      if (skuTrim) {
        orConditions.push(`sku.eq.${skuTrim}`);
      }

      if (orConditions.length > 0) {
        query = query.or(orConditions.join(','));
      } else if (produtoId && produtoId !== '-') {
        query = query.eq('id', produtoId);
      }

      const { data: prodsDb, error } = await query;
      if (error) {
        console.warn('[ModalDetalheEstoqueProduto] Erro ao buscar produtos:', error);
      }

      const listaBruta = prodsDb && prodsDb.length > 0 ? prodsDb : [produto];

      // Formatar cada item individualmente e filtrar itens ativos com filial real
      const itensFormatados: ItemProdutoDetalhado[] = [];
      const vistosChave = new Map<string, any>();

      // Ordenar por mais recente para manter o registro prioritário de cada variação/filial
      const ordenados = [...listaBruta].sort((a: any, b: any) => {
        const timeA = new Date(a?.updated_at || a?.created_at || 0).getTime();
        const timeB = new Date(b?.updated_at || b?.created_at || 0).getTime();
        if (timeB !== timeA) return timeB - timeA;
        return String(b?.id || '').localeCompare(String(a?.id || ''));
      });

      ordenados.forEach((p: any) => {
        if (!p) return;
        // Filtrar registros inativos
        if (p.status === 'INATIVO' || p.ativo === false) return;

        const rawFId = p.filial_id;
        // Não incluir registros sem filial válida no estoque físico
        if (!rawFId || rawFId === 'sem_filial' || String(rawFId).trim() === '') {
          return;
        }

        const fId = String(rawFId);
        const corLimpa = (p.cor || corAtual || 'Padrão').trim();
        const chaveDeduplicacao = `${fId}_${corLimpa.toLowerCase()}`;

        // Deduplicação lógica: se já temos o registro mais recente dessa filial e variação, ignoramos registros duplicados/fantasmas
        if (vistosChave.has(chaveDeduplicacao)) {
          return;
        }
        vistosChave.set(chaveDeduplicacao, p);

        const seriais = Array.isArray(p.imeis)
          ? p.imeis.filter((i: any) => !i.vendido && String(i.status || '').toUpperCase() !== 'VENDIDO')
          : [];

        const imeisStrings: string[] = seriais.map((i: any) => String(i.imei).trim()).filter(Boolean);

        let qtdValida = imeisStrings.length;
        if (qtdValida === 0) {
          qtdValida = Number(p.quantidade || 0);
        }

        const fNome = p.filiais?.nome || mapaFiliaisNome[fId] || `Filial ${fId}`;

        itensFormatados.push({
          id: String(p.id),
          nome: p.nome || produtoNome,
          filial_id: fId,
          filial_nome: fNome,
          categoria: p.categoria || categoria,
          cor: corLimpa,
          preco: Number(p.preco || p.preco_venda || precoBaseVenda),
          preco_venda: Number(p.preco_venda || p.preco || precoBaseVenda),
          preco_custo: Number(p.preco_custo !== undefined && p.preco_custo !== null ? p.preco_custo : precoBaseCusto),
          quantidade: qtdValida,
          imeis: imeisStrings,
          updated_at: p.updated_at,
          created_at: p.created_at
        });
      });

      setProdutosIrmaos(itensFormatados);
    } catch (err) {
      console.error('[ModalDetalheEstoqueProduto] Falha ao carregar itens:', err);
    } finally {
      setLoading(false);
    }
  }, [produto, produtoNome, produtoId, produtoEan, produtoSku, categoria, corAtual, precoBaseVenda, mapaFiliaisNome]);

  useEffect(() => {
    if (isOpen && produto) {
      setNomeEditado(produto?.nome || produto?.produto_nome || '');
      setEditandoNomeGeral(false);
      carregarDetalhesEstoque();
    }
  }, [isOpen, produto, carregarDetalhesEstoque]);

  // Handler para fechar com tecla ESC
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        // Se houver algum sub-modal/edição aberta, fecha ela primeiro
        if (editandoNomeGeral) {
          setEditandoNomeGeral(false);
          return;
        }
        if (editandoPrecoGeral) {
          setEditandoPrecoGeral(false);
          return;
        }
        if (itemEditandoId) {
          setItemEditandoId(null);
          return;
        }
        if (itemParaAdicionarImei) {
          setItemParaAdicionarImei(null);
          return;
        }
        if (itemParaExcluir) {
          setItemParaExcluir(null);
          return;
        }
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, editandoPrecoGeral, itemEditandoId, itemParaAdicionarImei, itemParaExcluir]);

  // Total Geral consolidando todas as variações e filiais
  const totalGeral = useMemo(() => {
    return produtosIrmaos.reduce((acc, curr) => acc + curr.quantidade, 0);
  }, [produtosIrmaos]);

  // Preço de venda exibido no cabeçalho (média ou do item principal)
  const precoExibicaoCabecalho = useMemo(() => {
    const comPreco = produtosIrmaos.find(p => p.preco_venda > 0 || p.preco > 0);
    return comPreco ? (comPreco.preco_venda || comPreco.preco) : precoBaseVenda;
  }, [produtosIrmaos, precoBaseVenda]);

  // Preço de custo exibido no cabeçalho (item principal ou base)
  const precoCustoExibicaoCabecalho = useMemo(() => {
    const comCusto = produtosIrmaos.find(p => p.preco_custo !== undefined && p.preco_custo !== null && p.preco_custo > 0);
    return comCusto && comCusto.preco_custo !== undefined ? comCusto.preco_custo : precoBaseCusto;
  }, [produtosIrmaos, precoBaseCusto]);

  // Agrupamento de Estoque por Filial
  const estoqueFiliais = useMemo(() => {
    const mapa: { [filialKey: string]: EstoquePorFilialItem } = {};

    // Inicia com as filiais: se propFilialId foi informada e não é 'TODAS', filtra apenas ela!
    const filiaisBase = (filiais || []).filter(f => {
      const fId = String(f.id);
      if (!fId || fId === 'sem_filial') return false;
      if (propFilialId && String(propFilialId) !== 'TODAS') {
        return String(fId) === String(propFilialId);
      }
      return true;
    });

    filiaisBase.forEach(f => {
      const fId = String(f.id);
      mapa[fId] = {
        filial_id: fId,
        filial_nome: f.nome,
        quantidadeTotal: 0,
        itens: [],
        status: 'ESGOTADO',
        ultima_movimentacao: null
      };
    });

    produtosIrmaos.forEach(item => {
      const fId = String(item.filial_id);
      if (!fId || fId === 'sem_filial') return;

      // Se houver filial específica selecionada, ignora itens de outras filiais
      if (propFilialId && String(propFilialId) !== 'TODAS' && String(fId) !== String(propFilialId)) {
        return;
      }

      if (!mapa[fId]) {
        mapa[fId] = {
          filial_id: fId,
          filial_nome: item.filial_nome || mapaFiliaisNome[fId] || `Filial ${fId}`,
          quantidadeTotal: 0,
          itens: [],
          status: 'ESGOTADO',
          ultima_movimentacao: null
        };
      }
      mapa[fId].quantidadeTotal += item.quantidade;
      mapa[fId].itens.push(item);

      if (!mapa[fId].ultima_movimentacao && (item.updated_at || item.created_at)) {
        mapa[fId].ultima_movimentacao = item.updated_at || item.created_at || null;
      }
    });

    // Para qualquer filial que ainda não possua nenhum item/variação cadastrada,
    // injeta uma linha com saldo 0 para permitir adição direta com [ - ] [ 0 ] [ + ]
    Object.values(mapa).forEach(filialObj => {
      if (filialObj.itens.length === 0) {
        const itemZerado: ItemProdutoDetalhado = {
          id: `temp_${filialObj.filial_id}_${encodeURIComponent(corAtual || 'Padrão')}`,
          nome: produtoNome,
          filial_id: filialObj.filial_id,
          filial_nome: filialObj.filial_nome,
          categoria: categoria,
          cor: (corAtual || 'Padrão').trim(),
          preco: precoBaseVenda,
          preco_venda: precoBaseVenda,
          preco_custo: precoBaseCusto,
          quantidade: 0,
          imeis: [],
          isSynthetic: true
        };
        filialObj.itens.push(itemZerado);
      }
    });

    return Object.values(mapa).map(f => {
      let statusCalc: 'EM_ESTOQUE' | 'ESTOQUE_BAIXO' | 'ESGOTADO' = 'ESGOTADO';
      if (f.quantidadeTotal > 3) statusCalc = 'EM_ESTOQUE';
      else if (f.quantidadeTotal > 0) statusCalc = 'ESTOQUE_BAIXO';

      return {
        ...f,
        status: statusCalc
      };
    }).sort((a, b) => b.quantidadeTotal - a.quantidadeTotal);
  }, [filiais, produtosIrmaos, mapaFiliaisNome, produtoNome, categoria, corAtual, precoBaseVenda, propFilialId]);

  // Agrupamento por Variações de Cor
  const variacoesCores = useMemo(() => {
    const mapa: { [cor: string]: VariacaoCorItem } = {};

    produtosIrmaos.forEach(item => {
      const corNome = (item.cor || 'Padrão').trim();
      if (!mapa[corNome]) {
        mapa[corNome] = {
          cor: corNome,
          quantidadeTotal: 0,
          itens: [],
          filiaisMap: {}
        };
      }
      mapa[corNome].quantidadeTotal += item.quantidade;
      mapa[corNome].itens.push(item);
      mapa[corNome].filiaisMap[item.filial_nome] = (mapa[corNome].filiaisMap[item.filial_nome] || 0) + item.quantidade;
    });

    return Object.values(mapa).sort((a, b) => b.quantidadeTotal - a.quantidadeTotal);
  }, [produtosIrmaos]);

  // 0. AÇÃO: Salvar Nome do Produto no Cabeçalho
  const salvarNomeGeral = async () => {
    const novoNomeLimpo = String(nomeEditado).trim();
    if (!novoNomeLimpo) {
      setNomeEditado(produtoNomeBase);
      setEditandoNomeGeral(false);
      return;
    }

    if (novoNomeLimpo === produtoNomeBase) {
      setEditandoNomeGeral(false);
      return;
    }

    setSalvandoNomeGeral(true);
    try {
      if (onUpdateProdutoField) {
        await onUpdateProdutoField(produtoId, produtoNomeBase, 'nome', novoNomeLimpo, produto?.filial_id);
      } else {
        const targetEmpresaId = produto?.empresa_id || null;
        let teveSucesso = false;

        // 1. Atualizar produto físico por ID direto se válido
        const idValido = produto?.id || produtoId;
        if (idValido && !String(idValido).startsWith('synth_') && !String(idValido).startsWith('temp_') && idValido !== '-') {
          const { error: errProdId } = await supabase.from('produtos').update({ nome: novoNomeLimpo }).eq('id', idValido);
          if (!errProdId) teveSucesso = true;
          else console.warn('[salvarNomeGeral] Erro ao atualizar por ID direto em produtos:', errProdId);
        }

        // 2. Atualizar todos os produtos físicos com o nome antigo na mesma empresa
        let qProds = supabase.from('produtos').update({ nome: novoNomeLimpo }).ilike('nome', produtoNomeBase.trim());
        if (targetEmpresaId) qProds = qProds.eq('empresa_id', targetEmpresaId);
        const { error: errProdsNome } = await qProds;
        if (!errProdsNome) teveSucesso = true;

        // 3. Atualizar produtos_catalogo por nome
        let qCat = supabase.from('produtos_catalogo').update({ nome: novoNomeLimpo }).ilike('nome', produtoNomeBase.trim());
        if (targetEmpresaId) qCat = qCat.eq('empresa_id', targetEmpresaId);
        const { error: errCatNome } = await qCat;
        if (!errCatNome) teveSucesso = true;

        // 4. Se o produto possuir catalogo_id ou produto_catalogo_id, atualiza diretamente por ID:
        const catId = produto?.produto_catalogo_id || produto?.catalogo_id || null;
        if (catId) {
          const { error: errCatId } = await supabase.from('produtos_catalogo').update({ nome: novoNomeLimpo }).eq('id', catId);
          if (!errCatId) teveSucesso = true;
        }

        if (!teveSucesso && errProdsNome) {
          throw errProdsNome;
        }
      }

      // 5. Atualiza o estado local imediatamente para refletir na interface
      setNomeEditado(novoNomeLimpo);
      setProdutosIrmaos(prev => prev.map(p => ({ ...p, nome: novoNomeLimpo })));
      if (produto) {
        produto.nome = novoNomeLimpo;
        produto.produto_nome = novoNomeLimpo;
      }
      setEditandoNomeGeral(false);
      showModalToast('Nome do produto atualizado com sucesso!', 'success');

      // 6. Notifica componente pai e invalida as queries da listagem
      dispararAtualizacao();
    } catch (err: any) {
      console.error('[ModalDetalheEstoqueProduto] Erro ao salvar nome do produto:', err);
      showModalToast('Erro ao salvar nome: ' + (err?.message || 'Falha no banco'), 'error');
    } finally {
      setSalvandoNomeGeral(false);
    }
  };

  // 1. AÇÃO: Salvar Preço Geral do Cabeçalho
  const salvarPrecoGeral = async () => {
    const novoValor = parsePrecoToNumeric(valorPrecoGeral);
    if (isNaN(novoValor) || novoValor < 0) {
      showModalToast('Informe um preço numérico válido maior ou igual a zero.', 'error');
      setEditandoPrecoGeral(false);
      return;
    }

    setSalvandoPrecoGeral(true);
    try {
      if (onUpdateProdutoField) {
        await onUpdateProdutoField(produtoId, produtoNome, 'preco', novoValor, produto?.filial_id);
      } else {
        const targetEmpresaId = produto?.empresa_id || null;

        // 1. Atualizar por ID direto na tabela produtos se ID válido
        if (produtoId && !String(produtoId).startsWith('synth_') && !String(produtoId).startsWith('temp_') && produtoId !== '-') {
          let { error: errId } = await supabase
            .from('produtos')
            .update({ preco: novoValor, preco_venda: novoValor })
            .eq('id', produtoId);

          if (errId && (errId.message?.includes('preco_venda') || (errId as any)?.details?.includes('preco_venda'))) {
            await supabase.from('produtos').update({ preco: novoValor }).eq('id', produtoId);
          }
        }

        // 2. Atualizar em massa todas as instâncias do produto com este nome
        let qProds = supabase
          .from('produtos')
          .update({ preco: novoValor, preco_venda: novoValor })
          .ilike('nome', produtoNome.trim());
        if (targetEmpresaId) qProds = qProds.eq('empresa_id', targetEmpresaId);

        let { error: updErr } = await qProds;
        if (updErr && (updErr.message?.includes('preco_venda') || (updErr as any)?.details?.includes('preco_venda'))) {
          let qRetry = supabase
            .from('produtos')
            .update({ preco: novoValor })
            .ilike('nome', produtoNome.trim());
          if (targetEmpresaId) qRetry = qRetry.eq('empresa_id', targetEmpresaId);
          await qRetry;
        }

        // 3. Atualizar também na tabela produtos_catalogo por nome
        try {
          let queryCat = supabase
            .from('produtos_catalogo')
            .update({ preco: novoValor, preco_venda: novoValor })
            .ilike('nome', produtoNome.trim());
          if (targetEmpresaId) queryCat = queryCat.eq('empresa_id', targetEmpresaId);
          await queryCat;
        } catch (eCat) {
          try {
            let fallbackCat = supabase
              .from('produtos_catalogo')
              .update({ preco: novoValor })
              .ilike('nome', produtoNome.trim());
            if (targetEmpresaId) fallbackCat = fallbackCat.eq('empresa_id', targetEmpresaId);
            await fallbackCat;
          } catch (_) { }
        }

        // 4. Se tiver produto_catalogo_id ou catalogo_id, atualiza diretamente por ID
        const catIdDirect = produto?.produto_catalogo_id || produto?.catalogo_id || null;
        if (catIdDirect) {
          try {
            let qCatId = supabase
              .from('produtos_catalogo')
              .update({ preco: novoValor, preco_venda: novoValor })
              .eq('id', catIdDirect);
            await qCatId;
          } catch (_) {
            try {
              await supabase.from('produtos_catalogo').update({ preco: novoValor }).eq('id', catIdDirect);
            } catch (_) { }
          }
        }
      }

      // Atualiza objeto produto recebido nas props para reflexão imediata
      if (produto) {
        produto.preco = novoValor;
        produto.preco_venda = novoValor;
      }

      // Atualiza estado local de todos os itens do produto
      setProdutosIrmaos(prev => prev.map(p => ({ ...p, preco: novoValor, preco_venda: novoValor })));
      setEditandoPrecoGeral(false);
      showModalToast('Preço de venda atualizado com sucesso!', 'success');
      dispararAtualizacao();
    } catch (err: any) {
      console.error('[ModalDetalheEstoqueProduto] Erro ao salvar preço geral:', err);
      showModalToast(`Erro ao salvar preço: ${err?.message || 'Falha ao atualizar'}`, 'error');
    } finally {
      setSalvandoPrecoGeral(false);
    }
  };

  // Função auxiliar para inserir ou atualizar estoque de uma filial no Supabase
  const persistirEstoqueFilial = async (
    item: ItemProdutoDetalhado,
    novosValores: { quantidade?: number; preco?: number; preco_custo?: number; cor?: string }
  ): Promise<ItemProdutoDetalhado> => {
    const fIdReal = item.filial_id;
    if (!fIdReal || fIdReal === 'sem_filial') {
      throw new Error('Não é possível salvar estoque com filial inválida.');
    }

    const filialIdNumerico = isNaN(Number(fIdReal)) ? fIdReal : Number(fIdReal);
    const empresaIdReal = produto?.empresa_id || null;
    const catIdReal = produto?.produto_catalogo_id || produto?.catalogo_id || null;
    const codBarrasReal = produto?.codigo_barras || null;

    const qtdFinal = novosValores.quantidade !== undefined ? novosValores.quantidade : item.quantidade;
    const precoFinal = novosValores.preco !== undefined ? novosValores.preco : (item.preco_venda || item.preco || precoBaseVenda);
    const precoCustoFinal = novosValores.preco_custo !== undefined ? novosValores.preco_custo : Number(item.preco_custo !== undefined ? item.preco_custo : precoBaseCusto);
    const corFinal = (novosValores.cor !== undefined ? novosValores.cor : (item.cor || corAtual || 'Padrão')).trim();
    const nomeFinal = item.nome || produtoNome;
    const categoriaFinal = item.categoria || categoria;

    // 1. Tentar localizar o registro no banco por ID direto ou por chave de unicidade lógica (filial_id + nome + cor)
    let idAlvo = (!item.isSynthetic && !String(item.id).startsWith('temp_')) ? item.id : null;

    let queryCheck = supabase
      .from('produtos')
      .select('id, quantidade, preco, preco_venda, preco_custo, cor, filial_id')
      .eq('filial_id', filialIdNumerico)
      .ilike('nome', nomeFinal.trim());

    if (corFinal) {
      queryCheck = queryCheck.ilike('cor', corFinal);
    }

    const { data: existentes } = await queryCheck;
    const listaExistentes = existentes || [];
    const existente = listaExistentes.length > 0 ? listaExistentes[0] : null;

    if (existente && existente.id) {
      idAlvo = existente.id;
      // Se houver mais de um registro duplicado antigo no banco para a mesma filial e cor,
      // atualiza o principal e limpa/desativa as duplicatas extras para evitar somas fantasmas futuras
      if (listaExistentes.length > 1) {
        const idsDuplicadosExtras = listaExistentes.slice(1).map(d => d.id);
        try {
          await supabase.from('produtos').delete().in('id', idsDuplicadosExtras);
        } catch (delErr) {
          console.warn('[persistirEstoqueFilial] Aviso ao limpar duplicatas extras:', delErr);
        }
      }
    }

    let idSalvo = idAlvo;

    if (idAlvo) {
      // Registro real existente (UPSERT lógico -> UPDATE direto no ID único)
      const payloadUpdate: any = {};
      if (novosValores.quantidade !== undefined) payloadUpdate.quantidade = novosValores.quantidade;
      if (novosValores.preco !== undefined) {
        payloadUpdate.preco = novosValores.preco;
        payloadUpdate.preco_venda = novosValores.preco;
      }
      if (novosValores.preco_custo !== undefined) {
        payloadUpdate.preco_custo = novosValores.preco_custo;
      }
      if (novosValores.cor !== undefined) payloadUpdate.cor = novosValores.cor;

      let { error: updErr } = await supabase
        .from('produtos')
        .update(payloadUpdate)
        .eq('id', idAlvo);

      // Fallback caso preco_venda não exista na tabela produtos
      if (updErr && (updErr.message?.includes('preco_venda') || (updErr as any)?.details?.includes('preco_venda'))) {
        const payloadSemPrecoVenda = { ...payloadUpdate };
        delete payloadSemPrecoVenda.preco_venda;
        const { error: retryErr } = await supabase
          .from('produtos')
          .update(payloadSemPrecoVenda)
          .eq('id', idAlvo);
        updErr = retryErr;
      }

      if (updErr) throw updErr;
    } else {
      // Não existe no banco: INSERT do registro com filial e variação definidas
      const payloadInsert: any = {
        nome: nomeFinal,
        filial_id: filialIdNumerico,
        quantidade: qtdFinal,
        preco: precoFinal,
        preco_venda: precoFinal,
        preco_custo: precoCustoFinal,
        cor: corFinal,
        categoria: categoriaFinal,
        status: 'ATIVO'
      };

      if (empresaIdReal) payloadInsert.empresa_id = empresaIdReal;
      if (catIdReal) payloadInsert.produto_catalogo_id = catIdReal;
      if (codBarrasReal) payloadInsert.codigo_barras = codBarrasReal;

      const { data: inserted, error: insErr } = await supabase
        .from('produtos')
        .insert(payloadInsert)
        .select()
        .single();

      if (insErr) {
        console.warn('[ModalDetalheEstoqueProduto] Tentando insert de fallback simplificado:', insErr);
        const fallbackPayload: any = {
          nome: nomeFinal,
          filial_id: filialIdNumerico,
          quantidade: qtdFinal,
          preco: precoFinal,
          preco_venda: precoFinal,
          preco_custo: precoCustoFinal,
          cor: corFinal,
          categoria: categoriaFinal
        };
        if (empresaIdReal) fallbackPayload.empresa_id = empresaIdReal;

        const { data: insFallback, error: insFbErr } = await supabase
          .from('produtos')
          .insert(fallbackPayload)
          .select()
          .single();

        if (insFbErr) throw insFbErr;
        idSalvo = insFallback.id;
      } else {
        idSalvo = inserted.id;
      }
    }

    // Registrar log em estoque_movimentacoes caso tenha havido alteração na quantidade
    if (novosValores.quantidade !== undefined && empresaIdReal) {
      try {
        const delta = qtdFinal - (item.quantidade || 0);
        const tipoMov = delta >= 0 ? 'AJUSTE_ENTRADA' : 'AJUSTE_SAIDA';
        const payloadMov: any = {
          empresa_id: empresaIdReal,
          produto_id: idSalvo,
          tipo_movimentacao: tipoMov,
          quantidade: Math.abs(delta) || 1,
          filial_origem_id: filialIdNumerico,
          observacao: `Ajuste manual de estoque via painel: de ${item.quantidade || 0} para ${qtdFinal} un`
        };
        await supabase.from('estoque_movimentacoes').insert(payloadMov);
      } catch (movErr) {
        console.warn('[ModalDetalheEstoqueProduto] Aviso ao registrar movimentação de estoque:', movErr);
      }
    }

    return {
      ...item,
      id: String(idSalvo),
      filial_id: String(filialIdNumerico),
      quantidade: qtdFinal,
      preco: precoFinal,
      preco_venda: precoFinal,
      preco_custo: precoCustoFinal,
      cor: corFinal,
      isSynthetic: false
    };
  };

  // 2. AÇÃO: Salvar Edição Inline de Item (Preço, Cor ou Quantidade)
  const salvarEdicaoInline = async (item: ItemProdutoDetalhado) => {
    if (!campoEditando || salvandoInline) return;
    setSalvandoInline(true);

    try {
      if (campoEditando === 'preco') {
        const novoValor = parsePrecoToNumeric(valorEditando);
        if (!isNaN(novoValor) && novoValor >= 0) {
          const itemAtualizado = await persistirEstoqueFilial(item, { preco: novoValor });

          // Sincroniza também produtos_catalogo com o novo preço
          const targetEmpresaId = produto?.empresa_id || null;
          try {
            let qCat = supabase
              .from('produtos_catalogo')
              .update({ preco: novoValor, preco_venda: novoValor })
              .ilike('nome', produtoNome.trim());
            if (targetEmpresaId) qCat = qCat.eq('empresa_id', targetEmpresaId);
            await qCat;
          } catch (eCat) {
            try {
              let fCat = supabase
                .from('produtos_catalogo')
                .update({ preco: novoValor })
                .ilike('nome', produtoNome.trim());
              if (targetEmpresaId) fCat = fCat.eq('empresa_id', targetEmpresaId);
              await fCat;
            } catch (_) { }
          }

          const catIdDirect = produto?.produto_catalogo_id || produto?.catalogo_id || null;
          if (catIdDirect) {
            try {
              await supabase
                .from('produtos_catalogo')
                .update({ preco: novoValor, preco_venda: novoValor })
                .eq('id', catIdDirect);
            } catch (_) {
              try {
                await supabase.from('produtos_catalogo').update({ preco: novoValor }).eq('id', catIdDirect);
              } catch (_) { }
            }
          }

          if (produto) {
            produto.preco = novoValor;
            produto.preco_venda = novoValor;
          }

          setProdutosIrmaos(prev => {
            const existe = prev.some(p => p.id === item.id);
            if (!existe) return [...prev, itemAtualizado];
            return prev.map(p => (p.id === item.id ? itemAtualizado : p));
          });
          showModalToast('Preço unitário atualizado com sucesso!', 'success');
        } else {
          showModalToast('Informe um preço unitário numérico válido.', 'error');
        }
      } else if (campoEditando === 'preco_custo') {
        const novoValor = parsePrecoToNumeric(valorEditando);
        if (!isNaN(novoValor) && novoValor >= 0) {
          const itemAtualizado = await persistirEstoqueFilial(item, { preco_custo: novoValor });
          setProdutosIrmaos(prev => {
            const existe = prev.some(p => p.id === item.id);
            if (!existe) return [...prev, itemAtualizado];
            return prev.map(p => (p.id === item.id ? itemAtualizado : p));
          });
          showModalToast('Preço de custo atualizado com sucesso!', 'success');
        } else {
          showModalToast('Informe um preço de custo numérico válido.', 'error');
        }
      } else if (campoEditando === 'cor') {
        const novaCor = String(valorEditando).trim();
        if (novaCor) {
          const itemAtualizado = await persistirEstoqueFilial(item, { cor: novaCor });
          setProdutosIrmaos(prev => {
            const existe = prev.some(p => p.id === item.id);
            if (!existe) return [...prev, itemAtualizado];
            return prev.map(p => (p.id === item.id ? itemAtualizado : p));
          });
          showModalToast('Cor atualizada com sucesso!', 'success');
        }
      } else if (campoEditando === 'quantidade') {
        const novaQtd = parseInt(valorEditando, 10);
        if (!isNaN(novaQtd) && novaQtd >= 0) {
          const itemAtualizado = await persistirEstoqueFilial(item, { quantidade: novaQtd });
          setProdutosIrmaos(prev => {
            const existe = prev.some(p => p.id === item.id);
            if (!existe) return [...prev, itemAtualizado];
            return prev.map(p => (p.id === item.id ? itemAtualizado : p));
          });
          showModalToast('Quantidade atualizada com sucesso!', 'success');
        }
      }

      setItemEditandoId(null);
      setCampoEditando(null);
      setValorEditando('');
      dispararAtualizacao();
    } catch (err: any) {
      console.error('[ModalDetalheEstoqueProduto] Erro ao salvar edição inline:', err);
      showModalToast(`Erro ao salvar: ${err?.message || 'Falha na gravação'}`, 'error');
    } finally {
      setSalvandoInline(false);
    }
  };

  // 3. AÇÃO: Alterar Quantidade Rápida (+1 ou -1) - Bloqueado se ehCelularOuSerial
  const ajustarQuantidadeRapida = async (item: ItemProdutoDetalhado, delta: number) => {
    if (ehCelularOuSerial) return;
    const novaQtd = Math.max(0, item.quantidade + delta);
    try {
      const itemAtualizado = await persistirEstoqueFilial(item, { quantidade: novaQtd });
      setProdutosIrmaos(prev => {
        const existe = prev.some(p => p.id === item.id);
        if (!existe) return [...prev, itemAtualizado];
        return prev.map(p => (p.id === item.id ? itemAtualizado : p));
      });
      dispararAtualizacao();
    } catch (err) {
      console.error('[ModalDetalheEstoqueProduto] Erro ao ajustar quantidade rápida:', err);
    }
  };

  // 3.1 AÇÃO: Adicionar Novo IMEI a um Item/Filial (Entrada de serial individual)
  const handleAdicionarImei = async () => {
    if (!itemParaAdicionarImei) return;
    const imeiLimpo = novoImeiInput.trim();
    if (!imeiLimpo) {
      setErroNovoImei('Informe o número do serial/IMEI');
      return;
    }

    setSalvandoNovoImei(true);
    setErroNovoImei(null);
    try {
      let targetItem = itemParaAdicionarImei;
      // Se for item sintético, persistir primeiro o registro real na tabela produtos
      if (targetItem.isSynthetic || String(targetItem.id).startsWith('temp_')) {
        targetItem = await persistirEstoqueFilial(targetItem, { quantidade: 0 });
      }

      // 1. Inserir na tabela 'imeis'
      const { data: novoImeiDb, error: insertError } = await supabase
        .from('imeis')
        .insert({
          imei: imeiLimpo,
          produto_id: targetItem.id,
          filial_id: targetItem.filial_id && targetItem.filial_id !== 'sem_filial' ? targetItem.filial_id : null,
          cor: targetItem.cor || 'Padrão',
          status: 'DISPONÍVEL',
          vendido: false
        })
        .select()
        .single();

      if (insertError) {
        if (insertError.message?.includes('unique') || insertError.code === '23505') {
          setErroNovoImei('Este IMEI/Serial já se encontra cadastrado no sistema!');
        } else {
          setErroNovoImei(insertError.message || 'Erro ao registrar IMEI');
        }
        setSalvandoNovoImei(false);
        return;
      }

      // 2. Incrementar a quantidade do produto para refletir o total de seriais
      const novaQtd = targetItem.imeis.length + 1;
      await supabase
        .from('produtos')
        .update({ quantidade: novaQtd })
        .eq('id', targetItem.id);

      // 3. Atualizar estado local
      setProdutosIrmaos(prev => {
        const existe = prev.some(p => p.id === targetItem.id);
        if (!existe) {
          return [
            ...prev.filter(p => p.id !== itemParaAdicionarImei.id),
            {
              ...targetItem,
              quantidade: novaQtd,
              imeis: [...targetItem.imeis, imeiLimpo]
            }
          ];
        }
        return prev.map(p => {
          if (p.id === targetItem.id) {
            return {
              ...p,
              quantidade: novaQtd,
              imeis: [...p.imeis, imeiLimpo]
            };
          }
          return p;
        });
      });

      setNovoImeiInput('');
      setItemParaAdicionarImei(null);
      dispararAtualizacao();
    } catch (err: any) {
      console.error('[ModalDetalheEstoqueProduto] Erro ao cadastrar novo IMEI:', err);
      setErroNovoImei(err?.message || 'Erro inesperado ao cadastrar IMEI.');
    } finally {
      setSalvandoNovoImei(false);
    }
  };

  // 4. AÇÃO: Excluir Registro / Unidade de Produto
  const confirmarExcluirItem = async () => {
    if (!itemParaExcluir) return;
    const item = itemParaExcluir;

    // Se for item sintético (ainda não salvo no banco), apenas fecha o diálogo
    if (item.isSynthetic || String(item.id).startsWith('temp_')) {
      setItemParaExcluir(null);
      return;
    }

    setExcluindoId(item.id);

    try {
      if (onDeleteProduto) {
        await onDeleteProduto(item);
      } else {
        await supabase.from('produtos').delete().eq('id', item.id);
      }

      setProdutosIrmaos(prev => prev.filter(p => p.id !== item.id));
      setItemParaExcluir(null);
      dispararAtualizacao();
    } catch (err) {
      console.error('[ModalDetalheEstoqueProduto] Erro ao excluir item:', err);
    } finally {
      setExcluindoId(null);
    }
  };

  if (!isOpen || !produto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-[#121214] border border-[#27272a] rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scaleUp text-left"
        onClick={e => e.stopPropagation()}
      >
        {/* CABEÇALHO DO MODAL */}
        <div className="p-5 border-b border-[#27272a] bg-gradient-to-r from-[#18181b] via-[#121214] to-[#18181b] flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-purple-950/50 border border-purple-800/40 flex items-center justify-center text-purple-400 shrink-0 mt-0.5">
              {isCelular ? <Smartphone size={20} /> : <Package size={20} />}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono font-bold text-gray-500 uppercase tracking-wider">
                  ID: {produtoId}
                </span>
                {filialNomeProdutoOrigem && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-cyan-950/40 text-cyan-300 border border-cyan-800/50">
                    <Store size={10} />
                    {filialNomeProdutoOrigem}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-[#6A0DAD]/20 text-purple-300 border border-[#6A0DAD]/40">
                  <Tag size={10} />
                  {categoria}
                </span>
                {produto?.codigo_barras && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono text-[10px] border border-zinc-700">
                    <Barcode size={10} />
                    {produto.codigo_barras}
                  </span>
                )}
              </div>

              {/* Título Principal com Edição Inline de Nome */}
              {editandoNomeGeral ? (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <input
                    type="text"
                    autoFocus
                    value={nomeEditado}
                    onChange={e => setNomeEditado(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') salvarNomeGeral();
                      if (e.key === 'Escape') {
                        setNomeEditado(produtoNomeBase);
                        setEditandoNomeGeral(false);
                      }
                    }}
                    placeholder="Nome do produto..."
                    className="w-full sm:w-80 bg-black border border-purple-500 rounded px-2.5 py-1 text-sm text-white outline-none font-bold"
                  />
                  <button
                    type="button"
                    onClick={salvarNomeGeral}
                    disabled={salvandoNomeGeral}
                    className="p-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer transition-colors"
                    title="Salvar Novo Nome"
                  >
                    {salvandoNomeGeral ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNomeEditado(produtoNomeBase);
                      setEditandoNomeGeral(false);
                    }}
                    className="p-1.5 rounded bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer transition-colors"
                    title="Cancelar Edição"
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-1">
                  <h2 className="text-base sm:text-lg font-bold text-white truncate" title={produtoNome}>
                    {produtoNome}
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setNomeEditado(produtoNome);
                      setEditandoNomeGeral(true);
                    }}
                    className="text-zinc-500 hover:text-purple-400 p-0.5 rounded transition-colors cursor-pointer"
                    title="Editar Nome do Produto"
                  >
                    <Edit2 size={13} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Fechar Modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* CARDS COM MÉTRICAS EM DESTAQUE */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 bg-[#141417] border-b border-[#222]">
          {/* Card 1: Preço de Venda com Edição Inline */}
          <div className="bg-[#1a1a1e] border border-[#27272a] rounded-xl p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                <DollarSign size={11} /> Preço de Venda
              </span>
              {!editandoPrecoGeral && (
                <button
                  type="button"
                  onClick={() => {
                    setValorPrecoGeral(String(precoExibicaoCabecalho));
                    setEditandoPrecoGeral(true);
                  }}
                  className="text-zinc-500 hover:text-emerald-400 p-0.5 rounded transition-colors cursor-pointer"
                  title="Editar Preço Geral"
                >
                  <Edit2 size={12} />
                </button>
              )}
            </div>

            {editandoPrecoGeral ? (
              <div className="flex items-center gap-1.5 mt-1.5">
                <input
                  type="text"
                  autoFocus
                  value={valorPrecoGeral}
                  onChange={e => setValorPrecoGeral(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') salvarPrecoGeral();
                    if (e.key === 'Escape') setEditandoPrecoGeral(false);
                  }}
                  placeholder="0,00"
                  className="w-full bg-black border border-emerald-500 rounded px-2 py-0.5 text-xs text-white outline-none font-mono"
                />
                <button
                  type="button"
                  onClick={salvarPrecoGeral}
                  disabled={salvandoPrecoGeral}
                  className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer"
                  title="Salvar Novo Preço"
                >
                  {salvandoPrecoGeral ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                </button>
                <button
                  type="button"
                  onClick={() => setEditandoPrecoGeral(false)}
                  className="p-1 rounded bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
                  title="Cancelar"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <span className="text-base sm:text-lg font-extrabold font-mono text-emerald-400 mt-1 block">
                {formatCurrency(precoExibicaoCabecalho)}
              </span>
            )}
          </div>

          {/* Card 2: Preço de Custo */}
          <div className="bg-[#1a1a1e] border border-[#27272a] rounded-xl p-3 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <DollarSign size={11} /> Preço de Custo
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-base sm:text-lg font-extrabold font-mono text-amber-400">
                {formatCurrency(precoCustoExibicaoCabecalho)}
              </span>
            </div>
          </div>

          {/* Card 3: Estoque Total Rede (Soma de todas as variações e filiais) */}
          <div className="bg-[#1a1a1e] border border-[#27272a] rounded-xl p-3">
            <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
              Total em Rede
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-base sm:text-lg font-extrabold font-mono text-cyan-400">
                {totalGeral}
              </span>
              <span className="text-[11px] text-zinc-400 font-medium">unidades</span>
            </div>
          </div>

          {/* Card 4: Variações de Cores */}
          <div className="bg-[#1a1a1e] border border-[#27272a] rounded-xl p-3">
            <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1">
              <Palette size={11} /> Cores Cadastradas
            </span>
            <span className="text-xs sm:text-sm font-bold text-white mt-1 block truncate">
              {variacoesCores.length > 0 ? `${variacoesCores.length} variação(ões)` : corAtual}
            </span>
          </div>

          {/* Card 5: Filiais com Estoque */}
          <div className="bg-[#1a1a1e] border border-[#27272a] rounded-xl p-3">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
              <Store size={11} /> Lojas Abastecidas
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-base sm:text-lg font-extrabold font-mono text-white">
                {estoqueFiliais.filter(f => f.quantidadeTotal > 0).length}
              </span>
              <span className="text-[11px] text-zinc-500 font-medium">de {estoqueFiliais.length}</span>
            </div>
          </div>
        </div>

        {/* ABAS / SELEÇÃO DE VISUALIZAÇÃO */}
        <div className="px-5 pt-3 pb-0 flex items-center gap-2 border-b border-[#222] bg-[#121214]">
          <button
            type="button"
            onClick={() => setAbaAtiva('filiais')}
            className={`px-3 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${abaAtiva === 'filiais'
              ? 'border-[#6A0DAD] text-purple-300'
              : 'border-transparent text-zinc-400 hover:text-white'
              }`}
          >
            <Store size={14} />
            Estoque por Loja / Filial ({estoqueFiliais.length} {estoqueFiliais.length === 1 ? 'filial' : 'filiais'})
          </button>
          <button
            type="button"
            onClick={() => setAbaAtiva('variacoes')}
            className={`px-3 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${abaAtiva === 'variacoes'
              ? 'border-[#6A0DAD] text-purple-300'
              : 'border-transparent text-zinc-400 hover:text-white'
              }`}
          >
            <Layers size={14} />
            Variações de Cores ({variacoesCores.length})
          </button>
        </div>

        {/* CONTEÚDO PRINCIPAL COM LISTAGEM E AÇÕES INLINE */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-zinc-500">
              <Loader2 className="animate-spin text-purple-500" size={28} />
              <span className="text-xs font-medium">Consultando distribuição de estoque na rede...</span>
            </div>
          ) : abaAtiva === 'filiais' ? (
            <div className="space-y-4">
              {estoqueFiliais.map(filial => {
                const temItens = filial.itens.length > 0;
                return (
                  <div key={filial.filial_id} className="border border-[#27272a] rounded-xl overflow-hidden bg-black/40">
                    {/* Cabeçalho da Filial */}
                    <div className="p-3 bg-[#18181b] border-b border-[#27272a] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Store size={15} className={filial.quantidadeTotal > 0 ? 'text-purple-400' : 'text-zinc-600'} />
                        <span className="font-bold text-white text-xs sm:text-sm">{filial.filial_nome}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${filial.quantidadeTotal > 0
                          ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40'
                          : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
                          }`}>
                          {filial.quantidadeTotal > 0 ? 'Em Estoque' : 'Esgotado'}
                        </span>
                      </div>
                      <span className="font-mono text-xs font-bold text-cyan-400">
                        Total Filial: {filial.quantidadeTotal} unids
                      </span>
                    </div>

                    {/* Tabela de Itens/Variações desta Filial */}
                    {!temItens ? (
                      <div className="p-4 text-center text-xs text-zinc-600 italic">
                        Nenhum saldo ou variação cadastrada para esta filial.
                      </div>
                    ) : (
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-[#222] text-zinc-500 uppercase text-[10px] tracking-wider bg-black/30">
                            <th className="py-2.5 px-3">Cor / Variação</th>
                            <th className="py-2.5 px-3">Preço Unitário</th>
                            <th className="py-2.5 px-3">Preço de Custo</th>
                            <th className="py-2.5 px-3 text-center">Quantidade</th>
                            {ehCelular && <th className="py-2.5 px-3">IMEIs / Seriais</th>}
                            <th className="py-2.5 px-3 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1e1e24]">
                          {filial.itens.map(item => {
                            const isEditandoCor = itemEditandoId === item.id && campoEditando === 'cor';
                            const isEditandoPreco = itemEditandoId === item.id && campoEditando === 'preco';
                            const isEditandoPrecoCusto = itemEditandoId === item.id && campoEditando === 'preco_custo';
                            const isEditandoQtd = itemEditandoId === item.id && campoEditando === 'quantidade';

                            return (
                              <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors">
                                {/* Cor com Edição Inline */}
                                <td className="py-2.5 px-3 align-middle">
                                  {isEditandoCor ? (
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="text"
                                        autoFocus
                                        value={valorEditando}
                                        onChange={e => setValorEditando(e.target.value)}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') salvarEdicaoInline(item);
                                          if (e.key === 'Escape') setItemEditandoId(null);
                                        }}
                                        className="w-24 bg-black border border-purple-500 rounded px-1.5 py-0.5 text-xs text-white"
                                      />
                                      <button type="button" onClick={() => salvarEdicaoInline(item)} className="text-emerald-400 hover:text-emerald-300">
                                        <Check size={12} />
                                      </button>
                                      <button type="button" onClick={() => setItemEditandoId(null)} className="text-zinc-500 hover:text-white">
                                        <X size={12} />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5">
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-zinc-800 border border-zinc-700 text-zinc-200">
                                        <Palette size={11} className="text-purple-400" />
                                        {item.cor}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setItemEditandoId(item.id);
                                          setCampoEditando('cor');
                                          setValorEditando(item.cor);
                                        }}
                                        className="text-zinc-600 hover:text-purple-400 transition-colors p-0.5"
                                        title="Editar Cor"
                                      >
                                        <Edit2 size={11} />
                                      </button>
                                    </div>
                                  )}
                                </td>

                                {/* Preço Unitário com Edição Inline */}
                                <td className="py-2.5 px-3 font-mono font-bold align-middle">
                                  {isEditandoPreco ? (
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="text"
                                        autoFocus
                                        value={valorEditando}
                                        onChange={e => setValorEditando(e.target.value)}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') salvarEdicaoInline(item);
                                          if (e.key === 'Escape') setItemEditandoId(null);
                                        }}
                                        className="w-20 bg-black border border-emerald-500 rounded px-1.5 py-0.5 text-xs text-white font-mono"
                                      />
                                      <button type="button" onClick={() => salvarEdicaoInline(item)} className="text-emerald-400 hover:text-emerald-300">
                                        <Check size={12} />
                                      </button>
                                      <button type="button" onClick={() => setItemEditandoId(null)} className="text-zinc-500 hover:text-white">
                                        <X size={12} />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5 text-emerald-400">
                                      <span>{formatCurrency(item.preco_venda || item.preco)}</span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setItemEditandoId(item.id);
                                          setCampoEditando('preco');
                                          setValorEditando(String(item.preco_venda || item.preco));
                                        }}
                                        className="text-zinc-600 hover:text-emerald-400 transition-colors p-0.5"
                                        title="Editar Preço Deste Item"
                                      >
                                        <Edit2 size={11} />
                                      </button>
                                    </div>
                                  )}
                                </td>

                                {/* Preço de Custo com Edição Inline */}
                                <td className="py-2.5 px-3 font-mono font-bold align-middle">
                                  {isEditandoPrecoCusto ? (
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="text"
                                        autoFocus
                                        value={valorEditando}
                                        onChange={e => setValorEditando(e.target.value)}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') salvarEdicaoInline(item);
                                          if (e.key === 'Escape') setItemEditandoId(null);
                                        }}
                                        className="w-20 bg-black border border-amber-500 rounded px-1.5 py-0.5 text-xs text-white font-mono"
                                      />
                                      <button type="button" onClick={() => salvarEdicaoInline(item)} className="text-emerald-400 hover:text-emerald-300">
                                        <Check size={12} />
                                      </button>
                                      <button type="button" onClick={() => setItemEditandoId(null)} className="text-zinc-500 hover:text-white">
                                        <X size={12} />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5 text-amber-400">
                                      <span>{formatCurrency(item.preco_custo || 0)}</span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setItemEditandoId(item.id);
                                          setCampoEditando('preco_custo');
                                          setValorEditando(String(item.preco_custo || 0));
                                        }}
                                        className="text-zinc-600 hover:text-amber-400 transition-colors p-0.5"
                                        title="Editar Preço de Custo Deste Item"
                                      >
                                        <Edit2 size={11} />
                                      </button>
                                    </div>
                                  )}
                                </td>

                                {/* Quantidade: Bloqueada para celular (estritamente seriais) / manual para acessórios */}
                                <td className="py-2.5 px-3 text-center align-middle">
                                  {ehCelularOuSerial ? (
                                    <div className="flex flex-col items-center justify-center">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-semibold text-zinc-100 font-mono text-xs">{item.imeis.length} unids</span>
                                        <span className="text-[10px] text-purple-300 font-medium bg-purple-950/40 border border-purple-800/40 px-1 rounded">(Via IMEI)</span>
                                      </div>
                                    </div>
                                  ) : isEditandoQtd ? (
                                    <div className="inline-flex items-center justify-center gap-1">
                                      <input
                                        type="number"
                                        autoFocus
                                        value={valorEditando}
                                        onChange={e => setValorEditando(e.target.value)}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') salvarEdicaoInline(item);
                                          if (e.key === 'Escape') setItemEditandoId(null);
                                        }}
                                        className="w-14 bg-black border border-cyan-500 rounded px-1.5 py-0.5 text-xs text-white text-center font-mono"
                                      />
                                      <button type="button" onClick={() => salvarEdicaoInline(item)} className="text-emerald-400 hover:text-emerald-300">
                                        <Check size={12} />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="inline-flex items-center gap-1.5 justify-center">
                                      <button
                                        type="button"
                                        onClick={() => ajustarQuantidadeRapida(item, -1)}
                                        disabled={item.quantidade <= 0}
                                        className="w-5 h-5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-zinc-300 flex items-center justify-center cursor-pointer transition-colors"
                                        title="Diminuir 1 unidade"
                                      >
                                        <Minus size={10} />
                                      </button>
                                      <span
                                        onClick={() => {
                                          setItemEditandoId(item.id);
                                          setCampoEditando('quantidade');
                                          setValorEditando(String(item.quantidade));
                                        }}
                                        className="font-mono font-bold text-white text-xs px-1 cursor-pointer hover:underline"
                                        title="Clique para digitar quantidade"
                                      >
                                        {item.quantidade}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => ajustarQuantidadeRapida(item, 1)}
                                        className="w-5 h-5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center cursor-pointer transition-colors"
                                        title="Aumentar 1 unidade"
                                      >
                                        <Plus size={10} />
                                      </button>
                                    </div>
                                  )}
                                </td>

                                {/* Seriais/IMEIs (Apenas para celulares) */}
                                {ehCelular && (
                                  <td className="py-2.5 px-3 align-middle">
                                    <div className="flex flex-col gap-1.5">
                                      {item.imeis.length > 0 ? (
                                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                                          {item.imeis.slice(0, 2).map((im, idx) => (
                                            <span key={idx} className="font-mono text-[9px] bg-zinc-900 border border-zinc-800 text-zinc-300 px-1.5 py-0.2 rounded truncate max-w-[90px]" title={im}>
                                              {im}
                                            </span>
                                          ))}
                                          {item.imeis.length > 2 && (
                                            <span className="text-[9px] text-purple-400 font-mono font-bold">
                                              +{item.imeis.length - 2} mais
                                            </span>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-[10px] text-zinc-600 font-mono italic">Sem seriais</span>
                                      )}

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setItemParaAdicionarImei(item);
                                          setNovoImeiInput('');
                                          setErroNovoImei(null);
                                        }}
                                        className="inline-flex items-center gap-1 text-[10px] text-purple-400 hover:text-purple-300 font-bold transition-colors cursor-pointer w-fit"
                                        title="Registrar novo serial/IMEI para esta filial e cor"
                                      >
                                        <Plus size={11} />
                                        <span>Adicionar IMEI</span>
                                      </button>
                                    </div>
                                  </td>
                                )}

                                {/* Ações: Lixeira de Exclusão */}
                                <td className="py-2.5 px-3 text-right align-middle">
                                  <button
                                    type="button"
                                    onClick={() => setItemParaExcluir(item)}
                                    disabled={excluindoId === item.id}
                                    className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-950/20 transition-colors cursor-pointer"
                                    title="Excluir este registro/variação de estoque"
                                  >
                                    {excluindoId === item.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* ABA 2: VARIAÇÕES DE CORES */
            <div className="space-y-4">
              {variacoesCores.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-500 italic">
                  Nenhuma variação de cor identificada.
                </div>
              ) : (
                variacoesCores.map(v => (
                  <div key={v.cor} className="border border-[#27272a] rounded-xl overflow-hidden bg-black/40">
                    <div className="p-3.5 bg-[#18181b] border-b border-[#27272a] flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-3.5 h-3.5 rounded-full border border-white/20 bg-purple-500" />
                        <div>
                          <span className="font-bold text-white text-xs sm:text-sm">Cor: {v.cor}</span>
                          <div className="flex flex-wrap gap-2 text-[10px] text-zinc-400 mt-0.5">
                            {Object.entries(v.filiaisMap).map(([loja, q]) => (
                              <span key={loja}>
                                {loja}: <strong className="text-zinc-200">{q} un.</strong>
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs sm:text-sm font-mono font-bold text-cyan-400">
                        Total Cor: {v.quantidadeTotal} unids
                      </span>
                    </div>

                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-[#222] text-zinc-500 uppercase text-[10px] tracking-wider bg-black/20">
                          <th className="py-2.5 px-3">Filial</th>
                          <th className="py-2.5 px-3">Preço</th>
                          <th className="py-2.5 px-3">Preço de Custo</th>
                          <th className="py-2.5 px-3 text-center">Quantidade</th>
                          <th className="py-2.5 px-3 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1e1e24]">
                        {v.itens.map(item => (
                          <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors">
                            <td className="py-2.5 px-3 font-semibold text-white">
                              {item.filial_nome}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-emerald-400">
                              {formatCurrency(item.preco_venda || item.preco)}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-amber-400">
                              {formatCurrency(item.preco_custo || 0)}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-white">
                              {item.quantidade} unids
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => setItemParaExcluir(item)}
                                className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-950/20 transition-colors cursor-pointer"
                                title="Excluir este item"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* DIALOG DE CONFIRMAÇÃO DE EXCLUSÃO */}
        {itemParaExcluir && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#18181b] border border-red-500/40 rounded-xl max-w-sm w-full p-5 space-y-4 shadow-2xl text-left">
              <div className="flex items-center gap-2.5 text-red-400">
                <AlertCircle size={20} />
                <h4 className="text-sm font-bold text-white">Confirmar Exclusão de Estoque</h4>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Tem certeza que deseja excluir o item <strong className="text-white">"{itemParaExcluir.nome}"</strong> da filial <strong className="text-purple-300">{itemParaExcluir.filial_nome}</strong>?
                {itemParaExcluir.quantidade > 0 && (
                  <span className="block mt-1 text-amber-400">
                    * Atenção: Há {itemParaExcluir.quantidade} unidade(s) registrada(s).
                  </span>
                )}
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setItemParaExcluir(null)}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmarExcluirItem}
                  disabled={excluindoId === itemParaExcluir.id}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  {excluindoId === itemParaExcluir.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  Confirmar Exclusão
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL / DIALOG PARA ADICIONAR NOVO SERIAL/IMEI */}
        {itemParaAdicionarImei && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
            <div className="bg-[#18181b] border border-purple-800/60 rounded-xl max-w-sm w-full p-5 space-y-4 shadow-2xl text-left">
              <div className="flex items-center gap-2.5 text-purple-400">
                <Barcode size={20} />
                <h4 className="text-sm font-bold text-white">Cadastrar Novo IMEI / Serial</h4>
              </div>

              <div className="space-y-1.5 text-xs text-zinc-300">
                <p>
                  Produto: <strong className="text-white">{itemParaAdicionarImei.nome}</strong>
                </p>
                <div className="flex items-center gap-3 text-[11px] text-zinc-400">
                  <span>Filial: <strong className="text-purple-300">{itemParaAdicionarImei.filial_nome}</strong></span>
                  <span>Cor: <strong className="text-zinc-200">{itemParaAdicionarImei.cor}</strong></span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                  Número do Serial / IMEI (15 dígitos):
                </label>
                <input
                  type="text"
                  autoFocus
                  value={novoImeiInput}
                  onChange={(e) => {
                    setNovoImeiInput(e.target.value);
                    if (erroNovoImei) setErroNovoImei(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAdicionarImei();
                    if (e.key === 'Escape') setItemParaAdicionarImei(null);
                  }}
                  placeholder="Ex: 356891091234567"
                  className="w-full bg-black border border-zinc-700 focus:border-purple-500 rounded-lg px-3 py-2 text-xs font-mono text-white outline-none"
                  disabled={salvandoNovoImei}
                />
                {erroNovoImei && (
                  <p className="mt-1.5 text-[11px] text-red-400 font-medium">
                    {erroNovoImei}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setItemParaAdicionarImei(null)}
                  disabled={salvandoNovoImei}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleAdicionarImei}
                  disabled={salvandoNovoImei || !novoImeiInput.trim()}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  {salvandoNovoImei ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                  Salvar IMEI
                </button>
              </div>
            </div>
          </div>
        )}

        {/* RODAPÉ COM AÇÕES */}
        <div className="p-4 border-t border-[#27272a] bg-[#141417] flex flex-wrap items-center justify-between gap-3 relative">
          {/* Toast / Notificação flutuante de sucesso/erro */}
          {toastModal && (
            <div
              className={`absolute -top-12 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl text-xs font-bold shadow-xl flex items-center gap-2 animate-fadeIn z-50 ${
                toastModal.type === 'success'
                  ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/50'
                  : 'bg-rose-950/90 text-rose-300 border border-rose-500/50'
              }`}
            >
              {toastModal.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
              <span>{toastModal.message}</span>
            </div>
          )}

          <div className="text-[11px] text-zinc-500">
            * Clique em Fechar ou pressione ESC para retornar à lista.
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {onTransferir && (
              <button
                type="button"
                onClick={() => onTransferir(produto)}
                className="px-3 py-2 rounded-xl bg-purple-950/40 hover:bg-purple-900/60 text-purple-300 border border-purple-800/50 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
              >
                <ArrowRightLeft size={13} />
                Transferir Estoque
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

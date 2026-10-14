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
import { formatCurrency, formatarMoeda } from '../utils/currencyUtils';

interface ModalDetalheEstoqueProdutoProps {
  isOpen: boolean;
  onClose: () => void;
  produto: any;
  filiais?: Array<{ id: string | number; nome: string }>;
  onTransferir?: (produto: any) => void;
  onUpdateProdutoField?: (produtoId: any, nome: string, field: string, value: any, itemFilialId?: any) => Promise<any>;
  onDeleteProduto?: (produto: any) => Promise<any>;
  onRefresh?: () => void;
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
  quantidade: number;
  imeis: string[];
  updated_at?: string;
  created_at?: string;
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
  filiais = [],
  onTransferir,
  onUpdateProdutoField,
  onDeleteProduto,
  onRefresh
}: ModalDetalheEstoqueProdutoProps) {
  const [loading, setLoading] = useState(false);
  const [produtosIrmaos, setProdutosIrmaos] = useState<ItemProdutoDetalhado[]>([]);
  const [abaAtiva, setAbaAtiva] = useState<'filiais' | 'variacoes'>('filiais');

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
  const produtoNome = produto?.nome || produto?.produto_nome || 'Produto sem nome';
  const produtoId = produto?.id || produto?.produto_id || '-';
  const categoria = produto?.categoria || produto?.tipo || 'GERAL';
  const corAtual = produto?.cor || produto?.cor_nome || 'Padrão';
  const precoBaseVenda = Number(produto?.preco_venda || produto?.preco || 0);

  const categoriaNome = String(produto?.categoria || produto?.categoria_nome || categoria || '').toUpperCase();
  const ehCelularOuSerial = categoriaNome.includes('CELULAR') || 
                            categoriaNome.includes('SMARTPHONE') || 
                            categoriaNome.includes('IOS') || 
                            categoriaNome.includes('ANDROID') || 
                            produto?.controla_imei === true ||
                            Boolean(produto?.imei) ||
                            (Array.isArray(produto?.imeis) && produto.imeis.length > 0);

  const isCelular = ehCelularOuSerial;

  // Estado para Adicionar Novo IMEI por Item/Filial
  const [itemParaAdicionarImei, setItemParaAdicionarImei] = useState<ItemProdutoDetalhado | null>(null);
  const [novoImeiInput, setNovoImeiInput] = useState('');
  const [salvandoNovoImei, setSalvandoNovoImei] = useState(false);
  const [erroNovoImei, setErroNovoImei] = useState<string | null>(null);

  // Mapeamento de Filiais por ID para lookup rápido
  const mapaFiliaisNome = useMemo(() => {
    const mapa: { [key: string]: string } = {};
    (filiais || []).forEach(f => {
      mapa[String(f.id)] = f.nome;
    });
    return mapa;
  }, [filiais]);

  // Função para buscar e consolidar todos os itens/filiais/cores deste produto
  const carregarDetalhesEstoque = useCallback(async () => {
    if (!produto) return;
    setLoading(true);
    try {
      const nomeTrim = String(produtoNome).trim();
      const catalogoId = produto?.produto_catalogo_id || null;

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

      if (catalogoId) {
        query = query.or(`produto_catalogo_id.eq.${catalogoId},nome.ilike.${nomeTrim}`);
      } else if (nomeTrim) {
        query = query.ilike('nome', nomeTrim);
      } else if (produtoId && produtoId !== '-') {
        query = query.eq('id', produtoId);
      }

      const { data: prodsDb, error } = await query;
      if (error) {
        console.warn('[ModalDetalheEstoqueProduto] Erro ao buscar produtos:', error);
      }

      const listaBruta = prodsDb && prodsDb.length > 0 ? prodsDb : [produto];

      // Formatar cada item individualmente
      const itensFormatados: ItemProdutoDetalhado[] = listaBruta.map((p: any) => {
        const seriais = Array.isArray(p.imeis)
          ? p.imeis.filter((i: any) => !i.vendido && String(i.status || '').toUpperCase() !== 'VENDIDO')
          : [];

        const imeisStrings: string[] = seriais.map((i: any) => String(i.imei).trim()).filter(Boolean);

        let qtdValida = imeisStrings.length;
        if (qtdValida === 0) {
          qtdValida = Number(p.quantidade || 0);
        }

        const fId = String(p.filial_id || 'sem_filial');
        const fNome = p.filiais?.nome || mapaFiliaisNome[fId] || (fId === 'sem_filial' ? 'Sem Filial' : `Filial ${fId}`);

        return {
          id: String(p.id),
          nome: p.nome || produtoNome,
          filial_id: fId,
          filial_nome: fNome,
          categoria: p.categoria || categoria,
          cor: (p.cor || 'Não informada').trim(),
          preco: Number(p.preco || p.preco_venda || precoBaseVenda),
          preco_venda: Number(p.preco_venda || p.preco || precoBaseVenda),
          quantidade: qtdValida,
          imeis: imeisStrings,
          updated_at: p.updated_at,
          created_at: p.created_at
        };
      });

      setProdutosIrmaos(itensFormatados);
    } catch (err) {
      console.error('[ModalDetalheEstoqueProduto] Falha ao carregar itens:', err);
    } finally {
      setLoading(false);
    }
  }, [produto, produtoNome, produtoId, categoria, precoBaseVenda, mapaFiliaisNome]);

  useEffect(() => {
    if (isOpen && produto) {
      carregarDetalhesEstoque();
    }
  }, [isOpen, produto, carregarDetalhesEstoque]);

  // Total Geral consolidando todas as variações e filiais
  const totalGeral = useMemo(() => {
    return produtosIrmaos.reduce((acc, curr) => acc + curr.quantidade, 0);
  }, [produtosIrmaos]);

  // Preço de venda exibido no cabeçalho (média ou do item principal)
  const precoExibicaoCabecalho = useMemo(() => {
    const comPreco = produtosIrmaos.find(p => p.preco_venda > 0 || p.preco > 0);
    return comPreco ? (comPreco.preco_venda || comPreco.preco) : precoBaseVenda;
  }, [produtosIrmaos, precoBaseVenda]);

  // Agrupamento de Estoque por Filial
  const estoqueFiliais = useMemo(() => {
    const mapa: { [filialKey: string]: EstoquePorFilialItem } = {};

    // Inicia com todas as filiais conhecidas
    (filiais || []).forEach(f => {
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
      const fId = item.filial_id;
      if (!mapa[fId]) {
        mapa[fId] = {
          filial_id: fId,
          filial_nome: item.filial_nome,
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

    return Object.values(mapa).map(f => {
      let statusCalc: 'EM_ESTOQUE' | 'ESTOQUE_BAIXO' | 'ESGOTADO' = 'ESGOTADO';
      if (f.quantidadeTotal > 3) statusCalc = 'EM_ESTOQUE';
      else if (f.quantidadeTotal > 0) statusCalc = 'ESTOQUE_BAIXO';

      return {
        ...f,
        status: statusCalc
      };
    }).sort((a, b) => b.quantidadeTotal - a.quantidadeTotal);
  }, [filiais, produtosIrmaos]);

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

  // 1. AÇÃO: Salvar Preço Geral do Cabeçalho
  const salvarPrecoGeral = async () => {
    const novoValor = parseFloat(String(valorPrecoGeral).replace('R$', '').replace(/\s/g, '').replace(',', '.'));
    if (isNaN(novoValor) || novoValor < 0) {
      setEditandoPrecoGeral(false);
      return;
    }

    setSalvandoPrecoGeral(true);
    try {
      if (onUpdateProdutoField) {
        await onUpdateProdutoField(produtoId, produtoNome, 'preco', novoValor, produto?.filial_id);
      } else {
        await supabase
          .from('produtos')
          .update({ preco: novoValor, preco_venda: novoValor })
          .ilike('nome', produtoNome.trim());
      }

      // Atualiza estado local de todos os itens do produto
      setProdutosIrmaos(prev => prev.map(p => ({ ...p, preco: novoValor, preco_venda: novoValor })));
      setEditandoPrecoGeral(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('[ModalDetalheEstoqueProduto] Erro ao salvar preço geral:', err);
    } finally {
      setSalvandoPrecoGeral(false);
    }
  };

  // 2. AÇÃO: Salvar Edição Inline de Item (Preço, Cor ou Quantidade)
  const salvarEdicaoInline = async (item: ItemProdutoDetalhado) => {
    if (!campoEditando || salvandoInline) return;
    setSalvandoInline(true);

    try {
      if (campoEditando === 'preco') {
        const novoValor = parseFloat(String(valorEditando).replace('R$', '').replace(/\s/g, '').replace(',', '.'));
        if (!isNaN(novoValor) && novoValor >= 0) {
          if (onUpdateProdutoField) {
            await onUpdateProdutoField(item.id, item.nome, 'preco', novoValor, item.filial_id);
          } else {
            await supabase.from('produtos').update({ preco: novoValor, preco_venda: novoValor }).eq('id', item.id);
          }
          setProdutosIrmaos(prev => prev.map(p => p.id === item.id ? { ...p, preco: novoValor, preco_venda: novoValor } : p));
        }
      } else if (campoEditando === 'cor') {
        const novaCor = String(valorEditando).trim();
        if (novaCor) {
          if (onUpdateProdutoField) {
            await onUpdateProdutoField(item.id, item.nome, 'cor', novaCor, item.filial_id);
          } else {
            await supabase.from('produtos').update({ cor: novaCor }).eq('id', item.id);
          }
          setProdutosIrmaos(prev => prev.map(p => p.id === item.id ? { ...p, cor: novaCor } : p));
        }
      } else if (campoEditando === 'quantidade') {
        const novaQtd = parseInt(valorEditando, 10);
        if (!isNaN(novaQtd) && novaQtd >= 0) {
          if (onUpdateProdutoField) {
            await onUpdateProdutoField(item.id, item.nome, 'quantidade', novaQtd, item.filial_id);
          } else {
            await supabase.from('produtos').update({ quantidade: novaQtd }).eq('id', item.id);
          }
          setProdutosIrmaos(prev => prev.map(p => p.id === item.id ? { ...p, quantidade: novaQtd } : p));
        }
      }

      setItemEditandoId(null);
      setCampoEditando(null);
      setValorEditando('');
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('[ModalDetalheEstoqueProduto] Erro ao salvar edição inline:', err);
    } finally {
      setSalvandoInline(false);
    }
  };

  // 3. AÇÃO: Alterar Quantidade Rápida (+1 ou -1) - Bloqueado se ehCelularOuSerial
  const ajustarQuantidadeRapida = async (item: ItemProdutoDetalhado, delta: number) => {
    if (ehCelularOuSerial) return;
    const novaQtd = Math.max(0, item.quantidade + delta);
    try {
      if (onUpdateProdutoField) {
        await onUpdateProdutoField(item.id, item.nome, 'quantidade', novaQtd, item.filial_id);
      } else {
        await supabase.from('produtos').update({ quantidade: novaQtd }).eq('id', item.id);
      }
      setProdutosIrmaos(prev => prev.map(p => p.id === item.id ? { ...p, quantidade: novaQtd } : p));
      if (onRefresh) onRefresh();
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
      // 1. Inserir na tabela 'imeis'
      const { data: novoImeiDb, error: insertError } = await supabase
        .from('imeis')
        .insert({
          imei: imeiLimpo,
          produto_id: itemParaAdicionarImei.id,
          filial_id: itemParaAdicionarImei.filial_id && itemParaAdicionarImei.filial_id !== 'sem_filial' ? itemParaAdicionarImei.filial_id : null,
          cor: itemParaAdicionarImei.cor || 'Padrão',
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
      const novaQtd = itemParaAdicionarImei.imeis.length + 1;
      await supabase
        .from('produtos')
        .update({ quantidade: novaQtd })
        .eq('id', itemParaAdicionarImei.id);

      // 3. Atualizar estado local
      setProdutosIrmaos(prev => prev.map(p => {
        if (p.id === itemParaAdicionarImei.id) {
          return {
            ...p,
            quantidade: novaQtd,
            imeis: [...p.imeis, imeiLimpo]
          };
        }
        return p;
      }));

      setNovoImeiInput('');
      setItemParaAdicionarImei(null);
      if (onRefresh) onRefresh();
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
    setExcluindoId(item.id);

    try {
      if (onDeleteProduto) {
        await onDeleteProduto(item);
      } else {
        await supabase.from('produtos').delete().eq('id', item.id);
      }

      setProdutosIrmaos(prev => prev.filter(p => p.id !== item.id));
      setItemParaExcluir(null);
      if (onRefresh) onRefresh();
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
              <h2 className="text-base sm:text-lg font-bold text-white truncate mt-1" title={produtoNome}>
                {produtoNome}
              </h2>
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-[#141417] border-b border-[#222]">
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

          {/* Card 2: Estoque Total Rede (Soma de todas as variações e filiais) */}
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

          {/* Card 3: Variações de Cores */}
          <div className="bg-[#1a1a1e] border border-[#27272a] rounded-xl p-3">
            <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1">
              <Palette size={11} /> Cores Cadastradas
            </span>
            <span className="text-xs sm:text-sm font-bold text-white mt-1 block truncate">
              {variacoesCores.length > 0 ? `${variacoesCores.length} variação(ões)` : corAtual}
            </span>
          </div>

          {/* Card 4: Filiais com Estoque */}
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
            className={`px-3 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              abaAtiva === 'filiais'
                ? 'border-[#6A0DAD] text-purple-300'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <Store size={14} />
            Estoque por Loja / Filial ({produtosIrmaos.length} registros)
          </button>
          <button
            type="button"
            onClick={() => setAbaAtiva('variacoes')}
            className={`px-3 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              abaAtiva === 'variacoes'
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
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          filial.status === 'EM_ESTOQUE'
                            ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40'
                            : filial.status === 'ESTOQUE_BAIXO'
                            ? 'bg-amber-950/40 text-amber-400 border border-amber-800/40'
                            : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
                        }`}>
                          {filial.status === 'EM_ESTOQUE' ? 'Em Estoque' : filial.status === 'ESTOQUE_BAIXO' ? 'Estoque Baixo' : 'Esgotado'}
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
                            <th className="py-2.5 px-3 text-center">Quantidade</th>
                            <th className="py-2.5 px-3">IMEIs / Seriais</th>
                            <th className="py-2.5 px-3 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1e1e24]">
                          {filial.itens.map(item => {
                            const isEditandoCor = itemEditandoId === item.id && campoEditando === 'cor';
                            const isEditandoPreco = itemEditandoId === item.id && campoEditando === 'preco';
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

                                {/* Seriais/IMEIs */}
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

                                    {ehCelularOuSerial && (
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
                                    )}
                                  </div>
                                </td>

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
        <div className="p-4 border-t border-[#27272a] bg-[#141417] flex flex-wrap items-center justify-between gap-3">
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

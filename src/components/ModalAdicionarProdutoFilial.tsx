import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import {
  X,
  Search,
  Plus,
  Package,
  DollarSign,
  Layers,
  Store,
  CheckCircle2,
  AlertCircle,
  Tag,
  Barcode
} from 'lucide-react';
import { formatCurrency } from '../utils/currencyUtils';

interface CatalogoItem {
  id: string | number;
  nome: string;
  sku?: string;
  codigo_barras?: string;
  categoria?: string;
  tipo?: string;
  preco?: number;
  preco_venda?: number;
  preco_custo?: number;
  cor?: string;
}

interface ModalAdicionarProdutoFilialProps {
  isOpen: boolean;
  onClose: () => void;
  filialId: string | number;
  filialNome: string;
  produtosCatalogo: CatalogoItem[];
  produtosFisicos: any[];
  empresaId?: string | number | null;
  userId?: string | null;
  onSuccess: (novoProduto: any) => void;
}

function parsePrecoToNumeric(valor: string | number): number {
  if (typeof valor === 'number') return isNaN(valor) ? 0 : Number(valor.toFixed(2));
  if (!valor) return 0;
  const limpo = String(valor).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const numero = parseFloat(limpo);
  return isNaN(numero) ? 0 : Number(numero.toFixed(2));
}

export default function ModalAdicionarProdutoFilial({
  isOpen,
  onClose,
  filialId,
  filialNome,
  produtosCatalogo = [],
  produtosFisicos = [],
  empresaId,
  userId,
  onSuccess
}: ModalAdicionarProdutoFilialProps) {
  const [busca, setBusca] = useState('');
  const [catalogoSelecionado, setCatalogoSelecionado] = useState<CatalogoItem | null>(null);
  const [quantidadeInicial, setQuantidadeInicial] = useState<number>(0);
  const [precoVenda, setPrecoVenda] = useState<string>('');
  const [precoCusto, setPrecoCusto] = useState<string>('');
  const [salvando, setSalvando] = useState(false);
  const [erroMsg, setErroMsg] = useState<string | null>(null);
  const [dropdownAberto, setDropdownAberto] = useState(false);

  // Mapear itens que já possuem registro físico para esta filial
  const fIdClean = String(filialId || '').trim().toLowerCase();

  const produtosJaExistentesNestaFilial = useMemo(() => {
    const nomesEans = new Set<string>();
    (produtosFisicos || []).forEach(p => {
      const pFilialId = String(p.filial_id || '').trim().toLowerCase();
      if (pFilialId === fIdClean) {
        if (p.catalogo_id) {
          nomesEans.add(`cat_${String(p.catalogo_id).toLowerCase()}`);
        }
        if (p.nome) {
          nomesEans.add(`nome_${String(p.nome).trim().toLowerCase()}`);
        }
        if (p.codigo_barras) {
          nomesEans.add(`ean_${String(p.codigo_barras).trim().toLowerCase()}`);
        }
      }
    });
    return nomesEans;
  }, [produtosFisicos, fIdClean]);

  // Lista de itens do catálogo disponíveis (que ainda NÃO possuem registro nesta filial)
  const catalogoDisponivel = useMemo(() => {
    return (produtosCatalogo || []).filter(cat => {
      const catId = String(cat.id || '').toLowerCase();
      const catNome = String(cat.nome || '').trim().toLowerCase();
      const catEan = String(cat.codigo_barras || '').trim().toLowerCase();

      if (catId && produtosJaExistentesNestaFilial.has(`cat_${catId}`)) return false;
      if (catNome && produtosJaExistentesNestaFilial.has(`nome_${catNome}`)) return false;
      if (catEan && produtosJaExistentesNestaFilial.has(`ean_${catEan}`)) return false;

      return true;
    });
  }, [produtosCatalogo, produtosJaExistentesNestaFilial]);

  // Filtragem pela busca digitada
  const itensFiltrados = useMemo(() => {
    if (!busca.trim()) return catalogoDisponivel.slice(0, 50);
    const termo = busca.toLowerCase().trim();
    return catalogoDisponivel.filter(item => {
      const nome = String(item.nome || '').toLowerCase();
      const ean = String(item.codigo_barras || '').toLowerCase();
      const sku = String(item.sku || '').toLowerCase();
      const categoria = String(item.categoria || '').toLowerCase();
      return nome.includes(termo) || ean.includes(termo) || sku.includes(termo) || categoria.includes(termo);
    }).slice(0, 50);
  }, [catalogoDisponivel, busca]);

  // Ao selecionar um item do catálogo, preenche os preços padrão
  const handleSelecionarCatalogo = (cat: CatalogoItem) => {
    setCatalogoSelecionado(cat);
    const precoPadrao = Number(cat.preco_venda || cat.preco || 0);
    setPrecoVenda(precoPadrao > 0 ? precoPadrao.toFixed(2).replace('.', ',') : '');
    const custoPadrao = Number(cat.preco_custo || 0);
    setPrecoCusto(custoPadrao > 0 ? custoPadrao.toFixed(2).replace('.', ',') : '');
    setBusca(cat.nome);
    setDropdownAberto(false);
    setErroMsg(null);
  };

  // Reset do modal
  const handleLimpar = () => {
    setCatalogoSelecionado(null);
    setBusca('');
    setQuantidadeInicial(0);
    setPrecoVenda('');
    setPrecoCusto('');
    setErroMsg(null);
    setDropdownAberto(false);
  };

  useEffect(() => {
    if (isOpen) {
      handleLimpar();
    }
  }, [isOpen, filialId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catalogoSelecionado) {
      setErroMsg('Selecione um produto do catálogo.');
      return;
    }

    if (!filialId || String(filialId) === 'TODAS') {
      setErroMsg('Selecione uma filial válida antes de adicionar.');
      return;
    }

    const precoVendaNum = parsePrecoToNumeric(precoVenda);
    const precoCustoNum = parsePrecoToNumeric(precoCusto);
    const qtdNum = Math.max(0, parseInt(String(quantidadeInicial), 10) || 0);

    setSalvando(true);
    setErroMsg(null);

    try {
      const filialIdNumerico = isNaN(Number(filialId)) ? filialId : Number(filialId);
      const targetEmpresaId = empresaId ? (isNaN(Number(empresaId)) ? empresaId : Number(empresaId)) : null;

      // 1. Inserir produto na tabela produtos
      const payload: any = {
        nome: catalogoSelecionado.nome.trim(),
        preco: precoVendaNum,
        preco_venda: precoVendaNum,
        preco_custo: precoCustoNum,
        quantidade: qtdNum,
        filial_id: filialIdNumerico,
        catalogo_id: catalogoSelecionado.id
      };

      if (targetEmpresaId) {
        payload.empresa_id = targetEmpresaId;
      }
      if (catalogoSelecionado.sku) {
        payload.sku = catalogoSelecionado.sku;
      }
      if (catalogoSelecionado.codigo_barras) {
        payload.codigo_barras = catalogoSelecionado.codigo_barras;
      }
      if (catalogoSelecionado.categoria) {
        payload.categoria = catalogoSelecionado.categoria;
      }
      if (catalogoSelecionado.tipo) {
        payload.tipo = catalogoSelecionado.tipo;
      }
      if (catalogoSelecionado.cor) {
        payload.cor = catalogoSelecionado.cor;
      }

      const { data: novoProduto, error: errInsert } = await supabase
        .from('produtos')
        .insert(payload)
        .select('*, filiais(id, nome)')
        .single();

      if (errInsert) {
        // Fallback simplificado sem colunas extras caso o schema seja estrito
        console.warn('[ModalAdicionarProdutoFilial] Tentando insert simplificado após erro:', errInsert);
        const payloadFallback: any = {
          nome: catalogoSelecionado.nome.trim(),
          preco: precoVendaNum,
          preco_venda: precoVendaNum,
          preco_custo: precoCustoNum,
          quantidade: qtdNum,
          filial_id: filialIdNumerico,
          catalogo_id: catalogoSelecionado.id
        };
        if (targetEmpresaId) payloadFallback.empresa_id = targetEmpresaId;

        const { data: retryNovo, error: retryErr } = await supabase
          .from('produtos')
          .insert(payloadFallback)
          .select()
          .single();

        if (retryErr) throw retryErr;

        // Se quantidadeInicial > 0, registra em estoque_movimentacoes
        if (qtdNum > 0 && retryNovo?.id) {
          try {
            await supabase.from('estoque_movimentacoes').insert({
              empresa_id: targetEmpresaId,
              produto_id: retryNovo.id,
              filial_destino_id: filialIdNumerico,
              quantidade: qtdNum,
              tipo_movimentacao: 'ENTRADA_INICIAL',
              criado_por: userId || null,
              status: 'CONCLUIDO',
              observacao: `Vínculo de produto à filial: ${catalogoSelecionado.nome} (Saldo Inicial: ${qtdNum} un)`
            });
          } catch (movErr) {
            console.warn('[ModalAdicionarProdutoFilial] Erro ao registrar movimentação inicial:', movErr);
          }
        }

        onSuccess(retryNovo);
        onClose();
        return;
      }

      // Se quantidadeInicial > 0, registra em estoque_movimentacoes
      if (qtdNum > 0 && novoProduto?.id) {
        try {
          await supabase.from('estoque_movimentacoes').insert({
            empresa_id: targetEmpresaId,
            produto_id: novoProduto.id,
            filial_destino_id: filialIdNumerico,
            quantidade: qtdNum,
            tipo_movimentacao: 'ENTRADA_INICIAL',
            criado_por: userId || null,
            status: 'CONCLUIDO',
            observacao: `Vínculo de produto à filial: ${catalogoSelecionado.nome} (Saldo Inicial: ${qtdNum} un)`
          });
        } catch (movErr) {
          console.warn('[ModalAdicionarProdutoFilial] Erro ao registrar movimentação inicial:', movErr);
        }
      }

      onSuccess(novoProduto);
      onClose();
    } catch (err: any) {
      console.error('[ModalAdicionarProdutoFilial] Erro ao vincular produto:', err);
      setErroMsg(err?.message || 'Falha ao adicionar produto à filial.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-[#121217] border border-[#272732] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Cabeçalho */}
        <div className="p-4 md:p-5 border-b border-[#202028] flex items-center justify-between bg-[#16161c]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-950/60 border border-purple-500/40 text-purple-400">
              <Plus size={20} />
            </div>
            <div>
              <h3 className="text-sm md:text-base font-bold text-white flex items-center gap-2">
                Adicionar Produto à Filial
              </h3>
              <p className="text-xs text-zinc-400 flex items-center gap-1.5 mt-0.5">
                <Store size={12} className="text-cyan-400" />
                <span className="text-cyan-300 font-semibold">{filialNome}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-4 overflow-y-auto flex-1">
          {erroMsg && (
            <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/60 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{erroMsg}</span>
            </div>
          )}

          {/* Campo 1: Autocomplete/Select de Produtos do Catálogo */}
          <div className="space-y-1.5 relative">
            <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
              <Package size={13} className="text-purple-400" />
              <span>Produto do Catálogo (Anti-Duplicidade)</span>
              <span className="text-rose-400">*</span>
            </label>

            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" size={15} />
              <input
                type="text"
                placeholder="Buscar por nome, EAN ou SKU no catálogo..."
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setDropdownAberto(true);
                  if (catalogoSelecionado && e.target.value !== catalogoSelecionado.nome) {
                    setCatalogoSelecionado(null);
                  }
                }}
                onFocus={() => setDropdownAberto(true)}
                className="w-full bg-black/60 border border-[#2a2a36] focus:border-purple-500 rounded-xl pl-10 pr-9 py-2.5 text-xs text-white placeholder-zinc-500 outline-none transition-all font-medium"
              />
              {busca && (
                <button
                  type="button"
                  onClick={() => {
                    setBusca('');
                    setCatalogoSelecionado(null);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Dropdown de sugestões do catálogo */}
            {dropdownAberto && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setDropdownAberto(false)}
                />
                <div className="absolute left-0 right-0 top-full mt-1.5 z-20 bg-[#16161d] border border-[#2d2d3d] rounded-xl shadow-2xl max-h-60 overflow-y-auto divide-y divide-[#22222d]">
                  {itensFiltrados.length === 0 ? (
                    <div className="p-3 text-center text-xs text-zinc-500">
                      Nenhum item do catálogo disponível para esta filial.
                    </div>
                  ) : (
                    itensFiltrados.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => handleSelecionarCatalogo(cat)}
                        className="w-full text-left p-3 hover:bg-purple-950/40 hover:border-purple-500/30 transition-colors flex items-center justify-between gap-3 group"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-white group-hover:text-purple-300 truncate">
                            {cat.nome}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-zinc-400">
                            {cat.categoria && (
                              <span className="px-1.5 py-0.2 rounded bg-purple-950/80 text-purple-300 border border-purple-800/40">
                                {cat.categoria}
                              </span>
                            )}
                            {cat.codigo_barras && (
                              <span className="font-mono">EAN: {cat.codigo_barras}</span>
                            )}
                            {cat.sku && (
                              <span className="font-mono">SKU: {cat.sku}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-mono font-bold text-emerald-400 block">
                            {formatCurrency(Number(cat.preco_venda || cat.preco || 0))}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}

            {catalogoSelecionado && (
              <div className="p-2.5 rounded-xl bg-purple-950/30 border border-purple-500/40 flex items-center justify-between gap-2 mt-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-purple-300 truncate">
                    ✓ Selecionado: {catalogoSelecionado.nome}
                  </p>
                  <p className="text-[10px] text-zinc-400">
                    ID Catálogo: <span className="font-mono">{String(catalogoSelecionado.id).slice(0, 8)}...</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCatalogoSelecionado(null);
                    setBusca('');
                  }}
                  className="text-[10px] text-zinc-400 hover:text-rose-400 underline"
                >
                  Trocar
                </button>
              </div>
            )}
          </div>

          {/* Grid de 3 campos: Quantidade Inicial, Preço de Venda, Preço de Custo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {/* Campo 2: Quantidade Inicial */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                <Layers size={13} className="text-purple-400" />
                <span>Qtd Inicial</span>
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={quantidadeInicial}
                onChange={(e) => setQuantidadeInicial(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full bg-black/60 border border-[#2a2a36] focus:border-purple-500 rounded-xl px-3 py-2 text-xs text-white outline-none font-mono font-bold text-center"
              />
            </div>

            {/* Campo 3: Preço de Venda */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                <DollarSign size={13} className="text-emerald-400" />
                <span>Preço Venda</span>
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-mono">R$</span>
                <input
                  type="text"
                  placeholder="0,00"
                  value={precoVenda}
                  onChange={(e) => setPrecoVenda(e.target.value)}
                  className="w-full bg-black/60 border border-[#2a2a36] focus:border-purple-500 rounded-xl pl-8 pr-3 py-2 text-xs text-white outline-none font-mono font-bold"
                />
              </div>
            </div>

            {/* Campo 4: Preço de Custo */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                <DollarSign size={13} className="text-amber-400" />
                <span>Preço Custo</span>
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-mono">R$</span>
                <input
                  type="text"
                  placeholder="0,00"
                  value={precoCusto}
                  onChange={(e) => setPrecoCusto(e.target.value)}
                  className="w-full bg-black/60 border border-[#2a2a36] focus:border-purple-500 rounded-xl pl-8 pr-3 py-2 text-xs text-white outline-none font-mono font-bold"
                />
              </div>
            </div>
          </div>

          <p className="text-[11px] text-zinc-500 pt-1">
            * Ao confirmar, o produto será cadastrado na loja <strong className="text-zinc-300">{filialNome}</strong> e caso a quantidade seja maior que zero, um histórico de auditoria <strong className="text-purple-400">ENTRADA_INICIAL</strong> será registrado automaticamente.
          </p>

          {/* Botões de Ação */}
          <div className="pt-3 border-t border-[#202028] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando || !catalogoSelecionado}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-purple-900/30 flex items-center gap-2 cursor-pointer"
            >
              <Plus size={14} />
              <span>{salvando ? 'Vinculando...' : 'Vincular à Filial'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

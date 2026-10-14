import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import {
  X,
  Package,
  Smartphone,
  Tag,
  Store,
  Layers,
  ArrowRightLeft,
  Sliders,
  AlertCircle,
  Loader2,
  Calendar,
  CheckCircle2,
  Barcode,
  Palette
} from 'lucide-react';
import { formatCurrency, formatarMoeda } from '../utils/currencyUtils';

interface ModalDetalheEstoqueProdutoProps {
  isOpen: boolean;
  onClose: () => void;
  produto: any;
  filiais?: Array<{ id: string | number; nome: string }>;
  onTransferir?: (produto: any) => void;
  onAjustarSaldo?: (produto: any) => void;
}

interface EstoquePorFilialItem {
  filial_id: string;
  filial_nome: string;
  quantidade: number;
  imeis: string[];
  ultima_movimentacao?: string | null;
  status: 'EM_ESTOQUE' | 'ESTOQUE_BAIXO' | 'ESGOTADO';
}

interface VariacaoCorItem {
  cor: string;
  quantidade: number;
  filiaisMap: { [filialNome: string]: number };
}

export default function ModalDetalheEstoqueProduto({
  isOpen,
  onClose,
  produto,
  filiais = [],
  onTransferir,
  onAjustarSaldo
}: ModalDetalheEstoqueProdutoProps) {
  const [loading, setLoading] = useState(false);
  const [estoqueFiliais, setEstoqueFiliais] = useState<EstoquePorFilialItem[]>([]);
  const [variacoesCores, setVariacoesCores] = useState<VariacaoCorItem[]>([]);
  const [abaAtiva, setAbaAtiva] = useState<'filiais' | 'variacoes'>('filiais');

  // Identificadores do Produto
  const produtoNome = produto?.nome || produto?.produto_nome || 'Produto sem nome';
  const produtoId = produto?.id || produto?.produto_id || '-';
  const categoria = produto?.categoria || produto?.tipo || 'GERAL';
  const corAtual = produto?.cor || produto?.cor_nome || 'Padrão / Não definida';
  const precoVenda = Number(produto?.preco_venda || produto?.preco || 0);
  const precoCusto = Number(produto?.preco_custo || 0);
  const isCelular = (categoria || '').toUpperCase().includes('CELULAR') || 
                    (categoria || '').toUpperCase().includes('IOS') || 
                    (categoria || '').toUpperCase().includes('ANDROID') ||
                    Boolean(produto?.imei) || 
                    (Array.isArray(produto?.imeis) && produto.imeis.length > 0);

  // Mapeamento de Filiais por ID para lookup rápido
  const mapaFiliaisNome = useMemo(() => {
    const mapa: { [key: string]: string } = {};
    (filiais || []).forEach(f => {
      mapa[String(f.id)] = f.nome;
    });
    return mapa;
  }, [filiais]);

  useEffect(() => {
    if (!isOpen || !produto) return;

    let isMounted = true;

    async function carregarDetalhesEstoque() {
      setLoading(true);
      try {
        const nomeTrim = String(produtoNome).trim();
        const catalogoId = produto?.produto_catalogo_id || null;

        // 1. Busca produtos com mesmo nome ou mesmo catalogo_id para consolidar multiloja
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

        const { data: produtosIrmaos, error } = await query;

        if (error) {
          console.warn('[ModalDetalheEstoqueProduto] Erro ao buscar estoque por filiais:', error);
        }

        const listaProdutos = produtosIrmaos && produtosIrmaos.length > 0 ? produtosIrmaos : [produto];

        // 2. Busca última movimentação no histórico recente (estoque_movimentacoes)
        const idsProdutos = listaProdutos.map(p => p.id).filter(Boolean);
        let movimentacoesRecentes: any[] = [];
        if (idsProdutos.length > 0) {
          try {
            const { data: movs } = await supabase
              .from('estoque_movimentacoes')
              .select('id, produto_id, filial_destino_id, filial_origem_id, tipo_movimentacao, created_at')
              .in('produto_id', idsProdutos)
              .order('created_at', { ascending: false })
              .limit(30);
            if (movs) movimentacoesRecentes = movs;
          } catch (e) {
            console.warn('[ModalDetalheEstoqueProduto] Movimentações fallback:', e);
          }
        }

        // 3. Agrupar estoque por filial
        const filiaisAgrupadas: { [filialKey: string]: EstoquePorFilialItem } = {};

        // Inicia com todas as filiais conhecidas zeradas (para dar visão total da rede)
        (filiais || []).forEach(f => {
          const fId = String(f.id);
          filiaisAgrupadas[fId] = {
            filial_id: fId,
            filial_nome: f.nome,
            quantidade: 0,
            imeis: [],
            status: 'ESGOTADO',
            ultima_movimentacao: null
          };
        });

        // Agrupamento por Cor / Variação
        const coresAgrupadas: { [corNome: string]: VariacaoCorItem } = {};

        listaProdutos.forEach(p => {
          const fId = String(p.filial_id || 'sem_filial');
          const fNome = mapaFiliaisNome[fId] || (fId === 'sem_filial' ? 'Sem Filial' : `Filial ${fId}`);

          if (!filiaisAgrupadas[fId]) {
            filiaisAgrupadas[fId] = {
              filial_id: fId,
              filial_nome: fNome,
              quantidade: 0,
              imeis: [],
              status: 'ESGOTADO',
              ultima_movimentacao: null
            };
          }

          // Imeis disponíveis
          const seriais = Array.isArray(p.imeis)
            ? p.imeis.filter((i: any) => !i.vendido && String(i.status || '').toUpperCase() !== 'VENDIDO')
            : [];

          const imeisStrings: string[] = seriais.map((i: any) => String(i.imei).trim()).filter(Boolean);

          let qtdValida = imeisStrings.length;
          if (qtdValida === 0) {
            qtdValida = Number(p.quantidade || 0);
          }

          filiaisAgrupadas[fId].quantidade += qtdValida;
          filiaisAgrupadas[fId].imeis.push(...imeisStrings);

          // Última movimentação
          const movItem = movimentacoesRecentes.find(
            m => String(m.filial_destino_id) === fId || String(m.filial_origem_id) === fId || String(m.produto_id) === String(p.id)
          );
          if (movItem?.created_at && !filiaisAgrupadas[fId].ultima_movimentacao) {
            filiaisAgrupadas[fId].ultima_movimentacao = movItem.created_at;
          } else if (!filiaisAgrupadas[fId].ultima_movimentacao) {
            filiaisAgrupadas[fId].ultima_movimentacao = p.updated_at || p.created_at || null;
          }

          // Agrupamento de Variações de Cores
          const corItem = (p.cor || 'Não informada').trim();
          if (!coresAgrupadas[corItem]) {
            coresAgrupadas[corItem] = {
              cor: corItem,
              quantidade: 0,
              filiaisMap: {}
            };
          }
          coresAgrupadas[corItem].quantidade += qtdValida;
          coresAgrupadas[corItem].filiaisMap[fNome] = (coresAgrupadas[corItem].filiaisMap[fNome] || 0) + qtdValida;
        });

        // Definir status de estoque para cada filial
        const resultadoFiliais: EstoquePorFilialItem[] = Object.values(filiaisAgrupadas).map(item => {
          let statusCalc: 'EM_ESTOQUE' | 'ESTOQUE_BAIXO' | 'ESGOTADO' = 'ESGOTADO';
          if (item.quantidade > 3) {
            statusCalc = 'EM_ESTOQUE';
          } else if (item.quantidade > 0) {
            statusCalc = 'ESTOQUE_BAIXO';
          }
          return {
            ...item,
            status: statusCalc
          };
        }).sort((a, b) => b.quantidade - a.quantidade);

        if (isMounted) {
          setEstoqueFiliais(resultadoFiliais);
          setVariacoesCores(Object.values(coresAgrupadas).sort((a, b) => b.quantidade - a.quantidade));
        }
      } catch (err) {
        console.error('[ModalDetalheEstoqueProduto] Falha ao processar dados de estoque:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    carregarDetalhesEstoque();

    return () => {
      isMounted = false;
    };
  }, [isOpen, produto, produtoNome, produtoId, filiais, mapaFiliaisNome]);

  if (!isOpen || !produto) return null;

  const totalGeral = estoqueFiliais.reduce((acc, curr) => acc + curr.quantidade, 0);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="bg-[#121214] border border-[#27272a] rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scaleUp"
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
          {/* Card 1: Preço de Venda */}
          <div className="bg-[#1a1a1e] border border-[#27272a] rounded-xl p-3">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              Preço de Venda
            </span>
            <span className="text-base sm:text-lg font-extrabold font-mono text-emerald-400 mt-1 block">
              {formatCurrency(precoVenda)}
            </span>
          </div>

          {/* Card 2: Estoque Total Rede */}
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

          {/* Card 3: Cor Principal */}
          <div className="bg-[#1a1a1e] border border-[#27272a] rounded-xl p-3">
            <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1">
              <Palette size={11} /> Cor Padrão
            </span>
            <span className="text-xs sm:text-sm font-bold text-white mt-1 block truncate" title={corAtual}>
              {corAtual}
            </span>
          </div>

          {/* Card 4: Filiais com Estoque */}
          <div className="bg-[#1a1a1e] border border-[#27272a] rounded-xl p-3">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
              <Store size={11} /> Lojas Abastecidas
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-base sm:text-lg font-extrabold font-mono text-white">
                {estoqueFiliais.filter(f => f.quantidade > 0).length}
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
            Estoque por Loja / Filial ({estoqueFiliais.length})
          </button>
          {variacoesCores.length > 0 && (
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
          )}
        </div>

        {/* CONTEÚDO PRINCIPAL (TABELA COM SCROLL INTERNO) */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-zinc-500">
              <Loader2 className="animate-spin text-purple-500" size={28} />
              <span className="text-xs font-medium">Consultando distribuição de estoque na rede...</span>
            </div>
          ) : abaAtiva === 'filiais' ? (
            <div className="border border-[#222] rounded-xl overflow-hidden bg-black/40">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#18181b] border-b border-[#27272a] text-zinc-400 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Filial / Loja</th>
                    <th className="py-3 px-4 text-center">Quantidade</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Última Movimentação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222]">
                  {estoqueFiliais.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-zinc-500 italic">
                        Nenhuma filial encontrada para este produto.
                      </td>
                    </tr>
                  ) : (
                    estoqueFiliais.map(item => (
                      <tr 
                        key={item.filial_id}
                        className={`hover:bg-zinc-800/40 transition-colors ${
                          item.quantidade > 0 ? 'bg-transparent' : 'opacity-60'
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Store size={14} className={item.quantidade > 0 ? 'text-purple-400' : 'text-zinc-600'} />
                            <span className="font-bold text-white text-xs">{item.filial_nome}</span>
                          </div>
                          {item.imeis.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {item.imeis.slice(0, 3).map((im, idx) => (
                                <span key={idx} className="font-mono text-[9px] bg-zinc-900 border border-zinc-800 text-zinc-400 px-1.5 py-0.2 rounded">
                                  {im}
                                </span>
                              ))}
                              {item.imeis.length > 3 && (
                                <span className="text-[9px] text-purple-400 font-mono">
                                  +{item.imeis.length - 3} seriais
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-white text-xs sm:text-sm">
                          <span className={item.quantidade > 0 ? 'text-cyan-400' : 'text-zinc-600'}>
                            {item.quantidade} unids
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            item.status === 'EM_ESTOQUE'
                              ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40'
                              : item.status === 'ESTOQUE_BAIXO'
                              ? 'bg-amber-950/40 text-amber-400 border border-amber-800/40'
                              : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              item.status === 'EM_ESTOQUE' ? 'bg-emerald-400' : item.status === 'ESTOQUE_BAIXO' ? 'bg-amber-400' : 'bg-zinc-600'
                            }`} />
                            {item.status === 'EM_ESTOQUE' ? 'Em Estoque' : item.status === 'ESTOQUE_BAIXO' ? 'Estoque Baixo' : 'Esgotado'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-[11px] text-zinc-400">
                          {item.ultima_movimentacao ? (
                            new Date(item.ultima_movimentacao).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          ) : (
                            <span className="text-zinc-600">Sem registros</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-3">
              {variacoesCores.map((v, i) => (
                <div key={i} className="p-3.5 rounded-xl border border-[#27272a] bg-black/40 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-3.5 h-3.5 rounded-full border border-white/20 bg-purple-500" />
                    <div>
                      <span className="font-bold text-white text-xs sm:text-sm">{v.cor}</span>
                      <div className="flex flex-wrap gap-2 text-[11px] text-zinc-400 mt-0.5">
                        {Object.entries(v.filiaisMap).map(([loja, q]) => (
                          <span key={loja}>
                            {loja}: <strong className="text-zinc-200">{q}</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-mono font-bold text-cyan-400">
                      {v.quantidade} unids
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

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

            {onAjustarSaldo && (
              <button
                type="button"
                onClick={() => onAjustarSaldo(produto)}
                className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
              >
                <Sliders size={13} />
                Ajustar Saldo
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

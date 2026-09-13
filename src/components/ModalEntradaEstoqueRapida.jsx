import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import {
  X,
  Package,
  Barcode,
  Search,
  Plus,
  Minus,
  CheckCircle2,
  Loader2,
  Store,
  Tag,
  AlertCircle
} from 'lucide-react';

export default function ModalEntradaEstoqueRapida({
  isOpen,
  onClose,
  perfilUsuario,
  session,
  activeFilialId,
  activeFilialNome,
  onSuccess
}) {
  const [busca, setBusca] = useState('');
  const [produtoSelecionado, setProdutoSelecionado] = useState(null);
  const [quantidade, setQuantidade] = useState('1');
  const [observacao, setObservacao] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingProdutos, setLoadingProdutos] = useState(false);
  const [produtosLocais, setProdutosLocais] = useState([]);
  const [catalogoGeral, setCatalogoGeral] = useState([]);
  const [erroMsg, setErroMsg] = useState(null);

  const inputBuscaRef = useRef(null);

  // Filial fixa do vendedor
  const filialIdFixa = useMemo(() => {
    return (
      activeFilialId ||
      perfilUsuario?.filial_id ||
      session?.user?.user_metadata?.filial_id ||
      localStorage.getItem('zenite_active_filial_id') ||
      localStorage.getItem('activeFilialId') ||
      ''
    );
  }, [activeFilialId, perfilUsuario, session]);

  const nomeFilialFixa = useMemo(() => {
    return (
      activeFilialNome ||
      perfilUsuario?.filial?.nome ||
      localStorage.getItem('zenite_active_filial_nome') ||
      'Minha Filial'
    );
  }, [activeFilialNome, perfilUsuario]);

  // Foco automático imediato ao abrir o modal
  useEffect(() => {
    if (isOpen) {
      // Foco instantâneo síncrono/microtask
      const timerInstant = setTimeout(() => {
        if (inputBuscaRef.current) {
          inputBuscaRef.current.focus();
          inputBuscaRef.current.select?.();
        }
      }, 50);

      const timerBackup = setTimeout(() => {
        if (inputBuscaRef.current && document.activeElement !== inputBuscaRef.current) {
          inputBuscaRef.current.focus();
        }
      }, 250);

      return () => {
        clearTimeout(timerInstant);
        clearTimeout(timerBackup);
      };
    }
  }, [isOpen]);

  // Carregar produtos da filial e catálogo quando o modal abrir
  useEffect(() => {
    if (!isOpen) {
      setBusca('');
      setProdutoSelecionado(null);
      setQuantidade('1');
      setObservacao('');
      setErroMsg(null);
      return;
    }

    const carregarDados = async () => {
      setLoadingProdutos(true);
      setErroMsg(null);
      try {
        const empresaId =
          perfilUsuario?.empresa_id ||
          session?.user?.user_metadata?.empresa_id;

        // 1. Produtos já existentes na filial
        let queryProdutos = supabase.from('produtos').select('*');
        if (filialIdFixa) {
          queryProdutos = queryProdutos.eq('filial_id', filialIdFixa);
        } else if (empresaId) {
          queryProdutos = queryProdutos.eq('empresa_id', empresaId);
        }
        const { data: dataProds, error: errProds } = await queryProdutos;
        if (!errProds && dataProds) {
          setProdutosLocais(dataProds);
        }

        // 2. Catálogo geral mestre para reposição de novos itens
        let queryCat = supabase.from('produtos_catalogo').select('*');
        if (empresaId) {
          queryCat = queryCat.eq('empresa_id', empresaId);
        }
        const { data: dataCat } = await queryCat;
        if (dataCat) {
          setCatalogoGeral(dataCat);
        }
      } catch (err) {
        console.warn('Erro ao carregar produtos para entrada rápida:', err);
      } finally {
        setLoadingProdutos(false);
        setTimeout(() => {
          if (inputBuscaRef.current && !produtoSelecionado) {
            inputBuscaRef.current.focus();
          }
        }, 100);
      }
    };

    carregarDados();
  }, [isOpen, filialIdFixa, perfilUsuario, session]);

  // Itens filtrados para o dropdown de busca rápida
  const resultadosBusca = useMemo(() => {
    const q = busca.toLowerCase().trim();
    if (!q || q.length < 2) return [];

    const matchesLocais = produtosLocais.filter((p) => {
      return (
        (p.nome && p.nome.toLowerCase().includes(q)) ||
        (p.codigo_barras && p.codigo_barras.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.categoria && p.categoria.toLowerCase().includes(q))
      );
    });

    // Se já encontramos localmente, retorna
    if (matchesLocais.length > 0) {
      return matchesLocais.slice(0, 10);
    }

    // Se não encontrou no estoque local, busca no catálogo mestre
    const matchesCat = catalogoGeral.filter((c) => {
      return (
        (c.nome && c.nome.toLowerCase().includes(q)) ||
        (c.codigo_barras && c.codigo_barras.toLowerCase().includes(q)) ||
        (c.sku && c.sku.toLowerCase().includes(q)) ||
        (c.categoria && c.categoria.toLowerCase().includes(q))
      );
    });

    return matchesCat.slice(0, 10);
  }, [busca, produtosLocais, catalogoGeral]);

  // Selecionar produto
  const handleSelecionarProduto = (item) => {
    setProdutoSelecionado(item);
    setBusca(item.nome || '');
  };

  // Submeter bipagem direta via tecla Enter
  const handleBuscaKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const termo = busca.trim().toLowerCase();
      if (!termo) return;

      // Busca exata por código de barras ou SKU
      const exatoLocal = produtosLocais.find(
        (p) =>
          (p.codigo_barras && p.codigo_barras.toLowerCase() === termo) ||
          (p.sku && p.sku.toLowerCase() === termo) ||
          (p.nome && p.nome.toLowerCase() === termo)
      );

      if (exatoLocal) {
        handleSelecionarProduto(exatoLocal);
        return;
      }

      const exatoCat = catalogoGeral.find(
        (c) =>
          (c.codigo_barras && c.codigo_barras.toLowerCase() === termo) ||
          (c.sku && c.sku.toLowerCase() === termo) ||
          (c.nome && c.nome.toLowerCase() === termo)
      );

      if (exatoCat) {
        handleSelecionarProduto(exatoCat);
        return;
      }

      if (resultadosBusca.length > 0) {
        handleSelecionarProduto(resultadosBusca[0]);
      }
    }
  };

  // Ação de confirmar e salvar a entrada de estoque
  const handleConfirmarEntrada = async (e) => {
    if (e) e.preventDefault();
    setErroMsg(null);

    if (!produtoSelecionado) {
      setErroMsg('Selecione ou bipe um produto antes de confirmar.');
      return;
    }

    const qtdNum = parseInt(quantidade, 10);
    if (isNaN(qtdNum) || qtdNum <= 0) {
      setErroMsg('Informe uma quantidade válida maior que zero.');
      return;
    }

    if (!filialIdFixa) {
      setErroMsg('Erro: Nenhuma filial de trabalho ativa foi detectada.');
      return;
    }

    setLoading(true);
    try {
      const empresaId =
        perfilUsuario?.empresa_id ||
        session?.user?.user_metadata?.empresa_id ||
        produtoSelecionado.empresa_id;
      const userId = session?.user?.id || perfilUsuario?.id;

      let targetProdutoId = produtoSelecionado.id;
      let saldoAnterior = Number(produtoSelecionado.quantidade || 0);

      // Verificar se o produto já existe na tabela 'produtos' com a filialIdFixa
      const { data: prodExistente, error: findErr } = await supabase
        .from('produtos')
        .select('*')
        .eq('filial_id', filialIdFixa)
        .eq('nome', produtoSelecionado.nome)
        .maybeSingle();

      if (findErr && findErr.code !== 'PGRST116') {
        console.warn('Aviso busca produto na filial:', findErr);
      }

      if (prodExistente) {
        // Incrementa a coluna quantidade do produto existente
        targetProdutoId = prodExistente.id;
        saldoAnterior = Number(prodExistente.quantidade || 0);
        const novoSaldo = saldoAnterior + qtdNum;

        const updatePayload = {
          quantidade: novoSaldo,
          status: 'Disponível'
        };
        if (produtoSelecionado.codigo_barras && !prodExistente.codigo_barras) {
          updatePayload.codigo_barras = produtoSelecionado.codigo_barras;
        }

        const { error: updateErr } = await supabase
          .from('produtos')
          .update(updatePayload)
          .eq('id', targetProdutoId);

        if (updateErr) throw updateErr;
      } else {
        // Se ainda não existia nessa filial, cria o registro na filial do operador
        const novoPayload = {
          empresa_id: empresaId,
          filial_id: filialIdFixa,
          nome: produtoSelecionado.nome,
          tipo: produtoSelecionado.tipo || 'ACESSORIO',
          categoria: produtoSelecionado.categoria || 'ACESSORIO',
          cor: produtoSelecionado.cor || null,
          codigo_barras: produtoSelecionado.codigo_barras || produtoSelecionado.sku || null,
          sku: produtoSelecionado.sku || null,
          preco: parseFloat(produtoSelecionado.preco || 0),
          preco_venda: parseFloat(produtoSelecionado.preco_venda || produtoSelecionado.preco || 0),
          quantidade: qtdNum,
          status: 'Disponível'
        };

        const { data: novoProd, error: insertProdErr } = await supabase
          .from('produtos')
          .insert(novoPayload)
          .select()
          .single();

        if (insertProdErr) throw insertProdErr;
        targetProdutoId = novoProd.id;
      }

      // Registrar obrigatoriamente a movimentação em estoque_movimentacoes
      // Compatibilidade: tenta ENTRADA_AVULSA e faz fallback para ENTRADA_AQUISICAO caso haja check constraint
      const obsTexto = observacao.trim()
        ? `Entrada Rápida PDV: ${observacao.trim()}`
        : `Entrada rápida de ${qtdNum} un. na filial ${nomeFilialFixa}`;

      const movPayload = {
        empresa_id: empresaId,
        filial_destino_id: filialIdFixa,
        produto_id: targetProdutoId,
        quantidade: qtdNum,
        tipo_movimentacao: 'ENTRADA_AVULSA',
        criado_por: userId,
        status: 'CONCLUIDO',
        observacao: obsTexto
      };

      const { error: movErr } = await supabase
        .from('estoque_movimentacoes')
        .insert(movPayload);

      if (movErr) {
        console.warn('Aviso insert ENTRADA_AVULSA, aplicando fallback:', movErr.message);
        // Fallback para constraint ENTRADA_AQUISICAO
        const fallbackPayload = {
          ...movPayload,
          tipo_movimentacao: 'ENTRADA_AQUISICAO'
        };
        // Remove status se a coluna não existir
        delete fallbackPayload.status;
        await supabase.from('estoque_movimentacoes').insert(fallbackPayload);
      }

      // Notificar sucesso e disparar recarregamento
      if (onSuccess) {
        onSuccess(qtdNum, produtoSelecionado.nome);
      }
      onClose();
    } catch (err) {
      console.error('Erro ao registrar entrada rápida:', err);
      setErroMsg('Falha ao salvar entrada: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#0A0A0A] border border-[#6A0DAD]/40 rounded-2xl w-full max-w-lg shadow-2xl shadow-[#6A0DAD]/20 overflow-hidden flex flex-col">
        {/* Cabeçalho do Modal */}
        <div className="p-5 border-b border-[#222222] flex items-center justify-between bg-gradient-to-r from-[#120024] to-[#0A0A0A]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#6A0DAD]/20 border border-[#6A0DAD]/40 flex items-center justify-center text-[#6A0DAD]">
              <Package size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                Entrada Rápida de Mercadoria
              </h3>
              <p className="text-[11px] text-gray-400">
                Confira a quantidade física antes de confirmar o saldo
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Corpo do Formulário */}
        <form onSubmit={handleConfirmarEntrada} className="p-6 space-y-5">
          {/* Filial Travada (Fixa na filial ativa) */}
          <div className="flex items-center justify-between bg-black/60 border border-[#222222] rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 text-xs">
              <Store size={16} className="text-[#6A0DAD] shrink-0" />
              <span className="text-gray-400 font-medium">Filial de Destino:</span>
              <span className="text-white font-extrabold tracking-wide uppercase">
                {nomeFilialFixa}
              </span>
            </div>
            <span className="text-[10px] bg-[#6A0DAD]/20 text-purple-300 font-bold px-2 py-0.5 rounded border border-[#6A0DAD]/30">
              Travada / Fixa
            </span>
          </div>

          {/* Mensagem de Erro se houver */}
          {erroMsg && (
            <div className="bg-red-950/40 border border-red-800/60 rounded-xl p-3 text-red-400 text-xs flex items-center gap-2 animate-fadeIn">
              <AlertCircle size={16} className="shrink-0" />
              <span>{erroMsg}</span>
            </div>
          )}

          {/* 1. Campo de Busca / Bipagem */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-300 flex justify-between items-center">
              <span>Bipar Código de Barras / Buscar Produto *</span>
              {produtoSelecionado && (
                <button
                  type="button"
                  onClick={() => {
                    setProdutoSelecionado(null);
                    setBusca('');
                    if (inputBuscaRef.current) inputBuscaRef.current.focus();
                  }}
                  className="text-[10px] text-purple-400 hover:underline font-bold"
                >
                  Trocar Produto
                </button>
              )}
            </label>
            <div className="relative">
              <input
                ref={inputBuscaRef}
                type="text"
                autoFocus
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  if (produtoSelecionado && e.target.value !== produtoSelecionado.nome) {
                    setProdutoSelecionado(null);
                  }
                }}
                onKeyDown={handleBuscaKeyDown}
                placeholder="Bipe o código de barras, SKU ou digite o nome..."
                className={`w-full bg-black border rounded-xl pl-10 pr-4 py-3 text-xs text-white outline-none font-medium transition-all ${
                  produtoSelecionado
                    ? 'border-emerald-500/60 bg-emerald-950/10'
                    : 'border-[#222222] focus:border-[#6A0DAD]'
                }`}
              />
              <Barcode
                size={18}
                className={`absolute left-3.5 top-3.5 transition-colors ${
                  produtoSelecionado ? 'text-emerald-400' : 'text-gray-500'
                }`}
              />
              {loadingProdutos && (
                <Loader2
                  size={16}
                  className="absolute right-3.5 top-3.5 animate-spin text-[#6A0DAD]"
                />
              )}
            </div>

            {/* Dropdown de sugestões de busca */}
            {!produtoSelecionado && resultadosBusca.length > 0 && (
              <div className="bg-[#111111] border border-[#222222] rounded-xl shadow-2xl max-h-48 overflow-y-auto divide-y divide-[#222222] mt-1 z-10">
                {resultadosBusca.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelecionarProduto(item)}
                    className="w-full text-left px-4 py-2.5 hover:bg-[#6A0DAD]/15 flex items-center justify-between gap-3 transition-colors text-xs cursor-pointer"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-white truncate">{item.nome}</p>
                      <div className="flex items-center gap-2 text-[10px] text-gray-400 font-mono mt-0.5">
                        {item.codigo_barras && <span>EAN: {item.codigo_barras}</span>}
                        {item.sku && <span>SKU: {item.sku}</span>}
                        <span className="text-purple-300">({item.categoria || item.tipo || 'Geral'})</span>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-emerald-400 shrink-0 font-bold">
                      Estoque: {item.quantidade ?? item.estoque ?? 0}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Card informativo do item selecionado */}
            {produtoSelecionado && (
              <div className="bg-[#6A0DAD]/10 border border-[#6A0DAD]/30 rounded-xl p-3 flex items-center justify-between gap-3 animate-fadeIn">
                <div className="min-w-0">
                  <span className="text-[10px] text-purple-300 font-extrabold uppercase tracking-wider block">
                    Item Selecionado
                  </span>
                  <p className="text-xs font-bold text-white truncate">
                    {produtoSelecionado.nome}
                  </p>
                  <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                    Saldo atual nesta loja:{' '}
                    <strong className="text-emerald-400">
                      {produtoSelecionado.quantidade ?? 0} un.
                    </strong>
                  </p>
                </div>
                <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 size={16} />
                </div>
              </div>
            )}
          </div>

          {/* 2. Quantidade Recebida */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-300">
              Quantidade Recebida <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const val = Math.max(1, (parseInt(quantidade, 10) || 1) - 1);
                  setQuantidade(String(val));
                }}
                className="w-12 h-11 bg-black border border-[#222222] hover:border-[#6A0DAD] rounded-xl flex items-center justify-center text-white hover:text-[#6A0DAD] transition-all cursor-pointer shrink-0"
              >
                <Minus size={16} />
              </button>
              <input
                type="number"
                min="1"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                className="flex-1 bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-xl py-2.5 text-center text-base font-extrabold text-white outline-none font-mono transition-all"
                placeholder="1"
              />
              <button
                type="button"
                onClick={() => {
                  const val = (parseInt(quantidade, 10) || 0) + 1;
                  setQuantidade(String(val));
                }}
                className="w-12 h-11 bg-black border border-[#222222] hover:border-[#6A0DAD] rounded-xl flex items-center justify-center text-white hover:text-[#6A0DAD] transition-all cursor-pointer shrink-0"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* 3. Observação (Opcional) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-300">
              Observação <span className="text-[10px] text-gray-500 font-normal">(Opcional)</span>
            </label>
            <input
              type="text"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: Recebido do fornecedor, reposição de balcão..."
              className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-xl px-4 py-2.5 text-xs text-white outline-none transition-all placeholder:text-gray-600"
            />
          </div>

          {/* Botão de Ação */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !produtoSelecionado}
              className="w-full bg-[#6A0DAD] hover:bg-[#500885] disabled:bg-gray-800 disabled:text-gray-500 text-white font-extrabold py-3.5 px-6 rounded-xl transition-all flex items-center justify-center gap-2 text-xs shadow-lg shadow-[#6A0DAD]/20 hover:shadow-[#6A0DAD]/40 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Atualizando Estoque...
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  Confirmar Entrada no Estoque
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

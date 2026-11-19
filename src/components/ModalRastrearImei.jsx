import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import {
  Search,
  X,
  Smartphone,
  Building2,
  User,
  Calendar,
  DollarSign,
  Hash,
  Phone,
  FileText,
  ArrowRight,
  CheckCircle2,
  PackagePlus,
  ArrowRightLeft,
  ShoppingBag,
  RotateCcw,
  Clock,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { formatCurrency } from '../utils/currencyUtils';
import ColorBadge from './ColorBadge';

/**
 * Normaliza qualquer registro retornado de `public.vw_rastreabilidade_imeis`
 * ou do fallback (`imeis` + `produtos` + `vendas` + `itens_venda` + `filiais`).
 */
function normalizarRegistroRastreio(raw, mapaFiliais = {}, mapaProdutos = {}) {
  if (!raw) return null;

  const imeiStr = String(raw.imei || raw.numero_imei || '').trim();
  if (!imeiStr) return null;

  const prodId = raw.produto_id || raw.id_produto || null;
  const prodRef = (prodId && mapaProdutos[String(prodId)]) || raw.produtos || null;

  const modelo =
    raw.modelo ||
    raw.produto_nome ||
    raw.nome_produto ||
    raw.modelo_nome ||
    raw.nome ||
    prodRef?.nome ||
    'Aparelho sem modelo identificado';

  const cor = raw.cor || raw.cor_aparelho || prodRef?.cor || null;

  // Determinação estrita de status (DISPONIVEL vs VENDIDO)
  const rawStatus = String(raw.status || raw.status_atual || '').trim().toUpperCase();
  const statusSemAcento = rawStatus.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const isVendido =
    raw.vendido === true ||
    statusSemAcento === 'VENDIDO' ||
    statusSemAcento.includes('VEND') ||
    Boolean(raw.venda_id || raw.id_venda);

  const isDisponivel = !isVendido && (statusSemAcento === 'DISPONIVEL' || raw.vendido === false);

  const filialId = raw.filial_id || raw.filial_atual_id || raw.loja_id || prodRef?.filial_id || null;
  const filialNome =
    raw.filial_nome ||
    raw.nome_filial ||
    raw.loja_atual ||
    raw.filial_atual ||
    raw.filiais?.nome ||
    (filialId && mapaFiliais[String(filialId)]) ||
    'Loja não identificada';

  // Dados da Venda (se vendido)
  const vendaId = raw.venda_id || raw.id_venda || null;
  const clienteNome =
    raw.cliente_nome ||
    raw.nome_cliente ||
    raw.comprador_nome ||
    raw.clientes?.nome ||
    null;
  const clienteCpf =
    raw.cliente_cpf_cnpj ||
    raw.cliente_cpf ||
    raw.cpf_cliente ||
    raw.cpf_cnpj ||
    raw.cpf ||
    raw.clientes?.cpf_cnpj ||
    raw.clientes?.cpf ||
    null;
  const clienteTelefone =
    raw.cliente_telefone ||
    raw.telefone_cliente ||
    raw.telefone ||
    raw.whatsapp_cliente ||
    raw.clientes?.telefone ||
    null;
  const dataVenda =
    raw.data_venda ||
    raw.vendido_em ||
    raw.venda_created_at ||
    raw.data_compra ||
    (isVendido ? raw.updated_at : null) ||
    null;

  const valorVendidoRaw =
    raw.valor_vendido ??
    raw.valor_venda ??
    raw.preco_unitario_vendido ??
    raw.preco_vendido ??
    raw.valor_total_venda ??
    raw.valor_total ??
    null;

  const valorVendido =
    valorVendidoRaw !== null && valorVendidoRaw !== undefined && !isNaN(Number(valorVendidoRaw))
      ? Number(valorVendidoRaw)
      : Number(raw.preco_venda || prodRef?.preco_venda || prodRef?.preco || 0);

  const vendedorNome = raw.vendedor_nome || raw.nome_vendedor || null;
  const formaPagamento = raw.forma_pagamento || raw.metodo_pagamento || null;
  const dataEntrada = raw.data_entrada || raw.created_at || null;

  return {
    id: raw.id || raw.imei_id || imeiStr,
    imei: imeiStr,
    produto_id: prodId,
    modelo,
    cor,
    status: isVendido ? 'VENDIDO' : isDisponivel ? 'DISPONIVEL' : (rawStatus || 'DISPONIVEL'),
    isVendido,
    isDisponivel,
    filial_id: filialId,
    filial_nome: filialNome,
    venda_id: vendaId,
    cliente_nome: clienteNome,
    cliente_cpf: clienteCpf,
    cliente_telefone: clienteTelefone,
    data_venda: dataVenda,
    valor_vendido: valorVendido,
    vendedor_nome: vendedorNome,
    forma_pagamento: formaPagamento,
    data_entrada: dataEntrada,
    raw
  };
}

function formatarDataHora(iso) {
  if (!iso) return 'Não informada';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return String(iso);
  }
}

export default function ModalRastrearImei({
  isOpen,
  onClose,
  empresaId = null,
  filiais = [],
  produtos = [],
  initialSearch = ''
}) {
  const [termoBusca, setTermoBusca] = useState(initialSearch || '');
  const [termoDebounced, setTermoDebounced] = useState(initialSearch || '');
  const [filtroStatus, setFiltroStatus] = useState('TODOS'); // 'TODOS' | 'DISPONIVEL' | 'VENDIDO'

  const [loadingLista, setLoadingLista] = useState(false);
  const [registros, setRegistros] = useState([]);
  const [aparelhoSelecionado, setAparelhoSelecionado] = useState(null);

  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [movimentacoesImei, setMovimentacoesImei] = useState([]);

  // Mapas auxiliares de filiais e produtos
  const mapaFiliais = useMemo(() => {
    const m = {};
    (filiais || []).forEach((f) => {
      if (f && f.id) m[String(f.id)] = f.nome;
    });
    return m;
  }, [filiais]);

  const mapaProdutos = useMemo(() => {
    const m = {};
    (produtos || []).forEach((p) => {
      if (p && p.id) m[String(p.id)] = p;
    });
    return m;
  }, [produtos]);

  // Atualiza busca inicial se o modal abrir já com um IMEI pré-selecionado
  useEffect(() => {
    if (isOpen && initialSearch) {
      setTermoBusca(initialSearch);
      setTermoDebounced(initialSearch);
    }
  }, [isOpen, initialSearch]);

  // Debounce da pesquisa
  useEffect(() => {
    const t = setTimeout(() => {
      setTermoDebounced(termoBusca.trim());
    }, 280);
    return () => clearTimeout(t);
  }, [termoBusca]);

  // Carrega dados de `public.vw_rastreabilidade_imeis` + enriquecimento com vendas/imeis
  const buscarAparelhos = useCallback(async () => {
    if (!isOpen) return;
    setLoadingLista(true);

    try {
      const listaFinalMap = new Map();

      // 1. Consulta prioritária à view `public.vw_rastreabilidade_imeis`
      try {
        let qView = supabase.from('vw_rastreabilidade_imeis').select('*').limit(500);
        const { data: viewData, error: viewErr } = await qView;

        if (!viewErr && Array.isArray(viewData)) {
          viewData.forEach((row) => {
            if (empresaId && row.empresa_id && String(row.empresa_id) !== String(empresaId)) {
              return;
            }
            const norm = normalizarRegistroRastreio(row, mapaFiliais, mapaProdutos);
            if (norm && norm.imei) {
              listaFinalMap.set(norm.imei, norm);
            }
          });
        } else if (viewErr) {
          console.warn('[ModalRastrearImei] Aviso ao consultar vw_rastreabilidade_imeis:', viewErr.message);
        }
      } catch (eView) {
        console.warn('[ModalRastrearImei] Fallback ativado para vw_rastreabilidade_imeis:', eView);
      }

      // 2. Complemento/Fallback na tabela `public.imeis` e `public.vendas` / `public.itens_venda`
      // Garante que qualquer aparelho ou dados de venda (CPF, Telefone, ID da Venda) estejam 100% completos
      let qImeis = supabase
        .from('imeis')
        .select('*, produtos(id, nome, categoria, cor, preco, preco_venda, filial_id), filiais(id, nome)')
        .order('created_at', { ascending: false })
        .limit(500);

      if (empresaId) {
        qImeis = qImeis.eq('empresa_id', empresaId);
      }

      const { data: imeisData } = await qImeis;
      if (Array.isArray(imeisData)) {
        imeisData.forEach((im) => {
          const norm = normalizarRegistroRastreio(im, mapaFiliais, mapaProdutos);
          if (!norm || !norm.imei) return;

          if (!listaFinalMap.has(norm.imei)) {
            listaFinalMap.set(norm.imei, norm);
          } else {
            // Mescla campos que porventura estivessem vazios na view
            const existente = listaFinalMap.get(norm.imei);
            listaFinalMap.set(norm.imei, {
              ...existente,
              cor: existente.cor || norm.cor,
              modelo:
                existente.modelo && existente.modelo !== 'Aparelho sem modelo identificado'
                  ? existente.modelo
                  : norm.modelo,
              filial_nome:
                existente.filial_nome && existente.filial_nome !== 'Loja não identificada'
                  ? existente.filial_nome
                  : norm.filial_nome,
              data_entrada: existente.data_entrada || norm.data_entrada
            });
          }
        });
      }

      // 3. Enriquecer aparelhos vendidos com dados da tabela `vendas` e `itens_venda` (Cliente, CPF, Telefone, Valor, ID da Venda)
      let qVendas = supabase
        .from('vendas')
        .select('id, imei, produto_nome, valor_total, preco_unitario_vendido, preco_unitario, cliente_id, cliente_nome, cliente_cpf_cnpj, cliente_telefone, vendedor_nome, forma_pagamento, status, created_at, filial_id')
        .not('imei', 'is', null)
        .order('created_at', { ascending: false })
        .limit(400);

      if (empresaId) {
        qVendas = qVendas.eq('empresa_id', empresaId);
      }

      const { data: vendasComImei } = await qVendas;
      if (Array.isArray(vendasComImei)) {
        vendasComImei.forEach((v) => {
          const statusVenda = String(v.status || '').toUpperCase();
          if (statusVenda === 'CANCELADA' || statusVenda === 'ESTORNADA' || statusVenda === 'EXCLUIDA') {
            return;
          }
          const imeiVenda = String(v.imei || '').trim();
          if (!imeiVenda) return;

          const existente = listaFinalMap.get(imeiVenda);
          const valorVendaReal = Number(v.preco_unitario_vendido || v.valor_total || v.preco_unitario || 0);

          if (existente) {
            listaFinalMap.set(imeiVenda, {
              ...existente,
              venda_id: existente.venda_id || v.id,
              cliente_nome: existente.cliente_nome || v.cliente_nome || 'Consumidor Final',
              cliente_cpf: existente.cliente_cpf || v.cliente_cpf_cnpj || null,
              cliente_telefone: existente.cliente_telefone || v.cliente_telefone || null,
              data_venda: existente.data_venda || v.created_at,
              valor_vendido: existente.valor_vendido > 0 ? existente.valor_vendido : valorVendaReal,
              vendedor_nome: existente.vendedor_nome || v.vendedor_nome || null,
              forma_pagamento: existente.forma_pagamento || v.forma_pagamento || null,
              modelo:
                existente.modelo && existente.modelo !== 'Aparelho sem modelo identificado'
                  ? existente.modelo
                  : (v.produto_nome || existente.modelo)
            });
          } else {
            // Caso o IMEI estivesse apenas registrado na venda histórica
            listaFinalMap.set(imeiVenda, {
              id: v.id,
              imei: imeiVenda,
              produto_id: null,
              modelo: v.produto_nome || 'Smartphone Vendido',
              cor: null,
              status: 'VENDIDO',
              isVendido: true,
              isDisponivel: false,
              filial_id: v.filial_id,
              filial_nome: (v.filial_id && mapaFiliais[String(v.filial_id)]) || 'Loja da Venda',
              venda_id: v.id,
              cliente_nome: v.cliente_nome || 'Consumidor Final',
              cliente_cpf: v.cliente_cpf_cnpj || null,
              cliente_telefone: v.cliente_telefone || null,
              data_venda: v.created_at,
              valor_vendido: valorVendaReal,
              vendedor_nome: v.vendedor_nome || null,
              forma_pagamento: v.forma_pagamento || null,
              data_entrada: null,
              raw: v
            });
          }
        });
      }

      const listaOrdenada = Array.from(listaFinalMap.values()).sort((a, b) => {
        const tA = new Date(a.data_venda || a.data_entrada || 0).getTime();
        const tB = new Date(b.data_venda || b.data_entrada || 0).getTime();
        return tB - tA;
      });

      setRegistros(listaOrdenada);

      // Se houver um initialSearch exato, já seleciona o primeiro aparelho correspondente
      if (initialSearch) {
        const matchExato = listaOrdenada.find(
          (r) => r.imei.toLowerCase() === initialSearch.trim().toLowerCase()
        );
        if (matchExato) {
          setAparelhoSelecionado(matchExato);
        }
      }
    } catch (err) {
      console.error('[ModalRastrearImei] Erro ao carregar rastreabilidade de IMEIs:', err);
    } finally {
      setLoadingLista(false);
    }
  }, [isOpen, empresaId, mapaFiliais, mapaProdutos, initialSearch]);

  useEffect(() => {
    if (isOpen) {
      buscarAparelhos();
    } else {
      setAparelhoSelecionado(null);
      setMovimentacoesImei([]);
    }
  }, [isOpen, buscarAparelhos]);

  // Carrega a Linha do Tempo completa da tabela `public.estoque_movimentacoes` ao selecionar um aparelho
  const carregarLinhaDoTempo = useCallback(
    async (aparelho) => {
      if (!aparelho || !aparelho.imei) {
        setMovimentacoesImei([]);
        return;
      }

      setLoadingHistorico(true);
      try {
        const imeiAlvo = aparelho.imei;
        let movs = [];

        // 1. Busca direta com join nas filiais de origem e destino
        const { data: dataJoin, error: errJoin } = await supabase
          .from('estoque_movimentacoes')
          .select(`
            id,
            empresa_id,
            produto_id,
            imei,
            tipo_movimentacao,
            filial_origem_id,
            filial_destino_id,
            quantidade,
            observacao,
            criado_por,
            created_at,
            filial_origem:filiais!filial_origem_id (id, nome),
            filial_destino:filiais!filial_destino_id (id, nome)
          `)
          .or(`imei.eq.${imeiAlvo},observacao.ilike.%${imeiAlvo}%`)
          .order('created_at', { ascending: false });

        if (!errJoin && Array.isArray(dataJoin)) {
          movs = dataJoin;
        } else {
          // Fallback resiliente sem join explícito caso a FK tenha outro nome no banco
          const { data: dataSimples } = await supabase
            .from('estoque_movimentacoes')
            .select('*')
            .or(`imei.eq.${imeiAlvo},observacao.ilike.%${imeiAlvo}%`)
            .order('created_at', { ascending: false });

          if (Array.isArray(dataSimples)) {
            movs = dataSimples.map((m) => ({
              ...m,
              filial_origem: m.filial_origem_id
                ? { id: m.filial_origem_id, nome: mapaFiliais[String(m.filial_origem_id)] || 'Filial Origem' }
                : null,
              filial_destino: m.filial_destino_id
                ? { id: m.filial_destino_id, nome: mapaFiliais[String(m.filial_destino_id)] || 'Filial Destino' }
                : null
            }));
          }
        }

        // Enriquecer caso o cliente/usuário não tenha vindo nos metadados da venda ainda
        if (aparelho.isVendido && (!aparelho.cliente_cpf || !aparelho.cliente_telefone) && aparelho.venda_id) {
          const { data: vendaDetalhe } = await supabase
            .from('vendas')
            .select('id, cliente_id, cliente_nome, cliente_cpf_cnpj, cliente_telefone, valor_total, preco_unitario_vendido, vendedor_nome, forma_pagamento, created_at')
            .eq('id', aparelho.venda_id)
            .maybeSingle();

          if (vendaDetalhe) {
            let cpfCliente = vendaDetalhe.cliente_cpf_cnpj || aparelho.cliente_cpf;
            let telCliente = vendaDetalhe.cliente_telefone || aparelho.cliente_telefone;
            let nomeCliente = vendaDetalhe.cliente_nome || aparelho.cliente_nome;

            if (vendaDetalhe.cliente_id && (!cpfCliente || !telCliente)) {
              const { data: cliDb } = await supabase
                .from('clientes')
                .select('nome, cpf_cnpj, telefone')
                .eq('id', vendaDetalhe.cliente_id)
                .maybeSingle();
              if (cliDb) {
                cpfCliente = cpfCliente || cliDb.cpf_cnpj || cliDb.cpf;
                telCliente = telCliente || cliDb.telefone;
                nomeCliente = nomeCliente || cliDb.nome;
              }
            }

            setAparelhoSelecionado((prev) =>
              prev && prev.imei === aparelho.imei
                ? {
                    ...prev,
                    cliente_nome: nomeCliente || prev.cliente_nome,
                    cliente_cpf: cpfCliente || prev.cliente_cpf,
                    cliente_telefone: telCliente || prev.cliente_telefone,
                    vendedor_nome: vendaDetalhe.vendedor_nome || prev.vendedor_nome,
                    forma_pagamento: vendaDetalhe.forma_pagamento || prev.forma_pagamento
                  }
                : prev
            );
          }
        }

        // Garantir que a linha do tempo sempre mostre os marcos principais (Entrada e Venda se aplicável)
        const temEventoEntrada = movs.some((m) =>
          String(m.tipo_movimentacao || '').toUpperCase().includes('ENTRADA')
        );
        const temEventoVenda = movs.some((m) =>
          String(m.tipo_movimentacao || '').toUpperCase().includes('VENDA')
        );

        const listaCompleta = [...movs];

        if (aparelho.isVendido && aparelho.data_venda && !temEventoVenda) {
          listaCompleta.push({
            id: `sintetico_venda_${aparelho.imei}`,
            imei: aparelho.imei,
            tipo_movimentacao: 'SAIDA_VENDA',
            filial_origem: { id: aparelho.filial_id, nome: aparelho.filial_nome },
            filial_destino: null,
            quantidade: 1,
            observacao: `Venda concluída para ${aparelho.cliente_nome || 'Cliente'}${
              aparelho.venda_id ? ` (Venda #${String(aparelho.venda_id).slice(0, 8)})` : ''
            }`,
            created_at: aparelho.data_venda
          });
        }

        if (aparelho.data_entrada && !temEventoEntrada) {
          listaCompleta.push({
            id: `sintetico_entrada_${aparelho.imei}`,
            imei: aparelho.imei,
            tipo_movimentacao: 'ENTRADA_AQUISICAO',
            filial_origem: null,
            filial_destino: { id: aparelho.filial_id, nome: aparelho.filial_nome },
            quantidade: 1,
            observacao: `Cadastro inicial / entrada do aparelho no estoque (${aparelho.filial_nome})`,
            created_at: aparelho.data_entrada
          });
        }

        listaCompleta.sort(
          (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        );

        setMovimentacoesImei(listaCompleta);
      } catch (err) {
        console.error('[ModalRastrearImei] Erro ao carregar histórico de movimentações:', err);
        setMovimentacoesImei([]);
      } finally {
        setLoadingHistorico(false);
      }
    },
    [mapaFiliais]
  );

  useEffect(() => {
    if (aparelhoSelecionado) {
      carregarLinhaDoTempo(aparelhoSelecionado);
    } else {
      setMovimentacoesImei([]);
    }
  }, [aparelhoSelecionado?.imei, carregarLinhaDoTempo]);

  // Filtragem em tempo real por Número de IMEI, Nome do Cliente ou Modelo do Aparelho
  const resultadosFiltrados = useMemo(() => {
    return registros.filter((r) => {
      if (filtroStatus === 'DISPONIVEL' && !r.isDisponivel) return false;
      if (filtroStatus === 'VENDIDO' && !r.isVendido) return false;

      if (!termoDebounced) return true;

      const t = termoDebounced.toLowerCase();
      const matchImei = String(r.imei || '').toLowerCase().includes(t);
      const matchCliente = String(r.cliente_nome || '').toLowerCase().includes(t);
      const matchCpf = String(r.cliente_cpf || '').toLowerCase().includes(t);
      const matchModelo = String(r.modelo || '').toLowerCase().includes(t);
      const matchFilial = String(r.filial_nome || '').toLowerCase().includes(t);

      return matchImei || matchCliente || matchCpf || matchModelo || matchFilial;
    });
  }, [registros, termoDebounced, filtroStatus]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 md:p-6 animate-fadeIn">
      <div className="bg-[#0b0b0f] border border-purple-500/30 rounded-2xl max-w-6xl w-full max-h-[92vh] flex flex-col shadow-2xl shadow-purple-950/40 overflow-hidden">
        {/* Cabeçalho do Modal */}
        <div className="bg-gradient-to-r from-[#120b1e] via-[#160f24] to-[#0d0d12] border-b border-zinc-800/80 px-5 py-4 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-600/20 border border-purple-500/40 rounded-xl text-purple-300 shadow-inner">
              <Search size={20} className="text-purple-400" />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
                🔍 Rastrear IMEI & Histórico de Vendas
              </h2>
              <p className="text-xs text-zinc-400">
                Investigação completa de aparelhos disponíveis em loja ou já vendidos, com ficha do comprador e linha do tempo.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={buscarAparelhos}
              disabled={loadingLista}
              className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/70 rounded-xl text-xs font-bold text-zinc-300 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Atualizar base de IMEIs"
            >
              <RefreshCw size={13} className={loadingLista ? 'animate-spin text-purple-400' : ''} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              title="Fechar (Esc)"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Barra de Pesquisa Rápida e Filtros */}
        <div className="p-4 bg-[#0f0f15] border-b border-zinc-800/80 flex flex-col md:flex-row items-stretch md:items-center gap-3 shrink-0">
          <div className="relative flex-1">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-purple-400 pointer-events-none" />
            <input
              type="text"
              autoFocus
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
              placeholder="Pesquisar por número do IMEI, nome do cliente, CPF ou modelo do aparelho..."
              className="w-full bg-black/80 border border-zinc-700/80 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 rounded-xl pl-10 pr-9 py-2.5 text-xs md:text-sm text-white placeholder-zinc-500 outline-none font-medium transition-all"
            />
            {termoBusca && (
              <button
                type="button"
                onClick={() => setTermoBusca('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-1 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setFiltroStatus('TODOS')}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                filtroStatus === 'TODOS'
                  ? 'bg-purple-600 border-purple-500 text-white shadow-md shadow-purple-900/30'
                  : 'bg-black/60 border-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              Todos ({registros.length})
            </button>
            <button
              type="button"
              onClick={() => setFiltroStatus('DISPONIVEL')}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                filtroStatus === 'DISPONIVEL'
                  ? 'bg-emerald-600/25 border-emerald-500 text-emerald-300'
                  : 'bg-black/60 border-zinc-800 text-emerald-400/70 hover:text-emerald-300'
              }`}
            >
              Disponíveis ({registros.filter((r) => r.isDisponivel).length})
            </button>
            <button
              type="button"
              onClick={() => setFiltroStatus('VENDIDO')}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                filtroStatus === 'VENDIDO'
                  ? 'bg-purple-500/25 border-purple-400 text-purple-200'
                  : 'bg-black/60 border-zinc-800 text-purple-400/70 hover:text-purple-300'
              }`}
            >
              Vendidos ({registros.filter((r) => r.isVendido).length})
            </button>
          </div>
        </div>

        {/* Corpo Principal Dividido: Lista à Esquerda + Ficha Completa e Timeline à Direita */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* Coluna Esquerda: Resultados da Busca */}
          <div className="lg:col-span-5 border-b lg:border-b-0 lg:border-r border-zinc-800/80 flex flex-col min-h-0 bg-[#0b0b0f]">
            <div className="px-4 py-2.5 bg-zinc-900/50 border-b border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-400 shrink-0">
              <span>
                Resultados encontrados: <strong className="text-white">{resultadosFiltrados.length}</strong>
              </span>
              <span>Clique em um aparelho para inspecionar</span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/50">
              {loadingLista ? (
                <div className="py-16 text-center space-y-2">
                  <RefreshCw size={24} className="animate-spin text-purple-400 mx-auto" />
                  <p className="text-xs text-zinc-400">Consultando rastreabilidade de IMEIs...</p>
                </div>
              ) : resultadosFiltrados.length === 0 ? (
                <div className="py-16 px-6 text-center space-y-2">
                  <Smartphone size={28} className="text-zinc-600 mx-auto" />
                  <p className="text-sm font-bold text-zinc-300">Nenhum aparelho encontrado</p>
                  <p className="text-xs text-zinc-500">
                    Verifique o número do IMEI, nome do cliente ou modelo digitado.
                  </p>
                </div>
              ) : (
                resultadosFiltrados.slice(0, 150).map((item) => {
                  const selecionado = aparelhoSelecionado?.imei === item.imei;
                  return (
                    <button
                      key={item.imei}
                      type="button"
                      onClick={() => setAparelhoSelecionado(item)}
                      className={`w-full text-left p-3.5 transition-all flex items-start justify-between gap-3 cursor-pointer ${
                        selecionado
                          ? 'bg-purple-950/35 border-l-4 border-l-purple-500'
                          : 'hover:bg-zinc-900/60'
                      }`}
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-extrabold text-white bg-zinc-900 border border-zinc-700/80 px-2 py-0.5 rounded">
                            {item.imei}
                          </span>
                          {item.isVendido ? (
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-purple-950/90 text-purple-300 border border-purple-500/50">
                              VENDIDO
                            </span>
                          ) : (
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-500/50">
                              DISPONÍVEL NA LOJA {item.filial_nome}
                            </span>
                          )}
                        </div>

                        <p className="text-xs font-bold text-zinc-200 truncate">{item.modelo}</p>

                        <div className="flex items-center gap-3 text-[11px] text-zinc-400 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Building2 size={11} className="text-cyan-400" />
                            {item.filial_nome}
                          </span>
                          {item.cliente_nome && (
                            <span className="flex items-center gap-1 text-purple-300 truncate max-w-[180px]">
                              <User size={11} />
                              {item.cliente_nome}
                            </span>
                          )}
                        </div>
                      </div>

                      <ChevronRight
                        size={16}
                        className={`shrink-0 mt-1 transition-transform ${
                          selecionado ? 'text-purple-400 translate-x-0.5' : 'text-zinc-600'
                        }`}
                      />
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Coluna Direita: Detalhes do Aparelho, Ficha da Venda e Linha do Tempo */}
          <div className="lg:col-span-7 flex flex-col min-h-0 overflow-y-auto p-4 md:p-6 space-y-5 bg-[#09090d]">
            {!aparelhoSelecionado ? (
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6 border border-dashed border-zinc-800 rounded-2xl bg-zinc-950/40">
                <div className="w-14 h-14 rounded-2xl bg-purple-950/40 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-3">
                  <Smartphone size={26} />
                </div>
                <h3 className="text-sm md:text-base font-bold text-white">
                  Selecione um aparelho ao lado para investigar
                </h3>
                <p className="text-xs text-zinc-400 max-w-md mt-1">
                  Pesquise pelo número do IMEI, nome do comprador ou modelo para visualizar o status atual, os dados completos da venda e a linha do tempo de movimentações entre filiais.
                </p>
              </div>
            ) : (
              <>
                {/* 1. Card de Status Atual e Identificação do Aparelho */}
                <div className="bg-[#111118] border border-zinc-800 rounded-2xl p-4 md:p-5 space-y-4 shadow-lg">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3.5">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block">
                        IMEI RASTREADO
                      </span>
                      <div className="flex items-center gap-2.5 mt-0.5">
                        <span className="font-mono text-base md:text-lg font-black text-white tracking-wider">
                          {aparelhoSelecionado.imei}
                        </span>
                        {aparelhoSelecionado.cor && <ColorBadge color={aparelhoSelecionado.cor} />}
                      </div>
                    </div>

                    {/* Badge Clara de Status Atual */}
                    <div>
                      {aparelhoSelecionado.isVendido ? (
                        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider bg-purple-950/90 text-purple-200 border border-purple-500/70 shadow-lg shadow-purple-950/50">
                          <ShoppingBag size={14} className="text-purple-400" />
                          VENDIDO
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-950/90 text-emerald-300 border border-emerald-500/70 shadow-lg shadow-emerald-950/50">
                          <CheckCircle2 size={14} className="text-emerald-400" />
                          DISPONÍVEL NA LOJA {aparelhoSelecionado.filial_nome}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="bg-black/50 border border-zinc-800/80 rounded-xl p-3">
                      <span className="text-[10px] uppercase font-bold text-zinc-500 block">
                        Modelo do Aparelho
                      </span>
                      <strong className="text-white text-sm mt-0.5 block">
                        {aparelhoSelecionado.modelo}
                      </strong>
                    </div>

                    <div className="bg-black/50 border border-zinc-800/80 rounded-xl p-3">
                      <span className="text-[10px] uppercase font-bold text-zinc-500 block">
                        {aparelhoSelecionado.isVendido ? 'Filial da Venda / Origem' : 'Filial Atual'}
                      </span>
                      <strong className="text-cyan-300 text-sm mt-0.5 flex items-center gap-1.5">
                        <Building2 size={14} className="text-cyan-400 shrink-0" />
                        {aparelhoSelecionado.filial_nome}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* 2. Ficha da Venda (Exibida quando o aparelho foi vendido) */}
                {aparelhoSelecionado.isVendido && (
                  <div className="bg-gradient-to-br from-[#170f26] to-[#0f0c18] border border-purple-500/40 rounded-2xl p-4 md:p-5 space-y-3.5 shadow-lg">
                    <div className="flex items-center justify-between gap-2 border-b border-purple-500/20 pb-2.5">
                      <h4 className="text-xs md:text-sm font-extrabold uppercase tracking-wider text-purple-200 flex items-center gap-2">
                        <FileText size={15} className="text-purple-400" />
                        Ficha da Venda
                      </h4>
                      {aparelhoSelecionado.venda_id && (
                        <span className="font-mono text-[11px] bg-purple-950/80 border border-purple-500/40 text-purple-300 px-2.5 py-0.5 rounded-lg">
                          ID da Venda: #{String(aparelhoSelecionado.venda_id).slice(0, 8)}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                      <div className="bg-black/50 border border-purple-500/20 rounded-xl p-3">
                        <span className="text-[10px] uppercase font-bold text-zinc-400 flex items-center gap-1">
                          <User size={11} className="text-purple-400" />
                          Nome do Cliente
                        </span>
                        <strong className="text-white text-xs md:text-sm mt-1 block truncate">
                          {aparelhoSelecionado.cliente_nome || 'Consumidor Final'}
                        </strong>
                      </div>

                      <div className="bg-black/50 border border-purple-500/20 rounded-xl p-3">
                        <span className="text-[10px] uppercase font-bold text-zinc-400 flex items-center gap-1">
                          <Hash size={11} className="text-purple-400" />
                          CPF / CNPJ
                        </span>
                        <strong className="text-zinc-200 font-mono text-xs md:text-sm mt-1 block">
                          {aparelhoSelecionado.cliente_cpf || 'Não informado'}
                        </strong>
                      </div>

                      <div className="bg-black/50 border border-purple-500/20 rounded-xl p-3">
                        <span className="text-[10px] uppercase font-bold text-zinc-400 flex items-center gap-1">
                          <Phone size={11} className="text-purple-400" />
                          Telefone
                        </span>
                        <strong className="text-zinc-200 font-mono text-xs md:text-sm mt-1 block">
                          {aparelhoSelecionado.cliente_telefone || 'Não informado'}
                        </strong>
                      </div>

                      <div className="bg-black/50 border border-purple-500/20 rounded-xl p-3">
                        <span className="text-[10px] uppercase font-bold text-zinc-400 flex items-center gap-1">
                          <Calendar size={11} className="text-purple-400" />
                          Data / Hora da Venda
                        </span>
                        <strong className="text-zinc-200 text-xs mt-1 block">
                          {formatarDataHora(aparelhoSelecionado.data_venda)}
                        </strong>
                      </div>

                      <div className="bg-black/50 border border-purple-500/20 rounded-xl p-3">
                        <span className="text-[10px] uppercase font-bold text-zinc-400 flex items-center gap-1">
                          <DollarSign size={11} className="text-emerald-400" />
                          Valor Vendido
                        </span>
                        <strong className="text-emerald-400 font-mono text-sm mt-1 block">
                          {formatCurrency(aparelhoSelecionado.valor_vendido || 0)}
                        </strong>
                      </div>

                      <div className="bg-black/50 border border-purple-500/20 rounded-xl p-3">
                        <span className="text-[10px] uppercase font-bold text-zinc-400 flex items-center gap-1">
                          <Hash size={11} className="text-purple-400" />
                          ID Completo da Venda
                        </span>
                        <strong
                          className="text-zinc-300 font-mono text-[11px] mt-1 block truncate"
                          title={aparelhoSelecionado.venda_id || ''}
                        >
                          {aparelhoSelecionado.venda_id || 'N/D'}
                        </strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Linha do Tempo do Aparelho (`public.estoque_movimentacoes`) */}
                <div className="bg-[#111118] border border-zinc-800 rounded-2xl p-4 md:p-5 space-y-4 shadow-lg">
                  <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                    <h4 className="text-xs md:text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
                      <Clock size={15} className="text-cyan-400" />
                      Linha do Tempo do Aparelho
                    </h4>
                    <span className="text-[11px] text-zinc-400">
                      {movimentacoesImei.length} evento(s) registrado(s)
                    </span>
                  </div>

                  {loadingHistorico ? (
                    <div className="py-10 text-center space-y-2">
                      <RefreshCw size={20} className="animate-spin text-purple-400 mx-auto" />
                      <p className="text-xs text-zinc-400">Carregando histórico de movimentações...</p>
                    </div>
                  ) : movimentacoesImei.length === 0 ? (
                    <div className="py-8 text-center text-xs text-zinc-500">
                      Nenhuma movimentação detalhada encontrada para este IMEI.
                    </div>
                  ) : (
                    <div className="relative pl-5 space-y-4 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-800">
                      {movimentacoesImei.map((mov, idx) => {
                        const tipo = String(mov.tipo_movimentacao || '').toUpperCase();
                        const isEntrada = tipo.includes('ENTRADA');
                        const isTransferencia = tipo.includes('TRANSFER');
                        const isVenda = tipo.includes('VENDA');
                        const isEstorno = tipo.includes('ESTORNO') || tipo.includes('DEVOLU');

                        let badgeColor = 'bg-zinc-800 text-zinc-300 border-zinc-700';
                        let dotColor = 'bg-zinc-400';
                        let labelTipo = tipo || 'MOVIMENTAÇÃO';

                        if (isEntrada) {
                          badgeColor = 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50';
                          dotColor = 'bg-emerald-400';
                          labelTipo = 'ENTRADA NO ESTOQUE';
                        } else if (isTransferencia) {
                          badgeColor = 'bg-cyan-950/90 text-cyan-300 border-cyan-500/50';
                          dotColor = 'bg-cyan-400';
                          labelTipo = 'TRANSFERÊNCIA ENTRE LOJAS';
                        } else if (isVenda) {
                          badgeColor = 'bg-purple-950/90 text-purple-300 border-purple-500/50';
                          dotColor = 'bg-purple-400';
                          labelTipo = 'VENDA REALIZADA';
                        } else if (isEstorno) {
                          badgeColor = 'bg-amber-950/90 text-amber-300 border-amber-500/50';
                          dotColor = 'bg-amber-400';
                          labelTipo = 'ESTORNO / DEVOLUÇÃO';
                        }

                        const nomeOrigem =
                          mov.filial_origem?.nome ||
                          (mov.filial_origem_id && mapaFiliais[String(mov.filial_origem_id)]) ||
                          null;
                        const nomeDestino =
                          mov.filial_destino?.nome ||
                          (mov.filial_destino_id && mapaFiliais[String(mov.filial_destino_id)]) ||
                          null;

                        return (
                          <div key={mov.id || idx} className="relative bg-black/50 border border-zinc-800/80 rounded-xl p-3.5 space-y-1.5">
                            <span
                              className={`absolute -left-[17px] top-4 w-3 h-3 rounded-full border-2 border-[#111118] ${dotColor}`}
                            />

                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${badgeColor}`}>
                                {labelTipo}
                              </span>
                              <span className="text-[11px] font-mono text-zinc-400">
                                {formatarDataHora(mov.created_at)}
                              </span>
                            </div>

                            {(nomeOrigem || nomeDestino) && (
                              <div className="flex items-center gap-2 text-xs text-zinc-200 pt-0.5 flex-wrap">
                                {nomeOrigem && (
                                  <span className="flex items-center gap-1 text-zinc-300">
                                    <Building2 size={12} className="text-zinc-400" />
                                    Origem: <strong className="text-white">{nomeOrigem}</strong>
                                  </span>
                                )}
                                {nomeOrigem && nomeDestino && (
                                  <ArrowRight size={13} className="text-purple-400" />
                                )}
                                {nomeDestino && (
                                  <span className="flex items-center gap-1 text-cyan-300">
                                    <Building2 size={12} className="text-cyan-400" />
                                    Destino: <strong className="text-cyan-200">{nomeDestino}</strong>
                                  </span>
                                )}
                              </div>
                            )}

                            {mov.observacao && (
                              <p className="text-xs text-zinc-400 leading-relaxed">
                                {mov.observacao}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

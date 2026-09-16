import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import {
  X,
  Smartphone,
  Barcode,
  Search,
  CheckCircle2,
  Loader2,
  Store,
  Tag,
  AlertCircle,
  Trash2,
  Sparkles,
  Palette
} from 'lucide-react';

const CORES_SUGESTOES = [
  'Preto',
  'Azul',
  'Branco',
  'Prata',
  'Titânio',
  'Cinza',
  'Dourado',
  'Verde',
  'Roxo',
  'Grafite'
];

export default function ModalEntradaEstoqueRapida({
  isOpen,
  onClose,
  perfilUsuario,
  session,
  activeFilialId,
  activeFilialNome,
  onSuccess
}) {
  // Estado de seleção do modelo / catálogo
  const [buscaModelo, setBuscaModelo] = useState('');
  const [produtoSelecionado, setProdutoSelecionado] = useState(null);
  const [loadingCatalogo, setLoadingCatalogo] = useState(false);
  const [catalogoAparelhos, setCatalogoAparelhos] = useState([]);

  // Estado de Cor
  const [corSelecionada, setCorSelecionada] = useState('Preto');
  const [sugestoesCores, setSugestoesCores] = useState(CORES_SUGESTOES);

  // Estado de Leitura de IMEI / Serial
  const [inputImei, setInputImei] = useState('');
  const [imeisBipados, setImeisBipados] = useState([]); // [{ imei: string, cor: string }]
  const [validandoImei, setValidandoImei] = useState(false);

  // Feedback e Loading
  const [loadingSalvando, setLoadingSalvando] = useState(false);
  const [erroMsg, setErroMsg] = useState(null);
  const [sucessoMsg, setSucessoMsg] = useState(null);

  const inputBuscaRef = useRef(null);
  const inputImeiRef = useRef(null);

  // Filial fixa / travada
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
      'MONKEY SHOP'
    );
  }, [activeFilialNome, perfilUsuario]);

  const empresaId = useMemo(() => {
    return (
      perfilUsuario?.empresa_id ||
      session?.user?.user_metadata?.empresa_id ||
      null
    );
  }, [perfilUsuario, session]);

  // Carregar cores personalizadas ao abrir
  useEffect(() => {
    if (!isOpen) {
      setBuscaModelo('');
      setProdutoSelecionado(null);
      setCorSelecionada('Preto');
      setInputImei('');
      setImeisBipados([]);
      setErroMsg(null);
      setSucessoMsg(null);
      setCatalogoAparelhos([]);
      return;
    }

    const carregarCores = async () => {
      try {
        const { data: resCores } = await supabase
          .from('cores_aparelhos')
          .select('nome');

        if (resCores && resCores.length > 0) {
          const nomesCores = resCores.map(c => c.nome).filter(Boolean);
          const unicas = Array.from(new Set([...CORES_SUGESTOES, ...nomesCores]));
          setSugestoesCores(unicas);
        }
      } catch (err) {
        console.warn('Erro ao carregar cores personalizadas:', err);
      }
    };

    carregarCores();
  }, [isOpen]);

  // Busca Híbrida e Inteligente no Catálogo com Debounce de 250ms
  useEffect(() => {
    if (!isOpen) return;

    // Se já selecionou um item e o texto bate com ele, não precisa refazer busca
    if (produtoSelecionado && buscaModelo.trim() === produtoSelecionado.nome_completo) {
      return;
    }

    const termo = buscaModelo.trim();
    if (!termo) {
      setCatalogoAparelhos([]);
      setLoadingCatalogo(false);
      return;
    }

    setLoadingCatalogo(true);
    const handler = setTimeout(async () => {
      try {
        // 1. Consultar a tabela 'catalogo_smartphones' buscando por 'nome_completo' ILIKE `%termo%` (limit 25)
        const { data: catalogoData, error: errCat } = await supabase
          .from('catalogo_smartphones')
          .select('id, marca, modelo, nome_completo, categoria')
          .ilike('nome_completo', `%${termo}%`)
          .limit(25);

        if (errCat) {
          console.warn('Erro ao consultar catalogo_smartphones:', errCat);
          setCatalogoAparelhos([]);
          return;
        }

        const modelosCatalogo = catalogoData || [];

        if (modelosCatalogo.length === 0) {
          setCatalogoAparelhos([]);
          return;
        }

        // 2. Consultar a tabela 'produtos' da filial ativa para verificar quais desses modelos já estão cadastrados na loja
        const nomesParaChecar = modelosCatalogo.map(m => m.nome_completo);

        let produtosFilial = [];
        if (filialIdFixa) {
          const { data: prodsData, error: errProds } = await supabase
            .from('produtos')
            .select('id, nome, quantidade, filial_id, empresa_id')
            .eq('filial_id', filialIdFixa)
            .in('nome', nomesParaChecar);

          if (!errProds && prodsData) {
            produtosFilial = prodsData;
          }
        }

        // Mapa de produtos cadastrados na filial por nome normalizado
        const mapaFilial = new Map();
        produtosFilial.forEach(p => {
          if (p.nome) {
            mapaFilial.set(p.nome.trim().toUpperCase(), p);
          }
        });

        // 3. Montar lista enriquecida com status
        const listaEnriquecida = modelosCatalogo.map(item => {
          const chave = (item.nome_completo || '').trim().toUpperCase();
          const prodExistente = mapaFilial.get(chave);
          const jaCadastrado = !!prodExistente;

          return {
            ...item,
            cadastrado: jaCadastrado,
            produto_id_filial: prodExistente ? prodExistente.id : null,
            saldo_atual_filial: prodExistente ? Number(prodExistente.quantidade || 0) : 0
          };
        });

        setCatalogoAparelhos(listaEnriquecida);
      } catch (err) {
        console.error('Erro na busca de celulares:', err);
      } finally {
        setLoadingCatalogo(false);
      }
    }, 250);

    return () => clearTimeout(handler);
  }, [buscaModelo, isOpen, produtoSelecionado, filialIdFixa]);

  // Foco inteligente
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      if (!produtoSelecionado && inputBuscaRef.current) {
        inputBuscaRef.current.focus();
      } else if (produtoSelecionado && inputImeiRef.current) {
        inputImeiRef.current.focus();
      }
    }, 80);

    return () => clearTimeout(timer);
  }, [isOpen, produtoSelecionado]);

  // Ao selecionar modelo da lista
  const handleSelecionarModelo = (item) => {
    setProdutoSelecionado(item);
    setBuscaModelo(item.nome_completo);
    setCatalogoAparelhos([]);
    setErroMsg(null);

    // Mover o foco imediatamente para o campo "3. Leitura de IMEI / Serial"
    setTimeout(() => {
      if (inputImeiRef.current) {
        inputImeiRef.current.focus();
      }
    }, 60);
  };

  // Sanitizar e processar leitura de IMEI
  const handleAdicionarImei = async () => {
    setErroMsg(null);
    const imeiLimpo = inputImei.replace(/\D/g, '').trim();

    if (!imeiLimpo) return;

    // Validação: sanitizar apenas números e verificar se tem 14 ou 15 dígitos
    if (imeiLimpo.length !== 14 && imeiLimpo.length !== 15) {
      setErroMsg(`IMEI inválido: deve conter 14 ou 15 dígitos numéricos (informado: ${imeiLimpo.length}).`);
      return;
    }

    // Validar duplicidade local na lista atual de bipados
    const jaBipado = imeisBipados.some(item => item.imei === imeiLimpo);
    if (jaBipado) {
      setErroMsg(`O IMEI ${imeiLimpo} já foi adicionado a esta entrada.`);
      return;
    }

    // Validar duplicidade no banco (tabela 'imeis')
    setValidandoImei(true);
    try {
      const { data: imeiExistente, error: errCheck } = await supabase
        .from('imeis')
        .select('id, imei, status, vendido')
        .eq('imei', imeiLimpo)
        .maybeSingle();

      if (errCheck && errCheck.code !== 'PGRST116') {
        console.warn('Aviso verificação de IMEI existente:', errCheck);
      }

      if (imeiExistente) {
        const isAtivo = !imeiExistente.vendido && String(imeiExistente.status || '').toUpperCase() !== 'BAIXADO';
        if (isAtivo) {
          setErroMsg(`O IMEI ${imeiLimpo} já está cadastrado no sistema (Status: ${imeiExistente.status || 'Ativo'}).`);
          setValidandoImei(false);
          return;
        }
      }

      const corFinalAtual = (corSelecionada || '').trim() || 'Preto';

      // Adicionar à lista de bipados com a cor selecionada
      setImeisBipados(prev => [
        ...prev,
        {
          imei: imeiLimpo,
          cor: corFinalAtual,
          timestamp: Date.now()
        }
      ]);
      setInputImei('');
      setErroMsg(null);
    } catch (err) {
      console.error('Erro ao verificar duplicidade de IMEI:', err);
      setErroMsg('Erro ao validar IMEI no banco de dados.');
    } finally {
      setValidandoImei(false);
      setTimeout(() => {
        if (inputImeiRef.current) inputImeiRef.current.focus();
      }, 50);
    }
  };

  const handleImeiKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      handleAdicionarImei();
    }
  };

  const handleRemoverImei = (imeiParaRemover) => {
    setImeisBipados(prev => prev.filter(item => item.imei !== imeiParaRemover));
    if (inputImeiRef.current) inputImeiRef.current.focus();
  };

  // Gravação no Banco (Supabase)
  const handleConfirmarEntrada = async (e) => {
    if (e) e.preventDefault();
    setErroMsg(null);
    setSucessoMsg(null);

    if (!produtoSelecionado) {
      setErroMsg('Selecione o modelo do aparelho no catálogo.');
      return;
    }

    if (imeisBipados.length === 0) {
      setErroMsg('Bipe ou digite ao menos um IMEI antes de confirmar.');
      return;
    }

    if (!filialIdFixa) {
      setErroMsg('Erro: Nenhuma filial ativa de trabalho identificada.');
      return;
    }

    // Determinar a cor final escolhida/digitada
    const corFinal = (corSelecionada || '').trim() || 'Preto';

    setLoadingSalvando(true);
    try {
      const qtdTotal = imeisBipados.length;
      const targetEmpresaId = empresaId || perfilUsuario?.empresa_id || null;
      const userId = session?.user?.id || perfilUsuario?.id;
      const nomeAparelho = produtoSelecionado.nome_completo || produtoSelecionado.nome;

      // 1. Verificar se o modelo selecionado já possui um registro na tabela 'produtos' com a 'filial_id' atual
      let targetProdutoId = null;

      const { data: prodExistente, error: errBuscaProd } = await supabase
        .from('produtos')
        .select('id, quantidade, preco_custo, preco_venda, cor')
        .eq('filial_id', filialIdFixa)
        .eq('nome', nomeAparelho)
        .maybeSingle();

      if (errBuscaProd && errBuscaProd.code !== 'PGRST116') {
        throw errBuscaProd;
      }

      if (prodExistente) {
        // SE JÁ EXISTE: recuperar o 'produto_id' existente e somar a quantidade de IMEIs bipados na coluna 'quantidade'
        targetProdutoId = prodExistente.id;
        const saldoAnterior = Number(prodExistente.quantidade || 0);

        const payloadUpdate = {
          quantidade: saldoAnterior + qtdTotal,
          tipo: 'APARELHO',
          categoria: 'Celulares'
        };

        // Se o produto existente estiver sem cor ou "Sem cor", atualizar com a corFinal
        const corAtual = (prodExistente.cor || '').trim().toLowerCase();
        if (!corAtual || corAtual === 'sem cor' || corAtual === 'null' || corAtual === 'undefined') {
          payloadUpdate.cor = corFinal;
        }

        const { error: updErr } = await supabase
          .from('produtos')
          .update(payloadUpdate)
          .eq('id', targetProdutoId);

        if (updErr) throw updErr;
      } else {
        // SE NÃO EXISTE NA FILIAL: fazer primeiro um INSERT na tabela 'produtos' com a cor obrigatória
        const payloadNovoProd = {
          nome: nomeAparelho,
          categoria: 'Celulares',
          tipo: 'APARELHO',
          cor: corFinal,
          filial_id: filialIdFixa,
          empresa_id: targetEmpresaId,
          quantidade: qtdTotal,
          preco_custo: 0,
          preco_venda: 0
        };

        const { data: novoCriado, error: crtErr } = await supabase
          .from('produtos')
          .insert(payloadNovoProd)
          .select('id')
          .single();

        if (crtErr) throw crtErr;
        targetProdutoId = novoCriado.id;
      }

      // 2. Batch INSERT na tabela 'imeis' com a corFinal
      const rowsImeis = imeisBipados.map(item => ({
        imei: item.imei,
        produto_id: targetProdutoId,
        filial_id: filialIdFixa,
        empresa_id: targetEmpresaId,
        cor: (item.cor || corFinal).trim() || corFinal,
        status: 'DISPONIVEL'
      }));

      const { error: errImeis } = await supabase
        .from('imeis')
        .insert(rowsImeis);

      if (errImeis) {
        // Tratar erro com toast/alerta caso ocorra chave duplicada de IMEI ou validação
        if (errImeis.code === '23505' || errImeis.message?.toLowerCase().includes('unique') || errImeis.message?.toLowerCase().includes('duplicate')) {
          throw new Error('Falha ao cadastrar IMEIs: Um ou mais IMEIs bipados já existem no banco de dados.');
        }
        throw errImeis;
      }

      // 3. Registrar movimentação em 'estoque_movimentacoes' com tipo 'ENTRADA' (se tabela existir)
      try {
        const obsTexto = `Entrada Rápida: ${nomeAparelho} (${qtdTotal} un. - IMEIs: ${imeisBipados.map(i => i.imei).join(', ')})`;
        const movPayload = {
          empresa_id: targetEmpresaId,
          filial_destino_id: filialIdFixa,
          produto_id: targetProdutoId,
          quantidade: qtdTotal,
          tipo_movimentacao: 'ENTRADA',
          criado_por: userId,
          status: 'CONCLUIDO',
          observacao: obsTexto
        };

        const { error: errMov } = await supabase
          .from('estoque_movimentacoes')
          .insert(movPayload);

        if (errMov) {
          await supabase.from('estoque_movimentacoes').insert({
            ...movPayload,
            tipo_movimentacao: 'ENTRADA_AQUISICAO'
          });
        }
      } catch (errMov) {
        console.warn('Aviso ao registrar log de movimentação de estoque:', errMov);
      }

      // 4. Limpar o formulário, zerar a lista de bipados e exibir toast de sucesso
      const mensagemSucesso = `${qtdTotal} aparelho(s) adicionados ao estoque com sucesso!`;
      setSucessoMsg(mensagemSucesso);
      
      if (onSuccess) {
        onSuccess(qtdTotal, nomeAparelho);
      }

      window.dispatchEvent(new Event('estoque_updated'));
      window.dispatchEvent(new Event('catalogo_updated'));

      // Limpar estados
      setBuscaModelo('');
      setProdutoSelecionado(null);
      setInputImei('');
      setImeisBipados([]);
      setCatalogoAparelhos([]);

      setTimeout(() => {
        onClose();
      }, 1200);

    } catch (err) {
      console.error('Erro ao confirmar entrada de celulares:', err);
      setErroMsg(err.message || 'Falha ao gravar entrada no estoque.');
    } finally {
      setLoadingSalvando(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#0A0A0A] border border-purple-500/40 rounded-2xl w-full max-w-xl shadow-2xl shadow-purple-950/30 overflow-hidden flex flex-col">
        
        {/* Cabeçalho */}
        <div className="p-5 border-b border-[#222222] flex items-center justify-between bg-gradient-to-r from-[#17002e] via-[#0e001c] to-[#0A0A0A]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
              <Smartphone size={22} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                📱 Entrada Rápida de Aparelhos (Celulares)
              </h3>
              <p className="text-[11px] text-gray-400">
                Cadastro rápido com conferência de IMEI, cor e quantidade automática
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

        {/* Formulário */}
        <form onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); }} className="p-6 space-y-5 overflow-y-auto max-h-[80vh]">
          
          {/* Filial de Destino: Travada / Fixa */}
          <div className="flex items-center justify-between bg-black/60 border border-[#222222] rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 text-xs">
              <Store size={16} className="text-purple-400 shrink-0" />
              <span className="text-gray-400 font-medium">Filial de Destino:</span>
              <span className="text-white font-extrabold tracking-wide uppercase">
                {nomeFilialFixa}
              </span>
            </div>
            <span className="text-[10px] bg-purple-950/80 text-purple-300 font-bold px-2 py-0.5 rounded border border-purple-800/60">
              Travada / Fixa
            </span>
          </div>

          {/* Feedback de Erro ou Sucesso */}
          {erroMsg && (
            <div className="bg-red-950/40 border border-red-800/60 rounded-xl p-3 text-red-400 text-xs flex items-center gap-2 animate-fadeIn">
              <AlertCircle size={16} className="shrink-0" />
              <span>{erroMsg}</span>
            </div>
          )}
          {sucessoMsg && (
            <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-xl p-3 text-emerald-400 text-xs flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>{sucessoMsg}</span>
            </div>
          )}

          {/* CAMPO 1: Selecionar Aparelho (Catálogo) com autocomplete */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-300 flex justify-between items-center">
              <span>1. Selecionar Aparelho (Catálogo) *</span>
              {produtoSelecionado && (
                <button
                  type="button"
                  onClick={() => {
                    setProdutoSelecionado(null);
                    setBuscaModelo('');
                    setTimeout(() => inputBuscaRef.current?.focus(), 50);
                  }}
                  className="text-[10px] text-purple-400 hover:underline font-bold cursor-pointer"
                >
                  Trocar Aparelho
                </button>
              )}
            </label>

            <div className="relative">
              <input
                ref={inputBuscaRef}
                type="text"
                value={buscaModelo}
                onChange={(e) => {
                  setBuscaModelo(e.target.value);
                  if (produtoSelecionado && e.target.value !== produtoSelecionado.nome) {
                    setProdutoSelecionado(null);
                  }
                }}
                placeholder="Busque o modelo (ex: Honor X5c Plus 256GB, Poco X8 Pro)..."
                className={`w-full bg-black border rounded-xl pl-10 pr-4 py-3 text-xs text-white outline-none font-medium transition-all ${
                  produtoSelecionado
                    ? 'border-emerald-500/60 bg-emerald-950/10'
                    : 'border-[#222222] focus:border-purple-500'
                }`}
              />
              <Search
                size={17}
                className={`absolute left-3.5 top-3.5 transition-colors ${
                  produtoSelecionado ? 'text-emerald-400' : 'text-gray-500'
                }`}
              />
              {loadingCatalogo && (
                <Loader2
                  size={16}
                  className="absolute right-3.5 top-3.5 animate-spin text-purple-400"
                />
              )}
            </div>

            {/* Dropdown de sugestões do catálogo inteligente */}
            {!produtoSelecionado && catalogoAparelhos.length > 0 && buscaModelo.trim().length > 0 && (
              <div className="bg-[#111111] border border-[#222222] rounded-xl shadow-2xl max-h-56 overflow-y-auto divide-y divide-[#222222] mt-1 z-20">
                {catalogoAparelhos.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelecionarModelo(item)}
                    className="w-full text-left px-4 py-2.5 hover:bg-purple-950/30 flex items-center justify-between gap-3 transition-colors text-xs cursor-pointer group"
                  >
                    <div className="min-w-0 flex items-center gap-2.5">
                      {item.marca && (
                        <span className="text-[10px] px-2 py-0.5 rounded font-extrabold tracking-wider uppercase bg-purple-950/70 text-purple-300 border border-purple-800/50 shrink-0">
                          {item.marca}
                        </span>
                      )}
                      <p className="font-bold text-white truncate text-xs">
                        {item.nome_completo}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {item.cadastrado ? (
                        <span className="text-[10px] bg-emerald-950/50 text-emerald-400 px-2 py-0.5 rounded font-medium border border-emerald-800/40">
                          Cadastrado
                        </span>
                      ) : (
                        <span className="text-[10px] bg-purple-950/40 text-purple-300 px-2 py-0.5 rounded font-medium border border-purple-800/30 group-hover:border-purple-500 transition-colors">
                          + Criar entrada
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Aviso quando pesquisou e nenhum modelo foi encontrado */}
            {!produtoSelecionado && !loadingCatalogo && buscaModelo.trim().length >= 2 && catalogoAparelhos.length === 0 && (
              <div className="bg-[#111111] border border-[#222222] rounded-xl p-3 text-xs text-gray-400 mt-1 text-center">
                Nenhum aparelho encontrado no catálogo para "<span className="text-white font-semibold">{buscaModelo}</span>".
              </div>
            )}

            {/* Badge de modelo e categoria confirmada */}
            {produtoSelecionado && (
              <div className="bg-purple-950/30 border border-purple-800/40 rounded-xl p-3 flex items-center justify-between gap-3 animate-fadeIn">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {produtoSelecionado.marca && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-purple-900 text-purple-200 font-extrabold uppercase tracking-wider">
                        {produtoSelecionado.marca}
                      </span>
                    )}
                    <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 size={12} /> Modelo Confirmado
                    </span>
                    {produtoSelecionado.cadastrado ? (
                      <span className="text-[9px] bg-emerald-950/60 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-800/40">
                        Já cadastrado na filial
                      </span>
                    ) : (
                      <span className="text-[9px] bg-purple-950/60 text-purple-300 px-1.5 py-0.5 rounded border border-purple-800/40">
                        Novo produto na filial
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-bold text-white mt-1.5 truncate">
                    {produtoSelecionado.nome_completo || produtoSelecionado.nome}
                  </p>
                </div>
                <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 size={16} />
                </div>
              </div>
            )}
          </div>

          {/* CAMPO 2: Cor do Aparelho */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-300 flex items-center gap-1.5">
              <Palette size={14} className="text-purple-400" />
              <span>2. Cor do Aparelho *</span>
            </label>
            <div className="flex items-center gap-2">
              <select
                value={corSelecionada}
                onChange={(e) => setCorSelecionada(e.target.value)}
                className="w-full bg-black border border-[#222222] focus:border-purple-500 rounded-xl px-3 py-2.5 text-xs text-white outline-none font-bold cursor-pointer"
              >
                {sugestoesCores.map((cor) => (
                  <option key={cor} value={cor}>
                    {cor}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Ou digite outra cor..."
                value={corSelecionada}
                onChange={(e) => setCorSelecionada(e.target.value)}
                className="w-1/2 bg-black border border-[#222222] focus:border-purple-500 rounded-xl px-3 py-2.5 text-xs text-white outline-none font-medium"
              />
            </div>
          </div>

          {/* CAMPO 3: Leitura de IMEI / Serial */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Barcode size={15} className="text-purple-400" />
                <span>3. Leitura de IMEI / Serial (14 ou 15 dígitos) *</span>
              </span>
              <span className="text-[10px] text-gray-400 font-normal">
                Pressione Enter para adicionar à lista
              </span>
            </label>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  ref={inputImeiRef}
                  type="text"
                  value={inputImei}
                  onChange={(e) => setInputImei(e.target.value.replace(/\D/g, '').slice(0, 15))}
                  onKeyDown={handleImeiKeyDown}
                  placeholder="Bipe ou digite o IMEI (15 dígitos)..."
                  className="w-full bg-black border border-[#222222] focus:border-purple-500 rounded-xl pl-9 pr-4 py-3 text-xs text-white outline-none font-mono font-bold tracking-wider transition-all placeholder:font-sans placeholder:tracking-normal"
                />
                <Barcode size={16} className="absolute left-3 top-3.5 text-gray-500" />
              </div>

              <button
                type="button"
                onClick={handleAdicionarImei}
                disabled={validandoImei || !inputImei.trim()}
                className="px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-800 disabled:text-gray-500 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                {validandoImei ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <span>Adicionar</span>
                )}
              </button>
            </div>

            {/* Lista de chips/tags de IMEIs bipados */}
            {imeisBipados.length > 0 ? (
              <div className="bg-black/50 border border-[#222222] rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-gray-400 font-semibold border-b border-[#222222] pb-1.5">
                  <span>IMEIs Prontos para Entrada ({imeisBipados.length}):</span>
                  <button
                    type="button"
                    onClick={() => setImeisBipados([])}
                    className="text-red-400 hover:underline text-[10px] cursor-pointer"
                  >
                    Limpar todos
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pt-1">
                  {imeisBipados.map((item) => (
                    <div
                      key={item.imei}
                      className="flex items-center gap-2 bg-[#121212] border border-purple-800/40 text-gray-200 px-3 py-1.5 rounded-lg text-xs font-mono font-bold shadow-sm"
                    >
                      <span className="text-white">{item.imei}</span>
                      <span className="text-[10px] text-purple-300 font-sans font-normal px-1.5 py-0.5 rounded bg-purple-950/60 border border-purple-800/30">
                        {item.cor}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoverImei(item.imei)}
                        className="text-gray-500 hover:text-red-400 transition-colors ml-0.5 cursor-pointer"
                        title="Remover IMEI"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-gray-500 italic">
                Nenhum IMEI bipado até o momento. Conecte o leitor ou digite o número acima.
              </p>
            )}
          </div>

          {/* CAMPO 4: Quantidade Total (Desabilitado para edição manual) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-300">
              4. Quantidade Total (Calculada Automaticamente)
            </label>
            <div className="flex items-center justify-between bg-black border border-[#222222] rounded-xl px-4 py-3">
              <span className="text-xs text-gray-400 font-medium">Contador de aparelhos bipados:</span>
              <span className="font-mono font-extrabold text-base text-emerald-400 bg-emerald-950/30 border border-emerald-800/40 px-3 py-1 rounded-lg">
                Quantidade: {imeisBipados.length} un.
              </span>
            </div>
          </div>

          {/* Botão de Ação */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleConfirmarEntrada}
              disabled={loadingSalvando || !produtoSelecionado || imeisBipados.length === 0}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-800 disabled:text-gray-500 text-white font-extrabold py-3.5 px-6 rounded-xl transition-all flex items-center justify-center gap-2 text-xs shadow-lg shadow-purple-900/30 hover:shadow-purple-900/50 cursor-pointer"
            >
              {loadingSalvando ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Gravando no Estoque e Tabela de IMEIs...
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  Confirmar Entrada no Estoque ({imeisBipados.length} un.)
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

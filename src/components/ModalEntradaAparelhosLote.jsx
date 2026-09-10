import React, { useState, useMemo, useEffect } from 'react';
import { X, Zap, Plus, Check, Loader2, Sparkles, AlertCircle, Trash2, Building2, Smartphone, DollarSign, Layers } from 'lucide-react';
import { supabase } from '../supabaseClient';

const ARMAZENAMENTOS_PADRAO = ['64GB', '128GB', '256GB', '512GB', '1TB'];
const CORES_PADRAO = ['Preto', 'Branco', 'Dourado', 'Verde', 'Azul', 'Cinza', 'Prata', 'Titanium'];

export default function ModalEntradaAparelhosLote({
  isOpen,
  onClose,
  perfilUsuario,
  filiais: filiaisProp = [],
  onSuccess
}) {
  // Filiais e Filial Destino
  const [listaFiliais, setListaFiliais] = useState(filiaisProp || []);
  const [loadingFiliais, setLoadingFiliais] = useState(false);
  const [filialDestinoId, setFilialDestinoId] = useState(() => {
    return perfilUsuario?.filial_id || localStorage.getItem('@zenite_filialId') || '';
  });

  // Campos do Formulário
  const [modelo, setModelo] = useState('');
  const [armazenamento, setArmazenamento] = useState('128GB');
  const [listaCores, setListaCores] = useState(CORES_PADRAO);
  const [corSelecionada, setCorSelecionada] = useState('Preto');
  const [novaCorInput, setNovaCorInput] = useState('');
  const [isSavingCor, setIsSavingCor] = useState(false);
  const [precoCusto, setPrecoCusto] = useState('');
  const [precoVenda, setPrecoVenda] = useState('');
  const [listaImeisTexto, setListaImeisTexto] = useState('');

  // Fila de Aparelhos Acumulada
  const [filaAparelhos, setFilaAparelhos] = useState([]);

  const [isSaving, setIsSaving] = useState(false);
  const [erroMsg, setErroMsg] = useState(null);
  const [avisoMsg, setAvisoMsg] = useState(null);

  // Carregar filiais
  useEffect(() => {
    if (!isOpen) return;

    const carregarFiliais = async () => {
      setLoadingFiliais(true);
      try {
        let empresaId = perfilUsuario?.empresa_id || perfilUsuario?.empresaId;
        if (!empresaId) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: prof } = await supabase
              .from('profiles')
              .select('empresa_id, filial_id')
              .eq('id', user.id)
              .maybeSingle();
            empresaId = prof?.empresa_id;
            if (!filialDestinoId && prof?.filial_id) {
              setFilialDestinoId(prof.filial_id);
            }
          }
        }

        let query = supabase.from('filiais').select('id, nome, tipo').order('nome', { ascending: true });
        if (empresaId) {
          query = query.eq('empresa_id', empresaId);
        }

        const { data, error } = await query;
        if (!error && Array.isArray(data) && data.length > 0) {
          setListaFiliais(data);
          if (!filialDestinoId) {
            const sessaoFilial = localStorage.getItem('@zenite_filialId') || perfilUsuario?.filial_id;
            const encontrada = data.find(f => String(f.id) === String(sessaoFilial));
            setFilialDestinoId(encontrada ? encontrada.id : data[0].id);
          }
        } else if (Array.isArray(filiaisProp) && filiaisProp.length > 0) {
          setListaFiliais(filiaisProp);
          if (!filialDestinoId) {
            setFilialDestinoId(filiaisProp[0].id);
          }
        }
      } catch (err) {
        console.warn('[ModalEntradaAparelhosLote] Erro ao carregar filiais:', err);
      } finally {
        setLoadingFiliais(false);
      }
    };

    carregarFiliais();
  }, [isOpen, perfilUsuario?.empresa_id, perfilUsuario?.filial_id]);

  // Carregar Cores Customizadas
  useEffect(() => {
    if (!isOpen) return;

    const carregarCores = async () => {
      try {
        const { data, error } = await supabase.from('cores_aparelhos').select('nome');
        if (!error && data) {
          const customizadas = data.map(c => c.nome).filter(Boolean);
          setListaCores(Array.from(new Set([...CORES_PADRAO, ...customizadas])));
        }
      } catch (err) {
        console.warn('[ModalEntradaAparelhosLote] Erro ao carregar cores:', err);
      }
    };

    carregarCores();
  }, [isOpen]);

  // Adicionar e Salvar Nova Cor Customizada
  const handleAdicionarNovaCor = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const corLimpa = novaCorInput.trim();
    if (!corLimpa) return;

    setIsSavingCor(true);
    try {
      let empresaId = perfilUsuario?.empresa_id || perfilUsuario?.empresaId;
      if (!empresaId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('empresa_id')
            .eq('id', user.id)
            .maybeSingle();
          empresaId = prof?.empresa_id;
        }
      }

      await supabase.from('cores_aparelhos').insert([{
        nome: corLimpa,
        empresa_id: empresaId || null
      }]);

      setListaCores(prev => Array.from(new Set([...prev, corLimpa])));
      setCorSelecionada(corLimpa);
      setNovaCorInput('');
    } catch (err) {
      console.error('[ModalEntradaAparelhosLote] Erro ao salvar nova cor:', err);
      // Mesmo se houver aviso/erro no banco, adicionar à lista local para não travar o fluxo
      setListaCores(prev => Array.from(new Set([...prev, corLimpa])));
      setCorSelecionada(corLimpa);
      setNovaCorInput('');
    } finally {
      setIsSavingCor(false);
    }
  };

  // Filial Selecionada Objeto
  const filialSelecionada = useMemo(() => {
    return listaFiliais.find(f => String(f.id) === String(filialDestinoId)) || {
      id: filialDestinoId || null,
      nome: 'Filial Padrão'
    };
  }, [listaFiliais, filialDestinoId]);

  // Adicionar Aparelhos à Fila
  const handleAdicionarAFila = () => {
    setErroMsg(null);
    setAvisoMsg(null);

    const modeloLimpo = modelo.trim();
    if (!modeloLimpo) {
      setErroMsg('Informe o modelo do aparelho (ex: Realme C85).');
      return;
    }

    if (!filialDestinoId) {
      setErroMsg('Selecione a Filial de Destino.');
      return;
    }

    const valorVendaNum = parseFloat(precoVenda || 0);
    if (isNaN(valorVendaNum) || valorVendaNum <= 0) {
      setErroMsg('Informe um Preço de Venda válido maior que zero.');
      return;
    }

    const valorCustoNum = parseFloat(precoCusto || 0);

    // Sanitizar e extrair IMEIs (apenas números de exatamente 15 dígitos)
    // O usuário pode separar por quebra de linha, vírgula, espaço, ponto-e-vírgula ou tab
    const tokens = listaImeisTexto
      .split(/[\r\n,;\t\s]+/)
      .map(t => t.replace(/\D/g, ''))
      .filter(t => t.length > 0);

    if (tokens.length === 0) {
      setErroMsg('Cole ou digite a lista de IMEIs no campo correspondente.');
      return;
    }

    const imeisValidos = [];
    const imeisInvalidos = [];

    tokens.forEach(tok => {
      if (tok.length === 15) {
        imeisValidos.push(tok);
      } else {
        imeisInvalidos.push(tok);
      }
    });

    if (imeisValidos.length === 0) {
      setErroMsg('Nenhum IMEI com 15 dígitos numéricos válidos foi encontrado.');
      return;
    }

    // Verificar se algum IMEI já está na fila
    const imeisJaNaFila = new Set(filaAparelhos.map(item => item.imei));
    const novosItens = [];
    const duplicadosFila = [];

    // Formatar nome apenas com Modelo e Armazenamento (sem a cor)
    const nomeFormatado = `${modeloLimpo} ${armazenamento ? armazenamento.trim() : ''}`.trim();

    imeisValidos.forEach(imeiFormatado => {
      if (imeisJaNaFila.has(imeiFormatado)) {
        duplicadosFila.push(imeiFormatado);
      } else {
        imeisJaNaFila.add(imeiFormatado);
        novosItens.push({
          idTemp: `${imeiFormatado}-${Date.now()}-${Math.random()}`,
          nome: nomeFormatado,
          modelo: modeloLimpo,
          armazenamento: armazenamento ? armazenamento.trim() : '',
          cor: corSelecionada ? corSelecionada.trim() : '',
          imei: imeiFormatado,
          filial_id: filialSelecionada.id,
          filial_nome: filialSelecionada.nome,
          preco_custo: isNaN(valorCustoNum) ? 0 : valorCustoNum,
          preco_venda: valorVendaNum
        });
      }
    });

    if (novosItens.length === 0) {
      setErroMsg('Todos os IMEIs informados já foram adicionados à fila.');
      return;
    }

    setFilaAparelhos(prev => [...prev, ...novosItens]);

    let avisos = [];
    if (duplicadosFila.length > 0) {
      avisos.push(`${duplicadosFila.length} IMEI(s) ignorados por já estarem na fila.`);
    }
    if (imeisInvalidos.length > 0) {
      avisos.push(`${imeisInvalidos.length} entrada(s) descartadas por não terem 15 dígitos.`);
    }
    if (avisos.length > 0) {
      setAvisoMsg(avisos.join(' '));
    }

    // Limpar inputs de modelo e textarea para permitir adicionar o próximo lote
    setModelo('');
    setListaImeisTexto('');
  };

  const handleRemoverItem = (index) => {
    setFilaAparelhos(prev => prev.filter((_, i) => i !== index));
  };

  const handleLimparFila = () => {
    setFilaAparelhos([]);
    setAvisoMsg(null);
    setErroMsg(null);
  };

  // Salvar Todos os Aparelhos no Supabase
  const handleSalvarTodos = async () => {
    setErroMsg(null);
    setAvisoMsg(null);

    if (filaAparelhos.length === 0) {
      setErroMsg('A fila está vazia. Adicione aparelhos à fila antes de salvar.');
      return;
    }

    let empresaId = perfilUsuario?.empresa_id || perfilUsuario?.empresaId;
    if (!empresaId) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('empresa_id')
            .eq('id', user.id)
            .maybeSingle();
          empresaId = prof?.empresa_id;
        }
      } catch (errEmp) {
        console.warn('Erro ao obter empresa_id da sessão ativa:', errEmp);
      }
    }

    if (!empresaId) {
      setErroMsg('ID da empresa não identificado na sessão do usuário.');
      return;
    }

    setIsSaving(true);

    try {
      // 1. Preparar payload conforme especificação
      const payload = filaAparelhos.map(item => ({
        empresa_id: empresaId,
        filial_id: item.filial_id,
        nome: item.nome,
        tipo: 'CELULAR',
        categoria: 'Celulares',
        imei: item.imei,
        preco: Number(item.preco_venda),
        preco_custo: Number(item.preco_custo || 0),
        preco_venda: Number(item.preco_venda),
        quantidade: 1,
        status: 'DISPONIVEL',
        cor: item.cor || null
      }));

      // Inserir em lote na tabela 'produtos'
      let { error: insertErr } = await supabase.from('produtos').insert(payload);

      // Fallback gracioso caso alguma coluna estrita (como status ou preco_venda) não exista no schema de produtos
      if (insertErr && (insertErr.code === 'PGRST204' || insertErr.message?.includes('could not find the column') || insertErr.message?.includes('does not exist'))) {
        console.warn('Fallback: removendo campos opcionais que podem não constar no schema estrito...');
        const payloadFallback = filaAparelhos.map(item => ({
          empresa_id: empresaId,
          filial_id: item.filial_id,
          nome: item.nome,
          tipo: 'CELULAR',
          categoria: 'Celulares',
          imei: item.imei,
          preco: Number(item.preco_venda),
          preco_custo: Number(item.preco_custo || 0),
          quantidade: 1,
          cor: item.cor || null
        }));

        const { error: fallbackErr } = await supabase.from('produtos').insert(payloadFallback);
        if (fallbackErr) throw fallbackErr;
      } else if (insertErr) {
        throw insertErr;
      }

      // Também sincronizar com a tabela 'imeis' se ela existir, para garantir compatibilidade com Poka-Yoke / módulo de IMEI
      try {
        const { data: produtosInseridos } = await supabase
          .from('produtos')
          .select('id, imei, filial_id')
          .eq('empresa_id', empresaId)
          .in('imei', filaAparelhos.map(i => i.imei));

        if (produtosInseridos && produtosInseridos.length > 0) {
          const mapaProdutoPorImei = {};
          produtosInseridos.forEach(p => {
            if (p.imei) mapaProdutoPorImei[p.imei] = p.id;
          });

          const imeisPayload = filaAparelhos.map(item => ({
            empresa_id: empresaId,
            filial_id: item.filial_id,
            produto_id: mapaProdutoPorImei[item.imei] || null,
            imei: item.imei,
            cor: item.cor || 'Preto',
            status: 'DISPONÍVEL',
            vendido: false,
            preco_compra: Number(item.preco_custo || 0),
            is_seminovo: false
          })).filter(i => i.produto_id !== null);

          if (imeisPayload.length > 0) {
            await supabase.from('imeis').upsert(imeisPayload, { onConflict: 'imei' });
          }
        }
      } catch (errImeiSync) {
        console.warn('[ModalEntradaAparelhosLote] Sincronização auxiliar de imeis ignorada ou dispensada:', errImeiSync);
      }

      const totalGravado = filaAparelhos.length;
      setFilaAparelhos([]);

      if (onSuccess) {
        onSuccess(totalGravado);
      }

      onClose();
    } catch (err) {
      console.error('Erro ao gravar aparelhos em lote:', err);
      setErroMsg(`Falha ao salvar aparelhos: ${err?.message || 'Erro desconhecido'}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#0D0D0D] border border-[#262626] w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#222222] bg-gradient-to-r from-[#140026] via-[#0D0D0D] to-[#0D0D0D]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#6A0DAD]/20 border border-[#6A0DAD]/40 flex items-center justify-center text-[#c084fc] shadow-lg shadow-[#6A0DAD]/10">
              <Smartphone size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-white tracking-wide">
                  Entrada Rápida de Aparelhos em Lote
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-[#6A0DAD]/30 text-[#c084fc] border border-[#6A0DAD]/40">
                  Fila IMEI
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Acumule aparelhos por modelo e lote de IMEIs antes de gravar no estoque
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Mensagens de Alerta / Erro */}
        {erroMsg && (
          <div className="mx-6 mt-4 p-3 bg-red-950/40 border border-red-800/50 rounded-xl flex items-center gap-2.5 text-red-300 text-xs">
            <AlertCircle size={16} className="shrink-0 text-red-400" />
            <span className="flex-1 font-medium">{erroMsg}</span>
            <button type="button" onClick={() => setErroMsg(null)} className="text-red-400 hover:text-red-200 cursor-pointer">
              <X size={14} />
            </button>
          </div>
        )}

        {avisoMsg && (
          <div className="mx-6 mt-3 p-3 bg-amber-950/30 border border-amber-800/40 rounded-xl flex items-center gap-2.5 text-amber-300 text-xs">
            <AlertCircle size={16} className="shrink-0 text-amber-400" />
            <span className="flex-1 font-medium">{avisoMsg}</span>
            <button type="button" onClick={() => setAvisoMsg(null)} className="text-amber-400 hover:text-amber-200 cursor-pointer">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Corpo do Modal */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
          
          {/* Seção 1: Configuração do Lote de Entrada (Topo) */}
          <div className="bg-[#141414] border border-[#222222] p-4 rounded-xl space-y-4">
            
            {/* Linha 1: Modelo & Filial de Destino */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              
              {/* Modelo */}
              <div className="md:col-span-7 space-y-1.5">
                <label className="block text-[11px] font-bold text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Smartphone size={13} className="text-[#c084fc]" />
                  Modelo do Aparelho <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={modelo}
                  onChange={(e) => setModelo(e.target.value)}
                  placeholder="Ex: Realme C85, iPhone 13, Moto G84..."
                  className="w-full bg-black border border-[#333333] focus:border-[#6A0DAD] rounded-lg px-3 py-2 text-sm text-white font-medium outline-none transition-colors"
                />
              </div>

              {/* Filial de Destino */}
              <div className="md:col-span-5 space-y-1.5">
                <label className="block text-[11px] font-bold text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 size={13} className="text-[#c084fc]" />
                  Filial de Destino <span className="text-red-400">*</span>
                </label>
                <select
                  value={filialDestinoId}
                  onChange={(e) => setFilialDestinoId(e.target.value)}
                  disabled={loadingFiliais}
                  className="w-full bg-black border border-[#333333] focus:border-[#6A0DAD] rounded-lg px-3 py-2 text-sm text-white font-medium outline-none cursor-pointer transition-colors"
                >
                  {listaFiliais.length === 0 ? (
                    <option value="">Nenhuma filial cadastrada</option>
                  ) : (
                    listaFiliais.map(fil => (
                      <option key={fil.id} value={fil.id}>
                        {fil.nome} {fil.tipo ? `(${fil.tipo})` : ''}
                      </option>
                    ))
                  )}
                </select>
              </div>

            </div>

            {/* Linha 2: Armazenamento e Cor */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-1">
              
              {/* Armazenamento (Chips Rápidos) */}
              <div className="md:col-span-6 space-y-1.5">
                <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers size={13} className="text-purple-400" />
                  Armazenamento
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {ARMAZENAMENTOS_PADRAO.map(cap => {
                    const isSelected = armazenamento === cap;
                    return (
                      <button
                        key={cap}
                        type="button"
                        onClick={() => setArmazenamento(cap)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#6A0DAD] border-[#6A0DAD] text-white shadow-sm shadow-[#6A0DAD]/30'
                            : 'bg-black border-[#333333] text-gray-400 hover:border-gray-500 hover:text-gray-200'
                        }`}
                      >
                        {isSelected && <Check size={12} className="inline mr-1" />}
                        {cap}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cor (Chips Rápidos + Inclusão Inline) */}
              <div className="md:col-span-6 space-y-1.5">
                <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                  Cor
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {listaCores.map(c => {
                    const isSelected = corSelecionada.trim().toLowerCase() === c.trim().toLowerCase();
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCorSelecionada(c)}
                        className={`px-3 py-1 rounded-lg text-xs transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-purple-600 text-white font-bold shadow-md shadow-purple-900/40'
                            : 'bg-[#1a1a24] text-gray-300 hover:text-white hover:bg-[#252533]'
                        }`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
                
                {/* Formulário Inline para Adicionar Nova Cor */}
                <form
                  onSubmit={handleAdicionarNovaCor}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={novaCorInput}
                    onChange={(e) => setNovaCorInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAdicionarNovaCor(e);
                      }
                    }}
                    placeholder="Outra cor (ex: Roxo Noturno, Amarelo, Estelar...)"
                    className="flex-1 bg-black border border-[#333333] focus:border-purple-500 rounded-lg px-3 py-1.5 text-xs text-white outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={handleAdicionarNovaCor}
                    disabled={isSavingCor || !novaCorInput.trim()}
                    className="shrink-0 px-3 py-1.5 bg-purple-600/90 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {isSavingCor ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Plus size={13} />
                    )}
                    + Adicionar Cor
                  </button>
                </form>
              </div>

            </div>

            {/* Linha 3: Preço de Custo e Preço de Venda */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-[#222222]/80">
              
              {/* Preço de Custo */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-amber-400/90 uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign size={13} className="text-amber-400" />
                  Preço de Custo (R$) <span className="text-[10px] text-gray-400 font-normal">(Opcional)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={precoCusto}
                  onChange={(e) => setPrecoCusto(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-black border border-amber-900/40 focus:border-amber-500 rounded-lg px-3 py-2 text-sm text-amber-300 font-mono outline-none"
                />
              </div>

              {/* Preço de Venda */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign size={13} className="text-emerald-400" />
                  Preço de Venda (R$) <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={precoVenda}
                  onChange={(e) => setPrecoVenda(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-black border border-emerald-900/50 focus:border-emerald-500 rounded-lg px-3 py-2 text-sm text-emerald-300 font-mono font-bold outline-none"
                />
              </div>

            </div>

            {/* Linha 4: Lista de IMEIs */}
            <div className="space-y-1.5 pt-1 border-t border-[#222222]/80">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold text-gray-200 uppercase tracking-wider">
                  Lista de IMEIs <span className="text-red-400">*</span>
                </label>
                <span className="text-[10px] text-gray-400">
                  Cole um por linha ou separados por vírgula/espaço (15 dígitos)
                </span>
              </div>
              <textarea
                rows={4}
                value={listaImeisTexto}
                onChange={(e) => setListaImeisTexto(e.target.value)}
                placeholder={"356987112345678\n356987112345679\n356987112345680"}
                className="w-full bg-black border border-[#333333] focus:border-[#6A0DAD] rounded-lg p-3 text-xs text-white font-mono outline-none resize-none leading-relaxed"
              />
            </div>

          </div>

          {/* Botão "+ Adicionar Aparelhos à Fila" */}
          <div className="flex justify-center py-1">
            <button
              type="button"
              onClick={handleAdicionarAFila}
              className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-[#6A0DAD] to-[#8A2BE2] hover:from-[#5b0b94] hover:to-[#7822c9] text-white rounded-xl text-sm font-extrabold transition-all shadow-lg shadow-[#6A0DAD]/25 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus size={18} />
              <span>+ Adicionar Aparelhos à Fila</span>
            </button>
          </div>

          {/* Seção 3: Tabela de Pré-visualização da Fila */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-[#c084fc]" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Fila de Aparelhos Cadastrados
                </h3>
                <span className="text-[11px] bg-[#6A0DAD]/20 text-[#c084fc] border border-[#6A0DAD]/30 px-2.5 py-0.5 rounded-md font-mono font-bold">
                  {filaAparelhos.length} na fila
                </span>
              </div>
              {filaAparelhos.length > 0 && (
                <button
                  type="button"
                  onClick={handleLimparFila}
                  className="text-xs text-red-400 hover:text-red-300 hover:underline font-semibold cursor-pointer"
                >
                  Limpar Fila
                </button>
              )}
            </div>

            {filaAparelhos.length === 0 ? (
              <div className="border border-dashed border-[#262626] rounded-xl p-8 text-center text-gray-500 text-xs">
                Nenhum aparelho na fila ainda. Preencha o modelo, filial, valores e cole a lista de IMEIs acima, depois clique em "+ Adicionar Aparelhos à Fila".
              </div>
            ) : (
              <div className="border border-[#222222] rounded-xl overflow-hidden bg-[#0A0A0A]">
                <div className="max-h-60 overflow-y-auto divide-y divide-[#1A1A1A]">
                  <table className="w-full text-left text-xs text-gray-300">
                    <thead className="bg-[#141414] text-[10px] font-bold text-gray-400 uppercase tracking-wider sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3 w-10">#</th>
                        <th className="py-2.5 px-3">Aparelho</th>
                        <th className="py-2.5 px-3">Filial</th>
                        <th className="py-2.5 px-3">IMEI</th>
                        <th className="py-2.5 px-3">Preço Venda</th>
                        <th className="py-2.5 px-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#181818]">
                      {filaAparelhos.map((item, idx) => (
                        <tr key={item.idTemp || idx} className="hover:bg-white/[0.02]">
                          <td className="py-2 px-3 font-mono text-[10px] text-gray-600">{idx + 1}</td>
                          <td className="py-2 px-3 font-medium text-white">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span>{item.nome}</span>
                              {item.cor && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-950/60 text-purple-300 border border-purple-800/50">
                                  {item.cor}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700 text-[10px] font-medium truncate max-w-[120px] inline-block">
                              {item.filial_nome || 'Filial'}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono text-purple-300 text-[11px] font-semibold tracking-wider">
                            {item.imei}
                          </td>
                          <td className="py-2 px-3 font-mono text-emerald-400 font-semibold">
                            R$ {Number(item.preco_venda).toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoverItem(idx)}
                              className="text-gray-500 hover:text-red-400 p-1 rounded hover:bg-white/5 transition-colors cursor-pointer"
                              title="Remover linha"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Rodapé / Totalizador e Gravação */}
        <div className="p-4 bg-[#111111] border-t border-[#222222] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-gray-400">
            Total de aparelhos na fila: <strong className="text-white font-mono text-sm">{filaAparelhos.length}</strong>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 px-4 py-2.5 bg-[#1F1F1F] hover:bg-[#2a2a2a] text-gray-300 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSalvarTodos}
              disabled={isSaving || filaAparelhos.length === 0}
              className="flex-1 px-6 py-2.5 bg-[#6A0DAD] hover:bg-[#500885] disabled:bg-gray-800 disabled:text-gray-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-[#6A0DAD]/20 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
              <span>Salvar Todos os Aparelhos ({filaAparelhos.length})</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

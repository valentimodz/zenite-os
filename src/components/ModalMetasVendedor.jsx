import React, { useState, useEffect } from 'react';
import { 
  X, Target, Award, DollarSign, Calendar, AlertCircle, 
  CheckCircle2, Sparkles, User, RefreshCw, ShieldCheck, TrendingUp 
} from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function ModalMetasVendedor({ 
  vendedor, 
  filialId, 
  empresaId, 
  isOpen, 
  onClose, 
  onSuccess 
}) {
  const getMesAtual = () => {
    const d = new Date();
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    return `${ano}-${mes}`;
  };

  const [mesAno, setMesAno] = useState(getMesAtual());
  const [isTrainee, setIsTrainee] = useState(false);
  const [metaBoleto, setMetaBoleto] = useState(67500);
  const [superMetaBoleto, setSuperMetaBoleto] = useState(87000);
  const [metaAcessorios, setMetaAcessorios] = useState(10000);
  const [superMetaAcessorios, setSuperMetaAcessorios] = useState(15000);
  const [metaTraineeBoleto, setMetaTraineeBoleto] = useState(40000);

  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [registroId, setRegistroId] = useState(null);
  const [mensagem, setMensagem] = useState(null);

  const parseMoeda = (str) => {
    if (typeof str === 'number') return str;
    if (!str) return 0;
    const limpo = String(str).replace(/[^\d,\.]/g, '').replace(',', '.');
    const num = parseFloat(limpo);
    return isNaN(num) ? 0 : num;
  };

  // Carregar metas do vendedor para o mês selecionado
  const carregarMetas = async (vendedorId, mes) => {
    if (!vendedorId || !mes) return;
    setLoading(true);
    setMensagem(null);
    try {
      // 1. Buscar na tabela metas
      let metaData = null;
      try {
        const { data, error } = await supabase
          .from('metas')
          .select('*')
          .eq('vendedor_id', vendedorId)
          .eq('mes_ano', mes)
          .maybeSingle();

        if (!error && data) {
          metaData = data;
        } else {
          // Fallback por mes_referencia
          const { data: dataRef } = await supabase
            .from('metas')
            .select('*')
            .eq('vendedor_id', vendedorId)
            .eq('mes_referencia', mes)
            .maybeSingle();
          if (dataRef) metaData = dataRef;
        }
      } catch (errM) {
        console.warn('[ModalMetasVendedor] Erro ao buscar metas:', errM);
      }

      if (metaData) {
        setRegistroId(metaData.id);
        if (metaData.meta_boleto !== undefined && metaData.meta_boleto !== null) {
          setMetaBoleto(Number(metaData.meta_boleto));
        } else if (metaData.valor_meta) {
          setMetaBoleto(Number(metaData.valor_meta));
        }
        if (metaData.super_meta_boleto !== undefined && metaData.super_meta_boleto !== null) {
          setSuperMetaBoleto(Number(metaData.super_meta_boleto));
        }
        if (metaData.meta_acessorios !== undefined && metaData.meta_acessorios !== null) {
          setMetaAcessorios(Number(metaData.meta_acessorios));
        }
        if (metaData.super_meta_acessorios !== undefined && metaData.super_meta_acessorios !== null) {
          setSuperMetaAcessorios(Number(metaData.super_meta_acessorios));
        }
        if (metaData.meta_trainee_boleto !== undefined && metaData.meta_trainee_boleto !== null) {
          setMetaTraineeBoleto(Number(metaData.meta_trainee_boleto));
        }
      } else {
        // Fallback inteligente com parâmetros padrão da filial
        setRegistroId(null);
        if (filialId) {
          try {
            const { data: cfg } = await supabase
              .from('configuracoes_metas_filial')
              .select('*')
              .eq('filial_id', filialId)
              .eq('mes_ano', mes)
              .maybeSingle();

            if (cfg) {
              if (cfg.meta_vendedor_boleto) setMetaBoleto(Number(cfg.meta_vendedor_boleto));
              if (cfg.super_meta_boleto) setSuperMetaBoleto(Number(cfg.super_meta_boleto));
              if (cfg.meta_vendedor_acessorios) setMetaAcessorios(Number(cfg.meta_vendedor_acessorios));
              if (cfg.super_meta_acessorios) setSuperMetaAcessorios(Number(cfg.super_meta_acessorios));
              if (cfg.meta_trainee_boletos) setMetaTraineeBoleto(Number(cfg.meta_trainee_boletos));
            }
          } catch (eCfg) {
            console.warn('[ModalMetasVendedor] Aviso fallback filial:', eCfg);
          }
        }
      }
    } catch (err) {
      console.error('[ModalMetasVendedor] Erro ao carregar:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && vendedor?.id) {
      const traineeInicial = Boolean(vendedor.is_treinner) || (vendedor.role || '').toUpperCase().includes('TRAINEE');
      setIsTrainee(traineeInicial);
      carregarMetas(vendedor.id, mesAno);
    }
  }, [isOpen, vendedor?.id, mesAno]);

  // Salvar Metas Individuais
  const handleSalvar = async (e) => {
    e.preventDefault();
    if (!vendedor?.id) return;

    setSalvando(true);
    setMensagem(null);

    try {
      const numMetaBoleto = parseMoeda(metaBoleto);
      const numSuperBoleto = parseMoeda(superMetaBoleto);
      const numMetaAcessorios = parseMoeda(metaAcessorios);
      const numSuperAcessorios = parseMoeda(superMetaAcessorios);
      const numMetaTrainee = parseMoeda(metaTraineeBoleto);

      // Valor total somando a meta do papel ativo + acessórios
      const valorBaseBoleto = isTrainee ? numMetaTrainee : numMetaBoleto;
      const valorMetaTotal = valorBaseBoleto + numMetaAcessorios;

      const payload = {
        vendedor_id: vendedor.id,
        filial_id: filialId || vendedor.filial_id || null,
        mes_ano: mesAno,
        mes_referencia: mesAno,
        valor_meta: valorMetaTotal,
        meta_boleto: numMetaBoleto,
        super_meta_boleto: numSuperBoleto,
        meta_acessorios: numMetaAcessorios,
        super_meta_acessorios: numSuperAcessorios,
        meta_trainee_boleto: numMetaTrainee,
        tipo_meta: 'VALOR',
        updated_at: new Date().toISOString()
      };

      const targetTenantId = empresaId || vendedor.empresa_id || null;
      if (targetTenantId) {
        payload.tenant_id = targetTenantId;
      }

      if (registroId) {
        payload.id = registroId;
      }

      // 1. Upsert na tabela metas
      let { data: savedData, error: saveErr } = await supabase
        .from('metas')
        .upsert(payload, { onConflict: 'vendedor_id,mes_ano' })
        .select()
        .single();

      if (saveErr) {
        console.warn('[ModalMetasVendedor] Fallback onConflict vendedor_id,mes_referencia:', saveErr.message);
        const resRef = await supabase
          .from('metas')
          .upsert(payload, { onConflict: 'vendedor_id,mes_referencia' })
          .select()
          .single();
        if (resRef.error) throw resRef.error;
        savedData = resRef.data;
      }

      if (savedData?.id) {
        setRegistroId(savedData.id);
      }

      // 2. Sincronizar status trainee em profiles se alterado
      try {
        await supabase
          .from('profiles')
          .update({ is_treinner: isTrainee })
          .eq('id', vendedor.id);
      } catch (profErr) {
        console.warn('[ModalMetasVendedor] Aviso ao sincronizar profiles:', profErr);
      }

      setMensagem({
        tipo: 'sucesso',
        texto: `Metas de ${vendedor.nome} para ${mesAno} ajustadas com sucesso!`
      });

      if (onSuccess) {
        onSuccess({
          ...payload,
          id: savedData?.id || registroId,
          is_treinner: isTrainee
        });
      }

      setTimeout(() => {
        setMensagem(null);
      }, 4000);
    } catch (err) {
      console.error('[ModalMetasVendedor] Erro ao salvar:', err);
      setMensagem({
        tipo: 'erro',
        texto: `Falha ao salvar metas: ${err.message || 'Erro desconhecido'}`
      });
    } finally {
      setSalvando(false);
    }
  };

  if (!isOpen || !vendedor) return null;

  const valorBoletoAtivo = isTrainee ? parseMoeda(metaTraineeBoleto) : parseMoeda(metaBoleto);
  const totalMetaCalculada = valorBoletoAtivo + parseMoeda(metaAcessorios);
  const totalSuperMetaCalculada = parseMoeda(superMetaBoleto) + parseMoeda(superMetaAcessorios);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-5 animate-fadeIn">
      <div className="bg-[#0A0A0A] border border-[#222222] hover:border-[#6A0DAD]/40 rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl shadow-purple-950/30 overflow-hidden font-sans transition-colors">
        
        {/* HEADER */}
        <div className="p-5 border-b border-[#222222] flex items-center justify-between bg-gradient-to-r from-[#140529] via-[#0E0E0E] to-[#0A0A0A]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#6A0DAD] to-[#A78BFA] flex items-center justify-center text-white shadow-lg shadow-purple-900/40">
              <Target size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                Ajustar Metas Individuais — {vendedor.nome}
              </h3>
              <span className="text-[11px] text-gray-400 font-medium flex items-center gap-1.5">
                <User size={12} className="text-[#A78BFA]" />
                {vendedor.email}
              </span>
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

        {/* FEEDBACK ALERT */}
        {mensagem && (
          <div className={`mx-5 mt-4 p-3.5 rounded-xl border flex items-center gap-2.5 text-xs font-semibold animate-fadeIn ${
            mensagem.tipo === 'sucesso' 
              ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40' 
              : 'bg-red-950/40 text-red-300 border-red-800/40'
          }`}>
            {mensagem.tipo === 'sucesso' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{mensagem.texto}</span>
          </div>
        )}

        {/* FORMULÁRIO */}
        <form onSubmit={handleSalvar} className="flex-1 overflow-y-auto p-5 space-y-5">
          
          {/* BARRA SUPERIOR: MÊS & PAPEL DO COLABORADOR */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#111111] border border-[#222222] p-4 rounded-xl">
            {/* Seletor de Mês */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar size={13} className="text-[#A78BFA]" /> Mês de Referência:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="month"
                  value={mesAno}
                  onChange={(e) => setMesAno(e.target.value)}
                  className="bg-black border border-[#333333] focus:border-[#6A0DAD] text-white text-xs font-bold px-3 py-2 rounded-lg outline-none cursor-pointer w-full font-mono"
                  required
                />
                {loading && <RefreshCw size={14} className="animate-spin text-purple-400 shrink-0" />}
              </div>
            </div>

            {/* Toggle Papel: Vendedor Padrão vs Trainee */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck size={13} className="text-[#A78BFA]" /> Perfil Operacional:
              </label>
              <div className="grid grid-cols-2 gap-1.5 bg-black border border-[#333333] p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setIsTrainee(false)}
                  className={`py-1.5 px-2 rounded-md text-xs font-bold transition-all text-center cursor-pointer ${
                    !isTrainee 
                      ? 'bg-[#6A0DAD] text-white shadow-md shadow-purple-950/50' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Vendedor Padrão
                </button>
                <button
                  type="button"
                  onClick={() => setIsTrainee(true)}
                  className={`py-1.5 px-2 rounded-md text-xs font-bold transition-all text-center flex items-center justify-center gap-1 cursor-pointer ${
                    isTrainee 
                      ? 'bg-amber-500 text-black shadow-md shadow-amber-950/50' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Sparkles size={11} /> Trainee
                </button>
              </div>
            </div>
          </div>

          {/* CAMPOS COM MÁSCARA / ENTRADA MONETÁRIA */}
          <div className="space-y-4">
            
            {/* Bloco 1: Boletos & Crediário */}
            <div className="bg-[#111111] border border-[#222222] p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between border-b border-[#222222]/80 pb-2">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  1. Boletos / Crediário & Financiadoras
                </span>
                <span className="text-[10px] text-gray-500">Valores em Reais (R$)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Meta Boletos */}
                <div className="bg-black/60 border border-[#262626] focus-within:border-amber-500 p-3 rounded-lg space-y-1 transition-colors">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Meta Boletos / Crediário (R$)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-gray-500 font-mono">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={metaBoleto}
                      onChange={(e) => setMetaBoleto(e.target.value)}
                      className="w-full bg-transparent text-sm font-bold text-white outline-none font-mono"
                      placeholder="67500.00"
                      required
                    />
                  </div>
                  <span className="text-[9px] text-gray-500 block">Ex: R$ 67.500,00</span>
                </div>

                {/* Super Meta Boletos */}
                <div className="bg-black/60 border border-[#262626] focus-within:border-[#A78BFA] p-3 rounded-lg space-y-1 transition-colors">
                  <label className="block text-[10px] font-bold text-[#A78BFA] uppercase tracking-wider flex items-center gap-1">
                    <Sparkles size={11} /> Super Meta Boletos (R$)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-gray-500 font-mono">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={superMetaBoleto}
                      onChange={(e) => setSuperMetaBoleto(e.target.value)}
                      className="w-full bg-transparent text-sm font-bold text-[#A78BFA] outline-none font-mono"
                      placeholder="87000.00"
                      required
                    />
                  </div>
                  <span className="text-[9px] text-gray-500 block">Ex: R$ 87.000,00</span>
                </div>
              </div>

              {/* Se for Trainee: Campo Adicional */}
              {isTrainee && (
                <div className="bg-amber-950/20 border border-amber-800/40 p-3 rounded-lg space-y-1 transition-colors animate-fadeIn">
                  <label className="block text-[10px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles size={12} className="text-amber-400" />
                    Meta Boletos Trainee (R$)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-amber-500 font-mono">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={metaTraineeBoleto}
                      onChange={(e) => setMetaTraineeBoleto(e.target.value)}
                      className="w-full bg-transparent text-sm font-bold text-amber-200 outline-none font-mono"
                      placeholder="40000.00"
                      required
                    />
                  </div>
                  <span className="text-[9px] text-amber-400/80 block">
                    Meta específica aplicada enquanto o colaborador estiver no período de adaptação (Ex: R$ 40.000,00)
                  </span>
                </div>
              )}
            </div>

            {/* Bloco 2: Acessórios */}
            <div className="bg-[#111111] border border-[#222222] p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between border-b border-[#222222]/80 pb-2">
                <span className="text-xs font-bold text-purple-400 flex items-center gap-1.5 uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                  2. Vendas de Acessórios
                </span>
                <span className="text-[10px] text-gray-500">Capas, Películas, Fones e Carregadores</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Meta Acessórios */}
                <div className="bg-black/60 border border-[#262626] focus-within:border-purple-500 p-3 rounded-lg space-y-1 transition-colors">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Meta Acessórios (R$)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-gray-500 font-mono">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={metaAcessorios}
                      onChange={(e) => setMetaAcessorios(e.target.value)}
                      className="w-full bg-transparent text-sm font-bold text-white outline-none font-mono"
                      placeholder="10000.00"
                      required
                    />
                  </div>
                  <span className="text-[9px] text-gray-500 block">Ex: R$ 10.000,00</span>
                </div>

                {/* Super Meta Acessórios */}
                <div className="bg-black/60 border border-[#262626] focus-within:border-pink-500 p-3 rounded-lg space-y-1 transition-colors">
                  <label className="block text-[10px] font-bold text-pink-400 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles size={11} /> Super Meta Acessórios (R$)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-gray-500 font-mono">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={superMetaAcessorios}
                      onChange={(e) => setSuperMetaAcessorios(e.target.value)}
                      className="w-full bg-transparent text-sm font-bold text-pink-300 outline-none font-mono"
                      placeholder="15000.00"
                      required
                    />
                  </div>
                  <span className="text-[9px] text-gray-500 block">Ex: R$ 15.000,00</span>
                </div>
              </div>
            </div>
          </div>

          {/* CARD DE VISUALIZAÇÃO / SOMA DA META */}
          <div className="bg-gradient-to-r from-purple-950/30 via-[#111111] to-[#120524] border border-[#333333] p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">
                Meta Total Mensal Calculada:
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-xl font-black text-white font-mono">
                  R$ {totalMetaCalculada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-xs text-gray-400 font-semibold">
                  ({isTrainee ? 'Trainee' : 'Boletos'} + Acessórios)
                </span>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <span className="text-[10px] text-[#A78BFA] uppercase font-bold tracking-wider block flex items-center sm:justify-end gap-1">
                <Sparkles size={11} /> Super Meta Total:
              </span>
              <span className="text-base font-black text-[#A78BFA] font-mono block mt-0.5">
                R$ {totalSuperMetaCalculada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* RODAPÉ / AÇÕES */}
          <div className="pt-2 border-t border-[#222222] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-bold text-gray-400 hover:text-white bg-transparent hover:bg-white/5 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="px-5 py-2.5 rounded-lg text-xs font-extrabold bg-[#6A0DAD] hover:bg-[#580991] text-white flex items-center gap-2 shadow-lg shadow-purple-950/40 transition-all hover:scale-[1.02] disabled:opacity-50 cursor-pointer"
            >
              {salvando ? (
                <>
                  <RefreshCw size={13} className="animate-spin" /> Salvando...
                </>
              ) : (
                <>
                  <Target size={14} /> Salvar Metas do Vendedor
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

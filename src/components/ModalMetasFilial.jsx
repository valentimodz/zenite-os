import React, { useState, useEffect } from 'react';
import { 
  X, Target, Award, DollarSign, Percent, Save, RefreshCw, 
  Calendar, Store, AlertCircle, CheckCircle2, TrendingUp, ShieldAlert, Sparkles 
} from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function ModalMetasFilial({ filial, isOpen, onClose, onSuccess }) {
  // Mês padrão: Mês atual no formato YYYY-MM
  const getMesAtual = () => {
    const d = new Date();
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    return `${ano}-${mes}`;
  };

  const [mesReferencia, setMesReferencia] = useState(getMesAtual());
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [registroId, setRegistroId] = useState(null);
  const [mensagem, setMensagem] = useState(null);

  // Estados dos Campos das Metas da Loja (R$)
  const [metaLojaBoleto, setMetaLojaBoleto] = useState(123000);
  const [metaLojaAcessorios, setMetaLojaAcessorios] = useState(8000);
  const [superMeta, setSuperMeta] = useState(143000);
  const [metaTraineeBoleto, setMetaTraineeBoleto] = useState(30000);

  // Estados dos Campos das Regras de Comissionamento (% e R$)
  // Vendas Boleto
  const [comissaoBoletoAbaixo, setComissaoBoletoAbaixo] = useState(1.0);
  const [comissaoBoletoBatida, setComissaoBoletoBatida] = useState(3.0);
  const [comissaoBoletoSuper, setComissaoBoletoSuper] = useState(3.2);

  // Acessórios
  const [comissaoAcessoriosAbaixo, setComissaoAcessoriosAbaixo] = useState(1.0);
  const [comissaoAcessoriosBatida, setComissaoAcessoriosBatida] = useState(2.5);
  const [comissaoAcessoriosSuper, setComissaoAcessoriosSuper] = useState(3.0);

  // Celulares à Vista/Cartão/Pix
  const [comissaoCelularAbaixo, setComissaoCelularAbaixo] = useState(1.0);
  const [comissaoCelularBatida, setComissaoCelularBatida] = useState(2.0);

  // Linha Premium / Unidade (R$)
  const [premiumUnitarioAbaixo, setPremiumUnitarioAbaixo] = useState(15.0);
  const [premiumUnitarioBatida, setPremiumUnitarioBatida] = useState(30.0);

  // Trainee Bonificado (% sobre boletos)
  const [comissaoTraineeBoleto, setComissaoTraineeBoleto] = useState(1.0);

  // Buscar regras da filial e mês selecionados
  const carregarRegras = async (filialId, mes) => {
    if (!filialId || !mes) return;
    setLoading(true);
    setMensagem(null);
    try {
      const { data, error } = await supabase
        .from('regras_comissoes')
        .select('*')
        .eq('filial_id', filialId)
        .eq('mes_referencia', mes)
        .maybeSingle();

      if (error) {
        console.warn('[ModalMetasFilial] Aviso ao buscar regras:', error);
      }

      if (data) {
        setRegistroId(data.id);
        setMetaLojaBoleto(Number(data.meta_loja_boleto ?? 123000));
        setMetaLojaAcessorios(Number(data.meta_loja_acessorios ?? 8000));
        setSuperMeta(Number(data.super_meta ?? 143000));
        setMetaTraineeBoleto(Number(data.meta_trainee_boleto ?? 30000));

        // Converter valores de fração decimal para percentual (0.01 -> 1%) se vier assim do banco
        const toPercent = (val, def) => {
          if (val === null || val === undefined) return def;
          const num = Number(val);
          return num <= 0.5 ? Number((num * 100).toFixed(2)) : num;
        };

        setComissaoBoletoAbaixo(toPercent(data.comissao_boleto_abaixo, 1.0));
        setComissaoBoletoBatida(toPercent(data.comissao_boleto_batida, 3.0));
        setComissaoBoletoSuper(toPercent(data.comissao_boleto_super, 3.2));

        setComissaoAcessoriosAbaixo(toPercent(data.comissao_acessorios_abaixo, 1.0));
        setComissaoAcessoriosBatida(toPercent(data.comissao_acessorios_batida, 2.5));
        setComissaoAcessoriosSuper(toPercent(data.comissao_acessorios_super, 3.0));

        setComissaoCelularAbaixo(toPercent(data.comissao_celular_abaixo, 1.0));
        setComissaoCelularBatida(toPercent(data.comissao_celular_batida, 2.0));

        setPremiumUnitarioAbaixo(Number(data.premium_unitario_abaixo ?? 15.0));
        setPremiumUnitarioBatida(Number(data.premium_unitario_batida ?? 30.0));

        setComissaoTraineeBoleto(toPercent(data.comissao_trainee_boleto, 1.0));
      } else {
        // Valores Padrão recomendados
        setRegistroId(null);
        setMetaLojaBoleto(123000);
        setMetaLojaAcessorios(8000);
        setSuperMeta(143000);
        setMetaTraineeBoleto(30000);

        setComissaoBoletoAbaixo(1.0);
        setComissaoBoletoBatida(3.0);
        setComissaoBoletoSuper(3.2);

        setComissaoAcessoriosAbaixo(1.0);
        setComissaoAcessoriosBatida(2.5);
        setComissaoAcessoriosSuper(3.0);

        setComissaoCelularAbaixo(1.0);
        setComissaoCelularBatida(2.0);

        setPremiumUnitarioAbaixo(15.0);
        setPremiumUnitarioBatida(30.0);

        setComissaoTraineeBoleto(1.0);
      }
    } catch (err) {
      console.error('[ModalMetasFilial] Erro ao carregar:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && filial?.id) {
      carregarRegras(filial.id, mesReferencia);
    }
  }, [isOpen, filial?.id, mesReferencia]);

  // Salvar / Fazer Upsert
  const handleSalvar = async (e) => {
    e.preventDefault();
    if (!filial?.id) return;

    setSalvando(true);
    setMensagem(null);

    try {
      // Obter tenant_id ou empresa_id da filial para integridade
      const tenantId = filial.tenant_id || filial.empresa_id || null;

      // As porcentagens são salvas como frações decimais (ex: 1% -> 0.01) para alinhamento com a base de dados
      const toDecimal = (val) => {
        const n = parseFloat(val) || 0;
        return Number((n / 100).toFixed(4));
      };

      const payload = {
        filial_id: filial.id,
        mes_referencia: mesReferencia,
        meta_loja_boleto: parseFloat(metaLojaBoleto) || 0,
        meta_loja_acessorios: parseFloat(metaLojaAcessorios) || 0,
        super_meta: parseFloat(superMeta) || 0,
        meta_trainee_boleto: parseFloat(metaTraineeBoleto) || 0,

        comissao_boleto_abaixo: toDecimal(comissaoBoletoAbaixo),
        comissao_boleto_batida: toDecimal(comissaoBoletoBatida),
        comissao_boleto_super: toDecimal(comissaoBoletoSuper),

        comissao_acessorios_abaixo: toDecimal(comissaoAcessoriosAbaixo),
        comissao_acessorios_batida: toDecimal(comissaoAcessoriosBatida),
        comissao_acessorios_super: toDecimal(comissaoAcessoriosSuper),

        comissao_celular_abaixo: toDecimal(comissaoCelularAbaixo),
        comissao_celular_batida: toDecimal(comissaoCelularBatida),

        premium_unitario_abaixo: parseFloat(premiumUnitarioAbaixo) || 0,
        premium_unitario_batida: parseFloat(premiumUnitarioBatida) || 0,

        comissao_trainee_boleto: toDecimal(comissaoTraineeBoleto),
        updated_at: new Date().toISOString()
      };

      if (tenantId) {
        payload.tenant_id = tenantId;
      }

      if (registroId) {
        payload.id = registroId;
      }

      // Upsert garantido pelo índice (filial_id, mes_referencia)
      const { data, error } = await supabase
        .from('regras_comissoes')
        .upsert(payload, { onConflict: 'filial_id,mes_referencia' })
        .select()
        .single();

      if (error) throw error;

      if (data?.id) {
        setRegistroId(data.id);
      }

      setMensagem({ tipo: 'sucesso', texto: `Metas e comissões para ${mesReferencia} salvas com sucesso!` });

      if (onSuccess) {
        onSuccess(data);
      }

      setTimeout(() => {
        setMensagem(null);
      }, 4000);
    } catch (err) {
      console.error('[ModalMetasFilial] Erro ao salvar:', err);
      setMensagem({ tipo: 'erro', texto: `Falha ao salvar: ${err.message || 'Erro desconhecido'}` });
    } finally {
      setSalvando(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-5 animate-fadeIn">
      <div className="bg-[#0A0A0A] border border-[#222222] hover:border-[#6A0DAD]/40 rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl shadow-purple-950/20 overflow-hidden font-sans transition-colors">
        
        {/* HEADER */}
        <div className="p-5 border-b border-[#222222] flex items-center justify-between bg-gradient-to-r from-[#120524] via-[#0D0D0D] to-[#0A0A0A]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#6A0DAD]/20 border border-[#6A0DAD]/40 flex items-center justify-center text-purple-400 shadow-inner">
              <Target size={22} className="text-[#A78BFA]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white">Metas da Loja &amp; Tabela de Comissionamento</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-800/50">
                  {filial?.nome || 'Filial'}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Configure os objetivos globais da equipe e faixas de remuneração variável por resultado.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-[#1A1A1A] rounded-lg transition-colors cursor-pointer"
            title="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* MENSAGEM DE FEEDBACK */}
        {mensagem && (
          <div className={`px-5 py-3 text-xs font-semibold flex items-center gap-2 border-b ${
            mensagem.tipo === 'sucesso' 
              ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40' 
              : 'bg-red-950/40 text-red-300 border-red-800/40'
          }`}>
            {mensagem.tipo === 'sucesso' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{mensagem.texto}</span>
          </div>
        )}

        {/* CORPO DO FORMULÁRIO */}
        <form onSubmit={handleSalvar} className="flex-1 overflow-y-auto p-5 space-y-6">
          
          {/* BARRA SUPERIOR: SELETOR DE MÊS */}
          <div className="bg-[#111111] border border-[#222222] p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-[#A78BFA]" />
              <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Mês de Referência:</span>
              <input
                type="month"
                value={mesReferencia}
                onChange={(e) => setMesReferencia(e.target.value)}
                className="bg-black border border-[#333333] focus:border-[#6A0DAD] text-white text-xs font-bold px-3 py-1.5 rounded-lg outline-none cursor-pointer"
                required
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              {loading ? (
                <span className="flex items-center gap-1.5 text-purple-400">
                  <RefreshCw size={13} className="animate-spin" /> Carregando parâmetros do mês...
                </span>
              ) : registroId ? (
                <span className="flex items-center gap-1 text-emerald-400 font-semibold text-[11px]">
                  <CheckCircle2 size={13} /> Regras salvas no Supabase
                </span>
              ) : (
                <span className="text-[11px] text-amber-400/90 font-medium">
                  Novo registro para este mês (valores padrão carregados)
                </span>
              )}
            </div>
          </div>

          {/* SEÇÃO 1: METAS DA LOJA (R$) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                <Target size={14} /> 1. Metas Globais da Loja (R$)
              </h4>
              <span className="text-[10px] text-gray-500">Valores em Reais para a filial inteira</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Meta Boleto */}
              <div className="bg-[#111111] border border-[#222222] focus-within:border-[#6A0DAD] p-3.5 rounded-xl space-y-1 transition-colors">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Meta Boleto (R$)
                </label>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-gray-500 font-mono">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={metaLojaBoleto}
                    onChange={(e) => setMetaLojaBoleto(e.target.value)}
                    className="w-full bg-transparent text-sm font-bold text-white outline-none font-mono"
                    placeholder="123000.00"
                    required
                  />
                </div>
                <span className="text-[9px] text-gray-500 block">Ex: R$ 123.000,00</span>
              </div>

              {/* Meta Acessórios */}
              <div className="bg-[#111111] border border-[#222222] focus-within:border-[#6A0DAD] p-3.5 rounded-xl space-y-1 transition-colors">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Meta Acessórios (R$)
                </label>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-gray-500 font-mono">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={metaLojaAcessorios}
                    onChange={(e) => setMetaLojaAcessorios(e.target.value)}
                    className="w-full bg-transparent text-sm font-bold text-white outline-none font-mono"
                    placeholder="8000.00"
                    required
                  />
                </div>
                <span className="text-[9px] text-gray-500 block">Ex: R$ 8.000,00</span>
              </div>

              {/* Super Meta */}
              <div className="bg-[#111111] border border-[#222222] focus-within:border-[#6A0DAD] p-3.5 rounded-xl space-y-1 transition-colors">
                <label className="block text-[10px] font-bold text-[#A78BFA] uppercase tracking-wider flex items-center gap-1">
                  <Sparkles size={11} /> Super Meta (R$)
                </label>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-gray-500 font-mono">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={superMeta}
                    onChange={(e) => setSuperMeta(e.target.value)}
                    className="w-full bg-transparent text-sm font-bold text-[#A78BFA] outline-none font-mono"
                    placeholder="143000.00"
                    required
                  />
                </div>
                <span className="text-[9px] text-gray-500 block">Ex: R$ 143.000,00</span>
              </div>

              {/* Meta Trainee Boletos */}
              <div className="bg-[#111111] border border-[#222222] focus-within:border-[#6A0DAD] p-3.5 rounded-xl space-y-1 transition-colors">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Meta Trainee Boletos (R$)
                </label>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-gray-500 font-mono">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={metaTraineeBoleto}
                    onChange={(e) => setMetaTraineeBoleto(e.target.value)}
                    className="w-full bg-transparent text-sm font-bold text-white outline-none font-mono"
                    placeholder="30000.00"
                    required
                  />
                </div>
                <span className="text-[9px] text-gray-500 block">Ex: R$ 30.000,00</span>
              </div>
            </div>
          </div>

          {/* SEÇÃO 2: REGRAS DE COMISSIONAMENTO (% / R$) */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between border-t border-[#222222] pt-4">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                <Award size={14} /> 2. Regras de Comissionamento (% / R$)
              </h4>
              <span className="text-[10px] text-gray-500">Gatilhos aplicados sobre faturamento e unidades</span>
            </div>

            {/* Linha 1: Vendas Boleto */}
            <div className="bg-[#111111] border border-[#222222] p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  Vendas no Boleto / Crediário
                </span>
                <span className="text-[10px] text-gray-400 font-medium">% sobre o valor bruto do boleto</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1">Abaixo da Meta (%)</label>
                  <div className="flex items-center bg-black border border-[#222222] focus-within:border-[#6A0DAD] px-3 py-1.5 rounded-lg">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={comissaoBoletoAbaixo}
                      onChange={(e) => setComissaoBoletoAbaixo(e.target.value)}
                      className="w-full bg-transparent text-xs font-bold text-white outline-none font-mono"
                      placeholder="1.0"
                    />
                    <span className="text-xs text-gray-500 font-bold">%</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-emerald-400 font-bold mb-1">Meta Batida (%)</label>
                  <div className="flex items-center bg-black border border-[#222222] focus-within:border-emerald-500 px-3 py-1.5 rounded-lg">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={comissaoBoletoBatida}
                      onChange={(e) => setComissaoBoletoBatida(e.target.value)}
                      className="w-full bg-transparent text-xs font-bold text-emerald-400 outline-none font-mono"
                      placeholder="3.0"
                    />
                    <span className="text-xs text-emerald-500 font-bold">%</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-[#A78BFA] font-bold mb-1">Super Meta (%)</label>
                  <div className="flex items-center bg-black border border-[#222222] focus-within:border-[#6A0DAD] px-3 py-1.5 rounded-lg">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={comissaoBoletoSuper}
                      onChange={(e) => setComissaoBoletoSuper(e.target.value)}
                      className="w-full bg-transparent text-xs font-bold text-[#A78BFA] outline-none font-mono"
                      placeholder="3.2"
                    />
                    <span className="text-xs text-purple-400 font-bold">%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Linha 2: Acessórios */}
            <div className="bg-[#111111] border border-[#222222] p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                  Vendas de Acessórios (Capas, Películas, Fones, etc.)
                </span>
                <span className="text-[10px] text-gray-400 font-medium">% sobre faturamento de acessórios</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1">Abaixo da Meta (%)</label>
                  <div className="flex items-center bg-black border border-[#222222] focus-within:border-[#6A0DAD] px-3 py-1.5 rounded-lg">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={comissaoAcessoriosAbaixo}
                      onChange={(e) => setComissaoAcessoriosAbaixo(e.target.value)}
                      className="w-full bg-transparent text-xs font-bold text-white outline-none font-mono"
                      placeholder="1.0"
                    />
                    <span className="text-xs text-gray-500 font-bold">%</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-emerald-400 font-bold mb-1">Meta Batida (%)</label>
                  <div className="flex items-center bg-black border border-[#222222] focus-within:border-emerald-500 px-3 py-1.5 rounded-lg">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={comissaoAcessoriosBatida}
                      onChange={(e) => setComissaoAcessoriosBatida(e.target.value)}
                      className="w-full bg-transparent text-xs font-bold text-emerald-400 outline-none font-mono"
                      placeholder="2.5"
                    />
                    <span className="text-xs text-emerald-500 font-bold">%</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-[#A78BFA] font-bold mb-1">Super Meta (%)</label>
                  <div className="flex items-center bg-black border border-[#222222] focus-within:border-[#6A0DAD] px-3 py-1.5 rounded-lg">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={comissaoAcessoriosSuper}
                      onChange={(e) => setComissaoAcessoriosSuper(e.target.value)}
                      className="w-full bg-transparent text-xs font-bold text-[#A78BFA] outline-none font-mono"
                      placeholder="3.0"
                    />
                    <span className="text-xs text-purple-400 font-bold">%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Linha 3: Celulares à Vista / Cartão / Pix */}
            <div className="bg-[#111111] border border-[#222222] p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                  Celulares à Vista / Cartão / Pix
                </span>
                <span className="text-[10px] text-gray-400 font-medium">% sobre aparelhos vendidos à vista</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1">Abaixo da Meta (%)</label>
                  <div className="flex items-center bg-black border border-[#222222] focus-within:border-[#6A0DAD] px-3 py-1.5 rounded-lg">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={comissaoCelularAbaixo}
                      onChange={(e) => setComissaoCelularAbaixo(e.target.value)}
                      className="w-full bg-transparent text-xs font-bold text-white outline-none font-mono"
                      placeholder="1.0"
                    />
                    <span className="text-xs text-gray-500 font-bold">%</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-emerald-400 font-bold mb-1">Meta Batida (%)</label>
                  <div className="flex items-center bg-black border border-[#222222] focus-within:border-emerald-500 px-3 py-1.5 rounded-lg">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={comissaoCelularBatida}
                      onChange={(e) => setComissaoCelularBatida(e.target.value)}
                      className="w-full bg-transparent text-xs font-bold text-emerald-400 outline-none font-mono"
                      placeholder="2.0"
                    />
                    <span className="text-xs text-emerald-500 font-bold">%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Linha 4: Linha Premium / Unidade & Trainee */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Linha Premium */}
              <div className="bg-[#111111] border border-[#222222] p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-pink-400"></span>
                    Linha Premium / Unidade
                  </span>
                  <span className="text-[9px] text-gray-400">JBL, iPhones, Consoles</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1">Abaixo (R$/unid)</label>
                    <div className="flex items-center bg-black border border-[#222222] focus-within:border-[#6A0DAD] px-3 py-1.5 rounded-lg">
                      <span className="text-xs text-gray-500 font-mono mr-1">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={premiumUnitarioAbaixo}
                        onChange={(e) => setPremiumUnitarioAbaixo(e.target.value)}
                        className="w-full bg-transparent text-xs font-bold text-white outline-none font-mono"
                        placeholder="15.00"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] text-emerald-400 font-bold mb-1">Batida (R$/unid)</label>
                    <div className="flex items-center bg-black border border-[#222222] focus-within:border-emerald-500 px-3 py-1.5 rounded-lg">
                      <span className="text-xs text-emerald-500 font-mono mr-1">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={premiumUnitarioBatida}
                        onChange={(e) => setPremiumUnitarioBatida(e.target.value)}
                        className="w-full bg-transparent text-xs font-bold text-emerald-400 outline-none font-mono"
                        placeholder="30.00"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Trainee Bonificado */}
              <div className="bg-[#111111] border border-[#222222] p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                    Trainee Bonificado
                  </span>
                  <span className="text-[9px] text-gray-400">% sobre boletos</span>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1">Comissão Trainee sobre Boletos (%)</label>
                  <div className="flex items-center bg-black border border-[#222222] focus-within:border-[#6A0DAD] px-3 py-1.5 rounded-lg">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={comissaoTraineeBoleto}
                      onChange={(e) => setComissaoTraineeBoleto(e.target.value)}
                      className="w-full bg-transparent text-xs font-bold text-cyan-300 outline-none font-mono"
                      placeholder="1.0"
                    />
                    <span className="text-xs text-cyan-500 font-bold">%</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* FOOTER ACTIONS */}
          <div className="border-t border-[#222222] pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold rounded-lg border border-[#333333] hover:border-gray-500 text-gray-300 hover:text-white transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando || loading}
              className="px-5 py-2 text-xs font-bold rounded-lg bg-[#6A0DAD] hover:bg-[#520887] text-white flex items-center gap-2 transition-all shadow-lg shadow-[#6A0DAD]/30 disabled:opacity-50 cursor-pointer"
            >
              {salvando ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> Salvando Regras...
                </>
              ) : (
                <>
                  <Save size={14} /> Salvar Parâmetros da Filial
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}

import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileCode, 
  ReceiptText, 
  Search, 
  Filter, 
  Download, 
  Eye, 
  Copy, 
  Check, 
  Calendar, 
  Building2, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  ExternalLink,
  DollarSign,
  TrendingUp,
  FileCheck
} from 'lucide-react';
import { supabase } from '../../supabaseClient';

interface FilialItem {
  id: string | number;
  nome?: string;
  razao_social?: string;
  cidade?: string;
  estado?: string;
  uf?: string;
  logo_url?: string;
}

interface NotaFiscalItem {
  id: string;
  empresa_id?: string;
  filial_id?: string | number;
  venda_id?: string;
  numero_nfe?: number | string;
  serie?: number | string;
  chave_acesso?: string;
  protocolo_autorizacao?: string;
  status?: string;
  cliente_nome?: string;
  cliente_documento?: string;
  valor_total?: number;
  danfe_pdf_url?: string;
  xml_conteudo?: string;
  created_at?: string;
  // Joins ou enrichments
  filial?: FilialItem;
  venda?: any;
}

interface NotasFiscaisViewProps {
  profile?: any;
  company?: any;
  filiais?: FilialItem[];
}

export const NotasFiscaisView: React.FC<NotasFiscaisViewProps> = ({ profile, company, filiais = [] }) => {
  const [notas, setNotas] = useState<NotaFiscalItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filtros
  const [selectedFilialId, setSelectedFilialId] = useState<string>('TODAS');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Datas padrão: Primeiro e último dia do mês corrente
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  
  const [dataInicio, setDataInicio] = useState<string>(firstDayOfMonth);
  const [dataFim, setDataFim] = useState<string>(lastDayOfMonth);
  const [statusFilter, setStatusFilter] = useState<'TODAS' | 'AUTORIZADAS' | 'CANCELADAS'>('TODAS');

  // Estado para toast/copiar
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Modal de Pré-visualização do DANFE
  const [modalDanfe, setModalDanfe] = useState<{ isOpen: boolean; pdfUrl: string; chave: string; numero: string } | null>(null);

  // Função para resolver logo da filial
  const getFilialLogo = (filialNome?: string, logoUrl?: string): string => {
    if (logoUrl && (logoUrl.startsWith('http') || logoUrl.startsWith('/'))) {
      return logoUrl;
    }
    const nomeNorm = String(filialNome || '').toLowerCase();
    if (nomeNorm.includes('cred') && nomeNorm.includes('cell')) return '/logos/credcell.png';
    if (nomeNorm.includes('monkey')) return '/logos/monkeyshop.png';
    if (nomeNorm.includes('smart')) return '/logos/credsmart.png';
    if (nomeNorm.includes('phone')) return '/logos/credphone.png';
    return '/logos/default-store.png';
  };

  // Carregar Notas Fiscais
  const carregarNotas = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      let query = supabase
        .from('notas_fiscais')
        .select('*')
        .order('created_at', { ascending: false });

      if (company?.id) {
        query = query.eq('empresa_id', company.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Buscar filiais se não vierem prontas
      const filiaisMap = new Map<string, FilialItem>();
      (filiais || []).forEach(f => {
        filiaisMap.set(String(f.id), f);
      });

      const notasEnriquecidas: NotaFiscalItem[] = (data || []).map((item: any) => {
        const filialRelacionada = item.filial_id ? filiaisMap.get(String(item.filial_id)) : undefined;
        return {
          ...item,
          filial: filialRelacionada
        };
      });

      setNotas(notasEnriquecidas);
    } catch (err: any) {
      console.error('Erro ao carregar notas fiscais:', err);
      setErrorMsg(err.message || 'Falha ao carregar listagem de notas fiscais.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarNotas();
  }, [company?.id]);

  // Filtragem
  const notasFiltradas = useMemo(() => {
    return notas.filter(nota => {
      // Filtro Filial
      if (selectedFilialId !== 'TODAS') {
        if (String(nota.filial_id) !== String(selectedFilialId)) return false;
      }

      // Filtro Status
      if (statusFilter === 'AUTORIZADAS') {
        const st = String(nota.status || '').toUpperCase();
        if (st !== 'AUTORIZADA' && st !== 'EMITIDA') return false;
      } else if (statusFilter === 'CANCELADAS') {
        const st = String(nota.status || '').toUpperCase();
        if (st !== 'CANCELADA') return false;
      }

      // Filtro de Data
      if (nota.created_at) {
        const dataNota = nota.created_at.split('T')[0];
        if (dataInicio && dataNota < dataInicio) return false;
        if (dataFim && dataNota > dataFim) return false;
      }

      // Filtro de Busca (Cliente, CPF/CNPJ, Número NF, Chave)
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().replace(/[^a-z0-9]/g, '');
        const rawTerm = searchTerm.toLowerCase().trim();

        const nome = String(nota.cliente_nome || '').toLowerCase();
        const doc = String(nota.cliente_documento || '').replace(/[^0-9]/g, '');
        const numero = String(nota.numero_nfe || '');
        const chave = String(nota.chave_acesso || '');

        const matchNome = nome.includes(rawTerm);
        const matchDoc = doc.includes(term);
        const matchNumero = numero.includes(rawTerm);
        const matchChave = chave.includes(term);

        if (!matchNome && !matchDoc && !matchNumero && !matchChave) {
          return false;
        }
      }

      return true;
    });
  }, [notas, selectedFilialId, statusFilter, dataInicio, dataFim, searchTerm]);

  // Indicadores Acumulados
  const { totalAutorizadas, valorFaturadoAcumulado } = useMemo(() => {
    let count = 0;
    let soma = 0;
    notasFiltradas.forEach(n => {
      const st = String(n.status || '').toUpperCase();
      if (st === 'AUTORIZADA' || st === 'EMITIDA') {
        count += 1;
        soma += Number(n.valor_total || 0);
      }
    });
    return {
      totalAutorizadas: count,
      valorFaturadoAcumulado: soma
    };
  }, [notasFiltradas]);

  // Mascarar documento CPF/CNPJ
  const formatarDocumento = (doc?: string) => {
    if (!doc) return 'Consumidor Final';
    const limpo = doc.replace(/\D/g, '');
    if (limpo.length === 11) {
      return `***.${limpo.substring(3, 6)}.${limpo.substring(6, 9)}-**`;
    }
    if (limpo.length === 14) {
      return `${limpo.substring(0, 2)}.${limpo.substring(2, 5)}.${limpo.substring(5, 8)}/${limpo.substring(8, 12)}-${limpo.substring(12, 14)}`;
    }
    return doc;
  };

  // Formatar Moeda
  const formatarMoeda = (val?: number) => {
    return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Formatar Data / Hora
  const formatarDataHora = (dataIso?: string) => {
    if (!dataIso) return '-';
    try {
      const d = new Date(dataIso);
      return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return dataIso;
    }
  };

  // Copiar Chave de Acesso com Toast
  const handleCopiarChave = (chave?: string) => {
    if (!chave) return;
    navigator.clipboard.writeText(chave);
    setCopiedKey(chave);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2500);
  };

  // Download do XML Oficial
  const handleDownloadXml = (nota: NotaFiscalItem) => {
    const xml = nota.xml_conteudo;
    if (!xml) {
      alert('Arquivo XML não armazenado para esta nota fiscal.');
      return;
    }
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NFe_${nota.chave_acesso || nota.numero_nfe || 'oficial'}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Visualizar DANFE
  const handleVerDanfe = (nota: NotaFiscalItem) => {
    if (!nota.danfe_pdf_url) {
      alert('O PDF / DANFE desta nota não está disponível.');
      return;
    }
    setModalDanfe({
      isOpen: true,
      pdfUrl: nota.danfe_pdf_url,
      chave: nota.chave_acesso || '',
      numero: String(nota.numero_nfe || '')
    });
  };

  return (
    <div className="flex-1 w-full p-4 sm:p-6 lg:p-8 space-y-6 bg-[#0A0A0A] text-zinc-100 min-h-screen">
      {/* 1. CABEÇALHO */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-950/40 border border-[#6A0DAD]/40 text-[#A855F7]">
              <FileCode size={26} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
                Gestão Fiscal & NF-e
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  SEFAZ: PRODUÇÃO OFICIAL (Ambiente 1)
                </span>
              </h1>
              <p className="text-xs text-zinc-400 mt-1">
                Monitoramento, DANFE e arquivos XML de notas fiscais eletrônicas autorizadas
              </p>
            </div>
          </div>
        </div>

        {/* Indicadores Resumo */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex-1 md:flex-initial bg-zinc-900/80 border border-zinc-800 rounded-xl p-3.5 flex items-center gap-3 min-w-[170px]">
            <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-emerald-400">
              <FileCheck size={20} />
            </div>
            <div>
              <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Notas Autorizadas</p>
              <p className="text-lg font-bold text-white">{totalAutorizadas}</p>
            </div>
          </div>

          <div className="flex-1 md:flex-initial bg-zinc-900/80 border border-zinc-800 rounded-xl p-3.5 flex items-center gap-3 min-w-[210px]">
            <div className="p-2 rounded-lg bg-purple-950/40 border border-purple-800/40 text-purple-400">
              <TrendingUp size={20} />
            </div>
            <div>
              <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Faturado no Período</p>
              <p className="text-lg font-bold text-emerald-400">{formatarMoeda(valorFaturadoAcumulado)}</p>
            </div>
          </div>

          <button
            onClick={carregarNotas}
            disabled={loading}
            title="Atualizar lista"
            className="p-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all cursor-pointer"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin text-purple-400' : ''} />
          </button>
        </div>
      </div>

      {/* 2. BARRA DE FILTROS */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
          {/* Filial */}
          <div className="lg:col-span-3">
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <Building2 size={13} className="text-purple-400" /> Filial / Unidade
            </label>
            <select
              value={selectedFilialId}
              onChange={(e) => setSelectedFilialId(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-[#6A0DAD] rounded-xl px-3 py-2.5 text-xs text-white outline-none transition-all"
            >
              <option value="TODAS">🏢 Todas as Filiais</option>
              {filiais.map(f => (
                <option key={f.id} value={f.id}>
                  {f.nome || f.razao_social} {f.cidade ? `(${f.cidade}/${f.estado || f.uf || 'PA'})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Campo de Busca */}
          <div className="lg:col-span-4">
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <Search size={13} className="text-purple-400" /> Busca Avançada
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Cliente, CPF/CNPJ, Nº da NF-e ou Chave..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-[#6A0DAD] rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-zinc-500 outline-none transition-all"
              />
              <Search size={14} className="absolute left-3 top-3 text-zinc-500" />
            </div>
          </div>

          {/* Período Data Inicial */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <Calendar size={13} className="text-purple-400" /> Data Inicial
            </label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-[#6A0DAD] rounded-xl px-3 py-2.5 text-xs text-white outline-none transition-all [color-scheme:dark]"
            />
          </div>

          {/* Período Data Final */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <Calendar size={13} className="text-purple-400" /> Data Final
            </label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-[#6A0DAD] rounded-xl px-3 py-2.5 text-xs text-white outline-none transition-all [color-scheme:dark]"
            />
          </div>

          {/* Status */}
          <div className="lg:col-span-1">
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <Filter size={13} className="text-purple-400" /> Status
            </label>
            <select
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-[#6A0DAD] rounded-xl px-2 py-2.5 text-xs text-white outline-none transition-all"
            >
              <option value="TODAS">Todas</option>
              <option value="AUTORIZADAS">Autorizadas</option>
              <option value="CANCELADAS">Canceladas</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. TABELA DE NOTAS FISCAIS */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-400">
            <RefreshCw size={28} className="animate-spin text-purple-500" />
            <p className="text-xs">Carregando dados das notas fiscais no Supabase...</p>
          </div>
        ) : errorMsg ? (
          <div className="py-16 px-4 text-center">
            <AlertCircle size={32} className="mx-auto text-red-400 mb-2" />
            <p className="text-sm font-semibold text-red-300">{errorMsg}</p>
            <button
              onClick={carregarNotas}
              className="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold rounded-lg text-white"
            >
              Tentar Novamente
            </button>
          </div>
        ) : notasFiltradas.length === 0 ? (
          <div className="py-20 px-4 text-center">
            <ReceiptText size={42} className="mx-auto text-zinc-600 mb-3" />
            <p className="text-base font-semibold text-zinc-300">Nenhuma nota fiscal encontrada</p>
            <p className="text-xs text-zinc-500 mt-1 max-w-md mx-auto">
              Não encontramos emissões fiscais correspondentes aos filtros selecionados. As notas emitidas via PDV serão listadas automaticamente aqui.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-950/80 border-b border-zinc-800 text-zinc-400 uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4 font-semibold">Filial / Emissor</th>
                  <th className="py-3.5 px-4 font-semibold">NF-e / Série</th>
                  <th className="py-3.5 px-4 font-semibold">Data / Hora</th>
                  <th className="py-3.5 px-4 font-semibold">Destinatário</th>
                  <th className="py-3.5 px-4 font-semibold">Valor Total</th>
                  <th className="py-3.5 px-4 font-semibold text-center">Status</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Ações Rápidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {notasFiltradas.map((nota) => {
                  const filialNome = nota.filial?.nome || nota.filial?.razao_social || 'Matriz / Loja Principal';
                  const filialCidadeUf = nota.filial?.cidade 
                    ? `${nota.filial.cidade}/${nota.filial.estado || nota.filial.uf || 'PA'}`
                    : 'Pará - BR';
                  const logoSrc = getFilialLogo(filialNome, nota.filial?.logo_url);
                  const numFormatado = String(nota.numero_nfe || '000000000').padStart(9, '0');
                  const serieFormatada = `Série ${nota.serie || 1}`;
                  const isAutorizada = String(nota.status || '').toUpperCase() === 'AUTORIZADA' || String(nota.status || '').toUpperCase() === 'EMITIDA';

                  return (
                    <tr 
                      key={nota.id} 
                      className="hover:bg-zinc-800/40 transition-colors group"
                    >
                      {/* Coluna 1: Filial */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={logoSrc}
                            alt={filialNome}
                            className="w-8 h-8 rounded object-contain bg-zinc-800 p-0.5 border border-zinc-700 shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/logos/default-store.png';
                            }}
                          />
                          <div className="min-w-0">
                            <p className="font-semibold text-white truncate max-w-[180px]">{filialNome}</p>
                            <p className="text-[10px] text-zinc-400">{filialCidadeUf}</p>
                          </div>
                        </div>
                      </td>

                      {/* Coluna 2: NF-e / Série */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-mono font-bold text-white text-[13px]">
                          {numFormatado.replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3')}
                        </div>
                        <div className="text-[10px] text-zinc-400 font-medium">
                          {serieFormatada}
                        </div>
                      </td>

                      {/* Coluna 3: Data / Hora */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-zinc-300">
                        {formatarDataHora(nota.created_at)}
                      </td>

                      {/* Coluna 4: Destinatário */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white truncate max-w-[200px]">
                          {nota.cliente_nome || 'Consumidor Final'}
                        </div>
                        <div className="text-[10px] font-mono text-zinc-400">
                          {formatarDocumento(nota.cliente_documento)}
                        </div>
                      </td>

                      {/* Coluna 5: Valor Total */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-bold text-emerald-400 text-sm">
                        {formatarMoeda(nota.valor_total)}
                      </td>

                      {/* Coluna 6: Status */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {isAutorizada ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-950/70 text-emerald-400 border border-emerald-500/40">
                            <CheckCircle2 size={12} /> AUTORIZADA
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-red-950/70 text-red-400 border border-red-500/40">
                            <XCircle size={12} /> {String(nota.status || 'CANCELADA').toUpperCase()}
                          </span>
                        )}
                      </td>

                      {/* Coluna 7: Ações Rápidas */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* 1. Ver DANFE */}
                          <button
                            onClick={() => handleVerDanfe(nota)}
                            title="Visualizar / Imprimir DANFE"
                            className="p-1.5 bg-zinc-800 hover:bg-[#6A0DAD] text-zinc-300 hover:text-white rounded-lg transition-all border border-zinc-700 hover:border-purple-500/50 cursor-pointer flex items-center gap-1 text-[11px] font-medium px-2"
                          >
                            <FileText size={13} className="text-purple-400 group-hover:text-white" />
                            <span>DANFE</span>
                          </button>

                          {/* 2. Baixar XML */}
                          <button
                            onClick={() => handleDownloadXml(nota)}
                            title="Baixar arquivo XML oficial"
                            className="p-1.5 bg-zinc-800 hover:bg-emerald-700 text-zinc-300 hover:text-white rounded-lg transition-all border border-zinc-700 hover:border-emerald-500/50 cursor-pointer flex items-center gap-1 text-[11px] font-medium px-2"
                          >
                            <Download size={13} className="text-emerald-400 group-hover:text-white" />
                            <span>XML</span>
                          </button>

                          {/* 3. Copiar Chave */}
                          <button
                            onClick={() => handleCopiarChave(nota.chave_acesso)}
                            title={nota.chave_acesso ? `Copiar Chave: ${nota.chave_acesso}` : 'Chave não disponível'}
                            className={`p-1.5 rounded-lg transition-all border text-[11px] font-medium px-2 flex items-center gap-1 cursor-pointer ${
                              copiedKey === nota.chave_acesso
                                ? 'bg-emerald-950 text-emerald-400 border-emerald-500/50'
                                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border-zinc-700'
                            }`}
                          >
                            {copiedKey === nota.chave_acesso ? (
                              <>
                                <Check size={13} className="text-emerald-400" />
                                <span>Copiada!</span>
                              </>
                            ) : (
                              <>
                                <Copy size={13} className="text-zinc-400" />
                                <span>Chave</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. MODAL DE PRÉ-VISUALIZAÇÃO DO DANFE */}
      {modalDanfe?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-4xl h-[90vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-950/60 border border-purple-800/40 rounded-lg text-purple-400">
                  <FileText size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    DANFE - Documento Auxiliar da NF-e
                    <span className="text-xs font-mono text-zinc-400">Nº {modalDanfe.numero}</span>
                  </h3>
                  <p className="text-[11px] font-mono text-zinc-500 truncate max-w-md">
                    {modalDanfe.chave}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={modalDanfe.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold rounded-lg text-white flex items-center gap-1.5 transition-all"
                >
                  <ExternalLink size={13} /> Abrir em Nova Aba
                </a>
                <button
                  onClick={() => setModalDanfe(null)}
                  className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-lg transition-all"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body / Iframe */}
            <div className="flex-1 bg-zinc-950 relative">
              <iframe
                src={modalDanfe.pdfUrl}
                title="Visualizador DANFE"
                className="w-full h-full border-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotasFiscaisView;

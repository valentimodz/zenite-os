import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import {
  Upload, FileText, CheckCircle2, AlertTriangle, XCircle, Loader2,
  Download, RefreshCw, Users, ShieldAlert, Award, Eye
} from 'lucide-react';

/**
 * Componente: ImportadorVendasCSV
 * 
 * Permite a importação gerencial de vendas retroativas baseada puramente em VOLUME/QUANTIDADES.
 * Aciona o motor nativo de comissões e contabiliza para rankings sem afetar o estoque físico.
 * 
 * 🔴 REGRA DE NEGÓCIO CRÍTICA DO TRAINEE (NATIVA):
 * - Trainee divide comissão APENAS sobre celulares (iPhones e Androids).
 * - Trainee NÃO recebe comissão sobre Acessórios (100% da comissão vai para o Vendedor).
 * 
 * 🔴 TRAVA DE ESTOQUE ABSOLUTA:
 * Esta ferramenta NÃO faz UPDATE na tabela 'produtos' (quantidade) nem INSERT em 'movimentacoes_estoque'.
 */
export default function ImportadorVendasCSV({ empresaId, profile, onImportSuccess }) {
  const [file, setFile] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [validationErrors, setValidationErrors] = useState([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState(null);
  const [vendedoresList, setVendedoresList] = useState([]);
  const [showVendedoresGuide, setShowVendedoresGuide] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Regras de Comissionamento Nativas do Sistema (Baseadas no Volume)
  const TAXA_NATIVA_IPHONE = 30.00;   // R$ 30 por iPhone (fixo nativo)
  const TAXA_NATIVA_ANDROID = 20.00;  // R$ 20 por Android (taxa nativa volume)
  const TAXA_NATIVA_ACESSORIO = 5.00; // R$ 5 por Acessório (taxa nativa volume)
  const FATOR_DIVISAO_TRAINEE = 0.50; // 50% Vendedor / 50% Trainee em Celulares

  const activeEmpresaId = empresaId || profile?.empresa_id || null;

  // Carregar lista de colaboradores para auxílio de UUIDs
  useEffect(() => {
    async function loadVendedores() {
      try {
        let q = supabase.from('profiles').select('id, nome, email, role');
        if (activeEmpresaId && activeEmpresaId !== 'MASTER') {
          q = q.eq('empresa_id', activeEmpresaId);
        }
        const { data, error } = await q;
        if (!error && data) {
          setVendedoresList(data);
        }
      } catch (err) {
        console.warn('Erro ao carregar lista de vendedores:', err);
      }
    }
    loadVendedores();
  }, [activeEmpresaId]);

  // Download do modelo CSV oficial
  const handleDownloadTemplate = () => {
    const header = 'data_venda,vendedor_id,trainee_id,qtd_iphones,qtd_androids,qtd_acessorios\n';
    const exampleSellerId = vendedoresList.length > 0 ? vendedoresList[0].id : '00000000-0000-0000-0000-000000000000';
    const exampleTraineeId = vendedoresList.length > 1 ? vendedoresList[1].id : '';

    const sampleRows = [
      `2024-01-15,${exampleSellerId},${exampleTraineeId},2,1,5`,
      `2024-01-16,${exampleSellerId},,1,0,3`,
      `2024-01-17,${exampleSellerId},${exampleTraineeId},0,2,10`
    ].join('\n');

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(header + sampleRows);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', csvContent);
    downloadAnchor.setAttribute('download', 'modelo_importacao_quantidades.csv');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Parser do arquivo CSV
  const parseCSV = (text) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) return { rows: [], errors: ['O arquivo CSV está vazio.'] };

    const firstLine = lines[0];
    const separator = firstLine.includes(';') && (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length ? ';' : ',';

    const cleanCell = (val) => {
      if (!val) return '';
      let str = val.trim();
      if (str.startsWith('"') && str.endsWith('"')) {
        str = str.slice(1, -1).trim();
      }
      return str;
    };

    const headerParts = lines[0].split(separator).map(h => cleanCell(h).toLowerCase().replace(/\s+/g, '_'));

    const colIndex = {
      data_venda: headerParts.findIndex(h => h.includes('data_venda') || h.includes('data') || h.includes('dt_venda')),
      vendedor_id: headerParts.findIndex(h => h.includes('vendedor_id') || h.includes('vendedor') || h.includes('usuario_id')),
      trainee_id: headerParts.findIndex(h => h.includes('trainee_id') || h.includes('trainee') || h.includes('treener_id')),
      qtd_iphones: headerParts.findIndex(h => h.includes('qtd_iphones') || h.includes('iphones') || h.includes('iphone')),
      qtd_androids: headerParts.findIndex(h => h.includes('qtd_androids') || h.includes('androids') || h.includes('android')),
      qtd_acessorios: headerParts.findIndex(h => h.includes('qtd_acessorios') || h.includes('acessorios') || h.includes('acessorio'))
    };

    if (colIndex.data_venda === -1 || colIndex.vendedor_id === -1 || colIndex.qtd_iphones === -1 || colIndex.qtd_androids === -1 || colIndex.qtd_acessorios === -1) {
      return {
        rows: [],
        errors: [
          `Cabeçalho inválido. O arquivo deve conter exatamente: data_venda, vendedor_id, trainee_id, qtd_iphones, qtd_androids, qtd_acessorios.`,
          `Cabeçalhos detectados: [${headerParts.join(', ')}]`
        ]
      };
    }

    const rows = [];
    const errors = [];

    const parseInteger = (val) => {
      if (!val) return 0;
      const num = parseInt(String(val).trim(), 10);
      return isNaN(num) ? 0 : Math.max(0, num);
    };

    const parseDate = (val) => {
      if (!val) return null;
      const str = String(val).trim();
      if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) {
        const parts = str.split('/');
        const day = parts[0];
        const month = parts[1];
        const year = parts[2].slice(0, 4);
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T12:00:00Z`;
      }
      if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        if (str.length === 10) return `${str}T12:00:00Z`;
        return new Date(str).toISOString();
      }
      const parsed = new Date(str);
      return isNaN(parsed.getTime()) ? null : parsed.toISOString();
    };

    for (let i = 1; i < lines.length; i++) {
      const lineStr = lines[i].trim();
      if (!lineStr) continue;

      const cells = lineStr.split(separator).map(cleanCell);
      const rawData = cells[colIndex.data_venda];
      const rawVendedor = cells[colIndex.vendedor_id];
      const rawTrainee = colIndex.trainee_id !== -1 ? cells[colIndex.trainee_id] : '';
      const rawIphones = cells[colIndex.qtd_iphones];
      const rawAndroids = cells[colIndex.qtd_androids];
      const rawAcessorios = cells[colIndex.qtd_acessorios];

      const dataVenda = parseDate(rawData);
      const vendedorId = rawVendedor ? rawVendedor.trim() : '';
      const traineeId = rawTrainee && rawTrainee.trim() !== '0' && rawTrainee.trim().toLowerCase() !== 'none' && rawTrainee.trim().toLowerCase() !== 'null' ? rawTrainee.trim() : null;

      const qtdIphones = parseInteger(rawIphones);
      const qtdAndroids = parseInteger(rawAndroids);
      const qtdAcessorios = parseInteger(rawAcessorios);
      const totalQtd = qtdIphones + qtdAndroids + qtdAcessorios;

      const lineNum = i + 1;
      let lineValid = true;
      const lineErrors = [];

      if (!dataVenda) {
        lineErrors.push(`Linha ${lineNum}: Data inválida "${rawData}". Formatos aceitos: AAAA-MM-DD ou DD/MM/AAAA.`);
        lineValid = false;
      }

      if (!vendedorId) {
        lineErrors.push(`Linha ${lineNum}: vendedor_id é obrigatório.`);
        lineValid = false;
      }

      if (totalQtd <= 0) {
        lineErrors.push(`Linha ${lineNum}: Quantidade total de itens deve ser > 0.`);
        lineValid = false;
      }

      if (lineErrors.length > 0) {
        errors.push(...lineErrors);
      }

      rows.push({
        lineNum,
        raw: lineStr,
        data_venda: dataVenda || rawData,
        vendedor_id: vendedorId,
        trainee_id: traineeId,
        hasTrainee: Boolean(traineeId),
        qtd_iphones: qtdIphones,
        qtd_androids: qtdAndroids,
        qtd_acessorios: qtdAcessorios,
        total_qtd: totalQtd,
        isValid: lineValid,
        errors: lineErrors
      });
    }

    return { rows, errors };
  };

  const handleFileChange = (selectedFile) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setIsParsing(true);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const { rows, errors } = parseCSV(text);
      setParsedRows(rows);
      setValidationErrors(errors);
      setIsParsing(false);
    };
    reader.onerror = () => {
      setValidationErrors(['Erro ao ler o arquivo selecionado.']);
      setIsParsing(false);
    };
    reader.readAsText(selectedFile);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // Helper de inserção segura em 'vendas'
  const insertVendaSegura = async (payload) => {
    try {
      const { data, error } = await supabase
        .from('vendas')
        .insert(payload)
        .select('id')
        .single();

      if (!error && data?.id) return { id: data.id, error: null };

      if (error && error.message) {
        const cleanPayload = { ...payload };
        if (error.message.includes('criado_at')) delete cleanPayload.criado_at;
        if (error.message.includes('trainee_id')) delete cleanPayload.trainee_id;
        if (error.message.includes('comissao_trainee')) delete cleanPayload.comissao_trainee;
        if (error.message.includes('teve_participacao_trainee')) delete cleanPayload.teve_participacao_trainee;

        const retry = await supabase
          .from('vendas')
          .insert(cleanPayload)
          .select('id')
          .single();
        return { id: retry.data?.id, error: retry.error };
      }

      return { id: data?.id, error };
    } catch (err) {
      return { id: null, error: err };
    }
  };

  // Helper de inserção segura em 'itens_venda'
  const insertItensVendaSegura = async (itens) => {
    if (!itens || itens.length === 0) return { error: null };
    try {
      const { data, error } = await supabase
        .from('itens_venda')
        .insert(itens);

      if (!error) return { error: null };

      if (error && error.message) {
        const itensSanitizados = itens.map(item => {
          const clean = { ...item };
          if (error.message.includes('subtotal')) delete clean.subtotal;
          if (error.message.includes('trainee_id')) delete clean.trainee_id;
          if (error.message.includes('comissao_trainee')) delete clean.comissao_trainee;
          return clean;
        });
        const retry = await supabase
          .from('itens_venda')
          .insert(itensSanitizados);
        return { error: retry.error };
      }

      return { error };
    } catch (err) {
      return { error: err };
    }
  };

  // Processamento da Importação
  const handleImport = async () => {
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      alert('Não há registros válidos para importar.');
      return;
    }

    if (!activeEmpresaId) {
      alert('ID da empresa não identificado.');
      return;
    }

    setIsImporting(true);
    setImportProgress(0);

    let successCount = 0;
    let errorCount = 0;
    let totalIphonesImportados = 0;
    let totalAndroidsImportados = 0;
    let totalAcessoriosImportados = 0;
    let totalComissaoVendedores = 0;
    let totalComissaoTrainees = 0;
    const processErrors = [];

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];

      try {
        const hasTrainee = row.hasTrainee;

        // CÁLCULOS NATIVOS BASEADOS NO VOLUME DE QUANTIDADES:
        // 1. iPhones (Dividido com Trainee se houver)
        const totalCommIphone = row.qtd_iphones * TAXA_NATIVA_IPHONE;
        const vendCommIphone = hasTrainee ? (totalCommIphone * (1 - FATOR_DIVISAO_TRAINEE)) : totalCommIphone;
        const traineeCommIphone = hasTrainee ? (totalCommIphone * FATOR_DIVISAO_TRAINEE) : 0;

        // 2. Androids (Dividido com Trainee se houver)
        const totalCommAndroid = row.qtd_androids * TAXA_NATIVA_ANDROID;
        const vendCommAndroid = hasTrainee ? (totalCommAndroid * (1 - FATOR_DIVISAO_TRAINEE)) : totalCommAndroid;
        const traineeCommAndroid = hasTrainee ? (totalCommAndroid * FATOR_DIVISAO_TRAINEE) : 0;

        // 3. Acessórios (REGRA CRÍTICA: Trainee NÃO RECEBE COMISSÃO DE ACESSÓRIOS - 100% para o Vendedor)
        const totalCommAcessorio = row.qtd_acessorios * TAXA_NATIVA_ACESSORIO;
        const vendCommAcessorio = totalCommAcessorio; // 100% Vendedor
        const traineeCommAcessorio = 0; // ZERO para Trainee

        const comissaoTotalVendedor = vendCommIphone + vendCommAndroid + vendCommAcessorio;
        const comissaoTotalTrainee = traineeCommIphone + traineeCommAndroid + traineeCommAcessorio;

        // Criar registro de Venda (valor_total: 0 pois o foco é volume e comissão)
        const payloadVenda = {
          empresa_id: activeEmpresaId,
          usuario_id: row.vendedor_id,
          vendedor_id: row.vendedor_id,
          valor_total: 0,
          status: 'CONCLUIDO',
          observacoes: 'IMPORTAÇÃO RETROATIVA - FOCO EM COMISSÃO/QTD',
          criado_at: row.data_venda,
          created_at: row.data_venda,
          status_pagamento: 'PAGO',
          valor_pago: 0,
          quantidade: row.total_qtd,
          comissao: comissaoTotalVendedor,
          teve_participacao_trainee: hasTrainee,
          comissao_trainee: comissaoTotalTrainee,
          trainee_id: hasTrainee ? row.trainee_id : null
        };

        const { id: generatedVendaId, error: vendaErr } = await insertVendaSegura(payloadVenda);

        if (vendaErr || !generatedVendaId) {
          throw new Error(vendaErr?.message || 'Falha ao gravar venda.');
        }

        // Criar registros em 'itens_venda'
        const itensParaInserir = [];

        // Item iPhone
        if (row.qtd_iphones > 0) {
          itensParaInserir.push({
            venda_id: generatedVendaId,
            empresa_id: activeEmpresaId,
            vendedor_id: row.vendedor_id,
            usuario_id: row.vendedor_id,
            trainee_id: hasTrainee ? row.trainee_id : null,
            categoria: 'IOS',
            produto_nome: 'iPhone (Importação Retroativa)',
            quantidade: row.qtd_iphones,
            preco_unitario: 0,
            preco_base: 0,
            valor_total: 0,
            comissao: vendCommIphone,
            comissao_trainee: traineeCommIphone,
            created_at: row.data_venda
          });
        }

        // Item Android
        if (row.qtd_androids > 0) {
          itensParaInserir.push({
            venda_id: generatedVendaId,
            empresa_id: activeEmpresaId,
            vendedor_id: row.vendedor_id,
            usuario_id: row.vendedor_id,
            trainee_id: hasTrainee ? row.trainee_id : null,
            categoria: 'ANDROID',
            produto_nome: 'Android (Importação Retroativa)',
            quantidade: row.qtd_androids,
            preco_unitario: 0,
            preco_base: 0,
            valor_total: 0,
            comissao: vendCommAndroid,
            comissao_trainee: traineeCommAndroid,
            created_at: row.data_venda
          });
        }

        // Item Acessório (REGRA CRÍTICA: FORÇAR trainee_id como NULL e comissao_trainee: 0)
        if (row.qtd_acessorios > 0) {
          itensParaInserir.push({
            venda_id: generatedVendaId,
            empresa_id: activeEmpresaId,
            vendedor_id: row.vendedor_id,
            usuario_id: row.vendedor_id,
            trainee_id: null, // FORCE NULL PARA ACESSÓRIOS
            categoria: 'ACESSORIO',
            produto_nome: 'Acessório (Importação Retroativa)',
            quantidade: row.qtd_acessorios,
            preco_unitario: 0,
            preco_base: 0,
            valor_total: 0,
            comissao: vendCommAcessorio,
            comissao_trainee: 0, // ZERO PARA TRAINEE EM ACESSÓRIOS
            created_at: row.data_venda
          });
        }

        if (itensParaInserir.length > 0) {
          const { error: itensErr } = await insertItensVendaSegura(itensParaInserir);
          if (itensErr) {
            console.warn(`[ImportadorCSV] Aviso nos itens da venda ${generatedVendaId}:`, itensErr);
          }
        }

        successCount++;
        totalIphonesImportados += row.qtd_iphones;
        totalAndroidsImportados += row.qtd_androids;
        totalAcessoriosImportados += row.qtd_acessorios;
        totalComissaoVendedores += comissaoTotalVendedor;
        totalComissaoTrainees += comissaoTotalTrainee;
      } catch (errRow) {
        errorCount++;
        processErrors.push(`Linha ${row.lineNum}: ${errRow.message || errRow}`);
      }

      setImportProgress(Math.round(((i + 1) / validRows.length) * 100));
    }

    setIsImporting(false);
    setImportResult({
      totalProcessado: validRows.length,
      sucesso: successCount,
      erros: errorCount,
      totalIphones: totalIphonesImportados,
      totalAndroids: totalAndroidsImportados,
      totalAcessorios: totalAcessoriosImportados,
      totalComissaoVendedores,
      totalComissaoTrainees,
      detalhesErros: processErrors
    });

    if (onImportSuccess && successCount > 0) {
      onImportSuccess({ successCount, totalComissaoVendedores });
    }
  };

  const handleReset = () => {
    setFile(null);
    setParsedRows([]);
    setValidationErrors([]);
    setImportResult(null);
    setImportProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const sumIphones = parsedRows.filter(r => r.isValid).reduce((acc, curr) => acc + curr.qtd_iphones, 0);
  const sumAndroids = parsedRows.filter(r => r.isValid).reduce((acc, curr) => acc + curr.qtd_androids, 0);
  const sumAcessorios = parsedRows.filter(r => r.isValid).reduce((acc, curr) => acc + curr.qtd_acessorios, 0);
  const validCount = parsedRows.filter(r => r.isValid).length;
  const invalidCount = parsedRows.filter(r => !r.isValid).length;

  return (
    <div className="space-y-6 font-sans">
      {/* Alerta de Segurança e Regra do Trainee */}
      <div className="p-4 bg-purple-950/20 border border-purple-800/30 rounded-xl flex items-start gap-3 text-xs">
        <ShieldAlert size={20} className="text-purple-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-purple-200">
            Importação Retroativa Focada em Quantidade (Volume & Comissões)
          </p>
          <p className="text-gray-400 leading-relaxed">
            As quantidades importadas alimentarão os rankings de vendas e acionarão os cálculos nativos de comissão. <strong className="text-purple-300">O estoque físico não sofre nenhuma alteração (trava de estoque ativa)</strong>.
          </p>
          <div className="p-2 bg-black/60 rounded border border-purple-900/40 text-[11px] text-purple-300 font-mono mt-1">
            ⚡ <strong>Regra Nativa do Trainee:</strong> Trainee divide comissão APENAS em Celulares (iPhones e Androids). Em Acessórios, 100% da comissão vai para o Vendedor Principal.
          </div>
        </div>
      </div>

      {/* Botões de Ação Rápida: Template e Guia de Vendedores */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="px-3 py-2 bg-black border border-[#333] hover:border-[#6A0DAD] text-gray-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
          >
            <Download size={14} className="text-[#6A0DAD]" />
            Baixar Modelo CSV
          </button>

          <button
            type="button"
            onClick={() => setShowVendedoresGuide(!showVendedoresGuide)}
            className="px-3 py-2 bg-black border border-[#333] hover:border-purple-600 text-gray-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
          >
            <Users size={14} className="text-purple-400" />
            {showVendedoresGuide ? 'Ocultar IDs dos Vendedores' : 'Consultar IDs dos Vendedores & Trainees'}
          </button>
        </div>

        {file && (
          <button
            type="button"
            onClick={handleReset}
            disabled={isImporting}
            className="px-3 py-1.5 bg-gray-900/80 hover:bg-gray-800 text-gray-400 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1 transition-all cursor-pointer"
          >
            <RefreshCw size={12} />
            Trocar Arquivo
          </button>
        )}
      </div>

      {/* Guia de IDs dos Vendedores/Trainees */}
      {showVendedoresGuide && (
        <div className="p-4 bg-[#0F0F0F] border border-[#2A2A2A] rounded-xl space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Users size={14} className="text-[#6A0DAD]" />
              Colaboradores Cadastrados (Copie o UUID para a planilha)
            </h4>
            <span className="text-[10px] text-gray-500 font-mono">
              {vendedoresList.length} cadastrados
            </span>
          </div>

          {vendedoresList.length === 0 ? (
            <p className="text-xs text-gray-500 italic">Nenhum colaborador encontrado na empresa.</p>
          ) : (
            <div className="max-h-48 overflow-y-auto border border-[#222] rounded-lg divide-y divide-[#222]">
              {vendedoresList.map((colab) => (
                <div
                  key={colab.id}
                  className="p-2 flex items-center justify-between hover:bg-[#1A1A1A] text-xs transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{colab.nome}</span>
                    <span className="text-[10px] text-purple-400 bg-purple-950/40 px-1.5 py-0.5 rounded font-mono">
                      {colab.role || 'VENDEDOR'}
                    </span>
                    {colab.email && <span className="text-[11px] text-gray-500">({colab.email})</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-[11px] text-gray-400 font-mono bg-black px-2 py-0.5 rounded border border-[#333]">
                      {colab.id}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(colab.id);
                        alert(`ID de ${colab.nome} copiado!`);
                      }}
                      className="text-[10px] text-purple-300 hover:text-white bg-[#6A0DAD]/30 hover:bg-[#6A0DAD] px-2 py-0.5 rounded transition-all cursor-pointer"
                    >
                      Copiar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dropzone de Upload (Limpeza Radical da Interface) */}
      {!file && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-3 ${
            isDragging
              ? 'border-[#6A0DAD] bg-[#6A0DAD]/10 scale-[0.99]'
              : 'border-[#333] hover:border-[#6A0DAD]/60 bg-black/40 hover:bg-[#0D0D0D]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileChange(e.target.files[0]);
              }
            }}
          />

          <div className="w-14 h-14 rounded-2xl bg-[#6A0DAD]/10 border border-[#6A0DAD]/30 flex items-center justify-center text-[#6A0DAD] shadow-inner">
            <Upload size={26} />
          </div>

          <div>
            <h4 className="text-sm font-bold text-white">
              Arraste seu arquivo .CSV aqui ou clique para selecionar
            </h4>
            <p className="text-xs text-gray-500 mt-1">
              Estrutura esperada: <span className="font-mono text-purple-300">data_venda, vendedor_id, trainee_id, qtd_iphones, qtd_androids, qtd_acessorios</span>
            </p>
          </div>

          <div className="inline-flex items-center gap-1.5 text-[11px] text-gray-400 bg-[#161616] px-3 py-1.5 rounded-full border border-[#2a2a2a] mt-1">
            <FileText size={12} className="text-purple-400" />
            Suporta delimitadores com vírgula ( , ) ou ponto e vírgula ( ; )
          </div>
        </div>
      )}

      {/* Carregando Parsing */}
      {isParsing && (
        <div className="p-8 border border-[#222] rounded-2xl bg-black flex flex-col items-center justify-center gap-3 text-white">
          <Loader2 size={28} className="animate-spin text-[#6A0DAD]" />
          <p className="text-xs text-gray-400 font-medium">Validando arquivo CSV...</p>
        </div>
      )}

      {/* Resultados da Validação & Pré-visualização */}
      {!isParsing && file && parsedRows.length > 0 && !importResult && (
        <div className="space-y-6 animate-fadeIn">
          {/* Cartões de Quantidades Totais */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-black border border-[#222] p-4 rounded-xl">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Linhas Válidas</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl font-extrabold text-emerald-400 font-mono">{validCount}</span>
                <span className="text-xs text-gray-500 font-mono">/ {parsedRows.length}</span>
              </div>
            </div>

            <div className="bg-black border border-[#222] p-4 rounded-xl">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">iPhones</span>
              <span className="text-xl font-extrabold text-blue-400 font-mono block mt-1">
                {sumIphones} un
              </span>
            </div>

            <div className="bg-black border border-[#222] p-4 rounded-xl">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Androids</span>
              <span className="text-xl font-extrabold text-green-400 font-mono block mt-1">
                {sumAndroids} un
              </span>
            </div>

            <div className="bg-black border border-[#222] p-4 rounded-xl">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Acessórios</span>
              <span className="text-xl font-extrabold text-pink-400 font-mono block mt-1">
                {sumAcessorios} un
              </span>
            </div>
          </div>

          {/* Erros de Validação */}
          {validationErrors.length > 0 && (
            <div className="p-4 bg-amber-950/20 border border-amber-800/40 rounded-xl space-y-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-amber-300">
                <AlertTriangle size={16} className="shrink-0" />
                <span>{invalidCount} linha(s) contêm erros e serão ignoradas:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-gray-300 max-h-32 overflow-y-auto font-mono text-[11px]">
                {validationErrors.slice(0, 10).map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Tabela de Pré-visualização */}
          <div className="bg-black border border-[#222] rounded-xl overflow-hidden shadow-md">
            <div className="p-3 bg-[#0E0E0E] border-b border-[#222] flex items-center justify-between">
              <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                <Eye size={14} className="text-[#6A0DAD]" />
                Pré-visualização dos Registros ({parsedRows.length} linhas)
              </span>
              <span className="text-[11px] text-gray-500 font-mono">
                {file.name}
              </span>
            </div>

            <div className="max-h-64 overflow-y-auto overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse font-sans">
                <thead>
                  <tr className="border-b border-[#222] bg-[#0A0A0A] text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Linha</th>
                    <th className="py-2.5 px-3">Data</th>
                    <th className="py-2.5 px-3">Vendedor Principal</th>
                    <th className="py-2.5 px-3">Trainee</th>
                    <th className="py-2.5 px-3 text-center">iPhones</th>
                    <th className="py-2.5 px-3 text-center">Androids</th>
                    <th className="py-2.5 px-3 text-center">Acessórios</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A1A1A]">
                  {parsedRows.slice(0, 50).map((row, idx) => {
                    const sellerObj = vendedoresList.find(v => v.id === row.vendedor_id);
                    const traineeObj = vendedoresList.find(v => v.id === row.trainee_id);
                    return (
                      <tr key={idx} className={row.isValid ? 'hover:bg-white/5' : 'bg-red-950/10 hover:bg-red-950/20'}>
                        <td className="py-2 px-3">
                          {row.isValid ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/30 px-1.5 py-0.5 rounded font-semibold">
                              <CheckCircle2 size={10} /> OK
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] text-red-400 bg-red-950/30 px-1.5 py-0.5 rounded font-semibold">
                              <XCircle size={10} /> Erro
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-mono text-gray-500 text-[11px]">{row.lineNum}</td>
                        <td className="py-2 px-3 font-mono text-gray-300">
                          {row.data_venda ? new Date(row.data_venda).toLocaleDateString('pt-BR') : '-'}
                        </td>
                        <td className="py-2 px-3 font-mono text-gray-300 text-[11px]">
                          {sellerObj ? sellerObj.nome : <span className="truncate max-w-[100px] inline-block">{row.vendedor_id}</span>}
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px]">
                          {traineeObj ? (
                            <span className="text-purple-300 font-semibold">{traineeObj.nome}</span>
                          ) : row.trainee_id ? (
                            <span className="text-purple-300 truncate max-w-[100px] inline-block">{row.trainee_id}</span>
                          ) : (
                            <span className="text-gray-600 font-sans italic">Sem trainee</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center font-mono text-blue-400 font-bold">{row.qtd_iphones}</td>
                        <td className="py-2 px-3 text-center font-mono text-green-400 font-bold">{row.qtd_androids}</td>
                        <td className="py-2 px-3 text-center font-mono text-pink-400 font-bold">{row.qtd_acessorios}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Barra de Progresso */}
          {isImporting && (
            <div className="space-y-2 p-4 bg-black border border-[#6A0DAD]/40 rounded-xl">
              <div className="flex justify-between text-xs text-gray-300 font-bold">
                <span className="flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-[#6A0DAD]" />
                  Processando comissões nativas e gerando histórico de vendas...
                </span>
                <span className="font-mono text-purple-400">{importProgress}%</span>
              </div>
              <div className="w-full bg-gray-900 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-[#6A0DAD] to-purple-400 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${importProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleReset}
              disabled={isImporting}
              className="px-4 py-2.5 bg-black border border-[#333] hover:border-gray-500 text-gray-400 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleImport}
              disabled={isImporting || validCount === 0}
              className="px-6 py-2.5 bg-[#6A0DAD] hover:bg-[#500885] disabled:bg-gray-800 disabled:text-gray-500 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-[#6A0DAD]/30 flex items-center gap-2 cursor-pointer"
            >
              {isImporting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {isImporting ? `Importando (${importProgress}%)...` : `Confirmar Importação de ${validCount} Linhas`}
            </button>
          </div>
        </div>
      )}

      {/* Relatório Final de Conclusão */}
      {importResult && (
        <div className="p-6 bg-[#0B0B0B] border border-emerald-800/40 rounded-2xl space-y-6 animate-fadeIn">
          <div className="flex items-center gap-3 border-b border-[#222] pb-4">
            <div className="w-10 h-10 rounded-full bg-emerald-950/60 border border-emerald-700/60 flex items-center justify-center text-emerald-400">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <h4 className="text-base font-bold text-white">Importação Retroativa Concluída!</h4>
              <p className="text-xs text-gray-400 mt-0.5">
                Os volumes de vendas e as comissões nativas foram gravadas com sucesso.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-black border border-[#222] p-3 rounded-lg">
              <span className="text-[10px] text-gray-500 uppercase font-bold block">Vendas Registradas</span>
              <span className="text-lg font-bold text-emerald-400 font-mono block mt-1">
                {importResult.sucesso}
              </span>
            </div>

            <div className="bg-black border border-[#222] p-3 rounded-lg">
              <span className="text-[10px] text-gray-500 uppercase font-bold block">Celulares Vendidos</span>
              <span className="text-base font-bold text-blue-400 font-mono block mt-1">
                {importResult.totalIphones + importResult.totalAndroids} un
              </span>
            </div>

            <div className="bg-black border border-[#222] p-3 rounded-lg">
              <span className="text-[10px] text-gray-500 uppercase font-bold block">Acessórios Vendidos</span>
              <span className="text-base font-bold text-pink-400 font-mono block mt-1">
                {importResult.totalAcessorios} un
              </span>
            </div>

            <div className="bg-black border border-[#222] p-3 rounded-lg">
              <span className="text-[10px] text-gray-500 uppercase font-bold block">Comissões Vendedores</span>
              <span className="text-base font-bold text-emerald-400 font-mono block mt-1">
                {importResult.totalComissaoVendedores.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
          </div>

          {importResult.totalComissaoTrainees > 0 && (
            <div className="p-3 bg-purple-950/30 border border-purple-800/40 rounded-lg text-xs font-mono text-purple-200">
              💜 <strong>Comissões Geradas para Trainees (Celulares):</strong> {importResult.totalComissaoTrainees.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-5 py-2.5 bg-[#6A0DAD] hover:bg-[#500885] text-white rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-2"
            >
              <RefreshCw size={14} /> Importar Outro Arquivo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

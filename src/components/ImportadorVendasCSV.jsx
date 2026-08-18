import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import {
  Upload, FileText, CheckCircle2, AlertTriangle, XCircle, Loader2,
  Download, RefreshCw, Users, ShieldAlert, DollarSign, HelpCircle, Check, Eye
} from 'lucide-react';

/**
 * Componente: ImportadorVendasCSV
 * 
 * Permite a importação gerencial de vendas retroativas puramente financeiras
 * via arquivo .csv para alimentar dashboards e comissões.
 * 
 * 🔴 RESTRIÇÃO CRÍTICA DO ESTOQUE:
 * Esta ferramenta NÃO lê, altera ou aciona as tabelas 'produtos' e 'movimentacoes_estoque'.
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

  const activeEmpresaId = empresaId || profile?.empresa_id || null;

  // Carregar lista de colaboradores/vendedores para auxiliar o preenchimento de UUIDs
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

  // Função para download de template CSV de exemplo
  const handleDownloadTemplate = () => {
    const header = 'data_venda,vendedor_id,total_celulares,total_acessorios\n';
    const exampleSellerId = vendedoresList.length > 0 ? vendedoresList[0].id : '00000000-0000-0000-0000-000000000000';
    const sampleRows = [
      `2024-01-15,${exampleSellerId},2500.00,350.00`,
      `2024-01-16,${exampleSellerId},1800.50,120.00`,
      `2024-01-17,${exampleSellerId},0.00,450.00`
    ].join('\n');

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(header + sampleRows);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', csvContent);
    downloadAnchor.setAttribute('download', 'modelo_importacao_vendas.csv');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Parser robusto de CSV
  const parseCSV = (text) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) return { rows: [], errors: ['O arquivo CSV está vazio.'] };

    // Identificar separador (vírgula ou ponto e vírgula)
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

    // Validar cabeçalhos esperados
    const requiredHeaders = ['data_venda', 'vendedor_id', 'total_celulares', 'total_acessorios'];
    const missingHeaders = requiredHeaders.filter(req => !headerParts.some(h => h.includes(req) || req.includes(h)));

    const colIndex = {
      data_venda: headerParts.findIndex(h => h.includes('data_venda') || h.includes('data') || h.includes('dt_venda')),
      vendedor_id: headerParts.findIndex(h => h.includes('vendedor_id') || h.includes('vendedor') || h.includes('usuario_id')),
      total_celulares: headerParts.findIndex(h => h.includes('total_celulares') || h.includes('celular') || h.includes('celulares')),
      total_acessorios: headerParts.findIndex(h => h.includes('total_acessorios') || h.includes('acessorio') || h.includes('acessorios'))
    };

    if (colIndex.data_venda === -1 || colIndex.vendedor_id === -1 || colIndex.total_celulares === -1 || colIndex.total_acessorios === -1) {
      return {
        rows: [],
        errors: [
          `Cabeçalho inválido ou incompleto. O arquivo precisa conter: data_venda, vendedor_id, total_celulares, total_acessorios.`,
          `Cabeçalhos detectados: [${headerParts.join(', ')}]`
        ]
      };
    }

    const rows = [];
    const errors = [];

    const parseNumber = (val) => {
      if (!val) return 0;
      let clean = String(val).trim().replace('R$', '').replace(/\s/g, '');
      // Tratar formato brasileiro "1.500,50" -> "1500.50"
      if (clean.includes(',') && clean.includes('.')) {
        clean = clean.replace(/\./g, '').replace(',', '.');
      } else if (clean.includes(',')) {
        clean = clean.replace(',', '.');
      }
      const num = parseFloat(clean);
      return isNaN(num) ? 0 : num;
    };

    const parseDate = (val) => {
      if (!val) return null;
      const str = String(val).trim();
      // Formato DD/MM/YYYY ou DD/MM/YYYY HH:mm
      if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) {
        const parts = str.split('/');
        const day = parts[0];
        const month = parts[1];
        const year = parts[2].slice(0, 4);
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T12:00:00Z`;
      }
      // Formato YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        if (str.length === 10) return `${str}T12:00:00Z`;
        return new Date(str).toISOString();
      }
      // Tentar parsing padrão
      const parsed = new Date(str);
      return isNaN(parsed.getTime()) ? null : parsed.toISOString();
    };

    for (let i = 1; i < lines.length; i++) {
      const lineStr = lines[i].trim();
      if (!lineStr) continue;

      const cells = lineStr.split(separator).map(cleanCell);
      const rawData = cells[colIndex.data_venda];
      const rawVendedor = cells[colIndex.vendedor_id];
      const rawCelulares = cells[colIndex.total_celulares];
      const rawAcessorios = cells[colIndex.total_acessorios];

      const dataVenda = parseDate(rawData);
      const vendedorId = rawVendedor ? rawVendedor.trim() : '';
      const totalCelulares = parseNumber(rawCelulares);
      const totalAcessorios = parseNumber(rawAcessorios);
      const valorTotal = totalCelulares + totalAcessorios;

      const lineNum = i + 1;
      let lineValid = true;
      const lineErrors = [];

      if (!dataVenda) {
        lineErrors.push(`Linha ${lineNum}: Data inválida "${rawData}". Use o formato AAAA-MM-DD ou DD/MM/AAAA.`);
        lineValid = false;
      }

      if (!vendedorId) {
        lineErrors.push(`Linha ${lineNum}: vendedor_id não informado.`);
        lineValid = false;
      }

      if (valorTotal <= 0) {
        lineErrors.push(`Linha ${lineNum}: O valor total (celulares + acessórios) deve ser maior que 0.`);
        lineValid = false;
      }

      if (totalCelulares < 0 || totalAcessorios < 0) {
        lineErrors.push(`Linha ${lineNum}: Valores não podem ser negativos.`);
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
        total_celulares: totalCelulares,
        total_acessorios: totalAcessorios,
        valor_total: valorTotal,
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
      setValidationErrors(['Falha ao ler o arquivo selecionado.']);
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

  // Helper seguro para inserção na tabela vendas
  const insertVendaSegura = async (payload) => {
    // Tenta primeiro com todas as propriedades (incluindo criado_at e created_at)
    try {
      const { data, error } = await supabase
        .from('vendas')
        .insert(payload)
        .select('id')
        .single();

      if (!error && data?.id) return { id: data.id, error: null };

      // Se falhou por motivo de coluna 'criado_at' inexistente, tenta sem criado_at
      if (error && error.message && error.message.includes('criado_at')) {
        const payloadSemCriadoAt = { ...payload };
        delete payloadSemCriadoAt.criado_at;
        const retry = await supabase
          .from('vendas')
          .insert(payloadSemCriadoAt)
          .select('id')
          .single();
        return { id: retry.data?.id, error: retry.error };
      }

      return { id: data?.id, error };
    } catch (err) {
      return { id: null, error: err };
    }
  };

  // Helper seguro para inserção na tabela itens_venda
  const insertItensVendaSegura = async (itens) => {
    if (!itens || itens.length === 0) return { error: null };
    try {
      const { data, error } = await supabase
        .from('itens_venda')
        .insert(itens);

      if (!error) return { error: null };

      // Se falhou devido a colunas extras (ex: subtotal ou categoria), sanitiza
      if (error && error.message && (error.message.includes('subtotal') || error.message.includes('categoria'))) {
        const itensSanitizados = itens.map(item => {
          const clean = { ...item };
          if (error.message.includes('subtotal')) delete clean.subtotal;
          if (error.message.includes('categoria')) delete clean.categoria;
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

  // Execução da Importação
  const handleImport = async () => {
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      alert('Não há linhas válidas para importar.');
      return;
    }

    if (!activeEmpresaId) {
      alert('ID da empresa não identificado. Certifique-se de estar conectado com uma conta com empresa vinculada.');
      return;
    }

    setIsImporting(true);
    setImportProgress(0);

    let successCount = 0;
    let errorCount = 0;
    let totalItensCriados = 0;
    let valorTotalImportado = 0;
    const processErrors = [];

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];

      try {
        // Passo A: valor_total = (total_celulares + total_acessorios)
        const valor_total = row.total_celulares + row.total_acessorios;

        // Passo B: INSERT na tabela vendas com dados da importação
        const payloadVenda = {
          empresa_id: activeEmpresaId,
          usuario_id: row.vendedor_id,
          vendedor_id: row.vendedor_id,
          valor_total: valor_total,
          status: 'CONCLUIDO',
          observacoes: 'IMPORTAÇÃO RETROATIVA VIA CSV',
          criado_at: row.data_venda,
          created_at: row.data_venda,
          status_pagamento: 'PAGO',
          valor_pago: valor_total,
          quantidade: (row.total_celulares > 0 ? 1 : 0) + (row.total_acessorios > 0 ? 1 : 0) || 1
        };

        const { id: generatedVendaId, error: vendaErr } = await insertVendaSegura(payloadVenda);

        if (vendaErr || !generatedVendaId) {
          throw new Error(vendaErr?.message || 'Falha ao registrar venda na tabela vendas.');
        }

        // Passo C: INSERT na tabela itens_venda usando o ID gerado
        const itensParaInserir = [];

        if (row.total_celulares > 0) {
          itensParaInserir.push({
            venda_id: generatedVendaId,
            empresa_id: activeEmpresaId,
            vendedor_id: row.vendedor_id,
            usuario_id: row.vendedor_id,
            categoria: 'Celulares',
            produto_nome: 'Celulares (Importação Retroativa)',
            quantidade: 1,
            preco_unitario: row.total_celulares,
            preco_unitario_vendido: row.total_celulares,
            preco_base: row.total_celulares,
            subtotal: row.total_celulares,
            valor_total: row.total_celulares,
            created_at: row.data_venda
          });
        }

        if (row.total_acessorios > 0) {
          itensParaInserir.push({
            venda_id: generatedVendaId,
            empresa_id: activeEmpresaId,
            vendedor_id: row.vendedor_id,
            usuario_id: row.vendedor_id,
            categoria: 'Acessorios',
            produto_nome: 'Acessorios (Importação Retroativa)',
            quantidade: 1,
            preco_unitario: row.total_acessorios,
            preco_unitario_vendido: row.total_acessorios,
            preco_base: row.total_acessorios,
            subtotal: row.total_acessorios,
            valor_total: row.total_acessorios,
            created_at: row.data_venda
          });
        }

        if (itensParaInserir.length > 0) {
          const { error: itensErr } = await insertItensVendaSegura(itensParaInserir);
          if (itensErr) {
            console.warn(`[ImportadorCSV] Aviso ao inserir itens da venda ${generatedVendaId}:`, itensErr);
          } else {
            totalItensCriados += itensParaInserir.length;
          }
        }

        successCount++;
        valorTotalImportado += valor_total;
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
      totalItens: totalItensCriados,
      valorTotal: valorTotalImportado,
      detalhesErros: processErrors
    });

    if (onImportSuccess && successCount > 0) {
      onImportSuccess({ successCount, valorTotalImportado });
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

  const totalGeralPrevisto = parsedRows
    .filter(r => r.isValid)
    .reduce((acc, curr) => acc + curr.valor_total, 0);

  const totalCelularesPrevisto = parsedRows
    .filter(r => r.isValid)
    .reduce((acc, curr) => acc + curr.total_celulares, 0);

  const totalAcessoriosPrevisto = parsedRows
    .filter(r => r.isValid)
    .reduce((acc, curr) => acc + curr.total_acessorios, 0);

  const validCount = parsedRows.filter(r => r.isValid).length;
  const invalidCount = parsedRows.filter(r => !r.isValid).length;

  return (
    <div className="space-y-6">
      {/* Alerta de Segurança e Escopo */}
      <div className="p-4 bg-purple-950/20 border border-purple-800/30 rounded-xl flex items-start gap-3 text-xs">
        <ShieldAlert size={20} className="text-purple-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-purple-200">
            Ambiente Financeiro Retroativo Seguro
          </p>
          <p className="text-gray-400 leading-relaxed">
            As vendas importadas por esta ferramenta alimentarão diretamente as métricas de faturamento, dashboards gerenciais e comissões dos vendedores. <strong className="text-purple-300">O estoque físico, produtos e movimentações não sofrem qualquer alteração</strong>.
          </p>
        </div>
      </div>

      {/* Botões de Ação Rápida: Template e Guia de Vendedores */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
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
            {showVendedoresGuide ? 'Ocultar IDs dos Vendedores' : 'Consultar IDs dos Vendedores'}
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

      {/* Guia de IDs dos Vendedores (para facilitar preenchimento do CSV) */}
      {showVendedoresGuide && (
        <div className="p-4 bg-[#0F0F0F] border border-[#2A2A2A] rounded-xl space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Users size={14} className="text-[#6A0DAD]" />
              Colaboradores Cadastrados (Copie o UUID para a coluna vendedor_id)
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
                        alert(`ID de ${colab.nome} copiado para a área de transferência!`);
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

      {/* Área de Upload / Dropzone */}
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
              Estrutura esperada: <span className="font-mono text-purple-300">data_venda, vendedor_id, total_celulares, total_acessorios</span>
            </p>
          </div>

          <div className="inline-flex items-center gap-1.5 text-[11px] text-gray-400 bg-[#161616] px-3 py-1.5 rounded-full border border-[#2a2a2a] mt-1">
            <FileText size={12} className="text-purple-400" />
            Suporta formatos com vírgula ( , ) ou ponto e vírgula ( ; )
          </div>
        </div>
      )}

      {/* Carregando Parsing */}
      {isParsing && (
        <div className="p-8 border border-[#222] rounded-2xl bg-black flex flex-col items-center justify-center gap-3 text-white">
          <Loader2 size={28} className="animate-spin text-[#6A0DAD]" />
          <p className="text-xs text-gray-400 font-medium">Validando estrutura e dados do CSV...</p>
        </div>
      )}

      {/* Resultados da Validação & Pré-visualização */}
      {!isParsing && file && parsedRows.length > 0 && !importResult && (
        <div className="space-y-6 animate-fadeIn">
          {/* Cartões de Métricas da Importação */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-black border border-[#222] p-4 rounded-xl">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Linhas Válidas</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl font-extrabold text-emerald-400 font-mono">{validCount}</span>
                <span className="text-xs text-gray-500 font-mono">/ {parsedRows.length}</span>
              </div>
            </div>

            <div className="bg-black border border-[#222] p-4 rounded-xl">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Total Geral</span>
              <span className="text-xl font-extrabold text-white font-mono block mt-1">
                {totalGeralPrevisto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>

            <div className="bg-black border border-[#222] p-4 rounded-xl">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Total Celulares</span>
              <span className="text-base font-bold text-purple-400 font-mono block mt-1">
                {totalCelularesPrevisto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>

            <div className="bg-black border border-[#222] p-4 rounded-xl">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Total Acessórios</span>
              <span className="text-base font-bold text-pink-400 font-mono block mt-1">
                {totalAcessoriosPrevisto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
          </div>

          {/* Avisos ou Erros de Validação */}
          {validationErrors.length > 0 && (
            <div className="p-4 bg-amber-950/20 border border-amber-800/40 rounded-xl space-y-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-amber-300">
                <AlertTriangle size={16} className="shrink-0" />
                <span>{invalidCount} linha(s) contêm erros e serão ignoradas durante a importação:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-gray-300 max-h-32 overflow-y-auto font-mono text-[11px]">
                {validationErrors.slice(0, 10).map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
                {validationErrors.length > 10 && (
                  <li className="text-amber-400">...e mais {validationErrors.length - 10} avisos.</li>
                )}
              </ul>
            </div>
          )}

          {/* Tabela de Pré-visualização */}
          <div className="bg-black border border-[#222] rounded-xl overflow-hidden shadow-md">
            <div className="p-3 bg-[#0E0E0E] border-b border-[#222] flex items-center justify-between">
              <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                <Eye size={14} className="text-[#6A0DAD]" />
                Pré-visualização dos Dados ({parsedRows.length} linhas)
              </span>
              <span className="text-[11px] text-gray-500 font-mono">
                Arquivo: {file.name}
              </span>
            </div>

            <div className="max-h-64 overflow-y-auto overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse font-sans">
                <thead>
                  <tr className="border-b border-[#222] bg-[#0A0A0A] text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Linha</th>
                    <th className="py-2.5 px-3">Data da Venda</th>
                    <th className="py-2.5 px-3">Vendedor ID</th>
                    <th className="py-2.5 px-3 text-right">Celulares</th>
                    <th className="py-2.5 px-3 text-right">Acessórios</th>
                    <th className="py-2.5 px-3 text-right">Valor Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A1A1A]">
                  {parsedRows.slice(0, 50).map((row, idx) => {
                    const sellerObj = vendedoresList.find(v => v.id === row.vendedor_id);
                    return (
                      <tr key={idx} className={row.isValid ? 'hover:bg-white/5' : 'bg-red-950/10 hover:bg-red-950/20'}>
                        <td className="py-2 px-3">
                          {row.isValid ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/30 px-1.5 py-0.5 rounded font-semibold">
                              <CheckCircle2 size={10} /> Válido
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] text-red-400 bg-red-950/30 px-1.5 py-0.5 rounded font-semibold" title={row.errors.join(', ')}>
                              <XCircle size={10} /> Erro
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-mono text-gray-500 text-[11px]">{row.lineNum}</td>
                        <td className="py-2 px-3 font-mono text-gray-300">
                          {row.data_venda ? new Date(row.data_venda).toLocaleDateString('pt-BR') : '-'}
                        </td>
                        <td className="py-2 px-3 font-mono text-gray-400 text-[11px]">
                          {sellerObj ? (
                            <span className="text-white font-semibold">{sellerObj.nome}</span>
                          ) : (
                            <span className="truncate max-w-[130px] inline-block" title={row.vendedor_id}>
                              {row.vendedor_id}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-purple-300">
                          {row.total_celulares.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-pink-300">
                          {row.total_acessorios.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-white">
                          {row.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {parsedRows.length > 50 && (
              <div className="p-2 bg-[#0A0A0A] border-t border-[#222] text-center text-[11px] text-gray-500">
                Mostrando as primeiras 50 de {parsedRows.length} linhas.
              </div>
            )}
          </div>

          {/* Barra de Progresso durante a importação */}
          {isImporting && (
            <div className="space-y-2 p-4 bg-black border border-[#6A0DAD]/40 rounded-xl">
              <div className="flex justify-between text-xs text-gray-300 font-bold">
                <span className="flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-[#6A0DAD]" />
                  Gravando vendas retroativas no Supabase...
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

          {/* Botão de Confirmação */}
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
              {isImporting ? `Importando (${importProgress}%)...` : `Confirmar Importação de ${validCount} Vendas`}
            </button>
          </div>
        </div>
      )}

      {/* Relatório de Conclusão da Importação */}
      {importResult && (
        <div className="p-6 bg-[#0B0B0B] border border-emerald-800/40 rounded-2xl space-y-6 animate-fadeIn">
          <div className="flex items-center gap-3 border-b border-[#222] pb-4">
            <div className="w-10 h-10 rounded-full bg-emerald-950/60 border border-emerald-700/60 flex items-center justify-center text-emerald-400">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <h4 className="text-base font-bold text-white">Importação Concluída com Sucesso!</h4>
              <p className="text-xs text-gray-400 mt-0.5">
                Os registros financeiros e comissões foram atualizados no sistema.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-black border border-[#222] p-3 rounded-lg">
              <span className="text-[10px] text-gray-500 uppercase font-bold block">Vendas Criadas</span>
              <span className="text-lg font-bold text-emerald-400 font-mono block mt-1">
                {importResult.sucesso}
              </span>
            </div>

            <div className="bg-black border border-[#222] p-3 rounded-lg">
              <span className="text-[10px] text-gray-500 uppercase font-bold block">Itens Registrados</span>
              <span className="text-lg font-bold text-purple-400 font-mono block mt-1">
                {importResult.totalItens}
              </span>
            </div>

            <div className="bg-black border border-[#222] p-3 rounded-lg">
              <span className="text-[10px] text-gray-500 uppercase font-bold block">Total Financeiro</span>
              <span className="text-base font-bold text-white font-mono block mt-1">
                {importResult.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>

            <div className="bg-black border border-[#222] p-3 rounded-lg">
              <span className="text-[10px] text-gray-500 uppercase font-bold block">Falhas</span>
              <span className={`text-lg font-bold font-mono block mt-1 ${importResult.erros > 0 ? 'text-red-400' : 'text-gray-500'}`}>
                {importResult.erros}
              </span>
            </div>
          </div>

          {importResult.detalhesErros.length > 0 && (
            <div className="p-3 bg-red-950/20 border border-red-800/30 rounded-lg text-xs space-y-1 font-mono">
              <span className="text-red-400 font-bold block font-sans">Erros durante a gravação:</span>
              <ul className="list-disc list-inside text-gray-300 text-[11px]">
                {importResult.detalhesErros.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
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

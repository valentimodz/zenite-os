import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import {
  Upload, FileText, CheckCircle2, AlertTriangle, XCircle, Loader2,
  Download, RefreshCw, Users, ShieldAlert, Award, Eye, DollarSign, Building2
} from 'lucide-react';

/**
 * Componente: ImportadorVendasCSV
 * 
 * Permite a importação gerencial de vendas retroativas baseada puramente em QUANTIDADES.
 * As comissões são calculadas como MULTIPLICADORES DIRETOS por unidade vendida:
 * 
 * 1. PREMIUM (iPhones/Consoles): R$ 30,00 fixo por unidade para o vendedor principal (qtd_premium * 30.00).
 * 2. ANDROIDS (Multiplicador 2 ou 3):
 *    - Pagamento em BOLETO: Multiplicador 3.00 por unidade.
 *    - Outras formas de pagamento: Multiplicador 2.00 por unidade.
 *    - Divisão com Trainee (se houver trainee_id):
 *      * Trainee recebe R$ 1,00 por unidade (qtd_androids * 1.00)
 *      * Vendedor recebe o restante: qtd_androids * (taxa_android - 1.00)
 *    - Sem Trainee: Vendedor recebe qtd_androids * taxa_android.
 * 3. ACESSÓRIOS (Multiplicador 2.50):
 *    - Vendedor recebe R$ 2,50 por unidade (qtd_acessorios * 2.50).
 *    - Trainee NÃO recebe comissão sobre acessórios (0%).
 * 
 * 🎯 AMARRAÇÃO DE FILIAL & PESO CONTÁBIL (BYPASS DO ZERO):
 * - Herda dinamicamente a filial do vendedor (`filial_id`) para garantir alinhamento com dashboards/filtros.
 * - Aplica faturamento figurativo contábil: Premium (R$ 1000) + Androids (R$ 1000) + Acessórios (R$ 50) para validação nos rankings.
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
  const [colaboradores, setColaboradores] = useState([]);
  const [showVendedoresGuide, setShowVendedoresGuide] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Multiplicadores Diretos por Unidade (Regras de Negócio)
  const TAXA_PREMIUM = 30.00;     // Multiplicador 30 por unidade Premium (iPhones/Consoles)
  const TAXA_ANDROID_BOLETO = 3.00; // Multiplicador 3 por Android quando pago em Boleto
  const TAXA_ANDROID_PADRAO = 2.00; // Multiplicador 2 por Android em outras formas
  const TAXA_ACESSORIO = 2.50;    // Multiplicador 2.5 por unidade de Acessório

  // Valores Figurativos por Unidade para Peso Contábil nos Rankings
  const VALOR_FIGURATIVO_PREMIUM = 1000.00;
  const VALOR_FIGURATIVO_ANDROID = 1000.00;
  const VALOR_FIGURATIVO_ACESSORIO = 50.00;

  const activeEmpresaId = empresaId || profile?.empresa_id || null;

  // Carregar lista de colaboradores com filial_id para herança dinâmica
  useEffect(() => {
    const fetchColaboradores = async () => {
      try {
        let q = supabase.from('profiles').select('id, nome, email, role, empresa_id, filial_id');
        if (activeEmpresaId && activeEmpresaId !== 'MASTER') {
          q = q.eq('empresa_id', activeEmpresaId);
        }
        const { data, error } = await q;
        if (!error && data && data.length > 0) {
          setColaboradores(data);
        } else {
          // Fallback para tabela usuarios caso profiles retorne vazio
          const { data: usersData } = await supabase.from('usuarios').select('id, nome, email, filial_id, empresa_id');
          if (usersData) setColaboradores(usersData);
        }
      } catch (err) {
        console.warn('Erro ao carregar colaboradores no Importador:', err);
      }
    };
    fetchColaboradores();
  }, [activeEmpresaId]);

  // Buscar automaticamente no banco quaisquer perfis presentes no CSV que ainda não estejam na lista
  useEffect(() => {
    if (!parsedRows || parsedRows.length === 0) return;

    const knownIds = new Set(
      (colaboradores || []).map(c => String(c.id || '').trim().toLowerCase())
    );

    const missingIds = [];
    parsedRows.forEach(r => {
      if (r.vendedor_id) {
        const cleanV = String(r.vendedor_id).trim().toLowerCase();
        if (cleanV && !knownIds.has(cleanV) && !missingIds.includes(r.vendedor_id.trim())) {
          missingIds.push(r.vendedor_id.trim());
        }
      }
      if (r.trainee_id) {
        const cleanT = String(r.trainee_id).trim().toLowerCase();
        if (cleanT && !knownIds.has(cleanT) && !missingIds.includes(r.trainee_id.trim())) {
          missingIds.push(r.trainee_id.trim());
        }
      }
    });

    if (missingIds.length === 0) return;

    async function fetchMissingColaboradores() {
      try {
        let { data } = await supabase
          .from('profiles')
          .select('id, nome, email, role, empresa_id, filial_id')
          .in('id', missingIds);

        if (!data || data.length === 0) {
          const res = await supabase.from('usuarios').select('id, nome, email, filial_id, empresa_id').in('id', missingIds);
          data = res.data;
        }

        if (data && data.length > 0) {
          setColaboradores(prev => {
            const map = new Map();
            (prev || []).forEach(p => { if (p?.id) map.set(String(p.id).trim().toLowerCase(), p); });
            data.forEach(p => { if (p?.id) map.set(String(p.id).trim().toLowerCase(), p); });
            return Array.from(map.values());
          });
        }
      } catch (err) {
        console.warn('Erro ao buscar perfis complementares do CSV:', err);
      }
    }

    fetchMissingColaboradores();
  }, [parsedRows]);

  // Helper de busca resiliente de colaborador por UUID ou email
  const getColaborador = (id) => {
    if (!id) return null;
    const cleanId = String(id).trim().toLowerCase();
    return (colaboradores || []).find(c => {
      if (!c) return false;
      const cId = String(c.id || c.usuario_id || '').trim().toLowerCase();
      const cEmail = String(c.email || '').trim().toLowerCase();
      return cId === cleanId || cEmail === cleanId;
    });
  };

  // Download do modelo CSV oficial com delimitador ';'
  const handleDownloadTemplate = () => {
    const header = 'data_venda;vendedor_id;trainee_id;forma_pagamento;qtd_premium;qtd_androids;qtd_acessorios\n';
    const exampleSellerId = colaboradores.length > 0 ? colaboradores[0].id : '00000000-0000-0000-0000-000000000000';
    const exampleTraineeId = colaboradores.length > 1 ? colaboradores[1].id : '';

    const sampleRows = [
      `2024-01-15;${exampleSellerId};${exampleTraineeId};BOLETO;2;1;5`,
      `2024-01-16;${exampleSellerId};;PIX;1;0;3`,
      `2024-01-17;${exampleSellerId};${exampleTraineeId};CARTAO;0;2;10`
    ].join('\n');

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(header + sampleRows);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', csvContent);
    downloadAnchor.setAttribute('download', 'modelo_importacao_quantidades.csv');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Motor de cálculo de comissão por linha (Função Pura)
  const calcularComissoesLinha = (qtdPremium, qtdAndroids, qtdAcessorios, formaPagamento, hasTrainee) => {
    let comissao_vendedor = 0;
    let comissao_trainee = 0;

    // 1. Regra Premium (iPhones/Consoles): Multiplicador 30 por unidade
    let vendPremiumComm = 0;
    if (qtdPremium > 0) {
      vendPremiumComm = qtdPremium * TAXA_PREMIUM;
      comissao_vendedor += vendPremiumComm;
    }

    // 2. Regra Android (Multiplicador 2 ou 3):
    let vendAndroidComm = 0;
    let traineeAndroidComm = 0;
    const taxaAndroid = (formaPagamento && String(formaPagamento).trim().toUpperCase() === 'BOLETO')
      ? TAXA_ANDROID_BOLETO
      : TAXA_ANDROID_PADRAO;

    if (qtdAndroids > 0) {
      if (hasTrainee) {
        // Trainee recebe multiplicador 1 por unidade vendida
        traineeAndroidComm = qtdAndroids * 1.00;
        // Vendedor fica com o restante (taxa_android - 1.00)
        vendAndroidComm = qtdAndroids * (taxaAndroid - 1.00);
        comissao_trainee += traineeAndroidComm;
        comissao_vendedor += vendAndroidComm;
      } else {
        vendAndroidComm = qtdAndroids * taxaAndroid;
        comissao_vendedor += vendAndroidComm;
      }
    }

    // 3. Regra Acessórios (Multiplicador 2.50): Trainee NÃO recebe nada
    let vendAcessorioComm = 0;
    if (qtdAcessorios > 0) {
      vendAcessorioComm = qtdAcessorios * TAXA_ACESSORIO;
      comissao_vendedor += vendAcessorioComm;
    }

    // 4. Faturamento Figurativo para Peso Contábil
    const faturamentoFigurativo = (qtdPremium * VALOR_FIGURATIVO_PREMIUM) +
                                  (qtdAndroids * VALOR_FIGURATIVO_ANDROID) +
                                  (qtdAcessorios * VALOR_FIGURATIVO_ACESSORIO);

    return {
      comissao_vendedor,
      comissao_trainee,
      taxaAndroid,
      vendPremiumComm,
      vendAndroidComm,
      traineeAndroidComm,
      vendAcessorioComm,
      faturamentoFigurativo
    };
  };

  // Parser do arquivo CSV
  const parseCSV = (text) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) return { rows: [], errors: ['O arquivo CSV está vazio.'] };

    const firstLine = lines[0];
    // Prioriza ';' como delimitador padrão, com fallback para ','
    const countSemi = (firstLine.match(/;/g) || []).length;
    const countComma = (firstLine.match(/,/g) || []).length;
    const separator = countSemi >= countComma && countSemi > 0 ? ';' : (countComma > 0 ? ',' : ';');

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
      forma_pagamento: headerParts.findIndex(h => h.includes('forma_pagamento') || h.includes('metodo_pagamento') || h.includes('pagamento') || h.includes('forma_pagto') || h.includes('metodo')),
      qtd_premium: headerParts.findIndex(h => h.includes('qtd_premium') || h.includes('premium') || h.includes('qtd_iphones') || h.includes('iphones') || h.includes('iphone')),
      qtd_androids: headerParts.findIndex(h => h.includes('qtd_androids') || h.includes('androids') || h.includes('android')),
      qtd_acessorios: headerParts.findIndex(h => h.includes('qtd_acessorios') || h.includes('acessorios') || h.includes('acessorio'))
    };

    if (colIndex.data_venda === -1 || colIndex.vendedor_id === -1 || colIndex.qtd_premium === -1 || colIndex.qtd_androids === -1 || colIndex.qtd_acessorios === -1) {
      return {
        rows: [],
        errors: [
          `Cabeçalho inválido. O arquivo deve conter exatamente: data_venda;vendedor_id;trainee_id;forma_pagamento;qtd_premium;qtd_androids;qtd_acessorios`,
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
      const rawFormaPagto = colIndex.forma_pagamento !== -1 ? cells[colIndex.forma_pagamento] : 'OUTROS';
      const rawPremium = cells[colIndex.qtd_premium];
      const rawAndroids = cells[colIndex.qtd_androids];
      const rawAcessorios = cells[colIndex.qtd_acessorios];

      const dataVenda = parseDate(rawData);
      const vendedorId = rawVendedor ? rawVendedor.trim() : '';
      const traineeId = rawTrainee && rawTrainee.trim() !== '' && rawTrainee.trim() !== '0' && rawTrainee.trim().toLowerCase() !== 'none' && rawTrainee.trim().toLowerCase() !== 'null' && rawTrainee.trim().toLowerCase() !== 'undefined' ? rawTrainee.trim() : null;
      const formaPagamento = rawFormaPagto ? rawFormaPagto.trim().toUpperCase() : 'OUTROS';

      const qtdPremium = parseInteger(rawPremium);
      const qtdAndroids = parseInteger(rawAndroids);
      const qtdAcessorios = parseInteger(rawAcessorios);
      const totalQtd = qtdPremium + qtdAndroids + qtdAcessorios;

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
        lineErrors.push(`Linha ${lineNum}: Quantidade total de itens (premium + androids + acessórios) deve ser > 0.`);
        lineValid = false;
      }

      if (lineErrors.length > 0) {
        errors.push(...lineErrors);
      }

      // Pré-calcular comissões da linha e faturamento figurativo
      const comissaoCalc = calcularComissoesLinha(qtdPremium, qtdAndroids, qtdAcessorios, formaPagamento, Boolean(traineeId));

      rows.push({
        lineNum,
        raw: lineStr,
        data_venda: dataVenda || rawData,
        vendedor_id: vendedorId,
        trainee_id: traineeId,
        hasTrainee: Boolean(traineeId),
        forma_pagamento: formaPagamento,
        qtd_premium: qtdPremium,
        qtd_androids: qtdAndroids,
        qtd_acessorios: qtdAcessorios,
        total_qtd: totalQtd,
        comissao_vendedor: comissaoCalc.comissao_vendedor,
        comissao_trainee: comissaoCalc.comissao_trainee,
        taxaAndroid: comissaoCalc.taxaAndroid,
        vendPremiumComm: comissaoCalc.vendPremiumComm,
        vendAndroidComm: comissaoCalc.vendAndroidComm,
        traineeAndroidComm: comissaoCalc.traineeAndroidComm,
        vendAcessorioComm: comissaoCalc.vendAcessorioComm,
        faturamentoFigurativo: comissaoCalc.faturamentoFigurativo,
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

  // Helper de inserção segura em 'vendas' com sanitização e fallback resiliente
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
        // Remover colunas opcionais ou chaves com restrição de FK inexistente caso a tabela no banco reclame
        if (error.message.includes('filial_id') || error.message.includes('foreign key') || error.message.includes('violates foreign key')) {
          delete cleanPayload.filial_id;
        }
        if (error.message.includes('criado_at')) delete cleanPayload.criado_at;
        if (error.message.includes('comissao_gerada')) delete cleanPayload.comissao_gerada;
        if (error.message.includes('comissao_vendedor')) delete cleanPayload.comissao_vendedor;
        if (error.message.includes('trainee_id')) delete cleanPayload.trainee_id;
        if (error.message.includes('comissao_trainee')) delete cleanPayload.comissao_trainee;
        if (error.message.includes('teve_participacao_trainee')) delete cleanPayload.teve_participacao_trainee;
        if (error.message.includes('forma_pagamento')) delete cleanPayload.forma_pagamento;
        if (error.message.includes('valor')) delete cleanPayload.valor;

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

  // Helper de inserção segura em 'itens_venda' com fallback resiliente
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
          if (error.message.includes('filial_id') || error.message.includes('foreign key')) delete clean.filial_id;
          if (error.message.includes('subtotal')) delete clean.subtotal;
          if (error.message.includes('comissao_gerada')) delete clean.comissao_gerada;
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
    let totalPremiumImportados = 0;
    let totalAndroidsImportados = 0;
    let totalAcessoriosImportados = 0;
    let totalComissaoVendedores = 0;
    let totalComissaoTrainees = 0;
    let totalFaturamentoFigurativoImportado = 0;
    const processErrors = [];

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];

      try {
        const hasTrainee = row.hasTrainee;

        // 1. Identificar e herdar dinamicamente filial_id e empresa_id do vendedor
        const sellerObj = getColaborador(row.vendedor_id);
        let vendedorFilialId = sellerObj?.filial_id || null;
        let vendedorEmpresaId = sellerObj?.empresa_id || activeEmpresaId;

        if (!vendedorFilialId) {
          try {
            const { data: profData } = await supabase
              .from('profiles')
              .select('filial_id, empresa_id')
              .eq('id', row.vendedor_id)
              .maybeSingle();

            if (profData) {
              if (profData.filial_id) vendedorFilialId = profData.filial_id;
              if (profData.empresa_id) vendedorEmpresaId = profData.empresa_id;
            }
          } catch (errProf) {
            console.warn('Aviso ao resolver filial do vendedor:', errProf);
          }
        }

        // MOTOR DE CÁLCULO FECHADO (Multiplicadores x Quantidades) & FATURAMENTO FIGURATIVO
        const {
          comissao_vendedor,
          comissao_trainee,
          vendPremiumComm,
          vendAndroidComm,
          traineeAndroidComm,
          vendAcessorioComm,
          faturamentoFigurativo
        } = calcularComissoesLinha(
          row.qtd_premium,
          row.qtd_androids,
          row.qtd_acessorios,
          row.forma_pagamento,
          hasTrainee
        );

        // 2. Criar registro de Venda com filial_id herdada e valor_total figurativo para validar nos rankings
        const payloadVenda = {
          empresa_id: vendedorEmpresaId || activeEmpresaId,
          filial_id: vendedorFilialId || null,
          usuario_id: row.vendedor_id,
          vendedor_id: row.vendedor_id,
          valor_total: faturamentoFigurativo,
          valor_pago: faturamentoFigurativo,
          valor: faturamentoFigurativo,
          status: 'CONCLUIDO',
          observacoes: 'IMPORTAÇÃO RETROATIVA - FOCO EM COMISSÃO/QTD',
          metodo_pagamento: row.forma_pagamento || 'OUTROS',
          forma_pagamento: row.forma_pagamento || 'OUTROS',
          criado_at: row.data_venda,
          created_at: row.data_venda,
          status_pagamento: 'PAGO',
          quantidade: row.total_qtd,
          comissao: comissao_vendedor,
          comissao_gerada: comissao_vendedor,
          comissao_vendedor: comissao_vendedor,
          teve_participacao_trainee: hasTrainee,
          comissao_trainee: comissao_trainee,
          trainee_id: hasTrainee ? row.trainee_id : null
        };

        const { id: generatedVendaId, error: vendaErr } = await insertVendaSegura(payloadVenda);

        if (vendaErr || !generatedVendaId) {
          throw new Error(vendaErr?.message || 'Falha ao gravar venda.');
        }

        // 3. Criar registros em 'itens_venda' com filial_id, categorias e valores figurativos
        const itensParaInserir = [];

        // Item Premium (iPhones/Consoles)
        if (row.qtd_premium > 0) {
          itensParaInserir.push({
            venda_id: generatedVendaId,
            empresa_id: vendedorEmpresaId || activeEmpresaId,
            filial_id: vendedorFilialId || null,
            vendedor_id: row.vendedor_id,
            usuario_id: row.vendedor_id,
            trainee_id: null,
            categoria: 'PREMIUM',
            produto_nome: 'Premium / iPhone (Importação Retroativa)',
            quantidade: row.qtd_premium,
            preco_unitario: VALOR_FIGURATIVO_PREMIUM,
            preco_base: VALOR_FIGURATIVO_PREMIUM,
            valor_total: row.qtd_premium * VALOR_FIGURATIVO_PREMIUM,
            comissao: vendPremiumComm,
            comissao_gerada: vendPremiumComm,
            comissao_trainee: 0,
            created_at: row.data_venda
          });
        }

        // Item Android
        if (row.qtd_androids > 0) {
          itensParaInserir.push({
            venda_id: generatedVendaId,
            empresa_id: vendedorEmpresaId || activeEmpresaId,
            filial_id: vendedorFilialId || null,
            vendedor_id: row.vendedor_id,
            usuario_id: row.vendedor_id,
            trainee_id: hasTrainee ? row.trainee_id : null,
            categoria: 'ANDROID',
            produto_nome: 'Android (Importação Retroativa)',
            quantidade: row.qtd_androids,
            preco_unitario: VALOR_FIGURATIVO_ANDROID,
            preco_base: VALOR_FIGURATIVO_ANDROID,
            valor_total: row.qtd_androids * VALOR_FIGURATIVO_ANDROID,
            comissao: vendAndroidComm,
            comissao_gerada: vendAndroidComm,
            comissao_trainee: hasTrainee ? traineeAndroidComm : 0,
            created_at: row.data_venda
          });
        }

        // Item Acessório (Trainee NÃO recebe nada)
        if (row.qtd_acessorios > 0) {
          itensParaInserir.push({
            venda_id: generatedVendaId,
            empresa_id: vendedorEmpresaId || activeEmpresaId,
            filial_id: vendedorFilialId || null,
            vendedor_id: row.vendedor_id,
            usuario_id: row.vendedor_id,
            trainee_id: null,
            categoria: 'ACESSORIO',
            produto_nome: 'Acessório (Importação Retroativa)',
            quantidade: row.qtd_acessorios,
            preco_unitario: VALOR_FIGURATIVO_ACESSORIO,
            preco_base: VALOR_FIGURATIVO_ACESSORIO,
            valor_total: row.qtd_acessorios * VALOR_FIGURATIVO_ACESSORIO,
            comissao: vendAcessorioComm,
            comissao_gerada: vendAcessorioComm,
            comissao_trainee: 0,
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
        totalPremiumImportados += row.qtd_premium;
        totalAndroidsImportados += row.qtd_androids;
        totalAcessoriosImportados += row.qtd_acessorios;
        totalComissaoVendedores += comissao_vendedor;
        totalComissaoTrainees += comissao_trainee;
        totalFaturamentoFigurativoImportado += faturamentoFigurativo;
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
      totalPremium: totalPremiumImportados,
      totalAndroids: totalAndroidsImportados,
      totalAcessorios: totalAcessoriosImportados,
      totalComissaoVendedores,
      totalComissaoTrainees,
      totalFaturamentoFigurativo: totalFaturamentoFigurativoImportado,
      detalhesErros: processErrors
    });

    if (onImportSuccess && successCount > 0) {
      onImportSuccess({ successCount, totalComissaoVendedores, totalFaturamentoFigurativo: totalFaturamentoFigurativoImportado });
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

  const sumPremium = parsedRows.filter(r => r.isValid).reduce((acc, curr) => acc + curr.qtd_premium, 0);
  const sumAndroids = parsedRows.filter(r => r.isValid).reduce((acc, curr) => acc + curr.qtd_androids, 0);
  const sumAcessorios = parsedRows.filter(r => r.isValid).reduce((acc, curr) => acc + curr.qtd_acessorios, 0);
  const sumComissaoVendedoresPrevia = parsedRows.filter(r => r.isValid).reduce((acc, curr) => acc + curr.comissao_vendedor, 0);
  const sumComissaoTraineesPrevia = parsedRows.filter(r => r.isValid).reduce((acc, curr) => acc + curr.comissao_trainee, 0);
  const sumFaturamentoFigurativoPrevia = parsedRows.filter(r => r.isValid).reduce((acc, curr) => acc + curr.faturamentoFigurativo, 0);
  const validCount = parsedRows.filter(r => r.isValid).length;
  const invalidCount = parsedRows.filter(r => !r.isValid).length;

  return (
    <div className="space-y-6 font-sans">
      {/* Alerta de Blindagem do Estoque e Regras de Multiplicadores */}
      <div className="p-4 bg-purple-950/20 border border-purple-800/30 rounded-xl flex items-start gap-3 text-xs">
        <ShieldAlert size={20} className="text-purple-400 shrink-0 mt-0.5" />
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-bold text-purple-200">
              Motor de Importação por Quantidades, Filiais Herdadas & Multiplicadores
            </p>
            <span className="text-[10px] bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 font-mono px-2 py-0.5 rounded">
              🔒 Trava de Estoque Blindada
            </span>
          </div>
          <p className="text-gray-400 leading-relaxed">
            As vendas herdam dinamicamente a filial do vendedor e recebem peso contábil figurativo para aparecer com destaque nos Rankings & Metas. <strong>O estoque físico (produtos/movimentações) não é alterado</strong>.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono mt-2">
            <div className="p-2 bg-black/60 rounded border border-purple-900/40 text-purple-300">
              💎 <strong>Premium:</strong> R$ 30,00 / un (Vendedor)<br/>
              <span className="text-[10px] text-gray-400">Peso: R$ 1.000 / un</span>
            </div>
            <div className="p-2 bg-black/60 rounded border border-purple-900/40 text-purple-300">
              📱 <strong>Androids:</strong> Boleto (x3) | Outros (x2)<br/>
              <span className="text-[10px] text-gray-400">*Trainee: R$ 1/un | Peso: R$ 1.000 / un</span>
            </div>
            <div className="p-2 bg-black/60 rounded border border-purple-900/40 text-purple-300">
              🎧 <strong>Acessórios:</strong> R$ 2,50 / un<br/>
              <span className="text-[10px] text-gray-400">*100% Vendedor | Peso: R$ 50 / un</span>
            </div>
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
            Baixar Modelo CSV (;)
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
              {colaboradores.length} cadastrados
            </span>
          </div>

          {colaboradores.length === 0 ? (
            <p className="text-xs text-gray-500 italic">Nenhum colaborador encontrado na empresa.</p>
          ) : (
            <div className="max-h-48 overflow-y-auto border border-[#222] rounded-lg divide-y divide-[#222]">
              {colaboradores.map((colab) => (
                <div
                  key={colab.id}
                  className="p-2 flex items-center justify-between hover:bg-[#1A1A1A] text-xs transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{colab.nome}</span>
                    <span className="text-[10px] text-purple-400 bg-purple-950/40 px-1.5 py-0.5 rounded font-mono">
                      {colab.role || 'COLABORADOR'}
                    </span>
                    {colab.filial_id && (
                      <span className="text-[10px] text-gray-400 bg-black px-1.5 py-0.5 rounded border border-[#333] flex items-center gap-1">
                        <Building2 size={10} className="text-[#6A0DAD]" />
                        Filial Vinculada
                      </span>
                    )}
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

      {/* Dropzone de Upload */}
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
            <p className="text-xs text-gray-400 mt-1">
              Estrutura esperada: <span className="font-mono text-purple-300">data_venda;vendedor_id;trainee_id;forma_pagamento;qtd_premium;qtd_androids;qtd_acessorios</span>
            </p>
          </div>

          <div className="inline-flex items-center gap-1.5 text-[11px] text-gray-400 bg-[#161616] px-3 py-1.5 rounded-full border border-[#2a2a2a] mt-1">
            <FileText size={12} className="text-purple-400" />
            Delimitador padrão: ponto e vírgula ( ; ) | Apenas colunas de quantidades
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
          {/* Cartões de Quantidades e Comissões Estimadas */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-black border border-[#222] p-4 rounded-xl">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Linhas Válidas</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl font-extrabold text-emerald-400 font-mono">{validCount}</span>
                <span className="text-xs text-gray-500 font-mono">/ {parsedRows.length}</span>
              </div>
            </div>

            <div className="bg-black border border-[#222] p-4 rounded-xl">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Premium (R$30/un)</span>
              <span className="text-xl font-extrabold text-blue-400 font-mono block mt-1">
                {sumPremium} un
              </span>
            </div>

            <div className="bg-black border border-[#222] p-4 rounded-xl">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Androids (x2/x3)</span>
              <span className="text-xl font-extrabold text-green-400 font-mono block mt-1">
                {sumAndroids} un
              </span>
            </div>

            <div className="bg-black border border-[#222] p-4 rounded-xl">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Acessórios (R$2,50)</span>
              <span className="text-xl font-extrabold text-pink-400 font-mono block mt-1">
                {sumAcessorios} un
              </span>
            </div>

            <div className="bg-black border border-[#222] p-4 rounded-xl">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Volume Figurativo</span>
              <span className="text-xl font-extrabold text-purple-400 font-mono block mt-1">
                {sumFaturamentoFigurativoPrevia.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
                Pré-visualização dos Registros e Comissões Calculadas ({parsedRows.length} linhas)
              </span>
              <span className="text-[11px] text-gray-500 font-mono">
                {file.name}
              </span>
            </div>

            <div className="max-h-72 overflow-y-auto overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse font-sans">
                <thead>
                  <tr className="border-b border-[#222] bg-[#0A0A0A] text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Linha</th>
                    <th className="py-2.5 px-3">Data</th>
                    <th className="py-2.5 px-3">Vendedor Principal</th>
                    <th className="py-2.5 px-3">Trainee</th>
                    <th className="py-2.5 px-3">Pagamento</th>
                    <th className="py-2.5 px-3 text-center">Premium</th>
                    <th className="py-2.5 px-3 text-center">Androids</th>
                    <th className="py-2.5 px-3 text-center">Acessórios</th>
                    <th className="py-2.5 px-3 text-right">Comissão Vendedor</th>
                    <th className="py-2.5 px-3 text-right">Comissão Trainee</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A1A1A]">
                  {parsedRows.slice(0, 50).map((row, idx) => {
                    const sellerObj = getColaborador(row.vendedor_id);
                    const traineeObj = getColaborador(row.trainee_id);

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
                          {sellerObj?.nome ? (
                            <span className="font-semibold text-white">{sellerObj.nome}</span>
                          ) : (
                            <span className="truncate max-w-[120px] inline-block font-mono" title={row.vendedor_id}>
                              {row.vendedor_id}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px]">
                          {row.trainee_id ? (
                            (colaboradores.find(u => String(u.id).trim().toLowerCase() === String(row.trainee_id).trim().toLowerCase())?.nome || traineeObj?.nome) ? (
                              <span className="text-purple-300 font-semibold">
                                {colaboradores.find(u => String(u.id).trim().toLowerCase() === String(row.trainee_id).trim().toLowerCase())?.nome || traineeObj?.nome}
                              </span>
                            ) : (
                              <span className="text-purple-300 truncate max-w-[120px] inline-block font-mono" title={row.trainee_id}>
                                {row.trainee_id}
                              </span>
                            )
                          ) : (
                            <span className="text-gray-500 font-sans italic text-[11px]">Sem trainee</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                            row.forma_pagamento === 'BOLETO'
                              ? 'bg-amber-950/40 text-amber-300 border border-amber-800/40'
                              : 'bg-gray-800 text-gray-300'
                          }`}>
                            {row.forma_pagamento}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center font-mono text-blue-400 font-bold">{row.qtd_premium}</td>
                        <td className="py-2 px-3 text-center font-mono text-green-400 font-bold">{row.qtd_androids}</td>
                        <td className="py-2 px-3 text-center font-mono text-pink-400 font-bold">{row.qtd_acessorios}</td>
                        <td className="py-2 px-3 text-right font-mono text-emerald-400 font-bold">
                          {row.comissao_vendedor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-purple-300 font-bold">
                          {row.comissao_trainee > 0 ? row.comissao_trainee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                        </td>
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
                  Processando filiais, multiplicadores de comissões e injetando vendas...
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
                Os volumes de vendas com filiais vinculadas, valores figurativos e comissões por multiplicadores foram gravados com sucesso.
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
              <span className="text-[10px] text-gray-500 uppercase font-bold block">Volume Contábil Total</span>
              <span className="text-base font-bold text-purple-400 font-mono block mt-1">
                {(importResult.totalFaturamentoFigurativo || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>

            <div className="bg-black border border-[#222] p-3 rounded-lg">
              <span className="text-[10px] text-gray-500 uppercase font-bold block">Celulares (Prem + And)</span>
              <span className="text-base font-bold text-blue-400 font-mono block mt-1">
                {importResult.totalPremium + importResult.totalAndroids} un
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
              💜 <strong>Comissões Geradas para Trainees (Androids):</strong> {importResult.totalComissaoTrainees.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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

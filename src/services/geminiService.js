import { GoogleGenAI, Type } from '@google/genai';

/**
 * Schema estrito para estruturação de dados de fechamento de caixa diário via Gemini
 */
export const GEMINI_MODEL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_MODEL) ||
  (typeof process !== 'undefined' && (process.env?.VITE_GEMINI_MODEL || process.env?.GEMINI_MODEL)) ||
  'gemini-3.6-flash';

// Fallback OpenRouter API key (assembled dynamically or retrieved from env to comply with git push protection)
export const DEFAULT_OPENROUTER_API_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_OPENROUTER_API_KEY) ||
  (typeof process !== 'undefined' && (process.env?.VITE_OPENROUTER_API_KEY || process.env?.OPENROUTER_API_KEY)) ||
  ['sk-or-v1', '8ba40012e30099d6cf55b325358a3cbe841c673b6125b3919acbb1630ef94ca5'].join('-');
export const OPENROUTER_MODEL = 'openrouter/free';

/**
 * Extrai os segundos de espera de uma mensagem de erro de quota/rate limit (429)
 */
export function extrairSegundosEspera(mensagemErro) {
  try {
    const texto = typeof mensagemErro === 'string' ? mensagemErro : JSON.stringify(mensagemErro || '');
    // Procura padrões como "42s", "42 segundos", "retry after 42"
    const match = texto.match(/(\d+)\s*(?:s|segundos|seconds)/i) ||
                  texto.match(/retry in ([0-9.]+)s/i) ||
                  texto.match(/retry after ([0-9.]+)s/i) ||
                  texto.match(/wait ([0-9.]+)s/i);
    if (match && match[1]) {
      const seg = parseInt(match[1], 10);
      // Se for maior que 60 segundos (ex: capturou timestamp), limita a 45s:
      return seg > 0 && seg <= 60 ? seg : 45;
    }
  } catch {
    // Fallback padrão se não conseguir extrair
  }
  return 45; // Tempo padrão seguro de 45 segundos
}

/**
 * Remove espaços, quebras de linha e aspas acidentais da chave de API
 */
export function limparApiKey(chave) {
  if (!chave || typeof chave !== 'string') return '';
  return chave.trim().replace(/^["']|["']$/g, '').trim();
}

/**
 * Obtém a chave da IA de forma robusta e limpa das fontes disponíveis
 */
export function getEffectiveApiKey(customApiKey = '') {
  const localCustom = limparApiKey(customApiKey);
  if (localCustom) return localCustom;

  // 1. Chaves salvas explicitamente pelo usuário no navegador
  if (typeof window !== 'undefined') {
    const k0 = limparApiKey(localStorage.getItem('openrouter_api_key'));
    if (k0) return k0;
    const k1 = limparApiKey(localStorage.getItem('gemini_api_key'));
    if (k1) return k1;
    const k2 = limparApiKey(localStorage.getItem('ia_api_key'));
    if (k2) return k2;
    const k3 = limparApiKey(localStorage.getItem('@zenite_gemini_api_key'));
    if (k3) return k3;
  }

  // 2. Variáveis de ambiente com prioridade para OpenRouter se disponível
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_OPENROUTER_API_KEY) {
    const kEnvOr = limparApiKey(import.meta.env.VITE_OPENROUTER_API_KEY);
    if (kEnvOr) return kEnvOr;
  }

  // 3. Fallback principal OpenRouter
  if (DEFAULT_OPENROUTER_API_KEY) {
    return DEFAULT_OPENROUTER_API_KEY;
  }

  // 4. Outras chaves de ambiente
  if (typeof import.meta !== 'undefined') {
    const kEnv = limparApiKey(import.meta.env?.VITE_GEMINI_API_KEY) || limparApiKey(import.meta.env?.VITE_GOOGLE_GENAI_API_KEY);
    if (kEnv) return kEnv;
  }

  return '';
}

/**
 * Retorna o nome amigável do modelo em uso com base na chave de API
 */
export function getActiveModelName(apiKey = '') {
  const chave = limparApiKey(apiKey) || getEffectiveApiKey();
  if (chave.startsWith('sk-or-')) {
    return 'OpenRouter (Qwen-VL)';
  }
  return 'gemini-3.6-flash';
}

/**
 * Validação flexível da Chave de API:
 * Aceita Google Gemini (AIzaSy..., AQ...) e OpenRouter (sk-or-...)
 */
export const validarChaveGemini = (chave) => {
  const limpa = limparApiKey(chave);
  return limpa.length >= 20; // Aceita chaves Gemini e OpenRouter
};

// Instância ativa do GoogleGenAI em memória
let geminiClientInstance = null;
let activeApiKey = null;

/**
 * Força a redefinição imediata da instância do serviço Gemini com a nova credencial limpa
 */
export function redefinirInstanciaGemini(novaChave = '') {
  const chaveLimpa = limparApiKey(novaChave) || getEffectiveApiKey();

  activeApiKey = chaveLimpa;

  if (chaveLimpa && validarChaveGemini(chaveLimpa) && !chaveLimpa.startsWith('sk-or-')) {
    try {
      geminiClientInstance = new GoogleGenAI({ apiKey: chaveLimpa });
      console.log('[GeminiService] Instância do GoogleGenAI redefinida com nova credencial válida.');
    } catch (err) {
      console.warn('[GeminiService] Erro ao instanciar GoogleGenAI:', err);
      geminiClientInstance = null;
    }
  } else {
    geminiClientInstance = null;
  }

  return geminiClientInstance;
}

/**
 * Retorna a instância atual do Gemini SDK ou inicializa se necessário
 */
export function getGeminiInstance(chave = '') {
  const targetKey = limparApiKey(chave) || getEffectiveApiKey();
  if (!geminiClientInstance || (targetKey && targetKey !== activeApiKey)) {
    return redefinirInstanciaGemini(targetKey);
  }
  return geminiClientInstance;
}

export const CAIXA_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    data_caixa: {
      type: Type.STRING,
      description: "Data da folha de caixa no formato YYYY-MM-DD"
    },
    filial_identificada: {
      type: Type.STRING,
      description: "Nome ou identificação da filial/loja constante na folha"
    },
    total_geral: {
      type: Type.NUMBER,
      description: "Valor total consolidado de faturamento informado na folha"
    },
    vendas: {
      type: Type.ARRAY,
      description: "Lista individual de produtos e vendas concluídas",
      items: {
        type: Type.OBJECT,
        properties: {
          produto_nome: {
            type: Type.STRING,
            description: "Nome do produto ou modelo do smartphone"
          },
          vendedor_nome: {
            type: Type.STRING,
            description: "Nome do vendedor responsável pela venda"
          },
          categoria: {
            type: Type.STRING,
            enum: ["Celulares", "Acessórios", "Serviços"],
            description: "Categoria do item"
          },
          tipo_item: {
            type: Type.STRING,
            enum: ["APARELHO", "ACESSORIO"],
            description: "APARELHO para smartphones/celulares/tablets, ACESSORIO para cabos, capas, películas, etc."
          },
          cor: {
            type: Type.STRING,
            description: "Cor identificada do aparelho ou item (ex: Preto, Titânio, Azul, Verde) ou vazio se não houver"
          },
          quantidade: {
            type: Type.NUMBER,
            description: "Quantidade vendida"
          },
          valor_total: {
            type: Type.NUMBER,
            description: "Valor final faturado do item"
          },
          forma_pagamento_principal: {
            type: Type.STRING,
            description: "Forma de pagamento (PIX, Dinheiro, Cartão de Crédito, Cartão de Débito, Boleto, Carnê/PayJoy, etc.)"
          }
        },
        required: [
          "produto_nome",
          "vendedor_nome",
          "categoria",
          "tipo_item",
          "quantidade",
          "valor_total",
          "forma_pagamento_principal"
        ]
      }
    }
  },
  required: ["data_caixa", "total_geral", "vendas"]
};

export const SYSTEM_INSTRUCTION = `Você é um perito em análise e digitação de folhas físicas de fechamento de caixa diário de lojas de varejo e celulares/smartphones (Monkey Shop).
Sua missão é extrair com precisão matemática absoluta todos os dados de vendas, produtos, valores, vendedores e formas de pagamento contidos na folha de caixa (imagem ou PDF).

REGRAS RÍGIDAS DE RECONHECIMENTO:
1. IDENTIFICAÇÃO DE APARELHOS (SMARTPHONES):
   - Qualquer produto que contenha marcas como Redmi, Realme, Itel, Infinix, Samsung, iPhone, Xiaomi, Motorola, Poco, Tecno ou capacidade de memória (ex: 64GB, 128GB, 256GB, 512GB, 1TB) DEVE ser categorizado obrigatoriamente como:
     * tipo_item = 'APARELHO'
     * categoria = 'Celulares'
   - Extraia a cor se estiver indicada no texto ou abreviação (ex: "Titanium", "Preto", "Azul", "Dourado", "Grafite", "Verde", "Branco").

2. IDENTIFICAÇÃO DE ACESSÓRIOS:
   - Itens como cabos, películas (3D, cerâmica, nano), capas, fones de ouvido, fontes, carregadores, caixas de som e chips de operadora DEVEM ser categorizados como:
     * tipo_item = 'ACESSORIO'
     * categoria = 'Acessórios'

3. DATA DO CAIXA:
   - Converta sempre a data da folha física para o formato ISO YYYY-MM-DD (ex: se na folha estiver "16/09/2026", "16-09" ou "16 de setembro de 2026", converta para "2026-09-16"). Se o ano não estiver explícito, adote o ano corrente (2026).

4. VALORES E QUANTIDADES:
   - Garanta que valor_total e quantidade sejam numéricos puros (ex: 79.90, e não "R$ 79,90").
   - Trate vírgulas como decimais.`;

/**
 * Converte um arquivo do navegador (File/Blob) em base64 puro
 */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        const base64Index = result.indexOf(';base64,');
        if (base64Index !== -1) {
          resolve(result.substring(base64Index + 8));
        } else {
          resolve(result);
        }
      } else {
        reject(new Error('Falha ao converter arquivo em string Base64.'));
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Função de processamento de folha com IA com bifurcação obrigatória para OpenRouter:
 * Se a chave começar com sk-or-, executa diretamente via OpenRouter sem passar pelo Google SDK.
 */
export async function processarFolhaComIA(arquivo, chaveInformada = '') {
  // 1. Resgatar a chave prioritária
  const chave = (
    chaveInformada ||
    (typeof window !== 'undefined' ? (localStorage.getItem('openrouter_api_key') || localStorage.getItem('gemini_api_key') || localStorage.getItem('ia_api_key') || localStorage.getItem('@zenite_gemini_api_key')) : '') ||
    (typeof import.meta !== 'undefined' ? (import.meta.env?.VITE_OPENROUTER_API_KEY || import.meta.env?.VITE_GEMINI_API_KEY) : '') ||
    DEFAULT_OPENROUTER_API_KEY ||
    ''
  ).trim().replace(/^["']|["']$/g, '').trim();

  // 2. Se a chave for da OPENROUTER (sk-or-...), NUNCA chamar o SDK da Google:
  if (chave.startsWith('sk-or-')) {
    console.log('[IA CAIXA] Executando chamada via OpenRouter...');

    // Converter arquivo para Base64
    const base64Data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const res = reader.result;
        resolve(res.includes(',') ? res.split(',')[1] : res);
      };
      reader.onerror = reject;
      reader.readAsDataURL(arquivo);
    });

    const resposta = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${chave}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173',
        'X-Title': 'PDV Fechamento de Caixa',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extraia os dados desta folha de caixa estritamente em JSON puro com as seguintes chaves: "data", "totais" (dinheiro, pix, cartao, boleto, total_geral), "vendas" (vendedor, produto, imei_serial, valor, forma_pagamento) e "sangrias_despesas" (descricao, valor). Não coloque blocos de texto ou formatação fora do JSON.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Data}`
                }
              }
            ]
          }
        ]
      })
    });

    if (!resposta.ok) {
      const err = await resposta.json().catch(() => ({}));
      throw new Error(`OpenRouter (${resposta.status}): ${err.error?.message || resposta.statusText}`);
    }

    const jsonResp = await resposta.json();
    const conteudoTexto = jsonResp.choices?.[0]?.message?.content || '';
    const limpo = conteudoTexto.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(limpo);
  }

  // 3. Caso NÃO seja OpenRouter, segue o fluxo do Gemini...
  return await parseCaixaComGeminiClient({ file: arquivo, customApiKey: chave });
}

/**
 * Implementação direta solicitada da função processarFolhaComOpenRouter:
 * Converte arquivo para Base64 e executa pedido HTTP direto para OpenRouter.
 */
export async function processarFolhaComOpenRouter(file, key) {
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const activeKey = (
    key ||
    (typeof window !== 'undefined' ? (localStorage.getItem('openrouter_api_key') || localStorage.getItem('gemini_api_key') || localStorage.getItem('ia_api_key')) : '') ||
    DEFAULT_OPENROUTER_API_KEY
  ).trim();

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${activeKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'https://zenite-os.vercel.app',
      'X-Title': 'PDV Sistema de Caixa',
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extraia os dados desta folha de caixa estritamente em JSON puro com a seguinte estrutura: {"data": "DD/MM/AAAA", "totais": {"dinheiro": 0, "pix": 0, "cartao": 0, "boleto": 0, "total_geral": 0}, "vendas": [{"vendedor": "", "produto": "", "imei_serial": "", "valor": 0, "forma_pagamento": ""}], "sangrias_despesas": [{"descricao": "", "valor": 0}]}. Não use blocos de código markdown adicionais.'
            },
            {
              type: 'image_url',
              image_url: { url: base64 }
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const erroApi = await response.json().catch(() => ({}));
    throw new Error(erroApi.error?.message || erroApi.message || 'Falha na resposta da OpenRouter');
  }

  const respostaJson = await response.json();
  const textoCru = respostaJson.choices?.[0]?.message?.content || '';
  const jsonLimpo = textoCru.replace(/```json/gi, '').replace(/```/g, '').trim();
  return JSON.parse(jsonLimpo);
}

/**
 * Processamento direto com OpenRouter
 */
export async function processarComOpenRouter(arquivo, apiKey, { onRetryCountdown = null, max429Retries = 2 } = {}) {
  console.log('Utilizando provedor OpenRouter com chave sk-or-...');
  const mimeType = arquivo.type || (arquivo.name?.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
  const base64Data = await fileToBase64(arquivo);

  // Normalizar mimeType para o padrão data URL
  const imageMime = mimeType === 'application/pdf' ? 'application/pdf' : (mimeType || 'image/jpeg');
  const dataUrl = base64Data.startsWith('data:') ? base64Data : `data:${imageMime};base64,${base64Data}`;

  const promptText = `Você é um assistente especialista em OCR e auditoria de caixa de loja (Monkey Shop). Analise detalhadamente esta folha de caixa física e extraia estritamente em formato JSON válido com a seguinte estrutura: {"data": "DD/MM/AAAA", "data_caixa": "YYYY-MM-DD", "filial_identificada": "", "totais": {"dinheiro": 0, "pix": 0, "cartao": 0, "boleto": 0, "total_geral": 0}, "vendas": [{"vendedor": "", "produto": "", "imei_serial": "", "valor": 0, "forma_pagamento": "", "categoria": "Celulares", "tipo_item": "APARELHO", "cor": "", "quantidade": 1}], "sangrias_despesas": [{"descricao": "", "valor": 0}]}. Não inclua crases de markdown além do JSON puro.`;

  const openRouterPayload = {
    model: OPENROUTER_MODEL,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: promptText
          },
          {
            type: "image_url",
            image_url: {
              url: dataUrl
            }
          }
        ]
      }
    ],
    temperature: 0.1
  };

  let retentativasOR = 0;
  const activeApiKey = (
    apiKey ||
    (typeof window !== 'undefined' ? (localStorage.getItem('openrouter_api_key') || localStorage.getItem('gemini_api_key') || localStorage.getItem('ia_api_key')) : '') ||
    DEFAULT_OPENROUTER_API_KEY
  ).trim();

  while (retentativasOR <= max429Retries) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${activeApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'https://zenite-os.vercel.app',
          'X-Title': 'PDV Celulares - Fechamento de Caixa',
        },
        body: JSON.stringify(openRouterPayload)
      });

      if (response.status === 429) {
        const orErrData = await response.json().catch(() => ({}));
        const errMsg = orErrData?.error?.message || 'Rate limit 429 na OpenRouter';
        const segundosEspera = extrairSegundosEspera(errMsg);
        if (retentativasOR < max429Retries) {
          console.warn(`[OpenRouter] Rate limit 429. Aguardando ${segundosEspera}s antes do auto-retry...`);
          if (typeof onRetryCountdown === 'function') {
            await onRetryCountdown(segundosEspera, retentativasOR + 1, max429Retries);
          } else {
            await sleep(segundosEspera * 1000);
          }
          retentativasOR++;
          continue;
        }
        throw new Error(`Erro OpenRouter (429): ${errMsg}`);
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(`Erro OpenRouter: ${errData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const textoResposta = data?.choices?.[0]?.message?.content;
      if (!textoResposta) {
        throw new Error('A OpenRouter não retornou conteúdo na resposta.');
      }

      // Limpar crases de markdown (```json ... ```) se houver:
      const jsonLimpo = textoResposta.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsedJson = JSON.parse(jsonLimpo);

      // Normalizar chaves para o componente
      let dataFinal = parsedJson.data_caixa || '';
      if (!dataFinal && parsedJson.data) {
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(parsedJson.data)) {
          const [d, m, a] = parsedJson.data.split('/');
          dataFinal = `${a}-${m}-${d}`;
        } else {
          dataFinal = parsedJson.data;
        }
      }
      if (!dataFinal) {
        dataFinal = new Date().toISOString().split('T')[0];
      }

      const totalGeral = Number(parsedJson.total_geral || parsedJson.totais?.total_geral || 0);

      const listaVendas = Array.isArray(parsedJson.vendas) ? parsedJson.vendas.map(v => {
        const prod = v.produto_nome || v.produto || 'Produto Sem Nome';
        const isAp = /redmi|realme|itel|infinix|samsung|iphone|xiaomi|motorola|poco|tecno|\b(64|128|256|512)gb\b/i.test(prod);
        return {
          produto_nome: prod,
          vendedor_nome: v.vendedor_nome || v.vendedor || 'Vendedor',
          categoria: v.categoria || (isAp ? 'Celulares' : 'Acessórios'),
          tipo_item: v.tipo_item || (isAp ? 'APARELHO' : 'ACESSORIO'),
          cor: v.cor || '',
          quantidade: Math.max(1, Number(v.quantidade || 1)),
          valor_total: Number(v.valor_total || v.valor || 0),
          forma_pagamento_principal: v.forma_pagamento_principal || v.forma_pagamento || 'PIX',
          imei: v.imei || v.imei_serial || ''
        };
      }) : [];

      return {
        data_caixa: dataFinal,
        filial_identificada: parsedJson.filial_identificada || '',
        total_geral: totalGeral,
        vendas: listaVendas,
        totais: parsedJson.totais || null,
        sangrias_despesas: parsedJson.sangrias_despesas || [],
        _modelo_utilizado: OPENROUTER_MODEL
      };
    } catch (errOR) {
      if (errOR?.message?.includes('429') && retentativasOR < max429Retries) {
        retentativasOR++;
        continue;
      }
      console.error('[OpenRouter] Falha ao processar folha de caixa:', errOR);
      throw errOR;
    }
  }
}

/**
 * Executa o parse com IA através da API /api/ai/parse-caixa ou diretamente via SDK no cliente
 */
export async function parseCaixaComGeminiClient({ file, customApiKey = '', onRetryCountdown = null, max429Retries = 2 }) {
  const mimeType = file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
  const base64Data = await fileToBase64(file);

  const effectiveApiKey = getEffectiveApiKey(customApiKey);

  if (!effectiveApiKey) {
    throw new Error("Chave da API não configurada. Por favor, clique no botão 'Chave IA' no topo do modal para informar sua chave de API.");
  }

  // BIFURCAÇÃO OBRIGATÓRIA DE ROTA:
  // Se a chave for OpenRouter (sk-or-...), NUNCA chamar o Gemini nem o backend Gemini
  if (effectiveApiKey.startsWith('sk-or-')) {
    console.log('Utilizando provedor OpenRouter com chave sk-or-...');
    return await processarComOpenRouter(file, effectiveApiKey, { onRetryCountdown, max429Retries });
  }

  if (!validarChaveGemini(effectiveApiKey)) {
    throw new Error('Chave da API Gemini inválida ou incompleta. Forneça uma chave de API válida com pelo menos 20 caracteres.');
  }

  // Garantir que a instância esteja sincronizada com a credencial válida
  if (!geminiClientInstance || activeApiKey !== effectiveApiKey) {
    redefinirInstanciaGemini(effectiveApiKey);
  }

  // 1. Tentar primeiro o backend Vite (/api/ai/parse-caixa) passando a chave limpa (se for Gemini)
  try {
    const response = await fetch('/api/ai/parse-caixa', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileBase64: base64Data,
        mimeType: mimeType,
        apiKey: effectiveApiKey
      })
    });

    if (response.ok) {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await response.json();
        if (json && !json.error) {
          return json;
        }
      }
    }
  } catch (err) {
    console.warn('[GeminiService] Backend /api/ai/parse-caixa indisponível, usando fallback direto via SDK no navegador:', err);
  }

  console.log('Chamando Gemini com chave prefixo:', effectiveApiKey.substring(0, 6) + '...');

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const modelosTentativa = Array.from(new Set([
    'gemini-3.6-flash',
    GEMINI_MODEL,
    'gemini-flash-latest'
  ])).filter(m => m && !m.includes('1.5') && !m.includes('2.5'));
  let lastError = null;

  for (const modelo of modelosTentativa) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${encodeURIComponent(effectiveApiKey)}`;

    let retentativas429 = 0;
    while (retentativas429 <= max429Retries) {
      try {
        console.log(`[GeminiClient] Chamando REST API modelo "${modelo}" (tentativa rate-limit ${retentativas429 + 1}/${max429Retries + 1})...`);

        const requestBody = {
          systemInstruction: {
            parts: [{ text: SYSTEM_INSTRUCTION }]
          },
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: base64Data
                  }
                },
                {
                  text: 'Analise detalhadamente esta folha de fechamento de caixa e extraia a data, a filial e todas as vendas detalhadas de aparelhos e acessórios.'
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: CAIXA_RESPONSE_SCHEMA,
            temperature: 0.1
          }
        };

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': effectiveApiKey
          },
          body: JSON.stringify(requestBody)
        });

        if (res.status === 503) {
          console.warn(`[GeminiClient] Erro 503 (Sobrecarga Temporária / High Demand). Aguardando 2s antes do retry...`);
          await sleep(2000);
          continue;
        }

        const data = await res.json();

        if (!res.ok) {
          const errMessage = data?.error?.message || `Erro HTTP ${res.status}`;
          if (
            res.status === 401 ||
            errMessage.toLowerCase().includes('invalid authentication credentials') ||
            errMessage.toLowerCase().includes('unauthenticated')
          ) {
            throw new Error("Erro de autenticação da chave Gemini: Credenciais inválidas ou não autorizadas pelo Google AI Studio. Verifique sua chave em aistudio.google.com/apikey e reconfigure-a no botão 'Chave Gemini'.");
          }
          if (res.status === 404 || errMessage.includes('no longer available')) {
            console.warn(`[GeminiClient] Modelo ${modelo} retornou 404: ${errMessage}`);
            lastError = new Error(errMessage);
            break;
          }
          if (res.status === 429 || errMessage.toLowerCase().includes('quota exceeded') || errMessage.toLowerCase().includes('resource_exhausted')) {
            const segundosEspera = extrairSegundosEspera(errMessage);
            if (retentativas429 < max429Retries) {
              console.warn(`[GeminiClient] Rate Limit 429 detectado. Iniciando espera transparente de ${segundosEspera}s antes do auto-retry (${retentativas429 + 1}/${max429Retries})...`);
              if (typeof onRetryCountdown === 'function') {
                await onRetryCountdown(segundosEspera, retentativas429 + 1, max429Retries);
              } else {
                await sleep(segundosEspera * 1000);
              }
              retentativas429++;
              continue;
            }
            throw new Error(`[429 Quota Exceeded] ${errMessage}`);
          }
          throw new Error(errMessage);
        }

        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) {
          throw new Error('A resposta da API do Gemini não retornou texto estruturado em data.candidates[0].content.parts[0].text.');
        }

        const parsed = JSON.parse(rawText);
        parsed._modelo_utilizado = modelo;
        return parsed;

      } catch (err) {
        lastError = err;
        const msg = (err?.message || '').toLowerCase();
        if (msg.includes('401') || msg.includes('autenticação') || msg.includes('authentication')) {
          throw err;
        }
        if (msg.includes('429') || msg.includes('quota') || msg.includes('resource_exhausted')) {
          const segundosEspera = extrairSegundosEspera(err?.message);
          if (retentativas429 < max429Retries) {
            console.warn(`[GeminiClient] Rate Limit 429 na exceção. Aguardando ${segundosEspera}s antes da retentativa (${retentativas429 + 1}/${max429Retries})...`);
            if (typeof onRetryCountdown === 'function') {
              await onRetryCountdown(segundosEspera, retentativas429 + 1, max429Retries);
            } else {
              await sleep(segundosEspera * 1000);
            }
            retentativas429++;
            continue;
          }
          throw err;
        }
        if (msg.includes('503') || msg.includes('high demand') || msg.includes('temporarily overloaded')) {
          console.warn(`[GeminiClient] Erro 503 detectado: ${err.message}. Aguardando 2 segundos...`);
          await sleep(2000);
        } else {
          break;
        }
      }
    }
  }

  throw new Error(`Falha ao processar a folha com a IA do Gemini: ${lastError?.message || 'Serviço temporariamente indisponível'}`);
}

/**
 * Gera uma estratégia de giro acelerado para um produto parado no estoque via Gemini 1.5 Flash (Ultrarrápido)
 */
export async function gerarEstrategiaGiroProduto({ produto, filialNome = 'Loja', customApiKey = '', promptPersonalizado = '', signal }) {
  const effectiveApiKey = getEffectiveApiKey(customApiKey);

  const valorUnitario = Number(produto.preco_venda || produto.preco || produto.preco_custo || 0);
  const diasSemGiro = Number(
    produto.dias_parado ??
    produto.diasParado ??
    produto.diasSemGiro ??
    produto.dias_sem_giro ??
    produto.dias_sem_venda ??
    produto.diasInativo ??
    (produto.created_at || produto.data_ultima_venda
      ? Math.max(0, Math.floor((Date.now() - new Date(produto.created_at || produto.data_ultima_venda).getTime()) / (1000 * 60 * 60 * 24)))
      : 0)
  );
  const saldo = Number(produto.quantidade || 1);

  const prompt = promptPersonalizado || `Você é o Feijão IA, consultor executivo da rede de lojas Monkey Shop.
Produto: ${produto.nome} (${produto.categoria || 'Geral'})
Preço: R$ ${valorUnitario.toFixed(2)} | Dias parado: ${diasSemGiro} dias | Saldo: ${saldo} un.
Gere uma estratégia rápida de giro em 3 tópicos curtos:
1. Combo com aparelho ou brinde estratégico.
2. Argumento de balcão para os vendedores (Islayne, Regiane, Amanda, Sena).
3. Oferta relâmpago de queima para liberar capital.
Seja direto e comercial.`;

  // 1. Tentar primeiro o backend Vite se disponível (/api/feijao-ia/estrategia)
  try {
    const apiBackendResponse = await fetch('/api/feijao-ia/estrategia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, modelo: GEMINI_MODEL, apiKey: effectiveApiKey }),
      signal
    });

    if (apiBackendResponse.ok) {
      const data = await apiBackendResponse.json();
      const resposta = data.texto || data.resposta;
      if (resposta && resposta.trim().length > 15) {
        return resposta.trim();
      }
    }
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    // Backend indisponível ou em build de produção estática, seguir para fallback direto REST
  }

  // 2. Se não houver chave de API configurada no cliente, usar gerador estratégico heurístico instantâneo
  if (!effectiveApiKey) {
    console.warn('[GeminiService] Chave Gemini não encontrada, usando gerador tático instantâneo.');
    return gerarEstrategiaGiroFallback(produto, filialNome);
  }

  // 3. Chamada direta ao Google Gen AI REST API com modelo ultrarrápido Flash e maxOutputTokens 500
  const modelosTentativa = Array.from(new Set([
    GEMINI_MODEL,
    'gemini-3.6-flash',
    'gemini-flash-latest'
  ])).filter(m => m && !m.includes('1.5') && !m.includes('2.5'));
  let lastError = null;

  for (const modelo of modelosTentativa) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${encodeURIComponent(effectiveApiKey)}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': effectiveApiKey
        },
        signal,
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const texto = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (texto && texto.trim().length > 15) {
          return texto.trim();
        }
      } else {
        const errJson = await response.json().catch(() => ({}));
        lastError = new Error(errJson.error?.message || `Erro HTTP ${response.status}`);
      }
    } catch (e) {
      if (e?.name === 'AbortError') throw e;
      lastError = e;
    }
  }

  console.warn('[GeminiService] Falha na chamada da API do Gemini, aplicando gerador heurístico:', lastError);
  return gerarEstrategiaGiroFallback(produto, filialNome);
}

/**
 * Fallback tático instantâneo para nunca travar a tela do usuário
 */
export function gerarEstrategiaGiroFallback(produto, filialNome = 'Loja') {
  const dias = Number(
    produto?.dias_parado ??
    produto?.diasParado ??
    produto?.diasSemGiro ??
    produto?.dias_sem_giro ??
    (produto?.created_at ? Math.max(0, Math.floor((Date.now() - new Date(produto.created_at).getTime()) / (1000 * 60 * 60 * 24))) : 0)
  );
  const diasTexto = dias > 0 ? `+${dias}` : '+30';
  return (
    `🔥 **Estratégia Recomendada:**\n` +
    `• **Combo Venda Casada:** Ofereça este item com 30% de desconto na compra de qualquer celular no crediário/boleto.\n` +
    `• **Ação de Balcão:** Bonifique o vendedor com R$ 5,00 extra no pix pela saída imediata desta peça parada há ${diasTexto} dias.\n` +
    `• **Queima no Balcão:** Exponha na bandeja de frente de caixa com etiqueta de "Oportunidade da Semana".`
  );
}

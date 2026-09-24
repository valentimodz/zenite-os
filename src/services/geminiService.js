import { GoogleGenAI, Type } from '@google/genai';

/**
 * Schema estrito para estruturação de dados de fechamento de caixa diário via Gemini
 */
export const GEMINI_MODEL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_MODEL) ||
  (typeof process !== 'undefined' && (process.env?.VITE_GEMINI_MODEL || process.env?.GEMINI_MODEL)) ||
  'gemini-3.6-flash';

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
 * Executa o parse com IA através da API /api/ai/parse-caixa ou diretamente via SDK no cliente
 */
export async function parseCaixaComGeminiClient({ file, customApiKey = '' }) {
  const mimeType = file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
  const base64Data = await fileToBase64(file);

  // 1. Tentar primeiro o backend Vite (/api/ai/parse-caixa)
  try {
    const response = await fetch('/api/ai/parse-caixa', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileBase64: base64Data,
        mimeType: mimeType,
        apiKey: customApiKey
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

  // 2. Fallback resiliente: execução direta no navegador usando fetch nativo na API REST do Gemini
  const effectiveApiKey =
    customApiKey?.trim() ||
    localStorage.getItem('@zenite_gemini_api_key') ||
    import.meta.env.VITE_GEMINI_API_KEY ||
    import.meta.env.VITE_GOOGLE_GENAI_API_KEY ||
    '';

  if (!effectiveApiKey) {
    throw new Error('Chave da API Gemini não localizada. Por favor, adicione VITE_GEMINI_API_KEY no .env ou informe sua chave no campo.');
  }

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const modelosTentativa = Array.from(new Set([
    GEMINI_MODEL,
    'gemini-3.6-flash',
    'gemini-flash-latest'
  ])).filter(m => m && !m.includes('1.5') && !m.includes('2.5'));
  let lastError = null;

  for (const modelo of modelosTentativa) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${effectiveApiKey}`;

    for (let tentativa = 1; tentativa <= 3; tentativa++) {
      try {
        console.log(`[GeminiClient] Chamando REST API modelo "${modelo}" (tentativa ${tentativa}/3)...`);

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
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });

        if (res.status === 503) {
          console.warn(`[GeminiClient] Erro 503 (Sobrecarga Temporária / High Demand). Aguardando 2s antes do retry (${tentativa}/3)...`);
          await sleep(2000);
          continue;
        }

        const data = await res.json();

        if (!res.ok) {
          const errMessage = data?.error?.message || `Erro HTTP ${res.status}`;
          if (res.status === 404 || errMessage.includes('no longer available')) {
            console.warn(`[GeminiClient] Modelo ${modelo} retornou 404: ${errMessage}`);
            lastError = new Error(errMessage);
            break;
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
  const effectiveApiKey =
    customApiKey?.trim() ||
    localStorage.getItem('@zenite_gemini_api_key') ||
    import.meta.env.VITE_GEMINI_API_KEY ||
    import.meta.env.VITE_GOOGLE_GENAI_API_KEY ||
    '';

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
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${effectiveApiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

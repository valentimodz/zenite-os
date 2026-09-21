import { GoogleGenAI, Type } from '@google/genai';

/**
 * Schema estrito para estruturação de dados de fechamento de caixa diário via Gemini 2.0 Flash
 */
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
  const modelosTentativa = ['gemini-2.5-flash', 'gemini-flash-lite-latest', 'gemini-flash-latest'];
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
 * Gera uma estratégia de giro acelerado para um produto parado no estoque via Gemini 2.5
 */
export async function gerarEstrategiaGiroProduto({ produto, filialNome = 'Loja', customApiKey = '' }) {
  const effectiveApiKey =
    customApiKey?.trim() ||
    localStorage.getItem('@zenite_gemini_api_key') ||
    import.meta.env.VITE_GEMINI_API_KEY ||
    import.meta.env.VITE_GOOGLE_GENAI_API_KEY ||
    '';

  const valorUnitario = Number(produto.preco_venda || produto.preco || produto.preco_custo || 0);
  const diasSemGiro = Number(produto.dias_sem_giro || 30);

  // Fallback rápido se não houver chave de API configurada
  if (!effectiveApiKey) {
    console.warn('[GeminiService] Chave Gemini não encontrada, usando gerador estratégico heurístico.');
    return gerarEstrategiaGiroFallback(produto, filialNome);
  }

  const prompt = `Você é a Feijão IA, a inteligência artificial especialista em inteligência comercial e varejo de tecnologia da rede Zênite. Atue como uma estrategista comercial de varejo de celulares.
O produto a seguir está parado no estoque da filial ${filialNome}:
- Item: ${produto.nome}
- Categoria: ${produto.categoria || 'Celulares / Geral'}
- Quantidade Imobilizada: ${produto.quantidade || 1} un.
- Preço Unitário: R$ ${valorUnitario.toFixed(2)}
- Dias em Estoque: ${diasSemGiro} dias

Forneça um plano tático imediato com:
1. Oferta de Combinação/Cross-selling (ex.: condição com película, capinha ou financiamento PayJoy/Aiva)
2. Argumento de Venda Rápido para a equipe no balcão
3. Ação Comercial Imediata para desovar o lote esta semana`;

  const modelosTentativa = ['gemini-2.5-flash', 'gemini-flash-lite-latest', 'gemini-flash-latest'];
  let lastError = null;

  for (const modelo of modelosTentativa) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${effectiveApiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1000
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const texto = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (texto && texto.trim().length > 20) {
          return texto;
        }
      } else {
        const errJson = await response.json().catch(() => ({}));
        lastError = new Error(errJson.error?.message || `Erro HTTP ${response.status}`);
      }
    } catch (e) {
      lastError = e;
    }
  }

  console.warn('[GeminiService] Falha na chamada da API do Gemini, aplicando gerador heurístico:', lastError);
  return gerarEstrategiaGiroFallback(produto, filialNome);
}

/**
 * Fallback heurístico inteligente caso a API esteja temporariamente indisponível
 */
export function gerarEstrategiaGiroFallback(produto, filialNome = 'Loja') {
  const preco = Number(produto.preco_venda || produto.preco || produto.preco_custo || 0);
  const entradaBoleto = (preco * 0.15).toFixed(2);
  const parcelaEstimada = ((preco * 1.15) / 12).toFixed(2);

  return `### 1. Oferta de Combinação / Cross-selling (Acessórios & PayJoy/Aiva)
* **Combo Proteção Total**: Na compra do **${produto.nome}**, leve Capa Anti-Impacto + Película 3D com 50% de desconto ou grátis na entrada via PIX.
* **Condição PayJoy / Aiva**: Entrada facilitada de apenas **R$ ${entradaBoleto}** e saldo em parcelas acessíveis de ~R$ ${parcelaEstimada}/mês.

### 2. Argumento de Venda Rápido para a Equipe no Balcão
* *"Este modelo oferece excelente autonomia de bateria, tela de alta nitidez e suporte oficial. Conseguimos liberar uma condição autorizada pela diretoria exclusiva para esta unidade em estoque aqui na loja ${filialNome}."*
* *"Fechando hoje, já te entrego o aparelho com a película aplicada e todos os seus dados transferidos sem nenhum custo adicional."*

### 3. Ação Comercial Imediata para Desovar o Lote Esta Semana
* **Incentivo Direto aos Consultores**: Bônus de **R$ 25,00 a R$ 35,00 adicionais** pagos na hora para o consultor que faturar este item nas próximas 48 horas.
* **Vitrine & Ponto Focal**: Posicionar na prateleira central da loja ${filialNome} com tag *"Destaque da Semana - Condição Exclusiva"*.`;
}

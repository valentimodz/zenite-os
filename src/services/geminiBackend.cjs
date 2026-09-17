const { GoogleGenAI, Type } = require('@google/genai');

/**
 * Esquema estrito para extração de caixa com Gemini
 */
const CAIXA_RESPONSE_SCHEMA = {
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

const SYSTEM_INSTRUCTION = `Você é um perito em análise e digitação de folhas físicas de fechamento de caixa diário de lojas de varejo e celulares/smartphones (Monkey Shop).
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

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function parseCaixaComGemini({ fileBase64, mimeType, apiKey }) {
  if (!apiKey) {
    throw new Error('Chave da API Gemini não fornecida. Configure VITE_GEMINI_API_KEY no arquivo .env ou informe-a no modal.');
  }

  // Modelos para chamada direta REST
  const modelosTentativa = ['gemini-2.5-flash', 'gemini-flash-latest'];
  let lastError = null;

  for (const modelo of modelosTentativa) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`;

    for (let tentativa = 1; tentativa <= 3; tentativa++) {
      try {
        console.log(`[GeminiBackend] Chamando REST API modelo "${modelo}" (tentativa ${tentativa}/3)...`);

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
                    mimeType: mimeType || 'application/pdf',
                    data: fileBase64
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
          console.warn(`[GeminiBackend] Erro 503 (Sobrecarga Temporária / High Demand). Aguardando 2s antes do retry (${tentativa}/3)...`);
          await sleep(2000);
          continue;
        }

        const data = await res.json();

        if (!res.ok) {
          const errMessage = data?.error?.message || `Erro HTTP ${res.status}`;
          // Se for 404 de descontinuação de modelo para nova chave, tenta o modelo alternativo imediatamente
          if (res.status === 404 || errMessage.includes('no longer available')) {
            console.warn(`[GeminiBackend] Modelo ${modelo} retornou 404: ${errMessage}`);
            lastError = new Error(errMessage);
            break;
          }
          throw new Error(errMessage);
        }

        // 4. Parsear o retorno de data.candidates[0].content.parts[0].text como JSON estruturado
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
          console.warn(`[GeminiBackend] Erro 503 detectado: ${err.message}. Aguardando 2 segundos...`);
          await sleep(2000);
        } else {
          // Se for outro erro que não é 503 nem 404, interrompe as tentativas desse modelo
          break;
        }
      }
    }
  }

  throw new Error(`Falha na API Gemini: ${lastError?.message || 'Serviço temporariamente indisponível'}`);
}

module.exports = {
  parseCaixaComGemini,
  CAIXA_RESPONSE_SCHEMA,
  SYSTEM_INSTRUCTION
};

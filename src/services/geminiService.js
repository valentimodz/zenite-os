import { GoogleGenAI, Type } from '@google/genai';

/**
 * Schema estrito para estruturação de dados de fechamento de caixa diário via Gemini 2.5 Flash
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

  // 2. Fallback resiliente: execução direta no navegador usando @google/genai
  const effectiveApiKey =
    customApiKey?.trim() ||
    localStorage.getItem('@zenite_gemini_api_key') ||
    import.meta.env.VITE_GEMINI_API_KEY ||
    import.meta.env.VITE_GOOGLE_GENAI_API_KEY ||
    '';

  if (!effectiveApiKey) {
    throw new Error('Chave da API Gemini não localizada. Por favor, adicione VITE_GEMINI_API_KEY no .env ou informe sua chave no campo.');
  }

  const ai = new GoogleGenAI({ apiKey: effectiveApiKey });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
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
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: CAIXA_RESPONSE_SCHEMA,
      temperature: 0.1
    }
  });

  const text = response?.text;
  if (!text) {
    throw new Error('A IA não retornou nenhum dado legível a partir do arquivo enviado.');
  }

  return JSON.parse(text);
}

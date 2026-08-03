import Groq from 'groq-sdk';

/**
 * Fallback estático de alta conversão para os casos em que a IA estiver indisponível ou sem chave API.
 */
export function getStaticPromoFallback(cliente, vendas, promoType) {
  const nomeCliente = cliente?.nome ? cliente.nome.split(' ')[0] : 'Cliente';
  const ultimaVenda = vendas && vendas.length > 0 ? vendas[0] : null;
  const aparelhoComprado = ultimaVenda?.produto_nome || ultimaVenda?.produtos_descricao || 'aparelho';

  if (promoType === 'upgrade') {
    return `Olá, ${nomeCliente}! 🚀 Notamos que você tem o seu ${aparelhoComprado} com a gente. Que tal dar um upgrade para o modelo mais recente hoje com condições VIP exclusivas de carnê/troca na nossa loja? Responda este Whats para garantir sua oferta! 📱✨`;
  } else if (promoType === 'quitacao') {
    return `Parabéns, ${nomeCliente}! 🎉 Seu parcelamento do ${aparelhoComprado} está sendo concluído este mês! Temos uma condição especial de quitação com limite de crédito liberado na hora para você levar um aparelho novo. Bora conferir? 💳🔥`;
  } else {
    return `Fala ${nomeCliente}! 🎧 Selecionamos você para uma condição especial essa semana: 20% OFF em qualquer acessório premium (capa, película de nano-gel ou carregador rápido). É só apresentar este Whats na loja! 🛍️⚡`;
  }
}

/**
 * Gera copys dinâmicas com foco em conversão de vendas via Groq API (LLaMA 3.3 / LLaMA 3.1).
 * Usa requisição HTTP nativa (fetch) para compatibilidade perfeita no navegador.
 */
export async function generatePromoCopyAI(cliente, vendas, promoType) {
  const staticFallback = getStaticPromoFallback(cliente, vendas, promoType);
  
  try {
    const apiKey = import.meta.env.VITE_GROQ_API_KEY || (typeof process !== 'undefined' ? process.env.GROQ_API_KEY : '');
    
    if (!apiKey || !apiKey.trim()) {
      console.warn('Groq API Key (VITE_GROQ_API_KEY) não encontrada no .env. Utilizando template estático.');
      return { copy: staticFallback, isAI: false };
    }

    const nomeCliente = cliente?.nome ? cliente.nome.split(' ')[0] : 'Cliente';
    const totalCompras = vendas?.length || 0;
    const ultimaVenda = vendas && vendas.length > 0 ? vendas[0] : null;
    const aparelhoAtual = ultimaVenda?.produto_nome || ultimaVenda?.produtos_descricao || 'aparelho de celular';
    const financeira = ultimaVenda?.financeira_parceira || ultimaVenda?.metodo_pagamento || 'Carnê/PayJoy';
    const parcelas = ultimaVenda?.parcelas || 12;

    let objetivoPrompt = '';
    if (promoType === 'upgrade') {
      objetivoPrompt = `Convidar o cliente ${nomeCliente} para realizar um Upgrade / Troca do seu ${aparelhoAtual} atual por um modelo mais moderno. Enfatize parcelamento facilitado ou bônus na avaliação do seminovo.`;
    } else if (promoType === 'quitacao') {
      objetivoPrompt = `Informar e parabenizar o cliente ${nomeCliente} que seu carnê/financiamento no ${financeira} em ${parcelas}x do ${aparelhoAtual} está sendo quitado este mês e oferecer pré-aprovação de limite para um novo contrato.`;
    } else {
      objetivoPrompt = `Oferecer ao cliente ${nomeCliente} 20% de desconto exclusivo em acessórios (carregadores rápidos, capas reforçadas, películas nano-gel) para o seu ${aparelhoAtual}.`;
    }

    const systemPrompt = `Você é um especialista em vendas via WhatsApp para lojas de celulares e eletrônicos de tecnologia.
Seu objetivo é criar uma mensagem persuasiva, amigável, humanizada e focada em conversão para envio direto no WhatsApp.

REGRAS RÍGIDAS DE SEGURANÇA (GUARDRAILS):
1. A mensagem deve ter no máximo 4 linhas de texto.
2. Use emojis de forma estratégica e moderada (ex: 🚀, 📱, 🎉, 💳, ⚡).
3. NUNCA invente descontos em dinheiro ou valores fictícios que não foram fornecidos no contexto.
4. Mantenha o tom profissional, caloroso e de fácil leitura rápida em telas mobile.
5. Retorne APENAS o texto pronto da mensagem do WhatsApp, sem aspas, observações ou explicações antes/depois.`;

    const userPrompt = `Contexto do Cliente:
- Nome: ${nomeCliente}
- Aparelho Atual / Última Compra: ${aparelhoAtual}
- Forma de Pagamento/Financiamento: ${financeira} (${parcelas}x)
- Histórico: ${totalCompras} compra(s) na loja

Objetivo da Mensagem: ${objetivoPrompt}`;

    const makeApiCall = async (modelName) => {
      return await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey.trim()}`
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7,
          max_tokens: 250
        })
      });
    };

    // Tenta primeiro llama-3.3-70b-versatile
    let res = await makeApiCall('llama-3.3-70b-versatile');

    // Se falhar ou modelo não for encontrado, tenta llama-3.1-8b-instant
    if (!res.ok) {
      console.warn(`Tentativa com llama-3.3-70b-versatile retornou status ${res.status}. Tentando llama-3.1-8b-instant...`);
      res = await makeApiCall('llama-3.1-8b-instant');
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error(`Erro na API Groq (${res.status}):`, errText);
      return { copy: staticFallback, isAI: false };
    }

    const data = await res.json();
    const aiCopy = data.choices?.[0]?.message?.content?.trim();

    if (aiCopy) {
      return { copy: aiCopy, isAI: true };
    }
    return { copy: staticFallback, isAI: false };
  } catch (error) {
    console.error('Falha na requisição da Groq AI:', error);
    return { copy: staticFallback, isAI: false };
  }
}

/**
 * 1. O CÉREBRO MATEMÁTICO (Lógica Determinística)
 * Itera sobre os produtos e histórico de vendas para calcular métricas financeiras exatas sem alucinação da IA.
 */
export function calcularInsightsEstoque(produtos = [], vendas = []) {
  const agora = new Date();
  const trintaDiasAtras = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Mapear vendas dos últimos 30 dias por produto_id / nome
  const vendasRecentesMap = new Map();
  vendas.forEach(v => {
    const dataVenda = v.created_at ? new Date(v.created_at) : null;
    if (!dataVenda || dataVenda >= trintaDiasAtras) {
      const key = String(v.produto_id || v.produto_nome || '').toLowerCase();
      vendasRecentesMap.set(key, (vendasRecentesMap.get(key) || 0) + (parseInt(v.quantidade || 1, 10)));
    }
  });

  let capitalTotalEstoque = 0;
  let capitalParadoEncalhado = 0;
  let totalItensEstoque = 0;
  const produtosEncalhados = [];

  produtos.forEach(p => {
    const qtd = parseInt(p.quantidade || p.estoque || 0, 10);
    const precoVenda = parseFloat(p.preco || p.preco_venda || 0);
    // Se preço de custo não constar, estimar 70% do preço de venda para cálculo conservador
    const precoCusto = parseFloat(p.preco_custo || p.custo || (precoVenda * 0.7) || 0);
    
    const capitalItem = precoCusto * qtd;
    capitalTotalEstoque += capitalItem;
    totalItensEstoque += qtd;

    const keyId = String(p.id || '').toLowerCase();
    const keyNome = String(p.nome || '').toLowerCase();
    const vendas30Dias = (vendasRecentesMap.get(keyId) || 0) + (vendasRecentesMap.get(keyNome) || 0);

    // Produto encalhado: Estoque > 0 e 0 vendas nos últimos 30 dias
    if (qtd > 0 && vendas30Dias === 0) {
      capitalParadoEncalhado += capitalItem;
      produtosEncalhados.push({
        id: p.id,
        nome: p.nome || 'Produto Sem Nome',
        quantidade: qtd,
        precoCusto: precoCusto,
        capitalTotal: capitalItem,
        diasSemVenda: 30 // Mínimo de 30 dias sem giro
      });
    }
  });

  // Ordenar produtos encalhados pelo maior capital parado
  produtosEncalhados.sort((a, b) => b.capitalTotal - a.capitalTotal);
  const topEncalhado = produtosEncalhados.length > 0 ? produtosEncalhados[0] : null;

  return {
    totalProdutos: produtos.length,
    totalItensEstoque,
    capitalTotalEstoque,
    capitalParadoEncalhado,
    produtosEncalhadosCount: produtosEncalhados.length,
    produtosEncalhados,
    topEncalhado
  };
}

/**
 * 2. O CONSELHEIRO (Integração Groq LLM com Guardrails Matemáticos)
 * Recebe os dados calculados de forma exata e gera um diagnóstico executivo.
 */
export async function gerarConselhoFinanceiro(insights) {
  const { capitalParadoEncalhado, produtosEncalhadosCount, topEncalhado, capitalTotalEstoque } = insights;

  const capitalParadoStr = `R$ ${capitalParadoEncalhado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const topEncalhadoStr = topEncalhado 
    ? `${topEncalhado.nome} (${topEncalhado.quantidade} un - R$ ${topEncalhado.capitalTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
    : 'Nenhum item com encalhe crítico no momento';

  const staticFallback = `📊 ALERTA EXECUTIVO DE ESTOQUE:\nIdentificamos ${capitalParadoStr} imobilizados em ${produtosEncalhadosCount} produto(s) sem vendas nos últimos 30 dias, liderado por ${topEncalhadoStr}.\n💡 Recomendação Tática: Crie uma ação de liquidação no carnê/PayJoy com brinde de acessórios ou bônus de avaliação no seminovo para liberar capital de giro imediatamente!`;

  try {
    const apiKey = import.meta.env.VITE_GROQ_API_KEY || (typeof process !== 'undefined' ? process.env.GROQ_API_KEY : '');

    if (!apiKey || !apiKey.trim()) {
      return { conselho: staticFallback, isAI: false };
    }

    const systemPrompt = `Você é um consultor financeiro e estrategista de varejo sênior para lojas de celulares e eletrônicos.
Sua missão é ler dados matemáticos previamente calculados e redigir um alerta executivo conciso, direto e acionável para o dono da loja (máximo 3 a 4 linhas).

REGRAS RÍGIDAS DE SEGURANÇA E MATEMÁTICA (GUARDRAILS ANTI-ALUCINAÇÃO):
1. NUNCA invente ou altere qualquer número. Use estritamente o valor de capital imobilizado (${capitalParadoStr}) e os dados do produto (${topEncalhadoStr}) fornecidos no prompt.
2. Seja profissional, incisivo e focado em resultados financeiros (liberação de capital de giro e aceleração de fluxo de caixa).
3. Sugira 1 ou 2 ações táticas rápidas (ex: campanha de upgrade no WhatsApp, parcelamento facilitado no carnê, combo de acessórios).
4. Retorne APENAS o texto pronto do diagnóstico executivo, sem explicações ou saudações desnecessárias.`;

    const userPrompt = `DADOS FINANCEIROS REAIS CALCULADOS:
- Capital Total Imobilizado em Estoque Parado (>30 dias sem vendas): ${capitalParadoStr}
- Quantidade de Produtos Sem Giro: ${produtosEncalhadosCount} item(ns)
- Principal Item Encalhado (Maior Impacto de Caixa): ${topEncalhadoStr}
- Patrimônio Total em Estoque: R$ ${capitalTotalEstoque.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const makeApiCall = async (modelName) => {
      return await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey.trim()}`
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.5,
          max_tokens: 300
        })
      });
    };

    let res = await makeApiCall('llama-3.3-70b-versatile');
    if (!res.ok) {
      res = await makeApiCall('llama-3.1-8b-instant');
    }

    if (!res.ok) {
      return { conselho: staticFallback, isAI: false };
    }

    const data = await res.json();
    const aiText = data.choices?.[0]?.message?.content?.trim();

    if (aiText) {
      return { conselho: aiText, isAI: true };
    }
    return { conselho: staticFallback, isAI: false };
  } catch (err) {
    console.error('Erro ao gerar conselho financeiro via Groq AI:', err);
    return { conselho: staticFallback, isAI: false };
  }
}

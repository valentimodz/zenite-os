import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const groqApiKey = Deno.env.get('GROQ_API_KEY') ?? ''

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })

    // Parse Request Body
    const body = await req.json()
    console.log("🔥 [RECEBIDO WEBHOOK WHATSAPP]:", JSON.stringify(body))

    let numero_telefone = ""
    let mensagem_texto = ""
    let id_loja = "" // Maps to tenant_id (UUID of company) or instanceId

    // 1. Parsing robusto para diferentes providers de webhook
    
    // Evolution API Webhook
    if (body.data?.message?.conversation) {
      mensagem_texto = body.data.message.conversation
    } else if (body.data?.message?.extendedTextMessage?.text) {
      mensagem_texto = body.data.message.extendedTextMessage.text
    }
    if (body.data?.key?.remoteJid) {
      numero_telefone = body.data.key.remoteJid.split('@')[0]
    }
    if (body.instanceId) {
      id_loja = body.instanceId
    }

    // Z-API Webhook
    if (body.text?.message) {
      mensagem_texto = body.text.message
    }
    if (body.phone) {
      numero_telefone = body.phone
    }

    // Meta Cloud API Webhook
    if (body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body) {
      mensagem_texto = body.entry[0].changes[0].value.messages[0].text.body
      numero_telefone = body.entry[0].changes[0].value.messages[0].from
    }

    // Fallbacks para payload direto customizado
    if (!numero_telefone && body.numero_telefone) numero_telefone = String(body.numero_telefone)
    if (!mensagem_texto && body.mensagem_texto) mensagem_texto = body.mensagem_texto
    if (!id_loja && body.id_loja) id_loja = body.id_loja
    if (!id_loja && body.tenant_id) id_loja = body.tenant_id

    // Sanitização e validações iniciais
    numero_telefone = numero_telefone.trim().replace(/\D/g, '') // remove não dígitos
    
    if (!numero_telefone || !mensagem_texto) {
      return new Response(JSON.stringify({ error: "Faltam parâmetros obrigatórios: 'numero_telefone' e/ou 'mensagem_texto'." }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Resolução do Tenant / Loja
    let resolvedTenantId: string | null = null
    let nomeLoja = "Zenite Celulares"

    if (id_loja) {
      // Se id_loja for UUID, busca diretamente na tabela companies
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id_loja)
      
      if (isUuid) {
        resolvedTenantId = id_loja
        const { data: comp } = await supabase
          .from('companies')
          .select('nome')
          .eq('id', resolvedTenantId)
          .maybeSingle()
        if (comp?.nome) nomeLoja = comp.nome
      } else {
        // Se for um instance_id ou chave externa, tenta cruzar com whatsapp_configuracoes
        const { data: config } = await supabase
          .from('whatsapp_configuracoes')
          .select('tenant_id')
          .eq('instance_id', id_loja)
          .maybeSingle()
        
        if (config?.tenant_id) {
          resolvedTenantId = config.tenant_id
          const { data: comp } = await supabase
            .from('companies')
            .select('nome')
            .eq('id', resolvedTenantId)
            .maybeSingle()
          if (comp?.nome) nomeLoja = comp.nome
        }
      }
    }

    // Se ainda não resolveu o tenant, pega a primeira empresa cadastrada como fallback
    if (!resolvedTenantId) {
      const { data: firstComp } = await supabase
        .from('companies')
        .select('id, nome')
        .limit(1)
        .maybeSingle()
      if (firstComp) {
        resolvedTenantId = firstComp.id
        nomeLoja = firstComp.nome
      }
    }

    // 3. Salvar a nova mensagem do usuário no histórico (Auditoria / Contexto)
    if (resolvedTenantId) {
      await supabase.from('whatsapp_triagem_historico').insert({
        tenant_id: resolvedTenantId,
        numero_telefone,
        sender: 'user',
        mensagem_texto
      })
    }

    // 4. Carregar histórico de conversas recente (últimas 10 mensagens) para dar contexto à IA
    let contextMessages: any[] = []
    if (resolvedTenantId) {
      const { data: hist } = await supabase
        .from('whatsapp_triagem_historico')
        .select('sender, mensagem_texto')
        .eq('tenant_id', resolvedTenantId)
        .eq('numero_telefone', numero_telefone)
        .order('created_at', { ascending: true })
        .limit(10)
      
      if (hist && hist.length > 0) {
        contextMessages = hist.map(h => ({
          role: h.sender === 'user' ? 'user' : 'assistant',
          content: h.mensagem_texto
        }))
      }
    }

    // Se o histórico estiver vazio, inicializa com a mensagem atual
    if (contextMessages.length === 0) {
      contextMessages = [{ role: 'user', content: mensagem_texto }]
    }

    // 5. System Prompt & Guardrails
    const systemPrompt = `Você é um assistente de triagem da loja de celulares ${nomeLoja}. 
Seu ÚNICO objetivo é descobrir: 1) Qual aparelho o cliente quer comprar? 2) Ele tem um usado para dar na troca?
REGRAS INQUEBRÁVEIS:
- Você NÃO tem autorização para informar preços.
- Você NÃO pode dar descontos.
- Se o cliente perguntar preço ou condições de pagamento, responda EXATAMENTE: "Para te passar a melhor condição de pagamento e o preço com desconto, vou transferir você agora mesmo para um de nossos especialistas no balcão. Um momento, por favor!"`

    // Monta as mensagens para a API do Groq
    const groqMessages = [
      { role: 'system', content: systemPrompt },
      ...contextMessages
    ]

    // 6. Chamada para a API do Groq (LLaMA 3.3 / LLaMA 3.1)
    let replyText = ""
    
    if (!groqApiKey) {
      console.warn("⚠️ GROQ_API_KEY não configurada no Deno. Usando resposta estática de contingência.")
      replyText = "Para te passar a melhor condição de pagamento e o preço com desconto, vou transferir você agora mesmo para um de nossos especialistas no balcão. Um momento, por favor!"
    } else {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqApiKey}`
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: groqMessages,
            temperature: 0.5,
            max_tokens: 300
          })
        })

        if (!response.ok) {
          throw new Error(`Erro na API Groq: ${response.statusText}`)
        }

        const data = await response.json()
        replyText = data.choices?.[0]?.message?.content || ""
      } catch (err) {
        console.error("❌ Erro ao chamar Groq:", err)
        // Fallback de contingência
        replyText = "Olá! Entendido. Vou transferir o seu atendimento para um dos nossos consultores para te passar os modelos disponíveis e valores exatos. Um momento, por favor!"
      }
    }

    // 7. Salvar resposta da IA no histórico
    if (resolvedTenantId && replyText) {
      await supabase.from('whatsapp_triagem_historico').insert({
        tenant_id: resolvedTenantId,
        numero_telefone,
        sender: 'assistant',
        mensagem_texto: replyText
      })
    }

    // 8. Opcional: Enviar resposta de volta para a API do WhatsApp se estiver configurada
    if (resolvedTenantId) {
      const { data: config } = await supabase
        .from('whatsapp_configuracoes')
        .select('*')
        .eq('tenant_id', resolvedTenantId)
        .eq('active', true)
        .maybeSingle()
      
      if (config && config.api_url && config.api_token) {
        try {
          let requestUrl = ""
          let headers: HeadersInit = { "Content-Type": "application/json" }
          let requestBody = {}

          if (config.provider === 'evolution') {
            requestUrl = `${config.api_url}/message/sendText/${config.instance_id || 'default'}`
            headers["apikey"] = config.api_token
            requestBody = {
              number: numero_telefone,
              options: { delay: 1200, linkPreview: false },
              textMessage: { text: replyText }
            }
          } else if (config.provider === 'zapi') {
            const baseUrl = config.api_url.endsWith('/') ? config.api_url.slice(0, -1) : config.api_url;
            requestUrl = `${baseUrl}/instances/${config.instance_id}/token/${config.api_token}/send-text`;
            
            // Adicionar Client-Token header por padrão se Z-API exigir em instâncias pagas
            headers["Client-Token"] = config.api_token;
            
            requestBody = {
              phone: numero_telefone,
              message: replyText
            }
          }

          if (requestUrl) {
            const sendRes = await fetch(requestUrl, {
              method: 'POST',
              headers,
              body: JSON.stringify(requestBody)
            })
            console.log(`🤖 [WHATSAPP DISPATCHED]: Status ${sendRes.status}`)
          }
        } catch (sendErr) {
          console.error("❌ Falha ao enviar mensagem de volta para a API do WhatsApp:", sendErr)
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      sender: numero_telefone,
      response: replyText,
      nome_loja: nomeLoja
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error("❌ ERRO CRÍTICO NO WEBHOOK:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

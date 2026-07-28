import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado: Header de autorização ausente.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    // 1. Verificar se o chamador é o valentimodz@gmail.com
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user || user.email !== 'valentimodz@gmail.com') {
      return new Response(JSON.stringify({ error: 'Acesso Proibido: Apenas valentimodz@gmail.com pode gerenciar o provisionamento.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Cliente administrativo
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const body = await req.json()
    const { action, ...payload } = body

    // AÇÃO 1: Criar Empresa
    if (action === 'create-company') {
      const { nome } = payload
      if (!nome) {
        return new Response(JSON.stringify({ error: 'O nome da empresa é obrigatório.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: company, error: compError } = await adminClient
        .from('companies')
        .insert({ nome })
        .select()
        .single()

      if (compError) {
        return new Response(JSON.stringify({ error: compError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ success: true, company }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } 
    
    // AÇÃO 2: Provisionar Usuário
    if (action === 'provision-user') {
      const { email, password, role, empresa_id, nome } = payload
      
      if (!email || !password || !role || !empresa_id || !nome) {
        return new Response(JSON.stringify({ error: 'Todos os campos (email, password, role, empresa_id, nome) são obrigatórios.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Criar usuário no auth
      const { data: authUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          nome_completo: nome,
          role,
          empresa_id
        }
      })

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const userId = authUser.user.id

      // Obter o perfil criado pelo trigger
      const { data: profile } = await adminClient
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (profile) {
        // Se criou uma empresa dummy (para cargos diferentes de VENDEDOR)
        if (role !== 'VENDEDOR' && profile.empresa_id && profile.empresa_id !== empresa_id) {
          const dummyCompanyId = profile.empresa_id
          
          // Atualiza perfil para o tenant e cargos desejados
          await adminClient
            .from('profiles')
            .update({ empresa_id, role, nome })
            .eq('id', userId)
            
          // Deleta a empresa dummy gerada pelo trigger
          await adminClient
            .from('companies')
            .delete()
            .eq('id', dummyCompanyId)
        } else {
          // Apenas atualiza para ter certeza que bate com os valores informados
          await adminClient
            .from('profiles')
            .update({ empresa_id, role, nome })
            .eq('id', userId)
        }
      } else {
        // Fallback caso o trigger falhe
        await adminClient
          .from('profiles')
          .insert({
            id: userId,
            empresa_id,
            nome,
            role
          })
      }

      return new Response(JSON.stringify({ success: true, user: authUser.user }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Ação inválida.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

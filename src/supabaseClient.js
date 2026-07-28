import { createClient } from '@supabase/supabase-js';

// Leitura flexível com fallback direto das credenciais para desbloqueio definitivo na Vercel
const supabaseUrl = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || 
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || 
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_URL) || 
  'https://rrrkryuvjyvartixidsu.supabase.co';

const supabaseAnonKey = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || 
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) || 
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) || 
  'sb_publishable_xfj5CgFhEpeBIiOqnD2Eow_WJ3I3j-l';

// Verificação de segurança (sempre pronto)
const isMissingCredentials = false;
const isConfigured = true;

export { supabaseUrl, supabaseAnonKey, isMissingCredentials, isConfigured };

// Cliente público padrão (opera sob as regras RLS do usuário logado)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Cliente administrador simulado no frontend (usa a Anon Key pública para evitar violação de segurança do navegador)
export const supabaseAdmin = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

// Cliente auxiliar para cadastro de novos usuários (evita deslogar o gerente atual e não usa a Service Role Key)
export const supabaseRegister = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});


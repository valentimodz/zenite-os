import { createClient } from '@supabase/supabase-js';

// Leitura flexível para garantir captura em Vite, Next ou Vercel
const supabaseUrl = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || 
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || 
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_URL) || 
  '';

const supabaseAnonKey = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || 
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) || 
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) || 
  '';

// Verificação de segurança flexível
const isMissingCredentials = 
  !supabaseUrl || 
  !supabaseAnonKey || 
  supabaseUrl.includes('seu-url-do-supabase') ||
  supabaseUrl.includes('placeholder-project');

const isConfigured = !isMissingCredentials;

if (!isConfigured) {
  console.warn(
    'Supabase URL or Anon Key is missing. Please define VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  );
}

export { supabaseUrl, supabaseAnonKey, isMissingCredentials, isConfigured };

// Cliente público padrão (opera sob as regras RLS do usuário logado)
export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createClient('https://placeholder-project.supabase.co', 'placeholder-anon-key');

// Cliente administrador simulado no frontend (usa a Anon Key pública para evitar violação de segurança do navegador)
export const supabaseAdmin = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })
  : createClient('https://placeholder-project.supabase.co', 'placeholder-anon-key');

// Cliente auxiliar para cadastro de novos usuários (evita deslogar o gerente atual e não usa a Service Role Key)
export const supabaseRegister = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    })
  : createClient('https://placeholder-project.supabase.co', 'placeholder-anon-key');


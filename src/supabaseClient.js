import { createClient } from '@supabase/supabase-js';

const getEnv = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env;
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env;
  }
  return {};
};

const env = getEnv();
const supabaseUrl = env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || '';

const isConfigured = !!(supabaseUrl && supabaseAnonKey);

if (!isConfigured) {
  console.warn(
    'Supabase URL or Anon Key is missing. Please define VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
  );
}

// Cliente público padrão (opera sob as regras RLS do usuário logado)
// Se não estiver configurado, usa placeholders válidos para evitar crash imediato na importação
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


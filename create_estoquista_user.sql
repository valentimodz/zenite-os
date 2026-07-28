-- =========================================================================
-- SYSTEM MIGRATION: ADICIONAR ROLE 'ESTOQUISTA' E USUÁRIO DE ESTOQUE
-- Execute este script no SQL Editor do console do seu projeto Supabase
-- =========================================================================

-- 1. Atualizar a constraint de roles em public.profiles
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'GERENTE', 'VENDEDOR', 'RH_ADMIN', 'OWNER', 'ESTOQUISTA', 'RH', 'DONO'));

-- 2. Garantir a existência de permissão para estoquista em profiles
COMMENT ON CONSTRAINT profiles_role_check ON public.profiles IS 'Permite a função ESTOQUISTA para operadores de almoxarifado';

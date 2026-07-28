-- =========================================================================
-- SYSTEM MIGRATION: ADICIONAR ROLE 'RH' NA CONSTRAINT DE PROFILES
-- Execute este script no SQL Editor do console do seu projeto Supabase
-- =========================================================================

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'GERENTE', 'VENDEDOR', 'RH_ADMIN', 'OWNER', 'ESTOQUISTA', 'RH'));
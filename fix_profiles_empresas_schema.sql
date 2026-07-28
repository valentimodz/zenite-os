-- =========================================================================
-- SCRIPT DE ALINHAMENTO DE BANCO DE DADOS: PROFILES & EMPRESAS
-- Execute este script no SQL Editor do seu console Supabase
-- =========================================================================

-- 1. Compatibilidade entre public.companies e public.empresas
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'empresas') 
       AND NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'companies') THEN
        EXECUTE 'CREATE OR REPLACE VIEW public.companies AS SELECT * FROM public.empresas';
    ELSIF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'companies') 
       AND NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'empresas') THEN
        EXECUTE 'CREATE OR REPLACE VIEW public.empresas AS SELECT * FROM public.companies';
    END IF;
END $$;

-- 2. Garantir colunas essenciais na tabela public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS empresa_id uuid;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS filial_id uuid;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nome text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'VENDEDOR';

-- 3. Remover restrição antiga de role se existir para aceitar papéis expandidos
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 4. Habilitar RLS e aplicar políticas de leitura e atualização sem bloqueios
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de perfis para autenticados" ON public.profiles;
CREATE POLICY "Permitir leitura de perfis para autenticados" ON public.profiles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Usuários podem atualizar o próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Permitir atualização de perfis para gestão" ON public.profiles;

CREATE POLICY "Permitir atualização de perfis para gestão" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    id = auth.uid()
    OR (empresa_id = public.get_user_empresa_id() AND public.get_user_role() IN ('GERENTE', 'ADMIN', 'SUPER_ADMIN', 'OWNER', 'DONO', 'RH', 'RH_ADMIN'))
    OR public.get_user_role() IN ('ADMIN', 'SUPER_ADMIN', 'OWNER', 'DONO')
    OR (auth.jwt() ->> 'email') IN ('valentimodz@gmail.com', 'rodrigo.gerenciaredecred@gmail.com', 'rodrigo.gerenciamonkeyshop@gmail.com')
  );

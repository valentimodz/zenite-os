-- =========================================================================
-- SYSTEM MIGRATION: BUCKET PRIVADO E POLÍTICAS PARA CERTIFICADOS FISCAIS
-- Execute este script no SQL Editor do console do seu projeto Supabase
-- =========================================================================

-- 1. Criar o bucket de certificados como privado (public = false)
INSERT INTO storage.buckets (id, name, public)
VALUES ('fiscal-certificates', 'fiscal-certificates', false)
ON CONFLICT (id) DO NOTHING;

-- Habilitar RLS em storage.objects (normalmente já vem habilitado globalmente para storage)

-- 2. Política de INSERT: Permitir upload se a primeira pasta do path for o empresa_id do usuário
DROP POLICY IF EXISTS "Permitir upload de certificados da própria empresa" ON storage.objects;
CREATE POLICY "Permitir upload de certificados da própria empresa" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'fiscal-certificates'
    AND (storage.foldername(name))[1] = (public.get_user_empresa_id())::text
  );

-- 3. Política de SELECT: Permitir leitura se a primeira pasta do path for o empresa_id do usuário
DROP POLICY IF EXISTS "Permitir leitura de certificados da própria empresa" ON storage.objects;
CREATE POLICY "Permitir leitura de certificados da própria empresa" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'fiscal-certificates'
    AND (storage.foldername(name))[1] = (public.get_user_empresa_id())::text
  );

-- 4. Política de DELETE: Permitir deleção se o usuário for gestor e a primeira pasta do path for o empresa_id dele
DROP POLICY IF EXISTS "Permitir remoção de certificados por gestores" ON storage.objects;
CREATE POLICY "Permitir remoção de certificados por gestores" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'fiscal-certificates'
    AND (storage.foldername(name))[1] = (public.get_user_empresa_id())::text
    AND public.get_user_role() IN ('ADMIN', 'SUPER_ADMIN', 'GERENTE', 'OWNER')
  );

-- Script SQL para liberar permissão de EXCLUSÃO (DELETE) para Super Admin no Supabase

-- 1. Habilitar RLS se ainda não estiver ativo
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- 2. Remover políticas antigas de exclusão (se existirem)
DROP POLICY IF EXISTS "Super Admin pode deletar empresas" ON empresas;
DROP POLICY IF EXISTS "Super Admin pode deletar companies" ON companies;

-- 3. Criar política de exclusão irrestrita para a role 'authenticated' ou Super Admin em 'empresas'
CREATE POLICY "Super Admin pode deletar empresas"
ON empresas FOR DELETE
TO authenticated
USING (true);

-- 4. Criar política de exclusão irrestrita em 'companies'
CREATE POLICY "Super Admin pode deletar companies"
ON companies FOR DELETE
TO authenticated
USING (true);

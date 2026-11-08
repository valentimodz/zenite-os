-- Script SQL para atualizar as Políticas RLS (Row Level Security) na tabela public.metas
-- Execute este script no SQL Editor do Supabase se o salvamento de metas retornar erro de RLS (new row violates row-level security policy).

-- 1. Garantir RLS ativado na tabela metas
ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;

-- 2. Remover políticas antigas de metas
DROP POLICY IF EXISTS "Usuários podem ver as metas da própria empresa" ON public.metas;
DROP POLICY IF EXISTS "Apenas gestores autorizados podem gerenciar metas" ON public.metas;
DROP POLICY IF EXISTS "Leitura global de metas para autenticados" ON public.metas;
DROP POLICY IF EXISTS "Gestão global de metas para autenticados" ON public.metas;

-- 3. Criar política de leitura isolada por empresa para usuários autenticados
CREATE POLICY "Leitura de metas para autenticados"
ON public.metas
FOR SELECT
TO authenticated
USING (empresa_id = public.get_user_empresa_id() OR public.get_user_role() = 'SUPER_ADMIN');

-- 4. Criar política de gravação e atualização restrita a gestores da própria empresa
CREATE POLICY "Gestão de metas para autenticados"
ON public.metas
FOR ALL
TO authenticated
USING (
  (empresa_id = public.get_user_empresa_id() AND public.get_user_role() IN ('ADMIN', 'GERENTE', 'OWNER', 'DONO', 'RH_ADMIN', 'RH'))
  OR public.get_user_role() = 'SUPER_ADMIN'
)
WITH CHECK (
  (empresa_id = public.get_user_empresa_id() AND public.get_user_role() IN ('ADMIN', 'GERENTE', 'OWNER', 'DONO', 'RH_ADMIN', 'RH'))
  OR public.get_user_role() = 'SUPER_ADMIN'
);

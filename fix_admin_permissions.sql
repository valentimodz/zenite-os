-- =========================================================================
-- Correção Definitiva de Permissões: SuperAdmin (Vextron Lab)
-- =========================================================================

-- 1. Forçar o cargo de ADMIN para o Pedro Valentim diretamente na tabela profiles
UPDATE public.profiles
SET role = 'ADMIN'
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'valentimodz@gmail.com'
);

-- 2. Garantir que o e-mail do Pedro Valentim tenha privilégios máximos para gerenciar as empresas
DROP POLICY IF EXISTS "Usuários podem atualizar a própria empresa" ON public.companies;
CREATE POLICY "Usuários podem atualizar a própria empresa" ON public.companies
  FOR UPDATE TO authenticated
  USING (
    id = public.get_user_empresa_id()
    OR public.get_user_role() = 'ADMIN'
    OR (auth.jwt() ->> 'email') = 'valentimodz@gmail.com'
  );

-- 3. Garantir que o Pedro veja todas as empresas no painel
DROP POLICY IF EXISTS "Usuários podem ver a própria empresa" ON public.companies;
CREATE POLICY "Usuários podem ver a própria empresa" ON public.companies
  FOR SELECT TO authenticated
  USING (
    id = public.get_user_empresa_id()
    OR public.get_user_role() = 'ADMIN'
    OR (auth.jwt() ->> 'email') = 'valentimodz@gmail.com'
  );

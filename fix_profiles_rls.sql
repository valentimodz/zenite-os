-- =========================================================================================
-- CORREÇÃO DE RLS (ROW LEVEL SECURITY) DA TABELA PROFILES
-- Permite que usuários editem seu próprio perfil, ou que os e-mails administrativos 
-- (Dono e Gerente) possam gerenciar as informações de vendedores (como a 'meta_mensal').
-- =========================================================================================

DROP POLICY IF EXISTS "Usuários podem atualizar o próprio perfil" ON public.profiles;

CREATE POLICY "Usuários podem atualizar o próprio perfil" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    -- Permite editar se o perfil pertencer ao usuário logado
    id = auth.uid()
    -- OU se for Gerente/Admin/Dono/RH atualizando perfis dentro da própria empresa
    OR (empresa_id = public.get_user_empresa_id() AND public.get_user_role() IN ('GERENTE', 'ADMIN', 'SUPER_ADMIN', 'OWNER', 'DONO', 'RH', 'RH_ADMIN'))
    -- OU se for Admin global
    OR public.get_user_role() IN ('ADMIN', 'SUPER_ADMIN', 'OWNER', 'DONO')
    -- OU bypass forçado via email do JWT
    OR (auth.jwt() ->> 'email') IN ('valentimodz@gmail.com', 'rodrigo.gerenciaredecred@gmail.com', 'rodrigo.gerenciamonkeyshop@gmail.com')
  );

-- Opcional (Se futuramente precisar permitir exclusão física pelo Rodrigo):
DROP POLICY IF EXISTS "Usuários podem deletar perfil" ON public.profiles;

CREATE POLICY "Usuários podem deletar perfil" ON public.profiles
  FOR DELETE TO authenticated
  USING (
    -- Bypass forçado via email do JWT (Dono ou Rodrigo - Admin da Rede Cred)
    (auth.jwt() ->> 'email') IN ('valentimodz@gmail.com', 'rodrigo.gerenciaredecred@gmail.com')
  );

-- Atualização de Políticas RLS para o Modelo Matrix (Hub & Spoke)
-- Rode este script no SQL Editor do Supabase para aplicar o bloqueio de inserção em Lojas

-- 1. Políticas para a Tabela PRODUTOS
DROP POLICY IF EXISTS "Gerentes podem atualizar produtos" ON public.produtos;

CREATE POLICY "Gerentes podem atualizar produtos" ON public.produtos
  FOR UPDATE TO authenticated
  USING (
    empresa_id = public.get_user_empresa_id() AND public.get_user_role() = 'GERENTE'
    OR public.get_user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "Gerentes podem deletar produtos" ON public.produtos;
CREATE POLICY "Gerentes podem deletar produtos" ON public.produtos
  FOR DELETE TO authenticated
  USING (
    empresa_id = public.get_user_empresa_id() AND public.get_user_role() = 'GERENTE'
    OR public.get_user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "Gerentes podem inserir produtos apenas na Matriz (ESTOQUE)" ON public.produtos;
CREATE POLICY "Gerentes podem inserir produtos apenas na Matriz (ESTOQUE)" ON public.produtos
  FOR INSERT TO authenticated
  WITH CHECK (
    (empresa_id = public.get_user_empresa_id() AND public.get_user_role() = 'GERENTE'
     OR public.get_user_role() = 'ADMIN')
    AND
    EXISTS (SELECT 1 FROM public.filiais WHERE id = filial_id AND tipo = 'ESTOQUE')
  );


-- 2. Políticas para a Tabela IMEIS
DROP POLICY IF EXISTS "Usuários podem gerenciar imeis" ON public.imeis;

CREATE POLICY "Usuários podem atualizar imeis" ON public.imeis
  FOR UPDATE TO authenticated
  USING (
    empresa_id = public.get_user_empresa_id()
    OR public.get_user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "Usuários podem deletar imeis" ON public.imeis;
CREATE POLICY "Usuários podem deletar imeis" ON public.imeis
  FOR DELETE TO authenticated
  USING (
    empresa_id = public.get_user_empresa_id()
    OR public.get_user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "Usuários podem inserir imeis apenas na Matriz (ESTOQUE) ou via RPC" ON public.imeis;
CREATE POLICY "Usuários podem inserir imeis apenas na Matriz (ESTOQUE) ou via RPC" ON public.imeis
  FOR INSERT TO authenticated
  WITH CHECK (
    (empresa_id = public.get_user_empresa_id() OR public.get_user_role() = 'ADMIN')
    AND
    EXISTS (
      SELECT 1 FROM public.produtos p
      JOIN public.filiais f ON f.id = p.filial_id
      WHERE p.id = produto_id AND f.tipo = 'ESTOQUE'
    )
  );

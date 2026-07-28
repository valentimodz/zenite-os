-- Adiciona colunas de auditoria na tabela de fechamentos de caixa
ALTER TABLE fechamentos 
ADD COLUMN IF NOT EXISTS valores_originais JSONB,
ADD COLUMN IF NOT EXISTS alterado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS data_alteracao TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS motivo_alteracao TEXT;

-- Permite que gerentes, donos (OWNER) ou admins (incluindo SUPER_ADMIN) atualizem fechamentos da própria empresa
DROP POLICY IF EXISTS "Usuários autorizados podem atualizar fechamentos" ON public.fechamentos;
CREATE POLICY "Usuários autorizados podem atualizar fechamentos" ON public.fechamentos
  FOR UPDATE TO authenticated
  USING (
    (empresa_id = public.get_user_empresa_id() AND (public.get_user_role() = 'ADMIN' OR public.get_user_role() = 'GERENTE' OR public.get_user_role() = 'OWNER'))
    OR public.get_user_role() = 'SUPER_ADMIN'
  )
  WITH CHECK (
    (empresa_id = public.get_user_empresa_id() AND (public.get_user_role() = 'ADMIN' OR public.get_user_role() = 'GERENTE' OR public.get_user_role() = 'OWNER'))
    OR public.get_user_role() = 'SUPER_ADMIN'
  );

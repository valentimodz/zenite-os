-- =========================================================================
-- SYSTEM MIGRATION: CONTROLE RBAC, AUDITORIA DE VENDAS E TABELA CLIENTES
-- Execute este script no SQL Editor do console do seu projeto Supabase
-- =========================================================================

-- 1. Criar tabela de Clientes (se não existir)
CREATE TABLE IF NOT EXISTS public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  vendedor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  nome text NOT NULL,
  cpf_cnpj text,
  email text,
  telefone text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(empresa_id, cpf_cnpj)
);

-- 2. Habilitar RLS na tabela de clientes
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de RLS para a tabela de clientes
DROP POLICY IF EXISTS "Clientes SELECT policy" ON public.clientes;
CREATE POLICY "Clientes SELECT policy" ON public.clientes
  FOR SELECT TO authenticated
  USING (
    (public.get_user_role() IN ('ADMIN', 'SUPER_ADMIN', 'GERENTE', 'OWNER') AND empresa_id = public.get_user_empresa_id())
    OR (public.get_user_role() = 'VENDEDOR' AND vendedor_id = auth.uid())
  );

DROP POLICY IF EXISTS "Clientes INSERT policy" ON public.clientes;
CREATE POLICY "Clientes INSERT policy" ON public.clientes
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.get_user_role() IN ('ADMIN', 'SUPER_ADMIN', 'GERENTE', 'OWNER') AND empresa_id = public.get_user_empresa_id())
    OR (public.get_user_role() = 'VENDEDOR' AND vendedor_id = auth.uid())
  );

DROP POLICY IF EXISTS "Clientes UPDATE policy" ON public.clientes;
CREATE POLICY "Clientes UPDATE policy" ON public.clientes
  FOR UPDATE TO authenticated
  USING (
    (public.get_user_role() IN ('ADMIN', 'SUPER_ADMIN', 'GERENTE', 'OWNER') AND empresa_id = public.get_user_empresa_id())
    OR (public.get_user_role() = 'VENDEDOR' AND vendedor_id = auth.uid())
  )
  WITH CHECK (
    (public.get_user_role() IN ('ADMIN', 'SUPER_ADMIN', 'GERENTE', 'OWNER') AND empresa_id = public.get_user_empresa_id())
    OR (public.get_user_role() = 'VENDEDOR' AND vendedor_id = auth.uid())
  );

DROP POLICY IF EXISTS "Clientes DELETE policy" ON public.clientes;
CREATE POLICY "Clientes DELETE policy" ON public.clientes
  FOR DELETE TO authenticated
  USING (
    (public.get_user_role() IN ('ADMIN', 'SUPER_ADMIN', 'GERENTE', 'OWNER') AND empresa_id = public.get_user_empresa_id())
  );

-- 4. Atualizar a constraint de roles para permitir a role 'ESTOQUISTA'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'GERENTE', 'VENDEDOR', 'RH_ADMIN', 'OWNER', 'ESTOQUISTA'));

-- 5. Criar tabela de Auditoria de Vendas (sales_audit_logs)
CREATE TABLE IF NOT EXISTS public.sales_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL, -- ID do usuário que alterou
  venda_id uuid,
  changed_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  old_data jsonb NOT NULL,
  new_data jsonb NOT NULL,
  justificativa text NOT NULL
);

-- 6. Habilitar RLS na tabela de auditoria
ALTER TABLE public.sales_audit_logs ENABLE ROW LEVEL SECURITY;

-- 7. Criar políticas de RLS para a tabela de auditoria (apenas gestores e administradores podem visualizar)
DROP POLICY IF EXISTS "Usuários podem ver logs de auditoria da própria empresa" ON public.sales_audit_logs;
CREATE POLICY "Usuários podem ver logs de auditoria da própria empresa" ON public.sales_audit_logs
  FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN ('ADMIN', 'SUPER_ADMIN', 'GERENTE', 'OWNER')
  );

-- Permitir inserção de logs por usuários autenticados (utilizado pela função RPC)
DROP POLICY IF EXISTS "Usuários podem inserir logs de auditoria" ON public.sales_audit_logs;
CREATE POLICY "Usuários podem inserir logs de auditoria" ON public.sales_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 8. RPC para registrar a correção de venda com auditoria atômica
CREATE OR REPLACE FUNCTION public.corrigir_venda(
  p_venda_id uuid,
  p_new_qty integer,
  p_new_valor_total numeric,
  p_new_comissao numeric,
  p_justificativa text
)
RETURNS void AS $$
DECLARE
  v_old_data jsonb;
  v_new_data jsonb;
  v_user_role text;
BEGIN
  -- Verificar permissões (apenas ADMIN, SUPER_ADMIN, OWNER, GERENTE)
  SELECT role INTO v_user_role FROM public.profiles WHERE id = auth.uid();
  IF v_user_role NOT IN ('ADMIN', 'SUPER_ADMIN', 'GERENTE', 'OWNER') THEN
    RAISE EXCEPTION 'Acesso Negado: Apenas Administradores e Gerentes podem editar vendas concluídas.';
  END IF;

  -- Capturar dados antigos
  SELECT row_to_json(v) INTO v_old_data FROM public.vendas v WHERE id = p_venda_id;
  IF v_old_data IS NULL THEN
    RAISE EXCEPTION 'Venda não encontrada.';
  END IF;

  -- Atualizar a venda
  UPDATE public.vendas
  SET 
    quantidade = p_new_qty,
    valor_total = p_new_valor_total,
    comissao = p_new_comissao
  WHERE id = p_venda_id;

  -- Capturar dados novos
  SELECT row_to_json(v) INTO v_new_data FROM public.vendas v WHERE id = p_venda_id;

  -- Inserir log de auditoria
  INSERT INTO public.sales_audit_logs (
    vendedor_id,
    venda_id,
    old_data,
    new_data,
    justificativa
  ) VALUES (
    auth.uid(),
    p_venda_id,
    v_old_data,
    v_new_data,
    p_justificativa
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

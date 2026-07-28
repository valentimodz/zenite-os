-- =========================================================================================
-- CRIAÇÃO DA TABELA DE METAS MENSAIS E POLÍTICAS DE ACESSO (RLS)
-- =========================================================================================

-- 1. Criação da tabela
CREATE TABLE IF NOT EXISTS public.metas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  tenant_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  valor_meta numeric NOT NULL DEFAULT 0,
  mes_referencia text NOT NULL, -- Ex: '2026-06'
  tipo_meta text NOT NULL DEFAULT 'faturamento' CHECK (tipo_meta IN ('faturamento', 'quantidade', 'ativacao')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  -- Evitar duplicidade: um vendedor só pode ter uma meta por mês/referência
  UNIQUE(vendedor_id, mes_referencia)
);

-- 2. Ativar Row Level Security
ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de Leitura (SELECT)
-- Vendedores e admins podem ler as metas da sua própria empresa (tenant)
DROP POLICY IF EXISTS "Usuários podem ver as metas da própria empresa" ON public.metas;
CREATE POLICY "Usuários podem ver as metas da própria empresa" ON public.metas
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_empresa_id()
    OR public.get_user_role() = 'ADMIN'
  );

-- 4. Políticas de Escrita (INSERT, UPDATE, DELETE)
-- Gestores (GERENTE e ADMIN) e e-mails administrativos podem modificar as metas
DROP POLICY IF EXISTS "Apenas gestores autorizados podem gerenciar metas" ON public.metas;
CREATE POLICY "Apenas gestores autorizados podem gerenciar metas" ON public.metas
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'email') IN ('valentimodz@gmail.com', 'rodrigo.gerenciaredecred@gmail.com')
    OR public.get_user_role() = 'ADMIN'
    OR (public.get_user_role() = 'GERENTE' AND tenant_id = public.get_user_empresa_id())
  )
  WITH CHECK (
    (auth.jwt() ->> 'email') IN ('valentimodz@gmail.com', 'rodrigo.gerenciaredecred@gmail.com')
    OR public.get_user_role() = 'ADMIN'
    OR (public.get_user_role() = 'GERENTE' AND tenant_id = public.get_user_empresa_id())
  );

-- 5. Trigger de updated_at (Opcional, para manter histórico de edições limpo)
CREATE OR REPLACE FUNCTION public.set_updated_at_metas()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_updated_at_metas ON public.metas;
CREATE TRIGGER trigger_updated_at_metas
BEFORE UPDATE ON public.metas
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_metas();

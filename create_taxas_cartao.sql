-- =========================================================================
-- CRIAÇÃO DA TABELA DE TAXAS DE CARTÃO E INSTALAÇÃO DE VALORES PADRÃO
-- =========================================================================

-- 1. Criar tabela de taxas por parcelas
CREATE TABLE IF NOT EXISTS public.taxas_cartao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  parcelas integer NOT NULL CHECK (parcelas >= 1 AND parcelas <= 12),
  taxa numeric NOT NULL DEFAULT 0, -- Ex: 2.5 para 2.5%
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(tenant_id, parcelas)
);

-- 2. Habilitar Row Level Security (RLS)
ALTER TABLE public.taxas_cartao ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de acesso RLS
DROP POLICY IF EXISTS "Usuários podem ver taxas de cartão da própria empresa" ON public.taxas_cartao;
CREATE POLICY "Usuários podem ver taxas de cartão da própria empresa" ON public.taxas_cartao
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_empresa_id()
    OR public.get_user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "Gestores podem gerenciar taxas de cartão da própria empresa" ON public.taxas_cartao;
CREATE POLICY "Gestores podem gerenciar taxas de cartão da própria empresa" ON public.taxas_cartao
  FOR ALL TO authenticated
  USING (
    tenant_id = public.get_user_empresa_id() AND public.get_user_role() IN ('GERENTE', 'ADMIN')
    OR (auth.jwt() ->> 'email') IN ('valentimodz@gmail.com', 'rodrigo.gerenciaredecred@gmail.com', 'rodrigo.gerenciamonkeyshop@gmail.com')
  )
  WITH CHECK (
    tenant_id = public.get_user_empresa_id() AND public.get_user_role() IN ('GERENTE', 'ADMIN')
    OR (auth.jwt() ->> 'email') IN ('valentimodz@gmail.com', 'rodrigo.gerenciaredecred@gmail.com', 'rodrigo.gerenciamonkeyshop@gmail.com')
  );

-- 4. Adicionar coluna de telefone do cliente na tabela de vendas
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS cliente_telefone text;

-- 5. Inicializar taxas padrão de cartão para empresas existentes
INSERT INTO public.taxas_cartao (tenant_id, parcelas, taxa)
SELECT c.id, p.parcela, p.taxa
FROM public.companies c
CROSS JOIN (
  VALUES 
    (1, 1.5), (2, 2.5), (3, 3.5), (4, 4.5), (5, 5.5), (6, 6.5),
    (7, 7.5), (8, 8.5), (9, 9.5), (10, 10.5), (11, 11.5), (12, 12.5)
) AS p(parcela, taxa)
ON CONFLICT (tenant_id, parcelas) DO NOTHING;

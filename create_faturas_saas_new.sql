-- =========================================================================
-- ATUALIZAÇÃO: Módulo de Faturas SaaS e Gestão de Assinaturas
-- =========================================================================

-- 1. Remover tabela antiga de faturas se existir
DROP TABLE IF EXISTS public.faturas_saas CASCADE;

-- 2. Criar a nova tabela faturas_saas atrelada ao tenant_id (empresa)
CREATE TABLE public.faturas_saas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  valor_mensalidade numeric NOT NULL DEFAULT 0,
  data_vencimento date NOT NULL,
  status text NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'PAGO', 'ATRASADO')),
  link_pagamento text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Alterar a tabela de Empresas para incluir configurações de assinatura
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS dia_vencimento integer DEFAULT 10 CHECK (dia_vencimento >= 1 AND dia_vencimento <= 31),
ADD COLUMN IF NOT EXISTS telefone text;

-- 4. Habilitar RLS na tabela de faturas
ALTER TABLE public.faturas_saas ENABLE ROW LEVEL SECURITY;

-- 5. Recriar políticas de RLS para faturas_saas
DROP POLICY IF EXISTS "SuperAdmins podem ver todas as faturas" ON public.faturas_saas;
CREATE POLICY "SuperAdmins podem ver todas as faturas" ON public.faturas_saas
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'ADMIN'
    ) OR (auth.jwt() ->> 'email') = 'valentimodz@gmail.com'
  );

DROP POLICY IF EXISTS "Usuários podem ver faturas de sua própria empresa" ON public.faturas_saas;
CREATE POLICY "Usuários podem ver faturas de sua própria empresa" ON public.faturas_saas
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT empresa_id FROM public.profiles WHERE profiles.id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "SuperAdmins podem gerenciar faturas" ON public.faturas_saas;
CREATE POLICY "SuperAdmins podem gerenciar faturas" ON public.faturas_saas
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'ADMIN'
    ) OR (auth.jwt() ->> 'email') = 'valentimodz@gmail.com'
  );

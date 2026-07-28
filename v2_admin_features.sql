-- =========================================================================
-- Atualização V2: Relacionamento com Cliente e Diagnóstico
-- =========================================================================

-- 1. Tabela de Avisos Globais (Mural)
CREATE TABLE IF NOT EXISTS public.global_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.global_notices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Todos podem ler avisos ativos" ON public.global_notices;
CREATE POLICY "Todos podem ler avisos ativos" ON public.global_notices
  FOR SELECT TO authenticated
  USING (active = true OR public.get_user_role() = 'ADMIN' OR (auth.jwt() ->> 'email') = 'valentimodz@gmail.com');

DROP POLICY IF EXISTS "SuperAdmins podem gerenciar avisos" ON public.global_notices;
CREATE POLICY "SuperAdmins podem gerenciar avisos" ON public.global_notices
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'ADMIN' OR (auth.jwt() ->> 'email') = 'valentimodz@gmail.com');

-- 2. Tabela de Erros de Sistema (Diagnóstico)
CREATE TABLE IF NOT EXISTS public.system_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  empresa_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  error_message text NOT NULL,
  page_location text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.system_errors ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado pode INSERIR um erro (para capturar erros do frontend)
DROP POLICY IF EXISTS "Todos podem reportar erros" ON public.system_errors;
CREATE POLICY "Todos podem reportar erros" ON public.system_errors
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Apenas SuperAdmin pode LER os erros
DROP POLICY IF EXISTS "SuperAdmins podem ler erros" ON public.system_errors;
CREATE POLICY "SuperAdmins podem ler erros" ON public.system_errors
  FOR SELECT TO authenticated
  USING (public.get_user_role() = 'ADMIN' OR (auth.jwt() ->> 'email') = 'valentimodz@gmail.com');

-- 3. Atualizar Tabela de Faturas
ALTER TABLE public.faturas_saas
ADD COLUMN IF NOT EXISTS link_pagamento text;

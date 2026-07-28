-- =========================================================================
-- Atualização: Modo Manutenção e Histórico de Faturas SaaS
-- =========================================================================

-- 1. Adicionar coluna de Modo Manutenção na tabela de Empresas
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS em_manutencao boolean NOT NULL DEFAULT false;

-- 2. Criar tabela de Faturas SaaS (Histórico Financeiro)
CREATE TABLE IF NOT EXISTS public.faturas_saas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  mes_referencia text NOT NULL, -- Ex: '2026-06'
  valor numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Pago', 'Atrasado', 'Cancelado')),
  data_vencimento date,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS na tabela de faturas
ALTER TABLE public.faturas_saas ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para faturas_saas
DROP POLICY IF EXISTS "SuperAdmins podem ver todas as faturas" ON public.faturas_saas;
DROP POLICY IF EXISTS "Usuários podem ver as faturas da própria empresa" ON public.faturas_saas;
DROP POLICY IF EXISTS "SuperAdmins podem inserir faturas" ON public.faturas_saas;
DROP POLICY IF EXISTS "SuperAdmins podem atualizar faturas" ON public.faturas_saas;
DROP POLICY IF EXISTS "SuperAdmins podem deletar faturas" ON public.faturas_saas;

CREATE POLICY "SuperAdmins podem ver todas as faturas" ON public.faturas_saas
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'ADMIN'
    )
  );

CREATE POLICY "Usuários podem ver as faturas da própria empresa" ON public.faturas_saas
  FOR SELECT USING (
    empresa_id IN (
      SELECT empresa_id FROM public.profiles WHERE profiles.id = auth.uid()
    )
  );

CREATE POLICY "SuperAdmins podem inserir faturas" ON public.faturas_saas
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'ADMIN'
    )
  );

CREATE POLICY "SuperAdmins podem atualizar faturas" ON public.faturas_saas
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'ADMIN'
    )
  );

CREATE POLICY "SuperAdmins podem deletar faturas" ON public.faturas_saas
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'ADMIN'
    )
  );

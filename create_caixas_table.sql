-- =========================================================================
-- MIGRATION: TABELA DE CONTROLE E ABERTURA DE CAIXAS (MULTI-FILIAIS)
-- Execute este script no SQL Editor do console do seu projeto Supabase
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.caixas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  filial_id uuid REFERENCES public.filiais(id) ON DELETE CASCADE NOT NULL,
  filial_nome text,
  operador_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
  operador_nome text,
  saldo_inicial numeric NOT NULL DEFAULT 0,
  saldo_final numeric,
  total_dinheiro numeric DEFAULT 0,
  total_pix numeric DEFAULT 0,
  total_cartao numeric DEFAULT 0,
  total_outros numeric DEFAULT 0,
  total_vendas numeric DEFAULT 0,
  data_abertura timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  data_fechamento timestamp with time zone,
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'fechado')),
  observacoes_abertura text,
  observacoes_fechamento text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Garantir colunas se a tabela caixas já existia previamente
ALTER TABLE public.caixas ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.caixas ADD COLUMN IF NOT EXISTS filial_id uuid;
ALTER TABLE public.caixas ADD COLUMN IF NOT EXISTS filial_nome text;
ALTER TABLE public.caixas ADD COLUMN IF NOT EXISTS operador_id uuid;
ALTER TABLE public.caixas ADD COLUMN IF NOT EXISTS operador_nome text;
ALTER TABLE public.caixas ADD COLUMN IF NOT EXISTS saldo_inicial numeric DEFAULT 0;
ALTER TABLE public.caixas ADD COLUMN IF NOT EXISTS saldo_final numeric;
ALTER TABLE public.caixas ADD COLUMN IF NOT EXISTS data_abertura timestamp with time zone DEFAULT timezone('utc'::text, now());
ALTER TABLE public.caixas ADD COLUMN IF NOT EXISTS data_fechamento timestamp with time zone;
ALTER TABLE public.caixas ADD COLUMN IF NOT EXISTS status text DEFAULT 'aberto';
ALTER TABLE public.caixas ADD COLUMN IF NOT EXISTS observacoes_abertura text;
ALTER TABLE public.caixas ADD COLUMN IF NOT EXISTS observacoes_fechamento text;

-- Adicionar vínculo caixa_id na tabela vendas para fechar gaveta
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS caixa_id uuid REFERENCES public.caixas(id) ON DELETE SET NULL;

-- Índices de Alta Performance
CREATE INDEX IF NOT EXISTS idx_caixas_filial_status ON public.caixas(filial_id, status);
CREATE INDEX IF NOT EXISTS idx_caixas_empresa ON public.caixas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_caixas_operador ON public.caixas(operador_id);
CREATE INDEX IF NOT EXISTS idx_vendas_caixa_id ON public.vendas(caixa_id);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.caixas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Caixas SELECT policy" ON public.caixas;
CREATE POLICY "Caixas SELECT policy" ON public.caixas
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Caixas INSERT policy" ON public.caixas;
CREATE POLICY "Caixas INSERT policy" ON public.caixas
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Caixas UPDATE policy" ON public.caixas;
CREATE POLICY "Caixas UPDATE policy" ON public.caixas
  FOR UPDATE TO authenticated
  USING (true);

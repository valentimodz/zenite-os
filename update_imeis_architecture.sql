-- =========================================================================
-- SCRIPT DE MIGRACAO: SEPARACAO DE PRODUTO E ITEM FISICO (IMEI)
-- Execute este script no SQL Editor do console do seu projeto Supabase
-- =========================================================================

-- 1. Adicionar filial_id na tabela imeis referenciando a tabela filiais
ALTER TABLE public.imeis 
  ADD COLUMN IF NOT EXISTS filial_id uuid REFERENCES public.filiais(id) ON DELETE CASCADE;

-- 2. Garantir a existencia de cor na tabela imeis
ALTER TABLE public.imeis 
  ADD COLUMN IF NOT EXISTS cor text;

-- 3. Adicionar ou atualizar a constraint de status para suportar 'DISPONÍVEL' e 'VENDIDO' em caixa alta
ALTER TABLE public.imeis DROP CONSTRAINT IF EXISTS imeis_status_check;
ALTER TABLE public.imeis 
  ADD CONSTRAINT imeis_status_check CHECK (status IN ('Disponível', 'Vendido', 'Aguardando Revisão', 'DISPONÍVEL', 'VENDIDO', 'AGUARDANDO REVISÃO'));

-- 4. Definir default do status para 'DISPONÍVEL'
ALTER TABLE public.imeis 
  ALTER COLUMN status SET DEFAULT 'DISPONÍVEL';

-- 5. Tornar a coluna imei UNIQUE
ALTER TABLE public.imeis DROP CONSTRAINT IF EXISTS unique_imei_number;
ALTER TABLE public.imeis 
  ADD CONSTRAINT unique_imei_number UNIQUE (imei);

-- 6. Tornar filial_id opcional (nullable) na tabela produtos para servir como catalogo mestre
ALTER TABLE public.produtos 
  ALTER COLUMN filial_id DROP NOT NULL;

-- 7. Adicionar coluna cor na tabela produtos e produtos_catalogo
ALTER TABLE public.produtos 
  ADD COLUMN IF NOT EXISTS cor text;

ALTER TABLE public.produtos_catalogo 
  ADD COLUMN IF NOT EXISTS cor text;


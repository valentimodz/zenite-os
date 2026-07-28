-- =========================================================================
-- SYSTEM MIGRATION: ADICIONAR CAMPOS FISCAIS (CEST, CFOP, ORIGEM)
-- Execute este script no SQL Editor do console do seu projeto Supabase
-- =========================================================================

-- 1. Criar colunas na tabela produtos_catalogo (se não existirem)
ALTER TABLE public.produtos_catalogo
  ADD COLUMN IF NOT EXISTS cest text,
  ADD COLUMN IF NOT EXISTS cfop text,
  ADD COLUMN IF NOT EXISTS origem text DEFAULT '0';

-- 2. Criar colunas na tabela produtos (se não existirem)
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS cest text,
  ADD COLUMN IF NOT EXISTS cfop text,
  ADD COLUMN IF NOT EXISTS origem text DEFAULT '0';
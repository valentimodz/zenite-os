-- =========================================================================
-- SYSTEM MIGRATION: ADICIONAR DESCONTO_AUTORIZADO_POR NA TABELA VENDAS
-- Execute este script no SQL Editor do console do seu projeto Supabase
-- =========================================================================

ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS desconto_autorizado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
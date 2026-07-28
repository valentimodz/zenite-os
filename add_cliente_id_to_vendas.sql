-- =========================================================================
-- SYSTEM MIGRATION: ADICIONAR CLIENTE_ID NA TABELA VENDAS
-- Execute este script no SQL Editor do console do seu projeto Supabase
-- =========================================================================

ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL;
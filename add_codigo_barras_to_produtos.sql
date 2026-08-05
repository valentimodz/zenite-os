-- ============================================================
-- MIGRAÇÃO OBRIGATÓRIA — Execute no SQL Editor do Supabase
-- ============================================================
-- Esta coluna é necessária para que a busca por código de barras
-- funcione no Estoque Físico (Torre de Controlo e Estoque Consolidado).
-- 
-- Execute o comando abaixo no painel:
-- Supabase → SQL Editor → New Query → Cole e execute:
-- ============================================================

ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS codigo_barras text;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS sku text;

-- Após executar, clique em "Atualizar" no sistema para recarregar os dados.

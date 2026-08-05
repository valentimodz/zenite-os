-- Script para adicionar a coluna codigo_barras na tabela produtos (estoque físico)
-- Execute este script no SQL Editor do Supabase se a coluna ainda não existir.

ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS codigo_barras text;

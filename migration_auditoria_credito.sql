-- Script de Migração: Auditoria de Vendas & Crédito
-- Execute este script no SQL Editor do Supabase para adicionar as colunas necessárias.

-- 1. Adicionar coluna financeira_parceira na tabela de vendas
ALTER TABLE public.vendas 
ADD COLUMN IF NOT EXISTS financeira_parceira TEXT DEFAULT NULL;

-- 2. Adicionar coluna status_credito na tabela de clientes com valor padrão 'EM DIA'
ALTER TABLE public.clientes 
ADD COLUMN IF NOT EXISTS status_credito TEXT DEFAULT 'EM DIA';

-- 3. Garantir que clientes já existentes possuam status_credito inicial como 'EM DIA'
UPDATE public.clientes 
SET status_credito = 'EM DIA' 
WHERE status_credito IS NULL;

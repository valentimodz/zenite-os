-- =========================================================================
-- MIGRATION: PLANOS SAAS E STATUS DE ASSINATURA NAS EMPRESAS
-- Execute este script no SQL Editor do console Supabase
-- =========================================================================

-- 1. Adicionar coluna plano se não existir
ALTER TABLE public.companies 
  ADD COLUMN IF NOT EXISTS plano text DEFAULT 'START' CHECK (plano IN ('START', 'PRO', 'ULTIMATE'));

-- 2. Adicionar coluna status_assinatura se não existir
ALTER TABLE public.companies 
  ADD COLUMN IF NOT EXISTS status_assinatura text DEFAULT 'ATIVO' CHECK (status_assinatura IN ('ATIVO', 'BLOQUEADO'));

-- 3. Atualizar registros existentes para garantir que não fiquem nulos
UPDATE public.companies 
SET plano = 'START' 
WHERE plano IS NULL;

UPDATE public.companies 
SET status_assinatura = 'ATIVO' 
WHERE status_assinatura IS NULL;
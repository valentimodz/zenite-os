-- Script SQL para alinhar o CHECK CONSTRAINT metas_tipo_meta_check no Supabase
-- Execute este script no SQL Editor do Supabase se metas de vendedores falharem por restricao CHECK.

-- 1. Remover a restrição antiga se existir
ALTER TABLE public.metas DROP CONSTRAINT IF EXISTS metas_tipo_meta_check;

-- 2. Atualizar valores antigos em maiúsculas (se houver) para o padrão atual
UPDATE public.metas SET tipo_meta = 'faturamento' WHERE tipo_meta = 'FATURAMENTO_GERAL' OR tipo_meta IS NULL;
UPDATE public.metas SET tipo_meta = 'quantidade' WHERE tipo_meta = 'BOLETO';

-- 3. Criar a nova restrição permitindo tanto os valores atuais quanto legados
ALTER TABLE public.metas 
  ADD CONSTRAINT metas_tipo_meta_check 
  CHECK (tipo_meta IN ('faturamento', 'quantidade', 'ativacao', 'FATURAMENTO_GERAL', 'BOLETO'));

-- 4. Definir valor padrão
ALTER TABLE public.metas ALTER COLUMN tipo_meta SET DEFAULT 'faturamento';

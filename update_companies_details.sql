-- =========================================================================
-- ATUALIZAÇÃO: Nome Fantasia e Endereço da Empresa (Companies) para S.O.S
-- =========================================================================

-- 1. Adicionar colunas de Nome Fantasia e Endereço na tabela de Empresas
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS nome_fantasia text,
ADD COLUMN IF NOT EXISTS endereco text;

-- 2. Atualizar registros existentes com dados atuais para evitar nulos
UPDATE public.companies
SET nome_fantasia = nome,
    endereco = 'Endereço não cadastrado'
WHERE nome_fantasia IS NULL;

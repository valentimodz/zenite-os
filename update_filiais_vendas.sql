-- =========================================================================================
-- ATUALIZAÇÃO DE TABELAS: FILIAIS (DADOS) E VENDAS (TRAINEE)
-- =========================================================================================

-- 1. Adicionar colunas de CNPJ, Telefone e Endereço na tabela filiais
ALTER TABLE public.filiais 
ADD COLUMN IF NOT EXISTS cnpj text,
ADD COLUMN IF NOT EXISTS telefone text,
ADD COLUMN IF NOT EXISTS endereco text;

-- 2. Adicionar colunas para registro de participação de trainee na tabela de vendas
ALTER TABLE public.vendas
ADD COLUMN IF NOT EXISTS teve_participacao_trainee boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS comissao_trainee numeric DEFAULT 0;

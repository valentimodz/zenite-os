-- =========================================================================
-- SYSTEM MIGRATION: DATA DE NASCIMENTO E ENDEREÇO OBRIGATÓRIOS NA TABELA CLIENTES
-- Execute este script no SQL Editor do console do seu projeto Supabase
-- =========================================================================

-- 1. Criar colunas na tabela clientes (se não existirem)
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS data_nascimento date,
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS logradouro text,
  ADD COLUMN IF NOT EXISTS numero text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS uf text,
  ADD COLUMN IF NOT EXISTS complemento text;

-- 2. Atualizar as colunas existentes para garantir que não haja campos nulos
-- antes de aplicar a restrição NOT NULL (evitando erros de migração)
UPDATE public.clientes SET data_nascimento = '2000-01-01' WHERE data_nascimento IS NULL;
UPDATE public.clientes SET cep = '00000-000' WHERE cep IS NULL;
UPDATE public.clientes SET logradouro = 'Não informado' WHERE logradouro IS NULL;
UPDATE public.clientes SET numero = 'S/N' WHERE numero IS NULL;
UPDATE public.clientes SET bairro = 'Não informado' WHERE bairro IS NULL;
UPDATE public.clientes SET cidade = 'Não informado' WHERE cidade IS NULL;
UPDATE public.clientes SET uf = 'UF' WHERE uf IS NULL;

-- 3. Aplicar restrição NOT NULL para tornar os campos obrigatórios no banco
ALTER TABLE public.clientes 
  ALTER COLUMN nome SET NOT NULL,
  ALTER COLUMN cpf_cnpj SET NOT NULL,
  ALTER COLUMN email SET NOT NULL,
  ALTER COLUMN telefone SET NOT NULL,
  ALTER COLUMN data_nascimento SET NOT NULL,
  ALTER COLUMN cep SET NOT NULL,
  ALTER COLUMN logradouro SET NOT NULL,
  ALTER COLUMN numero SET NOT NULL,
  ALTER COLUMN bairro SET NOT NULL,
  ALTER COLUMN cidade SET NOT NULL,
  ALTER COLUMN uf SET NOT NULL;

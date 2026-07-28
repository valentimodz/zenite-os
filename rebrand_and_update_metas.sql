-- =========================================================================
-- MIGRAÇÃO DE BANCO: REBRANDING PARA REDE CRED & ATUALIZAÇÃO DE METAS
-- =========================================================================

-- 1. Rebranding do nome da empresa na tabela de empresas
UPDATE public.companies
SET nome = 'Rede Cred', nome_fantasia = 'Rede Cred'
WHERE nome = 'Monkey Shop LTDA' OR nome = 'Monkey Shop' OR nome_fantasia = 'Monkey Shop LTDA';

-- 2. Atualizar outros registros textuais que contêm Monkey Shop
UPDATE public.companies
SET nome = REPLACE(nome, 'Monkey Shop LTDA', 'Rede Cred')
WHERE nome LIKE '%Monkey Shop LTDA%';

UPDATE public.companies
SET nome = REPLACE(nome, 'Monkey Shop', 'Rede Cred')
WHERE nome LIKE '%Monkey Shop%';

-- 3. Atualizar o email do usuário do Rodrigo no Supabase Auth e perfis
UPDATE auth.users
SET email = 'rodrigo.gerenciaredecred@gmail.com'
WHERE email = 'rodrigo.gerenciamonkeyshop@gmail.com';

UPDATE public.profiles
SET email = 'rodrigo.gerenciaredecred@gmail.com'
WHERE email = 'rodrigo.gerenciamonkeyshop@gmail.com';

-- 4. Atualizar os dados das metas de vendas já existentes
UPDATE public.metas
SET tipo_meta = 'faturamento'
WHERE tipo_meta = 'FATURAMENTO_GERAL';

UPDATE public.metas
SET tipo_meta = 'quantidade'
WHERE tipo_meta = 'BOLETO';

-- 5. Atualizar o valor padrão e a restrição de verificação (check constraint)
ALTER TABLE public.metas ALTER COLUMN tipo_meta SET DEFAULT 'faturamento';

ALTER TABLE public.metas DROP CONSTRAINT IF EXISTS metas_tipo_meta_check;

ALTER TABLE public.metas ADD CONSTRAINT metas_tipo_meta_check CHECK (tipo_meta IN ('faturamento', 'quantidade', 'ativacao'));

-- =========================================================================
-- SYSTEM MIGRATION: CATEGORIAS E REMOÇÃO DE VALIDAÇÕES ESTÁTICAS DE CATEGORIA
-- Execute este script no SQL Editor do console do seu projeto Supabase
-- =========================================================================

-- 1. Criar tabela de Categorias
CREATE TABLE IF NOT EXISTS public.categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  nome text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(empresa_id, nome)
);

-- 2. Habilitar RLS na tabela de categorias
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;

-- 3. Criar Políticas de RLS para Categorias
DROP POLICY IF EXISTS "Usuários podem ver categorias da própria empresa" ON public.categorias;
CREATE POLICY "Usuários podem ver categorias da própria empresa" ON public.categorias
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.get_user_empresa_id()
    OR public.get_user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "Usuários podem gerenciar categorias" ON public.categorias;
CREATE POLICY "Usuários podem gerenciar categorias" ON public.categorias
  FOR ALL TO authenticated
  USING (
    empresa_id = public.get_user_empresa_id()
    OR public.get_user_role() = 'ADMIN'
  );

-- 4. Remover as restrições check de categoria nas tabelas produtos e produtos_catalogo
-- Nota: O PostgreSQL cria constraints de check automáticas baseadas no nome da coluna.
-- Removemos as restrições de check para permitir qualquer valor dinâmico.
ALTER TABLE public.produtos DROP CONSTRAINT IF EXISTS produtos_categoria_check;
ALTER TABLE public.produtos_catalogo DROP CONSTRAINT IF EXISTS produtos_catalogo_categoria_check;

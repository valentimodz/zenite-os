-- Script de Atualização de Políticas RLS para Leitura Global de Clientes
-- Execute este script no SQL Editor do Supabase se usuários enfrentarem tabela vazia devido a RLS.

-- 1. Habilitar RLS na tabela de clientes
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- 2. Remover políticas antigas de leitura restritivas
DROP POLICY IF EXISTS "Permitir leitura de clientes" ON public.clientes;
DROP POLICY IF EXISTS "Clientes read policy" ON public.clientes;
DROP POLICY IF EXISTS "Vendedores leem apenas seus clientes" ON public.clientes;
DROP POLICY IF EXISTS "Leitura de clientes por empresa" ON public.clientes;

-- 3. Criar política de leitura por empresa (Multi-Tenant Isolation)
CREATE POLICY "Leitura global de clientes" 
ON public.clientes 
FOR SELECT 
TO authenticated 
USING (empresa_id = public.get_user_empresa_id() OR public.get_user_role() = 'SUPER_ADMIN');

-- 4. Permissões de inserção e atualização por empresa para usuários autenticados
CREATE POLICY "Inserção global de clientes" 
ON public.clientes 
FOR INSERT 
TO authenticated 
WITH CHECK (empresa_id = public.get_user_empresa_id() OR public.get_user_role() = 'SUPER_ADMIN');

CREATE POLICY "Atualização global de clientes" 
ON public.clientes 
FOR UPDATE 
TO authenticated 
USING (empresa_id = public.get_user_empresa_id() OR public.get_user_role() = 'SUPER_ADMIN')
WITH CHECK (empresa_id = public.get_user_empresa_id() OR public.get_user_role() = 'SUPER_ADMIN');

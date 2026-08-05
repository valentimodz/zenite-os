-- Script para remover a restrição de nome único no Catálogo de Produtos
-- Execute este script no SQL Editor do Supabase para permitir cadastrar produtos com o mesmo nome (variações de cor, EAN ou modelos).

ALTER TABLE public.produtos_catalogo DROP CONSTRAINT IF EXISTS produtos_catalogo_empresa_id_nome_key;

-- =========================================================================
-- SYSTEM MIGRATION: AUDITORIA DE DESCONTOS, COLUNAS DE PREÇO E ITENS DE VENDA
-- Execute este script no SQL Editor do console do seu projeto Supabase
-- =========================================================================

-- 1. Adicionar colunas de rastreamento de descontos e preços na tabela 'vendas'
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS preco_base numeric DEFAULT 0;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS preco_unitario numeric DEFAULT 0;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS preco_unitario_vendido numeric DEFAULT 0;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS valor_tabela numeric DEFAULT 0;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS valor_desconto numeric DEFAULT 0;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS desconto numeric DEFAULT 0;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS total_desconto numeric DEFAULT 0;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS percentual_desconto numeric DEFAULT 0;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS vendedor_nome text;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS cliente_nome text;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS cliente_cpf_cnpj text;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS cliente_telefone text;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS cliente_email text;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS usuario_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS criado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS produtos_descricao text;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS itens_resumo text;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS status_pagamento text DEFAULT 'PAGO';
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS valor_pago numeric DEFAULT 0;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS financeira_parceira text;

-- 2. Criar ou atualizar tabela de Itens de Venda (itens_venda)
CREATE TABLE IF NOT EXISTS public.itens_venda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id uuid REFERENCES public.vendas(id) ON DELETE CASCADE,
  empresa_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  filial_id uuid REFERENCES public.filiais(id) ON DELETE CASCADE,
  vendedor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  produto_id uuid,
  produto_nome text NOT NULL,
  quantidade integer NOT NULL DEFAULT 1,
  imei text,
  preco_base numeric NOT NULL DEFAULT 0,
  preco_unitario numeric NOT NULL DEFAULT 0,
  preco_unitario_vendido numeric NOT NULL DEFAULT 0,
  valor_desconto numeric NOT NULL DEFAULT 0,
  desconto numeric NOT NULL DEFAULT 0,
  percentual_desconto numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Garantir todas as colunas caso a tabela itens_venda já existisse previamente
ALTER TABLE public.itens_venda ADD COLUMN IF NOT EXISTS preco_base numeric DEFAULT 0;
ALTER TABLE public.itens_venda ADD COLUMN IF NOT EXISTS preco_unitario numeric DEFAULT 0;
ALTER TABLE public.itens_venda ADD COLUMN IF NOT EXISTS preco_unitario_vendido numeric DEFAULT 0;
ALTER TABLE public.itens_venda ADD COLUMN IF NOT EXISTS valor_desconto numeric DEFAULT 0;
ALTER TABLE public.itens_venda ADD COLUMN IF NOT EXISTS desconto numeric DEFAULT 0;
ALTER TABLE public.itens_venda ADD COLUMN IF NOT EXISTS percentual_desconto numeric DEFAULT 0;
ALTER TABLE public.itens_venda ADD COLUMN IF NOT EXISTS valor_total numeric DEFAULT 0;
ALTER TABLE public.itens_venda ADD COLUMN IF NOT EXISTS produto_nome text;
ALTER TABLE public.itens_venda ADD COLUMN IF NOT EXISTS imei text;
ALTER TABLE public.itens_venda ADD COLUMN IF NOT EXISTS vendedor_id uuid;
ALTER TABLE public.itens_venda ADD COLUMN IF NOT EXISTS filial_id uuid;
ALTER TABLE public.itens_venda ADD COLUMN IF NOT EXISTS empresa_id uuid;
ALTER TABLE public.itens_venda ADD COLUMN IF NOT EXISTS venda_id uuid;
ALTER TABLE public.itens_venda ADD COLUMN IF NOT EXISTS produto_id uuid;

ALTER TABLE public.itens_venda ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Itens Venda SELECT policy" ON public.itens_venda;
CREATE POLICY "Itens Venda SELECT policy" ON public.itens_venda
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Itens Venda INSERT policy" ON public.itens_venda;
CREATE POLICY "Itens Venda INSERT policy" ON public.itens_venda
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 3. Criar tabela específica de Auditoria de Descontos (auditoria_descontos)
CREATE TABLE IF NOT EXISTS public.auditoria_descontos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  filial_id uuid REFERENCES public.filiais(id) ON DELETE CASCADE,
  filial_nome text,
  vendedor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  vendedor_nome text NOT NULL,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  cliente_nome text,
  venda_id uuid REFERENCES public.vendas(id) ON DELETE SET NULL,
  itens_resumo text,
  valor_tabela numeric NOT NULL DEFAULT 0,
  valor_final numeric NOT NULL DEFAULT 0,
  valor_desconto numeric NOT NULL DEFAULT 0,
  percentual_desconto numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.auditoria_descontos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auditoria Descontos SELECT policy" ON public.auditoria_descontos;
CREATE POLICY "Auditoria Descontos SELECT policy" ON public.auditoria_descontos
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Auditoria Descontos INSERT policy" ON public.auditoria_descontos;
CREATE POLICY "Auditoria Descontos INSERT policy" ON public.auditoria_descontos
  FOR INSERT TO authenticated
  WITH CHECK (true);

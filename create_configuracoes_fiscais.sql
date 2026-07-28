-- =========================================================================
-- ATUALIZAÇÃO: Estrutura para Notas Fiscais (NF-e / NFS-e) no Zênite OS
-- Execute este script no Supabase SQL Editor (Settings > SQL Editor)
-- =========================================================================

-- 1. Criar tabela de Configurações Fiscais por empresa/tenant
CREATE TABLE IF NOT EXISTS public.configuracoes_fiscais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL UNIQUE,
  cnpj text NOT NULL,
  inscricao_estadual text,
  inscricao_municipal text,
  regime_tributario text CHECK (regime_tributario IN ('Simples Nacional', 'Lucro Presumido')) NOT NULL DEFAULT 'Simples Nacional',
  certificado_a1_url text,
  certificado_senha_criptografada text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.configuracoes_fiscais ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para configuracoes_fiscais
DROP POLICY IF EXISTS "Usuários podem ver configurações fiscais da própria empresa" ON public.configuracoes_fiscais;
CREATE POLICY "Usuários podem ver configurações fiscais da própria empresa" ON public.configuracoes_fiscais
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_empresa_id()
    OR public.get_user_role() = 'ADMIN'
    OR (auth.jwt() ->> 'email') = 'valentimodz@gmail.com'
  );

DROP POLICY IF EXISTS "Usuários podem gerenciar configurações fiscais da própria empresa" ON public.configuracoes_fiscais;
CREATE POLICY "Usuários podem gerenciar configurações fiscais da própria empresa" ON public.configuracoes_fiscais
  FOR ALL TO authenticated
  USING (
    tenant_id = public.get_user_empresa_id()
    OR public.get_user_role() = 'ADMIN'
    OR (auth.jwt() ->> 'email') = 'valentimodz@gmail.com'
  );

-- 2. Adicionar coluna NCM nas tabelas de produtos (estoque e catálogo)
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS ncm text;
ALTER TABLE public.produtos_catalogo ADD COLUMN IF NOT EXISTS ncm text;

-- 3. Adicionar colunas de controle da NF-e e dados do cliente na tabela de vendas
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS nfe_status text CHECK (nfe_status IN ('PENDENTE', 'EMITIDA', 'ERRO')) DEFAULT 'PENDENTE';
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS nfe_id text;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS nfe_pdf_url text;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS nfe_xml_url text;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS nfe_erro_detalhe text;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS cliente_nome text;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS cliente_cpf_cnpj text;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS cliente_email text;

-- 4. Adicionar colunas de controle da NFS-e na tabela de faturas do SaaS
ALTER TABLE public.faturas_saas ADD COLUMN IF NOT EXISTS nfse_pdf_url text;
ALTER TABLE public.faturas_saas ADD COLUMN IF NOT EXISTS nfse_id text;

-- 5. Adicionar colunas faltantes de controle de mensalidade e dados da empresa (companies)
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS valor_mensalidade numeric DEFAULT 0;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS valor_setup numeric DEFAULT 0;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS dia_vencimento integer DEFAULT 10;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS telefone text;

-- 6. Categorização de Metas dos Vendedores
-- Valores aceites: 'FATURAMENTO_GERAL' (soma todas as vendas) | 'BOLETO' (filtra por metodo_pagamento = 'boleto')
ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS tipo_meta text
  CHECK (tipo_meta IN ('FATURAMENTO_GERAL', 'BOLETO'))
  NOT NULL DEFAULT 'FATURAMENTO_GERAL';

-- =========================================================================
-- REESTRUTURAÇÃO DO MÓDULO DE VENDAS E PAGAMENTOS (SUPABASE / POSTGRESQL)
-- Suporte a Pagamentos Parciais, Sinais e Contas a Receber
-- =========================================================================

-- 1. MODIFICAÇÃO DA TABELA 'vendas'
-- 1.1 Adicionar coluna 'valor_pago' (numeric, default 0)
ALTER TABLE public.vendas 
  ADD COLUMN IF NOT EXISTS valor_pago NUMERIC NOT NULL DEFAULT 0;

-- 1.2 Adicionar coluna 'status_pagamento' (varchar, default 'PAGO')
ALTER TABLE public.vendas 
  ADD COLUMN IF NOT EXISTS status_pagamento VARCHAR(20) NOT NULL DEFAULT 'PAGO';

ALTER TABLE public.vendas 
  ALTER COLUMN status_pagamento SET DEFAULT 'PAGO';

-- Aplicar constraint CHECK para valores válidos ('PENDENTE', 'PARCIAL', 'PAGO')
ALTER TABLE public.vendas DROP CONSTRAINT IF EXISTS vendas_status_pagamento_check;
ALTER TABLE public.vendas 
  ADD CONSTRAINT vendas_status_pagamento_check 
  CHECK (status_pagamento IN ('PENDENTE', 'PARCIAL', 'PAGO'));

-- 1.3 Adicionar/Garantir coluna 'cliente_id' e 'data_vencimento'
ALTER TABLE public.vendas 
  ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL;

ALTER TABLE public.vendas 
  ADD COLUMN IF NOT EXISTS data_vencimento DATE;

-- 1.4 Atualizar vendas legadas sem cliente cadastrado para 'PAGO' com valor_pago = valor_total
-- Isso evita falha na constraint de validação de cliente em registros passados
UPDATE public.vendas 
SET status_pagamento = 'PAGO', 
    valor_pago = COALESCE(valor_total, 0)
WHERE (status_pagamento = 'PENDENTE' OR status_pagamento IS NULL) 
  AND (valor_pago = 0 OR valor_pago IS NULL) 
  AND cliente_id IS NULL;

-- 1.5 Constraint: cliente_id é OBRIGATÓRIO se status_pagamento for 'PENDENTE' ou 'PARCIAL'
ALTER TABLE public.vendas DROP CONSTRAINT IF EXISTS check_cliente_obrigatorio_vendas;
ALTER TABLE public.vendas 
  ADD CONSTRAINT check_cliente_obrigatorio_vendas 
  CHECK (
    status_pagamento = 'PAGO' 
    OR cliente_id IS NOT NULL
  );

-- 2. CRIAÇÃO DA TABELA 'vendas_pagamentos' (A TABELA DO CAIXA)
CREATE TABLE IF NOT EXISTS public.vendas_pagamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id UUID NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
  valor_pago NUMERIC NOT NULL CHECK (valor_pago > 0),
  metodo_pagamento VARCHAR(20) NOT NULL CHECK (metodo_pagamento IN ('PIX', 'CARTAO', 'DINHEIRO')),
  data_pagamento TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  caixa_id UUID REFERENCES public.fechamentos(id) ON DELETE SET NULL,
  tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE
);

-- Índices de performance para otimizar pesquisas e consultas por tenant/caixa
CREATE INDEX IF NOT EXISTS idx_vendas_pagamentos_venda_id ON public.vendas_pagamentos(venda_id);
CREATE INDEX IF NOT EXISTS idx_vendas_pagamentos_tenant_id ON public.vendas_pagamentos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vendas_pagamentos_caixa_id ON public.vendas_pagamentos(caixa_id);

-- 3. POLÍTICAS DE SEGURANÇA (ROW LEVEL SECURITY - RLS)
ALTER TABLE public.vendas_pagamentos ENABLE ROW LEVEL SECURITY;

-- 3.1 Política para SELECT (Leitura por usuários autenticados da mesma empresa/tenant)
DROP POLICY IF EXISTS "Usuários podem ver pagamentos do mesmo tenant" ON public.vendas_pagamentos;
CREATE POLICY "Usuários podem ver pagamentos do mesmo tenant" ON public.vendas_pagamentos
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_empresa_id()
    OR public.get_user_role() IN ('ADMIN', 'SUPER_ADMIN', 'OWNER')
  );

-- 3.2 Política para INSERT (Inserção por usuários autenticados da mesma empresa/tenant)
DROP POLICY IF EXISTS "Usuários podem inserir pagamentos no seu tenant" ON public.vendas_pagamentos;
CREATE POLICY "Usuários podem inserir pagamentos no seu tenant" ON public.vendas_pagamentos
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_empresa_id()
    OR public.get_user_role() IN ('ADMIN', 'SUPER_ADMIN', 'OWNER')
  );

-- 3.3 Política para UPDATE (Edição por usuários autenticados da mesma empresa/tenant)
DROP POLICY IF EXISTS "Usuários podem atualizar pagamentos do seu tenant" ON public.vendas_pagamentos;
CREATE POLICY "Usuários podem atualizar pagamentos do seu tenant" ON public.vendas_pagamentos
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.get_user_empresa_id()
    OR public.get_user_role() IN ('ADMIN', 'SUPER_ADMIN', 'OWNER')
  )
  WITH CHECK (
    tenant_id = public.get_user_empresa_id()
    OR public.get_user_role() IN ('ADMIN', 'SUPER_ADMIN', 'OWNER')
  );

-- 3.4 Política para DELETE (Exclusão permitida para admins/gerentes do tenant)
DROP POLICY IF EXISTS "Usuários autorizados podem deletar pagamentos do seu tenant" ON public.vendas_pagamentos;
CREATE POLICY "Usuários autorizados podem deletar pagamentos do seu tenant" ON public.vendas_pagamentos
  FOR DELETE TO authenticated
  USING (
    (tenant_id = public.get_user_empresa_id() AND public.get_user_role() IN ('GERENTE', 'ADMIN', 'OWNER'))
    OR public.get_user_role() = 'SUPER_ADMIN'
  );

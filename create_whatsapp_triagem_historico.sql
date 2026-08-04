-- =========================================================================
-- CRIAÇÃO DA TABELA DE HISTÓRICO DE MENSAGENS E CONFIGURAÇÕES DA TRIAGEM IA
-- =========================================================================

-- 1. Tabela para salvar o histórico da conversa de triagem
CREATE TABLE IF NOT EXISTS public.whatsapp_triagem_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  numero_telefone VARCHAR(30) NOT NULL,
  sender VARCHAR(10) NOT NULL CHECK (sender IN ('user', 'assistant', 'system')),
  mensagem_texto TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices de performance para carregar histórico de conversas rapidamente
CREATE INDEX IF NOT EXISTS idx_wa_triagem_tenant_phone ON public.whatsapp_triagem_historico(tenant_id, numero_telefone);
CREATE INDEX IF NOT EXISTS idx_wa_triagem_created_at ON public.whatsapp_triagem_historico(created_at);

-- 2. Tabela opcional para configurações do webhook (Instâncias/Tokens do WhatsApp)
CREATE TABLE IF NOT EXISTS public.whatsapp_configuracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  provider VARCHAR(20) NOT NULL DEFAULT 'evolution' CHECK (provider IN ('evolution', 'zapi', 'meta')),
  api_url VARCHAR(255),
  api_token VARCHAR(255),
  instance_id VARCHAR(100),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS para políticas de segurança
ALTER TABLE public.whatsapp_triagem_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_configuracoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de histórico do mesmo tenant" ON public.whatsapp_triagem_historico;
CREATE POLICY "Permitir leitura de histórico do mesmo tenant" ON public.whatsapp_triagem_historico
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_empresa_id() OR public.get_user_role() IN ('ADMIN', 'SUPER_ADMIN', 'OWNER'));

DROP POLICY IF EXISTS "Permitir inserção de histórico do mesmo tenant" ON public.whatsapp_triagem_historico;
CREATE POLICY "Permitir inserção de histórico do mesmo tenant" ON public.whatsapp_triagem_historico
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_empresa_id() OR public.get_user_role() IN ('ADMIN', 'SUPER_ADMIN', 'OWNER'));

DROP POLICY IF EXISTS "Permitir leitura de configurações do mesmo tenant" ON public.whatsapp_configuracoes;
CREATE POLICY "Permitir leitura de configurações do mesmo tenant" ON public.whatsapp_configuracoes
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_empresa_id() OR public.get_user_role() IN ('ADMIN', 'SUPER_ADMIN', 'OWNER'));

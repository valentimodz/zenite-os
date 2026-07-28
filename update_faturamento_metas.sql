-- =========================================================================
-- Atualização: Metas Dinâmicas, Faturamento SaaS e Multi-tenancy
-- =========================================================================

-- 1. Adicionar colunas de Faturamento na tabela de Empresas
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS valor_mensalidade numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS valor_setup numeric NOT NULL DEFAULT 0;

-- 2. Adicionar coluna de Meta Mensal na tabela de Perfis
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS meta_mensal numeric NOT NULL DEFAULT 0;

-- 3. Função RPC para registrar nova empresa de forma isolada
-- Essa função cria uma nova empresa, gerando um UUID único garantido,
-- e um perfil de Gerente/Dono vinculado diretamente à essa empresa.
CREATE OR REPLACE FUNCTION public.registrar_nova_empresa_isolada(
  p_nome_empresa text,
  p_valor_mensalidade numeric,
  p_valor_setup numeric,
  p_email_dono text,
  p_nome_dono text
)
RETURNS json AS $$
DECLARE
  v_nova_empresa_id uuid;
  v_auth_user_id uuid;
BEGIN
  -- Cria a nova empresa isolada (o UUID gerado garante o multi-tenant_id)
  INSERT INTO public.companies (nome, valor_mensalidade, valor_setup, status)
  VALUES (p_nome_empresa, p_valor_mensalidade, p_valor_setup, 'ATIVO')
  RETURNING id INTO v_nova_empresa_id;

  -- NOTA: O usuário (Dono) deve ser criado via Auth do Supabase no front-end antes, 
  -- ou a Trigger de onboarding fará o bind. Caso estejamos cadastrando no painel Supremo, 
  -- precisaremos retornar apenas o UUID da empresa, para associarmos o dono depois,
  -- OU podemos criar uma regra que a criação do usuário sempre puxa do Auth.

  -- Retorna o UUID da nova empresa para uso no Frontend
  RETURN json_build_object('success', true, 'empresa_id', v_nova_empresa_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

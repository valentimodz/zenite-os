-- =========================================================================
-- SYSTEM MIGRATION: ADICIONAR PAPEL 'DONO' E CONFIGURAÇÕES DE NICHO
-- Execute este script no SQL Editor do console do seu projeto Supabase
-- =========================================================================

-- 1. Permitir papel 'DONO' na constraint de profiles
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'GERENTE', 'VENDEDOR', 'RH_ADMIN', 'OWNER', 'ESTOQUISTA', 'RH', 'DONO'));

-- 2. Adicionar coluna settings na tabela public.companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{"enable_troca": true, "enable_imei": true}'::jsonb;

-- 3. Atualizar block_preco_custo_for_admin para incluir 'DONO'
CREATE OR REPLACE FUNCTION block_preco_custo_for_admin()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  
  IF NEW.preco_custo IS DISTINCT FROM OLD.preco_custo THEN
    IF v_role NOT IN ('OWNER', 'DONO', 'SUPER_ADMIN') THEN
      RAISE EXCEPTION 'Acesso Negado: Apenas Sócios (OWNER/DONO) podem definir ou alterar o Preço de Custo.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Atualizar get_ceo_financial_kpis para incluir 'DONO'
CREATE OR REPLACE FUNCTION get_ceo_financial_kpis(p_empresa_id UUID)
RETURNS JSON AS $$
DECLARE
  v_role TEXT;
  v_faturamento_total NUMERIC := 0;
  v_custos_produtos NUMERIC := 0;
  v_comissoes_totais NUMERIC := 0;
  v_despesas_totais NUMERIC := 0;
  v_lucro_bruto NUMERIC := 0;
  v_ranking JSON;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  
  IF v_role NOT IN ('OWNER', 'DONO', 'SUPER_ADMIN') THEN
    RAISE EXCEPTION 'Acesso Negado: Você não tem permissão para acessar essa area.';
  END IF;

  SELECT 
    COALESCE(SUM(valor_total), 0),
    COALESCE(SUM(comissao), 0) + COALESCE(SUM(comissao_trainee), 0)
  INTO v_faturamento_total, v_comissoes_totais
  FROM public.vendas
  WHERE empresa_id = p_empresa_id
    AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE);

  SELECT 
    COALESCE(SUM(p.preco_custo * v.quantidade), 0)
  INTO v_custos_produtos
  FROM public.vendas v
  JOIN public.produtos_catalogo p ON v.produto_id = p.id
  WHERE v.empresa_id = p_empresa_id
    AND DATE_TRUNC('month', v.created_at) = DATE_TRUNC('month', CURRENT_DATE);

  v_despesas_totais := v_custos_produtos + v_comissoes_totais;
  v_lucro_bruto := v_faturamento_total - v_despesas_totais;

  SELECT json_agg(row_to_json(r))
  INTO v_ranking
  FROM (
    SELECT 
      f.nome AS filial_nome,
      COALESCE(SUM(v.valor_total), 0) AS faturamento
    FROM public.filiais f
    LEFT JOIN public.vendas v ON v.filial_id = f.id AND DATE_TRUNC('month', v.created_at) = DATE_TRUNC('month', CURRENT_DATE)
    WHERE f.empresa_id = p_empresa_id AND f.tipo = 'LOJA'
    GROUP BY f.id, f.nome
    ORDER BY faturamento DESC
  ) r;

  RETURN json_build_object(
    'faturamento_total', v_faturamento_total,
    'despesas_totais', v_despesas_totais,
    'lucro_bruto', v_lucro_bruto,
    'ranking_filiais', COALESCE(v_ranking, '[]'::json)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 0. Atualizar a constraint de roles para permitir a role 'OWNER'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'GERENTE', 'VENDEDOR', 'RH_ADMIN', 'OWNER'));

-- 1. Atualizar o utilizador Neto para a Role OWNER
UPDATE public.profiles 
SET role = 'OWNER' 
WHERE nome ILIKE '%Neto%';

-- 2. Adicionar preco_custo à tabela produtos_catalogo (se não existir)
ALTER TABLE public.produtos_catalogo 
ADD COLUMN IF NOT EXISTS preco_custo NUMERIC(10,2) DEFAULT 0;

-- 3. Função para garantir que apenas OWNER e SUPER_ADMIN podem alterar preco_custo
CREATE OR REPLACE FUNCTION block_preco_custo_for_admin()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Obter a role do utilizador atual
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  
  -- Se o preço de custo foi alterado e o utilizador não é OWNER nem SUPER_ADMIN
  IF NEW.preco_custo IS DISTINCT FROM OLD.preco_custo THEN
    IF v_role NOT IN ('OWNER', 'SUPER_ADMIN') THEN
      RAISE EXCEPTION 'Acesso Negado: Apenas Sócios (OWNER) podem definir ou alterar o Preço de Custo.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar o trigger na tabela produtos_catalogo
DROP TRIGGER IF EXISTS trg_block_preco_custo ON public.produtos_catalogo;
CREATE TRIGGER trg_block_preco_custo
BEFORE UPDATE ON public.produtos_catalogo
FOR EACH ROW
EXECUTE FUNCTION block_preco_custo_for_admin();

-- 4. Função Segura para os KPIs do CEO (Lucro Líquido, Custos Totais, etc)
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
  -- 1. Verificação Estrita de Segurança
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  
  IF v_role NOT IN ('OWNER', 'SUPER_ADMIN') THEN
    RAISE EXCEPTION 'Acesso Negado: Você não tem permissão para acessar essa area.';
  END IF;

  -- 2. Cálculos Financeiros Baseados nas Vendas (Mês Corrente)
  -- Faturamento e Comissões
  SELECT 
    COALESCE(SUM(valor_total), 0),
    COALESCE(SUM(comissao), 0) + COALESCE(SUM(comissao_trainee), 0)
  INTO v_faturamento_total, v_comissoes_totais
  FROM public.vendas
  WHERE empresa_id = p_empresa_id
    AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE);

  -- Custo dos Produtos Vendidos (Fazendo join com produtos para pegar o custo histórico ou catálogo)
  SELECT 
    COALESCE(SUM(p.preco_custo * v.quantidade), 0)
  INTO v_custos_produtos
  FROM public.vendas v
  JOIN public.produtos_catalogo p ON v.produto_id = p.id
  WHERE v.empresa_id = p_empresa_id
    AND DATE_TRUNC('month', v.created_at) = DATE_TRUNC('month', CURRENT_DATE);

  -- Despesas Totais = Custo dos Produtos + Comissões
  v_despesas_totais := v_custos_produtos + v_comissoes_totais;

  -- Lucro Bruto
  v_lucro_bruto := v_faturamento_total - v_despesas_totais;

  -- 3. Ranking de Filiais (Faturamento)
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

  -- 4. Retornar os Dados Formatados
  RETURN json_build_object(
    'faturamento_total', v_faturamento_total,
    'despesas_totais', v_despesas_totais,
    'lucro_bruto', v_lucro_bruto,
    'ranking_filiais', COALESCE(v_ranking, '[]'::JSON)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

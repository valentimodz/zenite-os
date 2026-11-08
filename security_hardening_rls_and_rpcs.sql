-- =========================================================================
-- ZENITE OS - SCRIPT CONSOLIDADO DE BLINDAGEM DE SEGURANÇA (RLS, TRIGGERS E RPCs)
-- Execute este script no SQL Editor do Supabase para aplicar todas as
-- correções da Auditoria de Segurança de uma só vez.
-- =========================================================================

-- 1. Hardening da Trigger de Onboarding (auth.users -> public.handle_new_user)
-- Impede auto-associação a tenants existentes via raw_user_meta_data não autenticado
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_company_id uuid;
  company_name text;
  full_name text;
BEGIN
  full_name := COALESCE(new.raw_user_meta_data->>'nome_completo', new.raw_user_meta_data->>'nome', 'Usuário');
  company_name := COALESCE(new.raw_user_meta_data->>'nome_empresa', 'Minha Nova Loja');

  INSERT INTO public.companies (nome)
  VALUES (company_name)
  RETURNING id INTO new_company_id;

  INSERT INTO public.profiles (id, empresa_id, nome, role)
  VALUES (new.id, new_company_id, full_name, 'GERENTE')
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

-- 2. Hardening da RPC get_ceo_financial_kpis (Isolamento Multi-Tenant)
CREATE OR REPLACE FUNCTION public.get_ceo_financial_kpis(p_empresa_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_caller_empresa_id UUID;
  v_faturamento_total NUMERIC := 0;
  v_custos_produtos NUMERIC := 0;
  v_comissoes_totais NUMERIC := 0;
  v_despesas_totais NUMERIC := 0;
  v_lucro_bruto NUMERIC := 0;
  v_ranking JSON;
BEGIN
  SELECT role, empresa_id INTO v_role, v_caller_empresa_id FROM public.profiles WHERE id = auth.uid();

  IF v_role NOT IN ('OWNER', 'DONO', 'SUPER_ADMIN') THEN
    RAISE EXCEPTION 'Acesso Negado: Você não tem permissão para acessar essa area.';
  END IF;

  IF v_role <> 'SUPER_ADMIN' AND (v_caller_empresa_id IS NULL OR v_caller_empresa_id IS DISTINCT FROM p_empresa_id) THEN
    RAISE EXCEPTION 'Acesso Negado: Escopo de empresa inválido para o seu perfil.';
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
$$;

-- 3. Hardening da RPC corrigir_venda (Isolamento Multi-Tenant)
CREATE OR REPLACE FUNCTION public.corrigir_venda(
  p_venda_id uuid,
  p_new_qty integer,
  p_new_valor_total numeric,
  p_new_comissao numeric,
  p_justificativa text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_data jsonb;
  v_new_data jsonb;
  v_user_role text;
  v_user_empresa_id uuid;
  v_venda_empresa_id uuid;
BEGIN
  SELECT role, empresa_id INTO v_user_role, v_user_empresa_id FROM public.profiles WHERE id = auth.uid();
  IF v_user_role NOT IN ('ADMIN', 'SUPER_ADMIN', 'GERENTE', 'OWNER', 'DONO') THEN
    RAISE EXCEPTION 'Acesso Negado: Apenas Administradores e Gerentes podem editar vendas concluídas.';
  END IF;

  SELECT row_to_json(v), v.empresa_id INTO v_old_data, v_venda_empresa_id FROM public.vendas v WHERE id = p_venda_id;
  IF v_old_data IS NULL THEN
    RAISE EXCEPTION 'Venda não encontrada.';
  END IF;

  IF v_user_role <> 'SUPER_ADMIN' AND (v_user_empresa_id IS NULL OR v_user_empresa_id IS DISTINCT FROM v_venda_empresa_id) THEN
    RAISE EXCEPTION 'Acesso Negado: Não é permitido alterar vendas de outra empresa.';
  END IF;

  UPDATE public.vendas
  SET
    quantidade = p_new_qty,
    valor_total = p_new_valor_total,
    comissao = p_new_comissao
  WHERE id = p_venda_id AND empresa_id = v_venda_empresa_id;

  SELECT row_to_json(v) INTO v_new_data FROM public.vendas v WHERE id = p_venda_id;

  INSERT INTO public.sales_audit_logs (
    vendedor_id,
    venda_id,
    old_data,
    new_data,
    justificativa
  ) VALUES (
    auth.uid(),
    p_venda_id,
    v_old_data,
    v_new_data,
    p_justificativa
  );
END;
$$;

-- 4. Hardening das RPCs de Transferência (registrar_transferencia_saida e confirmar_recebimento_transferencia)
CREATE OR REPLACE FUNCTION public.registrar_transferencia_saida(
  p_empresa_id uuid,
  p_filial_origem_id uuid,
  p_filial_destino_id uuid,
  p_criado_por uuid,
  p_observacoes text,
  p_itens_json jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transferencia_id uuid;
  v_item jsonb;
  v_criado_por_profile_id uuid;
  v_caller_empresa_id uuid;
  v_caller_role text;
BEGIN
  SELECT empresa_id, role INTO v_caller_empresa_id, v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF v_caller_role IS DISTINCT FROM 'SUPER_ADMIN' AND (v_caller_empresa_id IS NULL OR v_caller_empresa_id IS DISTINCT FROM p_empresa_id) THEN
    RAISE EXCEPTION 'Acesso Negado: Não é permitido criar transferências para outra empresa.';
  END IF;

  INSERT INTO public.transferencias (
    empresa_id, filial_origem_id, filial_destino_id, criado_por, status, observacoes
  ) VALUES (
    p_empresa_id, p_filial_origem_id, p_filial_destino_id, auth.uid(), 'EM_TRANSITO', p_observacoes
  )
  RETURNING id INTO v_transferencia_id;

  SELECT id INTO v_criado_por_profile_id FROM public.profiles WHERE id = auth.uid();

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens_json) LOOP
    INSERT INTO public.transferencias_itens (
      transferencia_id, imei, produto_id, nome, tipo, categoria, quantidade
    ) VALUES (
      v_transferencia_id,
      v_item->>'imei',
      (v_item->>'produto_id')::uuid,
      v_item->>'nome',
      v_item->>'tipo',
      v_item->>'categoria',
      COALESCE((v_item->>'quantidade')::integer, 1)
    );

    UPDATE public.imeis
    SET status = 'EM_TRANSITO'
    WHERE imei = v_item->>'imei'
      AND empresa_id = p_empresa_id;

    INSERT INTO public.estoque_movimentacoes (
      empresa_id, produto_id, imei, tipo_movimentacao, filial_origem_id, filial_destino_id, quantidade, observacao, criado_por
    ) VALUES (
      p_empresa_id,
      (v_item->>'produto_id')::uuid,
      v_item->>'imei',
      'TRANSFERENCIA_SAIDA',
      p_filial_origem_id,
      p_filial_destino_id,
      COALESCE((v_item->>'quantidade')::integer, 1),
      COALESCE(p_observacoes, 'Transferência de estoque enviada.'),
      v_criado_por_profile_id
    );
  END LOOP;

  RETURN json_build_object('transferencia_id', v_transferencia_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.confirmar_recebimento_transferencia(
  p_transferencia_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_transferencia RECORD;
  v_dest_prod_id uuid;
  v_dest_prod_nome text;
  v_dest_prod_tipo text;
  v_dest_prod_cat text;
  v_dest_prod_preco numeric;
  v_caller_empresa_id uuid;
  v_caller_role text;
BEGIN
  SELECT empresa_id, role INTO v_caller_empresa_id, v_caller_role FROM public.profiles WHERE id = auth.uid();

  SELECT * INTO v_transferencia
  FROM public.transferencias
  WHERE id = p_transferencia_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transferência não encontrada: %', p_transferencia_id;
  END IF;

  IF v_caller_role IS DISTINCT FROM 'SUPER_ADMIN' AND (v_caller_empresa_id IS NULL OR v_caller_empresa_id IS DISTINCT FROM v_transferencia.empresa_id) THEN
    RAISE EXCEPTION 'Acesso Negado: Transferência pertence a outra empresa.';
  END IF;

  FOR v_item IN
    SELECT ti.imei, ti.produto_id
    FROM public.transferencias_itens ti
    WHERE ti.transferencia_id = p_transferencia_id
  LOOP
    SELECT nome, tipo, categoria, preco
    INTO v_dest_prod_nome, v_dest_prod_tipo, v_dest_prod_cat, v_dest_prod_preco
    FROM public.produtos
    WHERE id = v_item.produto_id;

    SELECT id INTO v_dest_prod_id
    FROM public.produtos
    WHERE filial_id = v_transferencia.filial_destino_id
      AND empresa_id = v_transferencia.empresa_id
      AND nome = v_dest_prod_nome
    LIMIT 1;

    IF v_dest_prod_id IS NOT NULL THEN
      UPDATE public.produtos SET quantidade = quantidade + 1 WHERE id = v_dest_prod_id;
    ELSE
      INSERT INTO public.produtos (empresa_id, filial_id, nome, tipo, categoria, preco, quantidade)
      VALUES (v_transferencia.empresa_id, v_transferencia.filial_destino_id, v_dest_prod_nome, v_dest_prod_tipo, v_dest_prod_cat, COALESCE(v_dest_prod_preco, 0), 1)
      RETURNING id INTO v_dest_prod_id;
    END IF;

    UPDATE public.produtos
    SET quantidade = GREATEST(0, quantidade - 1)
    WHERE id = v_item.produto_id
      AND empresa_id = v_transferencia.empresa_id;

    UPDATE public.imeis
    SET status = 'DISPONÍVEL',
        filial_id = v_transferencia.filial_destino_id,
        produto_id = v_dest_prod_id
    WHERE imei = v_item.imei
      AND empresa_id = v_transferencia.empresa_id;

    INSERT INTO public.estoque_movimentacoes (
      empresa_id, produto_id, imei, tipo_movimentacao, filial_origem_id, filial_destino_id, quantidade, observacao
    ) VALUES (
      v_transferencia.empresa_id,
      v_dest_prod_id,
      v_item.imei,
      'TRANSFERENCIA_ENTRADA',
      v_transferencia.filial_origem_id,
      v_transferencia.filial_destino_id,
      1,
      'Transferência de estoque recebida e confirmada.'
    );
  END LOOP;

  UPDATE public.transferencias
  SET status = 'CONCLUIDA', updated_at = now()
  WHERE id = p_transferencia_id;
END;
$$;

-- 5. Hardening da RPC registrar_nova_empresa_isolada (Restrita ao SUPER_ADMIN)
CREATE OR REPLACE FUNCTION public.registrar_nova_empresa_isolada(
  p_nome_empresa text,
  p_valor_mensalidade numeric,
  p_valor_setup numeric,
  p_email_dono text,
  p_nome_dono text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nova_empresa_id uuid;
  v_caller_role text;
BEGIN
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF v_caller_role IS DISTINCT FROM 'SUPER_ADMIN' THEN
    RAISE EXCEPTION 'Acesso Negado: Apenas o Super Admin pode provisionar novas empresas isoladas.';
  END IF;

  INSERT INTO public.companies (nome, valor_mensalidade, valor_setup, status)
  VALUES (p_nome_empresa, p_valor_mensalidade, p_valor_setup, 'ATIVO')
  RETURNING id INTO v_nova_empresa_id;

  RETURN json_build_object('success', true, 'empresa_id', v_nova_empresa_id);
END;
$$;

-- 6. Correção de Políticas RLS Multi-Tenant (DELETE em companies/empresas, clientes, metas, storage)
DROP POLICY IF EXISTS "Super Admin pode deletar companies" ON public.companies;
CREATE POLICY "Super Admin pode deletar companies"
  ON public.companies FOR DELETE TO authenticated
  USING (public.get_user_role() = 'SUPER_ADMIN');

DROP POLICY IF EXISTS "Leitura global de clientes" ON public.clientes;
DROP POLICY IF EXISTS "Inserção global de clientes" ON public.clientes;
DROP POLICY IF EXISTS "Atualização global de clientes" ON public.clientes;

CREATE POLICY "Leitura global de clientes"
  ON public.clientes FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id() OR public.get_user_role() = 'SUPER_ADMIN');

CREATE POLICY "Inserção global de clientes"
  ON public.clientes FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id() OR public.get_user_role() = 'SUPER_ADMIN');

CREATE POLICY "Atualização global de clientes"
  ON public.clientes FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id() OR public.get_user_role() = 'SUPER_ADMIN')
  WITH CHECK (empresa_id = public.get_user_empresa_id() OR public.get_user_role() = 'SUPER_ADMIN');

DROP POLICY IF EXISTS "Leitura de metas para autenticados" ON public.metas;
DROP POLICY IF EXISTS "Gestão de metas para autenticados" ON public.metas;

CREATE POLICY "Leitura de metas para autenticados"
  ON public.metas FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id() OR public.get_user_role() = 'SUPER_ADMIN');

CREATE POLICY "Gestão de metas para autenticados"
  ON public.metas FOR ALL TO authenticated
  USING (
    (empresa_id = public.get_user_empresa_id() AND public.get_user_role() IN ('ADMIN', 'GERENTE', 'OWNER', 'DONO', 'RH_ADMIN', 'RH'))
    OR public.get_user_role() = 'SUPER_ADMIN'
  )
  WITH CHECK (
    (empresa_id = public.get_user_empresa_id() AND public.get_user_role() IN ('ADMIN', 'GERENTE', 'OWNER', 'DONO', 'RH_ADMIN', 'RH'))
    OR public.get_user_role() = 'SUPER_ADMIN'
  );

-- 7. RPC obter_alertas_estoque_baixo
CREATE OR REPLACE FUNCTION public.obter_alertas_estoque_baixo(
  p_limite_minimo integer DEFAULT 3,
  p_filial_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_role text;
  v_resultado json;
BEGIN
  SELECT empresa_id, role INTO v_empresa_id, v_role FROM public.profiles WHERE id = auth.uid();

  SELECT json_agg(row_to_json(r))
  INTO v_resultado
  FROM (
    SELECT
      p.id,
      p.id AS produto_id,
      p.nome,
      p.nome AS produto_nome,
      p.filial_id,
      f.nome AS filial_nome,
      p.quantidade,
      p.quantidade AS qtd,
      p.categoria,
      p.cor,
      p.preco,
      p.preco_venda
    FROM public.produtos p
    LEFT JOIN public.filiais f ON f.id = p.filial_id
    WHERE (v_role = 'SUPER_ADMIN' OR p.empresa_id = v_empresa_id)
      AND (p_filial_id IS NULL OR p.filial_id = p_filial_id)
      AND p.quantidade <= p_limite_minimo
    ORDER BY p.quantidade ASC
    LIMIT 20
  ) r;

  RETURN COALESCE(v_resultado, '[]'::json);
END;
$$;


-- =========================================================================
-- TABELA DE HISTÓRICO E MOVIMENTAÇÃO DE ESTOQUE - ZÊNITE
-- Execute este script no SQL Editor do seu projeto Supabase
-- =========================================================================

-- 1. Criar tabela de Movimentações de Estoque se não existir
CREATE TABLE IF NOT EXISTS public.estoque_movimentacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  produto_id uuid REFERENCES public.produtos(id) ON DELETE SET NULL,
  imei text,
  tipo_movimentacao text NOT NULL CHECK (tipo_movimentacao IN (
    'ENTRADA_AQUISICAO', 
    'SAIDA_VENDA', 
    'TRANSFERENCIA_SAIDA', 
    'TRANSFERENCIA_ENTRADA', 
    'AJUSTE_MANUAL_ENTRADA', 
    'AJUSTE_MANUAL_SAIDA'
  )),
  filial_origem_id uuid REFERENCES public.filiais(id) ON DELETE SET NULL,
  filial_destino_id uuid REFERENCES public.filiais(id) ON DELETE SET NULL,
  quantidade integer NOT NULL DEFAULT 1,
  observacao text,
  criado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Habilitar RLS
ALTER TABLE public.estoque_movimentacoes ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de RLS
DROP POLICY IF EXISTS "Usuários podem ver movimentações da própria empresa" ON public.estoque_movimentacoes;
CREATE POLICY "Usuários podem ver movimentações da própria empresa" ON public.estoque_movimentacoes
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.get_user_empresa_id()
    OR public.get_user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "Usuários podem inserir movimentações" ON public.estoque_movimentacoes;
CREATE POLICY "Usuários podem inserir movimentações" ON public.estoque_movimentacoes
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    OR public.get_user_role() = 'ADMIN'
  );

-- =========================================================================
-- ATUALIZAÇÃO DOS PROCEDURES DE TRANSFERÊNCIA PARA GRAVAR LOGS DE MOVIMENTAÇÃO
-- =========================================================================

-- 4. RPC: Registrar Saída de Transferência (Atualizado para inserir log)
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
AS $$
DECLARE
  v_transferencia_id uuid;
  v_item jsonb;
  v_criado_por_profile_id uuid;
BEGIN
  INSERT INTO public.transferencias (
    empresa_id, filial_origem_id, filial_destino_id, criado_por, status, observacoes
  ) VALUES (
    p_empresa_id, p_filial_origem_id, p_filial_destino_id, p_criado_por, 'EM_TRANSITO', p_observacoes
  )
  RETURNING id INTO v_transferencia_id;

  -- Resolver ID de profile correspondente ao auth.uid() do Supabase
  SELECT id INTO v_criado_por_profile_id
  FROM public.profiles
  WHERE id = p_criado_por;

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

    -- Inserir log de movimentação de saída
    INSERT INTO public.estoque_movimentacoes (
      empresa_id,
      produto_id,
      imei,
      tipo_movimentacao,
      filial_origem_id,
      filial_destino_id,
      quantidade,
      observacao,
      criado_por
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


-- 5. RPC: Confirmar Recebimento de Transferência (Atualizado para inserir log)
CREATE OR REPLACE FUNCTION public.confirmar_recebimento_transferencia(
  p_transferencia_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item RECORD;
  v_transferencia RECORD;
  v_dest_prod_id uuid;
  v_dest_prod_nome text;
  v_dest_prod_tipo text;
  v_dest_prod_cat text;
  v_dest_prod_preco numeric;
BEGIN
  SELECT * INTO v_transferencia
  FROM public.transferencias
  WHERE id = p_transferencia_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transferência não encontrada: %', p_transferencia_id;
  END IF;

  FOR v_item IN
    SELECT ti.imei, ti.produto_id
    FROM public.transferencias_itens ti
    WHERE ti.transferencia_id = p_transferencia_id
  LOOP
    -- Buscar dados do produto original para replicar na filial destino
    SELECT nome, tipo, categoria, preco
    INTO v_dest_prod_nome, v_dest_prod_tipo, v_dest_prod_cat, v_dest_prod_preco
    FROM public.produtos
    WHERE id = v_item.produto_id;

    -- Verificar se já existe esse produto na filial destino
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

    -- Decrementar estoque na filial origem
    UPDATE public.produtos
    SET quantidade = GREATEST(0, quantidade - 1)
    WHERE id = v_item.produto_id
      AND empresa_id = v_transferencia.empresa_id;

    -- Atualizar o IMEI: mover para a filial destino, status DISPONÍVEL, produto correto
    UPDATE public.imeis
    SET status = 'DISPONÍVEL',
        filial_id = v_transferencia.filial_destino_id,
        produto_id = v_dest_prod_id
    WHERE imei = v_item.imei
      AND empresa_id = v_transferencia.empresa_id;

    -- Inserir log de movimentação de entrada/recebimento
    INSERT INTO public.estoque_movimentacoes (
      empresa_id,
      produto_id,
      imei,
      tipo_movimentacao,
      filial_origem_id,
      filial_destino_id,
      quantidade,
      observacao
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

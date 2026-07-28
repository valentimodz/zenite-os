-- =========================================================================
-- MÓDULO DE TRANSFERÊNCIA DE MERCADORIAS - ZÊNITE OS
-- Execute este script INTEIRO no SQL Editor do seu projeto Supabase
-- =========================================================================

-- 1. Expandir a constraint de status do imeis para incluir 'EM_TRANSITO'
ALTER TABLE public.imeis DROP CONSTRAINT IF EXISTS imeis_status_check;
ALTER TABLE public.imeis 
  ADD CONSTRAINT imeis_status_check CHECK (
    status IN (
      'Disponível', 'Vendido', 'Aguardando Revisão',
      'DISPONÍVEL', 'VENDIDO', 'AGUARDANDO REVISÃO',
      'EM_TRANSITO'
    )
  );

-- 2. Criar tabela de Transferências (cabeçalho)
CREATE TABLE IF NOT EXISTS public.transferencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  filial_origem_id uuid REFERENCES public.filiais(id) ON DELETE CASCADE NOT NULL,
  filial_destino_id uuid REFERENCES public.filiais(id) ON DELETE CASCADE NOT NULL,
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'EM_TRANSITO' CHECK (status IN ('EM_TRANSITO', 'CONCLUIDA', 'CANCELADA')),
  observacoes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Criar tabela de Itens de Transferência (detalhe por IMEI)
CREATE TABLE IF NOT EXISTS public.transferencias_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transferencia_id uuid REFERENCES public.transferencias(id) ON DELETE CASCADE NOT NULL,
  imei text NOT NULL,
  produto_id uuid REFERENCES public.produtos(id) ON DELETE SET NULL,
  nome text,
  tipo text,
  categoria text,
  quantidade integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3b. Garantir que colunas existam (caso a tabela já tenha sido criada antes sem elas)
-- Se a tabela antiga tinha 'nome_produto' MAS NÃO 'nome', renomear para 'nome'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'transferencias_itens'
      AND column_name = 'nome_produto'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'transferencias_itens'
      AND column_name = 'nome'
  ) THEN
    ALTER TABLE public.transferencias_itens RENAME COLUMN nome_produto TO nome;
  END IF;
END $$;

ALTER TABLE public.transferencias_itens ADD COLUMN IF NOT EXISTS nome text;
ALTER TABLE public.transferencias_itens ADD COLUMN IF NOT EXISTS tipo text;
ALTER TABLE public.transferencias_itens ADD COLUMN IF NOT EXISTS categoria text;
ALTER TABLE public.transferencias_itens ADD COLUMN IF NOT EXISTS quantidade integer NOT NULL DEFAULT 1;
ALTER TABLE public.transferencias_itens ADD COLUMN IF NOT EXISTS produto_id uuid REFERENCES public.produtos(id) ON DELETE SET NULL;

-- Remover NOT NULL de 'nome' caso tenha sido criado como NOT NULL anteriormente
ALTER TABLE public.transferencias_itens ALTER COLUMN nome DROP NOT NULL;

-- Remover NOT NULL de 'nome_produto' caso exista com NOT NULL (coluna legada)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'transferencias_itens'
      AND column_name = 'nome_produto'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.transferencias_itens ALTER COLUMN nome_produto DROP NOT NULL;
  END IF;
END $$;

-- 4. Habilitar RLS
ALTER TABLE public.transferencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transferencias_itens ENABLE ROW LEVEL SECURITY;


-- 5. Políticas de RLS para transferencias
DROP POLICY IF EXISTS "Usuários podem ver transferências da empresa" ON public.transferencias;
CREATE POLICY "Usuários podem ver transferências da empresa" ON public.transferencias
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id() OR public.get_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "Usuários podem inserir transferências" ON public.transferencias;
CREATE POLICY "Usuários podem inserir transferências" ON public.transferencias
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id() OR public.get_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "Usuários podem atualizar transferências da empresa" ON public.transferencias;
CREATE POLICY "Usuários podem atualizar transferências da empresa" ON public.transferencias
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id() OR public.get_user_role() = 'ADMIN');

-- 6. Políticas de RLS para transferencias_itens
DROP POLICY IF EXISTS "Usuários podem ver itens de transferências" ON public.transferencias_itens;
CREATE POLICY "Usuários podem ver itens de transferências" ON public.transferencias_itens
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.transferencias t
      WHERE t.id = transferencia_id
        AND (t.empresa_id = public.get_user_empresa_id() OR public.get_user_role() = 'ADMIN')
    )
  );

DROP POLICY IF EXISTS "Usuários podem inserir itens de transferências" ON public.transferencias_itens;
CREATE POLICY "Usuários podem inserir itens de transferências" ON public.transferencias_itens
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transferencias t
      WHERE t.id = transferencia_id
        AND (t.empresa_id = public.get_user_empresa_id() OR public.get_user_role() = 'ADMIN')
    )
  );

-- 7. RPC: Registrar Saída de Transferência
DROP FUNCTION IF EXISTS public.registrar_transferencia_saida(uuid, uuid, uuid, uuid, text, jsonb);
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
BEGIN
  INSERT INTO public.transferencias (
    empresa_id, filial_origem_id, filial_destino_id, criado_por, status, observacoes
  ) VALUES (
    p_empresa_id, p_filial_origem_id, p_filial_destino_id, p_criado_por, 'EM_TRANSITO', p_observacoes
  )
  RETURNING id INTO v_transferencia_id;

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
  END LOOP;

  RETURN json_build_object('transferencia_id', v_transferencia_id);
END;
$$;

-- 8. RPC: Confirmar Recebimento de Transferência
DROP FUNCTION IF EXISTS public.confirmar_recebimento_transferencia(uuid);
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
  END LOOP;

  UPDATE public.transferencias
  SET status = 'CONCLUIDA', updated_at = now()
  WHERE id = p_transferencia_id;
END;
$$;

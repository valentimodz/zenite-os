-- =========================================================================
-- SCRIPT DE MODELAGEM BANCO DE DADOS SUPABASE (ZÊNITE)
-- Execute este script no SQL Editor do console do seu projeto Supabase
-- =========================================================================

-- Habilitar a extensão UUID se não estiver habilitada
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Criar tabela de Empresas (Companies)
CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  status text CHECK (status IN ('ATIVO', 'INATIVO')) NOT NULL DEFAULT 'ATIVO',
  valor_mensalidade numeric NOT NULL DEFAULT 0,
  valor_setup numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Criar tabela de Perfis de Usuários (Profiles)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  empresa_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  filial_id uuid, -- Será criada a tabela filiais e adicionada a constraint FKey depois
  nome text NOT NULL,
  role text CHECK (role IN ('VENDEDOR', 'GERENTE', 'ADMIN')) NOT NULL DEFAULT 'VENDEDOR',
  meta_mensal numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Criar tabela de Filiais (Branches)
CREATE TABLE IF NOT EXISTS public.filiais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  nome text NOT NULL,
  tipo text CHECK (tipo IN ('LOJA', 'ESTOQUE')) NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Adicionar coluna status em companies se ainda não existir
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS status text CHECK (status IN ('ATIVO', 'INATIVO')) NOT NULL DEFAULT 'ATIVO';

-- Adicionar coluna filial_id em profiles se ainda não existir
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS filial_id uuid;

-- Atualizar a constraint de check da role em profiles se já existir
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('VENDEDOR', 'GERENTE', 'ADMIN'));

-- Adicionar Foreign Key do filial_id em profiles (remover primeiro se já existir)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS fk_profiles_filial;
ALTER TABLE public.profiles 
  ADD CONSTRAINT fk_profiles_filial FOREIGN KEY (filial_id) REFERENCES public.filiais(id) ON DELETE SET NULL;

-- 4. Habilitar Row Level Security (RLS) nas Tabelas
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.filiais ENABLE ROW LEVEL SECURITY;

-- Função auxiliar para obter a empresa_id do usuário atual de forma segura.
-- Definida como SECURITY DEFINER para rodar com privilégios do criador,
-- evitando recursão infinita (infinite loop) ao avaliar políticas da tabela profiles.
CREATE OR REPLACE FUNCTION public.get_user_empresa_id()
RETURNS uuid AS $$
  SELECT empresa_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Função auxiliar para obter a role do usuário atual de forma segura.
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- 5. Políticas de RLS para Companies
-- Remover se já existirem para evitar erro 42710 (duplicate_object)
DROP POLICY IF EXISTS "Usuários podem ver a própria empresa" ON public.companies;
DROP POLICY IF EXISTS "Usuários podem atualizar a própria empresa" ON public.companies;

-- Permite que usuários leiam apenas a empresa à qual estão vinculados, ou ADMIN lê todas
CREATE POLICY "Usuários podem ver a própria empresa" ON public.companies
  FOR SELECT TO authenticated
  USING (
    id = public.get_user_empresa_id()
    OR public.get_user_role() = 'ADMIN'
  );

-- Permite que gerentes atualizem os dados da própria empresa, ou ADMIN atualiza todas
CREATE POLICY "Usuários podem atualizar a própria empresa" ON public.companies
  FOR UPDATE TO authenticated
  USING (
    id = public.get_user_empresa_id()
    OR public.get_user_role() = 'ADMIN'
  );

-- 6. Políticas de RLS para Profiles
-- Remover se já existirem para evitar erro 42710 (duplicate_object)
DROP POLICY IF EXISTS "Usuários podem ver seu próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem ver perfis do mesmo tenant" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem atualizar o próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Gerentes podem gerenciar perfis da própria empresa" ON public.profiles;

-- Permite que usuários vejam seu próprio perfil
CREATE POLICY "Usuários podem ver seu próprio perfil" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.get_user_role() = 'ADMIN'
  );

-- Permite que usuários leiam outros perfis vinculados ao mesmo tenant (empresa_id)
CREATE POLICY "Usuários podem ver perfis do mesmo tenant" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.get_user_empresa_id()
    OR public.get_user_role() = 'ADMIN'
  );

-- Permite que usuários editem seu próprio perfil, ou gerentes gerenciem os da empresa, ou ADMIN
CREATE POLICY "Usuários podem atualizar o próprio perfil" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    id = auth.uid()
    OR empresa_id = public.get_user_empresa_id() AND public.get_user_role() = 'GERENTE'
    OR public.get_user_role() = 'ADMIN'
  );

-- Permite que gerentes criem perfis na empresa (por exemplo, ao cadastrar vendedores)
CREATE POLICY "Gerentes podem gerenciar perfis da própria empresa" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.get_user_empresa_id() AND public.get_user_role() = 'GERENTE'
    OR public.get_user_role() = 'ADMIN'
  );

-- 7. Políticas de RLS para Filiais
DROP POLICY IF EXISTS "Usuários podem ver filiais da própria empresa" ON public.filiais;
DROP POLICY IF EXISTS "Gerentes podem gerenciar filiais da própria empresa" ON public.filiais;

CREATE POLICY "Usuários podem ver filiais da própria empresa" ON public.filiais
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.get_user_empresa_id()
    OR public.get_user_role() = 'ADMIN'
  );

CREATE POLICY "Gerentes podem gerenciar filiais da própria empresa" ON public.filiais
  FOR ALL TO authenticated
  USING (
    empresa_id = public.get_user_empresa_id() AND public.get_user_role() = 'GERENTE'
    OR public.get_user_role() = 'ADMIN'
  );

-- 8. Trigger automático para cadastro (Sign Up)
-- Cria uma empresa e um perfil de gerente assim que a conta do Supabase Auth é criada,
-- ou vincula o usuário como VENDEDOR se for criado pelo Gerente.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_company_id uuid;
  company_name text;
  full_name text;
  user_role text;
  meta_empresa_id uuid;
  meta_filial_id uuid;
BEGIN
  -- Extrair dados enviados na assinatura (options.data no cliente)
  full_name := COALESCE(new.raw_user_meta_data->>'nome_completo', 'Usuário');
  user_role := COALESCE(new.raw_user_meta_data->>'role', 'GERENTE');

  IF user_role = 'VENDEDOR' AND (new.raw_user_meta_data->>'empresa_id') IS NOT NULL THEN
    -- A. Obter IDs do tenant e filial dos metadados
    meta_empresa_id := (new.raw_user_meta_data->>'empresa_id')::uuid;
    meta_filial_id := (new.raw_user_meta_data->>'filial_id')::uuid;

    -- B. Criar Perfil de Usuário como VENDEDOR vinculado ao tenant do Gerente e à filial
    INSERT INTO public.profiles (id, empresa_id, filial_id, nome, role)
    VALUES (new.id, meta_empresa_id, meta_filial_id, full_name, 'VENDEDOR');
  ELSE
    -- A. Criar Empresa para novo cadastro de Gerente
    company_name := COALESCE(new.raw_user_meta_data->>'nome_empresa', 'Minha Nova Loja');
    
    INSERT INTO public.companies (nome)
    VALUES (company_name)
    RETURNING id INTO new_company_id;

    -- B. Criar Perfil de Usuário como GERENTE vinculado ao novo tenant
    INSERT INTO public.profiles (id, empresa_id, nome, role)
    VALUES (new.id, new_company_id, full_name, 'GERENTE');
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Associar a trigger ao auth.users do Supabase
-- Remover se já existir para evitar conflitos ao reexecutar
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================================
-- NOVAS TABELAS DE NEGÓCIO (PRODUTOS, IMEIS, VENDAS, FECHAMENTOS)
-- =========================================================================

-- Adicionar coluna is_treinner em profiles se ainda não existir
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_treinner boolean NOT NULL DEFAULT false;

-- 9. Criar tabela de Produtos (Products)
CREATE TABLE IF NOT EXISTS public.produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  filial_id uuid REFERENCES public.filiais(id) ON DELETE CASCADE NOT NULL,
  nome text NOT NULL,
  tipo text CHECK (tipo IN ('CELULAR', 'ACESSORIO')) NOT NULL,
  categoria text CHECK (categoria IN ('IOS', 'ANDROID', 'APPLE_JBL_CONSOLE', 'SERVICO')) NOT NULL,
  preco numeric NOT NULL DEFAULT 0,
  quantidade integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para Produtos
DROP POLICY IF EXISTS "Usuários podem ver produtos da própria empresa" ON public.produtos;
CREATE POLICY "Usuários podem ver produtos da própria empresa" ON public.produtos
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.get_user_empresa_id()
    OR public.get_user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "Gerentes podem gerenciar produtos" ON public.produtos;
CREATE POLICY "Gerentes podem gerenciar produtos" ON public.produtos
  FOR ALL TO authenticated
  USING (
    empresa_id = public.get_user_empresa_id() AND public.get_user_role() = 'GERENTE'
    OR public.get_user_role() = 'ADMIN'
  );

-- 10. Criar tabela de IMEIs (Cell phone serial control)
CREATE TABLE IF NOT EXISTS public.imeis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid REFERENCES public.produtos(id) ON DELETE CASCADE NOT NULL,
  empresa_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  imei text NOT NULL,
  vendido boolean NOT NULL DEFAULT false,
  cor text,
  bateria_saude integer,
  observacoes text,
  preco_compra numeric DEFAULT 0,
  is_seminovo boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.imeis ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para IMEIs
DROP POLICY IF EXISTS "Usuários podem ver imeis da empresa" ON public.imeis;
CREATE POLICY "Usuários podem ver imeis da empresa" ON public.imeis
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.get_user_empresa_id()
    OR public.get_user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "Usuários podem gerenciar imeis" ON public.imeis;
CREATE POLICY "Usuários podem gerenciar imeis" ON public.imeis
  FOR ALL TO authenticated
  USING (
    empresa_id = public.get_user_empresa_id()
    OR public.get_user_role() = 'ADMIN'
  );

-- 11. Criar tabela de Vendas (Sales logs)
CREATE TABLE IF NOT EXISTS public.vendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  filial_id uuid REFERENCES public.filiais(id) ON DELETE CASCADE NOT NULL,
  vendedor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  produto_id uuid REFERENCES public.produtos(id) ON DELETE CASCADE NOT NULL,
  quantidade integer NOT NULL DEFAULT 1,
  valor_total numeric NOT NULL DEFAULT 0,
  comissao numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para Vendas
DROP POLICY IF EXISTS "Usuários podem ver vendas da empresa" ON public.vendas;
CREATE POLICY "Usuários podem ver vendas da empresa" ON public.vendas
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.get_user_empresa_id()
    OR public.get_user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "Usuários podem inserir vendas" ON public.vendas;
CREATE POLICY "Usuários podem inserir vendas" ON public.vendas
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    OR public.get_user_role() = 'ADMIN'
  );

-- 12. Criar tabela de Fechamentos (Daily store closes)
CREATE TABLE IF NOT EXISTS public.fechamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  filial_id uuid REFERENCES public.filiais(id) ON DELETE CASCADE NOT NULL,
  vendedor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  valor_dinheiro numeric NOT NULL DEFAULT 0,
  valor_cartao numeric NOT NULL DEFAULT 0,
  valor_pix numeric NOT NULL DEFAULT 0,
  comprovante_url text, -- Armazena a imagem em Base64 ou URL
  observacoes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.fechamentos ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para Fechamentos
DROP POLICY IF EXISTS "Usuários podem ver fechamentos da empresa" ON public.fechamentos;
CREATE POLICY "Usuários podem ver fechamentos da empresa" ON public.fechamentos
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.get_user_empresa_id()
    OR public.get_user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "Usuários podem inserir fechamentos" ON public.fechamentos;
CREATE POLICY "Usuários podem inserir fechamentos" ON public.fechamentos
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    OR public.get_user_role() = 'ADMIN'
  );

-- =========================================================================
-- MÓDULO POKA-YOKE: CATÁLOGO MESTRE DE PRODUTOS (produtos_catalogo)
-- Execute este bloco SEPARADO se o banco já existia antes
-- =========================================================================

-- 13. Criar tabela de Catálogo de Produtos Mestre (Produtos_Catalogo)
CREATE TABLE IF NOT EXISTS public.produtos_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  nome text NOT NULL,
  tipo text CHECK (tipo IN ('CELULAR', 'ACESSORIO')) NOT NULL,
  categoria text CHECK (categoria IN ('IOS', 'ANDROID', 'APPLE_JBL_CONSOLE', 'SERVICO')) NOT NULL,
  preco numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(empresa_id, nome)
);
ALTER TABLE public.produtos_catalogo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários podem ver catálogo da empresa" ON public.produtos_catalogo;
CREATE POLICY "Usuários podem ver catálogo da empresa" ON public.produtos_catalogo
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.get_user_empresa_id()
    OR public.get_user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "Gerentes podem gerenciar catálogo" ON public.produtos_catalogo;
CREATE POLICY "Gerentes podem gerenciar catálogo" ON public.produtos_catalogo
  FOR ALL TO authenticated
  USING (
    empresa_id = public.get_user_empresa_id() AND public.get_user_role() = 'GERENTE'
    OR public.get_user_role() = 'ADMIN'
  );

-- =========================================================================
-- CORREÇÕES DE RLS: Permitir Vendedores atualizarem IMEIs e Produtos (PDV)
-- Execute este bloco no SQL Editor do Supabase se já tiver rodado o script anterior
-- =========================================================================

-- Permissão para Vendedores atualizarem imeis (marcar como vendido no PDV)
DROP POLICY IF EXISTS "Usuários podem atualizar imeis da empresa" ON public.imeis;
CREATE POLICY "Usuários podem atualizar imeis da empresa" ON public.imeis
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id())
  WITH CHECK (empresa_id = public.get_user_empresa_id());

-- Permissão para Vendedores atualizarem quantidade de produtos (decrementar no PDV)
DROP POLICY IF EXISTS "Usuários podem atualizar produtos da empresa" ON public.produtos;
CREATE POLICY "Usuários podem atualizar produtos da empresa" ON public.produtos
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id())
  WITH CHECK (empresa_id = public.get_user_empresa_id());

-- =========================================================================
-- MÓDULO SEMI-NOVO: CAMPOS DE COMPRA DE CLIENTE (USADOS)
-- Execute este bloco se o banco já existia antes
-- =========================================================================
ALTER TABLE public.imeis ADD COLUMN IF NOT EXISTS cor text;
ALTER TABLE public.imeis ADD COLUMN IF NOT EXISTS bateria_saude integer;
ALTER TABLE public.imeis ADD COLUMN IF NOT EXISTS observacoes text;
ALTER TABLE public.imeis ADD COLUMN IF NOT EXISTS preco_compra numeric DEFAULT 0;
ALTER TABLE public.imeis ADD COLUMN IF NOT EXISTS is_seminovo boolean DEFAULT false;

-- Permissão para Vendedores inserirem produtos (registrar compras de aparelhos de clientes no PDV)
DROP POLICY IF EXISTS "Usuários podem inserir produtos da empresa" ON public.produtos;
CREATE POLICY "Usuários podem inserir produtos da empresa" ON public.produtos
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id());

-- =========================================================================
-- MÓDULO HÍBRIDO E STATUS DE IMEI (VENDAS E CONTROLE DE ESTOQUE)
-- Execute este bloco se o banco já existia antes
-- =========================================================================

-- Adicionar coluna status na tabela de imeis
ALTER TABLE public.imeis ADD COLUMN IF NOT EXISTS status text CHECK (status IN ('Disponível', 'Vendido', 'Aguardando Revisão')) NOT NULL DEFAULT 'Disponível';

-- Garantir que os IMEIs existentes tenham o status correto baseado na coluna vendido
UPDATE public.imeis SET status = 'Vendido' WHERE vendido = true AND status = 'Disponível';

-- Adicionar colunas para venda híbrida / troca na tabela de vendas
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS metodo_pagamento text;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS parcelas integer DEFAULT 1;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS valor_desconto_troca numeric DEFAULT 0;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS used_imei text;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS used_produto_nome text;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS used_valor_avaliacao numeric DEFAULT 0;


-- =========================================================================
-- CONTROLE DE TRANSAÇÃO ATÔMICA VIA RPC & AJUSTE ADICIONAL DE RLS
-- =========================================================================

-- Ajuste de RLS para INSERT/UPDATE em produtos, imeis e vendas
DROP POLICY IF EXISTS "Usuários podem ver produtos da própria empresa" ON public.produtos;
CREATE POLICY "Usuários podem ver produtos da própria empresa" ON public.produtos
  FOR SELECT TO authenticated USING (empresa_id = public.get_user_empresa_id() OR public.get_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "Usuários podem inserir produtos da empresa" ON public.produtos;
CREATE POLICY "Usuários podem inserir produtos da empresa" ON public.produtos
  FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_user_empresa_id() OR public.get_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "Usuários podem atualizar produtos da empresa" ON public.produtos;
CREATE POLICY "Usuários podem atualizar produtos da empresa" ON public.produtos
  FOR UPDATE TO authenticated USING (empresa_id = public.get_user_empresa_id() OR public.get_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "Usuários podem ver imeis da empresa" ON public.imeis;
CREATE POLICY "Usuários podem ver imeis da empresa" ON public.imeis
  FOR SELECT TO authenticated USING (empresa_id = public.get_user_empresa_id() OR public.get_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "Usuários podem inserir imeis da empresa" ON public.imeis;
CREATE POLICY "Usuários podem inserir imeis da empresa" ON public.imeis
  FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_user_empresa_id() OR public.get_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "Usuários podem atualizar imeis da empresa" ON public.imeis;
CREATE POLICY "Usuários podem atualizar imeis da empresa" ON public.imeis
  FOR UPDATE TO authenticated USING (empresa_id = public.get_user_empresa_id() OR public.get_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "Usuários podem ver vendas da empresa" ON public.vendas;
CREATE POLICY "Usuários podem ver vendas da empresa" ON public.vendas
  FOR SELECT TO authenticated USING (empresa_id = public.get_user_empresa_id() OR public.get_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "Usuários podem inserir vendas" ON public.vendas;
CREATE POLICY "Usuários podem inserir vendas" ON public.vendas
  FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_user_empresa_id() OR public.get_user_role() = 'ADMIN');

-- RPC para registrar a venda híbrida com atomicidade
CREATE OR REPLACE FUNCTION public.registrar_venda_hibrida(
  p_empresa_id uuid,
  p_filial_id uuid,
  p_vendedor_id uuid,
  p_produto_novo_id uuid,
  p_quantidade_novo integer,
  p_imei_novo text,
  p_valor_total_novo numeric,
  p_comissao numeric,
  p_metodo_pagamento text,
  p_parcelas integer,
  p_valor_desconto_troca numeric,
  p_used_valor_avaliacao numeric,
  p_trocas_json jsonb,
  p_teve_participacao_trainee boolean DEFAULT false,
  p_comissao_trainee numeric DEFAULT 0
)
RETURNS json
AS $$
DECLARE
  v_venda_id uuid;
  v_created_at timestamp with time zone;
  v_troca_item jsonb;
  v_exist_prod_id uuid;
  v_exist_qty integer;
  v_prod_id uuid;
  v_prod_categoria text;
  v_prod_tipo text;
BEGIN
  -- 1. Obter tipo/categoria do produto novo
  SELECT tipo, categoria INTO v_prod_tipo, v_prod_categoria FROM public.produtos WHERE id = p_produto_novo_id;

  -- 2. Se for celular novo, marcar IMEI como vendido e status 'Vendido'
  IF v_prod_tipo = 'CELULAR' AND p_imei_novo IS NOT NULL AND p_imei_novo <> '' THEN
    UPDATE public.imeis 
    SET vendido = true, status = 'Vendido'
    WHERE imei = p_imei_novo AND produto_id = p_produto_novo_id AND empresa_id = p_empresa_id;
  END IF;

  -- 3. Decrementar estoque do novo (se não for serviço)
  IF v_prod_categoria <> 'SERVICO' THEN
    UPDATE public.produtos 
    SET quantidade = GREATEST(0, quantidade - p_quantidade_novo)
    WHERE id = p_produto_novo_id AND empresa_id = p_empresa_id;
  END IF;

  -- 4. Registrar a Venda
  INSERT INTO public.vendas (
    empresa_id,
    filial_id,
    vendedor_id,
    produto_id,
    quantidade,
    valor_total,
    comissao,
    metodo_pagamento,
    parcelas,
    valor_desconto_troca,
    used_imei,
    used_produto_nome,
    used_valor_avaliacao,
    teve_participacao_trainee,
    comissao_trainee
  ) VALUES (
    p_empresa_id,
    p_filial_id,
    p_vendedor_id,
    p_produto_novo_id,
    p_quantidade_novo,
    p_valor_total_novo,
    p_comissao,
    p_metodo_pagamento,
    p_parcelas,
    p_valor_desconto_troca,
    (SELECT COALESCE(string_agg(t->>'imei', ', '), '') FROM jsonb_array_elements(p_trocas_json) t),
    (SELECT COALESCE(string_agg(t->'produto'->>'nome', ', '), '') FROM jsonb_array_elements(p_trocas_json) t),
    p_used_valor_avaliacao,
    p_teve_participacao_trainee,
    p_comissao_trainee
  )
  RETURNING id, created_at INTO v_venda_id, v_created_at;

  -- 5. Processar cada aparelho usado na troca
  IF p_metodo_pagamento = 'troca' AND p_trocas_json IS NOT NULL AND jsonb_array_length(p_trocas_json) > 0 THEN
    FOR v_troca_item IN SELECT * FROM jsonb_array_elements(p_trocas_json) LOOP
      
      -- Verificar se já existe o produto com esse nome no estoque da filial correspondente
      SELECT id, quantidade INTO v_exist_prod_id, v_exist_qty
      FROM public.produtos
      WHERE filial_id = p_filial_id 
        AND nome = v_troca_item->'produto'->>'nome'
        AND tipo = 'CELULAR'
      LIMIT 1;

      IF v_exist_prod_id IS NOT NULL THEN
        v_prod_id := v_exist_prod_id;
        -- Incrementa a quantidade
        UPDATE public.produtos 
        SET quantidade = v_exist_qty + 1 
        WHERE id = v_exist_prod_id;
      ELSE
        -- Cria o produto na filial
        INSERT INTO public.produtos (
          empresa_id,
          filial_id,
          nome,
          tipo,
          categoria,
          preco,
          quantidade
        ) VALUES (
          p_empresa_id,
          p_filial_id,
          v_troca_item->'produto'->>'nome',
          'CELULAR',
          v_troca_item->'produto'->>'categoria',
          (v_troca_item->'produto'->>'preco')::numeric,
          1
        )
        RETURNING id INTO v_prod_id;
      END IF;

      -- Inserir o IMEI do usado com status 'Aguardando Revisão' e is_seminovo = true
      INSERT INTO public.imeis (
        produto_id,
        empresa_id,
        imei,
        vendido,
        cor,
        bateria_saude,
        observacoes,
        preco_compra,
        is_seminovo,
        status
      ) VALUES (
        v_prod_id,
        p_empresa_id,
        v_troca_item->>'imei',
        false,
        v_troca_item->>'cor',
        (v_troca_item->>'bateria')::integer,
        COALESCE(v_troca_item->>'obs', 'Entrada por troca no PDV'),
        (v_troca_item->>'valor')::numeric,
        true,
        'Aguardando Revisão'
      );

    END LOOP;
  END IF;

  -- Retornar um JSON com os dados da transação realizada
  RETURN json_build_object(
    'venda_id', v_venda_id,
    'created_at', v_created_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;




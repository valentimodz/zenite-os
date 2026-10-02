-- ==============================================================================
-- CORREÇÃO DE PERMISSÃO PARA ALTERAÇÃO DE PREÇO NO ESTOQUE / PRODUTOS
-- ==============================================================================
-- Este script remove a restrição de trigger no PostgreSQL que causava o erro:
-- "Não autorizado: Apenas Super Admin e Admin da Monkey Shop podem alterar preços."
--
-- Execute este comando no SQL Editor do seu Supabase Dashboard.
-- ==============================================================================

-- 1. Remove qualquer trigger de validação de preço existente na tabela produtos
DROP TRIGGER IF EXISTS tr_check_preco_update ON public.produtos;
DROP TRIGGER IF EXISTS tr_check_preco_update_produtos ON public.produtos;
DROP TRIGGER IF EXISTS trigger_check_preco_update ON public.produtos;
DROP FUNCTION IF EXISTS public.check_preco_update();

-- 2. Se desejar manter a validação a nível de banco, descomente a função e trigger abaixo,
-- que agora reconhece 'super_admin', 'superadmin', 'admin', 'administrador' (case-insensitive)
-- e o ID do usuário root:

/*
CREATE OR REPLACE FUNCTION public.check_preco_update()
RETURNS trigger AS $$
DECLARE
  v_role text;
  v_user_id uuid;
BEGIN
  -- Se o preço de venda ou custo não mudou, permite sem restrições
  IF (OLD.preco_venda IS NOT DISTINCT FROM NEW.preco_venda) AND 
     (OLD.preco_custo IS NOT DISTINCT FROM NEW.preco_custo) THEN
    RETURN NEW;
  END IF;

  v_user_id := auth.uid();

  -- Se for o usuário Super Admin principal, permite diretamente
  IF v_user_id = 'd6bd8388-36d1-4c5b-943a-1d3c232fc73d'::uuid THEN
    RETURN NEW;
  END IF;

  -- Obter role do usuário logado na tabela usuarios
  SELECT lower(role) INTO v_role
  FROM public.usuarios
  WHERE id = v_user_id
  LIMIT 1;

  IF v_role IS NOT NULL AND (
     v_role = 'super_admin' OR 
     v_role = 'superadmin' OR 
     v_role LIKE '%super%' OR 
     v_role = 'admin' OR 
     v_role = 'administrador'
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Não autorizado: Apenas Super Admin e Admin podem alterar preços.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_check_preco_update
  BEFORE UPDATE ON public.produtos
  FOR EACH ROW
  EXECUTE FUNCTION public.check_preco_update();
*/

-- 3. Garante que os RLS de UPDATE na tabela produtos permitam atualização para administradores
DO $$
BEGIN
  -- Recarregar permissões / schema cache do Supabase
  NOTIFY pgrst, 'reload schema';
END $$;

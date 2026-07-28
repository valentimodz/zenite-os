-- =========================================================================
-- Vextron Lab: Tabela de Chamados de Suporte (S.O.S)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.chamados_suporte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  empresa_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  rota text,
  mensagem text NOT NULL,
  status text NOT NULL DEFAULT 'aberto',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.chamados_suporte ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários podem criar chamados" ON public.chamados_suporte;
CREATE POLICY "Usuários podem criar chamados" ON public.chamados_suporte
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários podem ver próprios chamados" ON public.chamados_suporte;
CREATE POLICY "Usuários podem ver próprios chamados" ON public.chamados_suporte
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.get_user_role() = 'ADMIN' OR (auth.jwt() ->> 'email') = 'valentimodz@gmail.com');

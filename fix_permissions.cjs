const fs = require('fs');

let content = fs.readFileSync('SUPABASE.sql', 'utf8');

// Replace filiais FOR ALL policy
const targetFiliais = `CREATE POLICY "Gerentes podem gerenciar filiais da própria empresa" ON public.filiais
  FOR ALL TO authenticated
  USING (
    empresa_id = public.get_user_empresa_id() AND public.get_user_role() = 'GERENTE'
    OR public.get_user_role() = 'ADMIN'
  );`;
  
const replacementFiliais = `CREATE POLICY "Gerentes podem inserir filiais da própria empresa" ON public.filiais
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.get_user_empresa_id() AND public.get_user_role() = 'GERENTE'
    OR public.get_user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "Dono e Gerente podem atualizar filiais" ON public.filiais;
CREATE POLICY "Dono e Gerente podem atualizar filiais" ON public.filiais
  FOR UPDATE TO authenticated
  USING (
    empresa_id = public.get_user_empresa_id() AND (auth.jwt() ->> 'email' IN ('valentimodz@gmail.com', 'rodrigo.gerenciamonkeyshop@gmail.com'))
  );

DROP POLICY IF EXISTS "Dono e Gerente podem deletar filiais" ON public.filiais;
CREATE POLICY "Dono e Gerente podem deletar filiais" ON public.filiais
  FOR DELETE TO authenticated
  USING (
    empresa_id = public.get_user_empresa_id() AND (auth.jwt() ->> 'email' IN ('valentimodz@gmail.com', 'rodrigo.gerenciamonkeyshop@gmail.com'))
  );`;

content = content.replace(targetFiliais, replacementFiliais);

const targetVendas = `CREATE POLICY "Usuários podem inserir vendas" ON public.vendas
  FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_user_empresa_id() OR public.get_user_role() = 'ADMIN');`;

const replacementVendas = `CREATE POLICY "Usuários podem inserir vendas" ON public.vendas
  FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_user_empresa_id() OR public.get_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "Dono e Gerente podem atualizar vendas" ON public.vendas;
CREATE POLICY "Dono e Gerente podem atualizar vendas" ON public.vendas
  FOR UPDATE TO authenticated
  USING (
    empresa_id = public.get_user_empresa_id() AND (auth.jwt() ->> 'email' IN ('valentimodz@gmail.com', 'rodrigo.gerenciamonkeyshop@gmail.com'))
  );

DROP POLICY IF EXISTS "Dono e Gerente podem deletar vendas" ON public.vendas;
CREATE POLICY "Dono e Gerente podem deletar vendas" ON public.vendas
  FOR DELETE TO authenticated
  USING (
    empresa_id = public.get_user_empresa_id() AND (auth.jwt() ->> 'email' IN ('valentimodz@gmail.com', 'rodrigo.gerenciamonkeyshop@gmail.com'))
  );`;

content = content.replaceAll(targetVendas, replacementVendas);

const targetVendas2 = `CREATE POLICY "Usuários podem inserir vendas" ON public.vendas
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    OR public.get_user_role() = 'ADMIN'
  );`;

const replacementVendas2 = targetVendas2 + `\n\nDROP POLICY IF EXISTS "Dono e Gerente podem atualizar vendas" ON public.vendas;
CREATE POLICY "Dono e Gerente podem atualizar vendas" ON public.vendas
  FOR UPDATE TO authenticated
  USING (
    empresa_id = public.get_user_empresa_id() AND (auth.jwt() ->> 'email' IN ('valentimodz@gmail.com', 'rodrigo.gerenciamonkeyshop@gmail.com'))
  );

DROP POLICY IF EXISTS "Dono e Gerente podem deletar vendas" ON public.vendas;
CREATE POLICY "Dono e Gerente podem deletar vendas" ON public.vendas
  FOR DELETE TO authenticated
  USING (
    empresa_id = public.get_user_empresa_id() AND (auth.jwt() ->> 'email' IN ('valentimodz@gmail.com', 'rodrigo.gerenciamonkeyshop@gmail.com'))
  );`;

content = content.replace(targetVendas2, replacementVendas2);

fs.writeFileSync('SUPABASE.sql', content, 'utf8');
console.log('Done!');

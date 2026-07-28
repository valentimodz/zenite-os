-- 1. Adicionar a coluna logo_url à tabela filiais
ALTER TABLE public.filiais ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- 2. Criar o bucket de storage para os logos das filiais
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos_filiais', 'logos_filiais', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Políticas de RLS (Row Level Security) para o bucket 'logos_filiais'
-- a. Qualquer utilizador pode visualizar/ler (Necessário para carregar o logo nos recibos e PDVs)
CREATE POLICY "Public Access" ON storage.objects
  FOR SELECT USING (bucket_id = 'logos_filiais');

-- b. Apenas utilizadores autenticados com role ADMIN ou SUPER_ADMIN podem fazer upload
CREATE POLICY "Admin Upload Access" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'logos_filiais' AND 
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role IN ('ADMIN', 'SUPER_ADMIN')
    )
  );

-- c. Apenas utilizadores autenticados com role ADMIN ou SUPER_ADMIN podem atualizar (substituir ficheiro)
CREATE POLICY "Admin Update Access" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'logos_filiais' AND 
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role IN ('ADMIN', 'SUPER_ADMIN')
    )
  );

-- d. Apenas utilizadores autenticados com role ADMIN ou SUPER_ADMIN podem apagar
CREATE POLICY "Admin Delete Access" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'logos_filiais' AND 
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role IN ('ADMIN', 'SUPER_ADMIN')
    )
  );

UPDATE public.profiles
SET 
  role = 'OWNER', 
  empresa_id = (SELECT id FROM public.companies WHERE nome ILIKE '%Rede Cred%' LIMIT 1)
WHERE id = (SELECT id FROM auth.users WHERE email = 'teste.ceo@vextron.com');

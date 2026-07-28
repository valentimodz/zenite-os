import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

// Read env variables manually
const envPath = path.resolve('.env');
let envContent = '';
try {
  envContent = fs.readFileSync(envPath, 'utf8');
} catch (e) {
  // Silent catch
}

const getEnvVar = (name) => {
  const match = envContent.match(new RegExp(`^${name}=(.*)$`, 'm'));
  return match ? match[1].trim() : null;
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL') || '';
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY') || '';
const supabaseServiceKey = getEnvVar('VITE_SUPABASE_SERVICE_ROLE_KEY') || '';

// Expose env vars to process.env so that supabaseClient.js can read them when imported in Node.js
process.env.VITE_SUPABASE_URL = supabaseUrl;
process.env.VITE_SUPABASE_ANON_KEY = supabaseAnonKey;

// Import the global supabase client instance
const { supabase } = await import('./src/supabaseClient.js');

// Encryption/decryption helpers for certificate passwords
const ENCRYPTION_KEY = (supabaseServiceKey || 'VextronLabSaaSKeyDefault32BytesLong').substring(0, 32).padEnd(32, '0'); // Must be 32 bytes
const IV_LENGTH = 16;

function encrypt(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  if (!text) return '';
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'super-admin-api',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const parsedUrl = new URL(req.url, 'http://localhost');
          const pathname = parsedUrl.pathname;

          // CORS pre-flight
          if (req.method === 'OPTIONS') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Headers', '*');
            res.setHeader('Access-Control-Allow-Methods', '*');
            res.statusCode = 200;
            res.end();
            return;
          }

          if (
            pathname.startsWith('/api/super-admin/') || 
            pathname.startsWith('/api/fiscal/') || 
            pathname.startsWith('/api/webhooks/')
          ) {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Headers', '*');

            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
              try {
                // 1. Verify Authorization Header
                const authHeader = req.headers['authorization'];
                if (!authHeader) {
                  res.statusCode = 401;
                  res.end(JSON.stringify({ error: 'Header de autorização ausente.' }));
                  return;
                }
                const token = authHeader.replace('Bearer ', '');
                
                // Verify user via the imported global public client
                const { data: { user }, error: authError } = await supabase.auth.getUser(token);
                
                if (authError || !user) {
                  res.statusCode = 401;
                  res.end(JSON.stringify({ error: 'Sessão inválida ou expirada.' }));
                  return;
                }

                // Initialize request-specific user client configured with the user's token
                const userClient = createClient(supabaseUrl, supabaseAnonKey, {
                  global: {
                    headers: {
                      Authorization: `Bearer ${token}`
                    }
                  }
                });

                // Fetch profile to verify role
                const { data: profile } = await userClient
                  .from('profiles')
                  .select('*')
                  .eq('id', user.id)
                  .single();

                let userRole = profile?.role || 'VENDEDOR';
                if (user.email === 'valentimodz@gmail.com') userRole = 'SUPER_ADMIN';
                else if (user.email === 'valentimodz2@gmail.com') userRole = 'ADMIN';
                else if (user.email === 'rodrigo.gerenciamonkeyshop@gmail.com' || user.email === 'rodrigo.gerenciaredecred@gmail.com') userRole = 'GERENTE';

                // Initialize Admin client if key is present, otherwise fallback to the user client to avoid crash
                const adminClient = supabaseServiceKey
                  ? createClient(supabaseUrl, supabaseServiceKey, {
                      auth: {
                        autoRefreshToken: false,
                        persistSession: false
                      }
                    })
                  : userClient;

                const payload = body ? JSON.parse(body) : {};

                // ROUTE: Super Admin Provisioning
                if (pathname.startsWith('/api/super-admin/')) {
                  if (userRole !== 'SUPER_ADMIN') {
                    res.statusCode = 403;
                    res.end(JSON.stringify({ error: 'Acesso Proibido: Apenas valentimodz@gmail.com pode gerenciar o provisionamento.' }));
                    return;
                  }

                  if (pathname === '/api/super-admin/create-company') {
                    const { nome } = payload;
                    if (!nome) {
                      res.statusCode = 400;
                      res.end(JSON.stringify({ error: 'O nome da empresa é obrigatório.' }));
                      return;
                    }

                    const { data: company, error: compError } = await adminClient
                      .from('companies')
                      .insert({ nome })
                      .select()
                      .single();

                    if (compError) {
                      res.statusCode = 400;
                      res.end(JSON.stringify({ error: compError.message }));
                      return;
                    }

                    res.statusCode = 200;
                    res.end(JSON.stringify({ success: true, company }));
                    return;
                  }

                  if (pathname === '/api/super-admin/provision-user') {
                    const { email, password, role, empresa_id, nome } = payload;
                    if (!email || !password || !role || !empresa_id || !nome) {
                      res.statusCode = 400;
                      res.end(JSON.stringify({ error: 'Todos os campos são obrigatórios.' }));
                      return;
                    }

                    // Criar usuário no auth
                    const { data: authUser, error: createError } = await adminClient.auth.admin.createUser({
                      email,
                      password,
                      email_confirm: true,
                      user_metadata: {
                        nome_completo: nome,
                        role,
                        empresa_id
                      }
                    });

                    if (createError) {
                      res.statusCode = 400;
                      res.end(JSON.stringify({ error: createError.message }));
                      return;
                    }

                    const userId = authUser.user.id;

                    // Obter perfil criado pelo trigger
                    const { data: userProfile } = await adminClient
                      .from('profiles')
                      .select('*')
                      .eq('id', userId)
                      .single();

                    if (userProfile) {
                      if (role !== 'VENDEDOR' && userProfile.empresa_id && userProfile.empresa_id !== empresa_id) {
                        const dummyCompanyId = userProfile.empresa_id;

                        // Atualizar perfil
                        await adminClient
                          .from('profiles')
                          .update({ empresa_id, role, nome })
                          .eq('id', userId);

                        // Deletar empresa dummy
                        await adminClient
                          .from('companies')
                          .delete()
                          .eq('id', dummyCompanyId);
                      } else {
                        await adminClient
                          .from('profiles')
                          .update({ empresa_id, role, nome })
                          .eq('id', userId);
                      }
                    } else {
                      await adminClient
                        .from('profiles')
                        .insert({
                          id: userId,
                          empresa_id,
                          nome,
                          role
                        });
                    }

                    res.statusCode = 200;
                    res.end(JSON.stringify({ success: true, user: authUser.user }));
                    return;
                  }
                }

                // ROUTE: Fiscal Configurations (GET/POST)
                if (pathname === '/api/fiscal/configuracoes') {
                  if (req.method === 'GET') {
                    const tenantId = parsedUrl.searchParams.get('tenant_id');
                    if (!tenantId) {
                      res.statusCode = 400;
                      res.end(JSON.stringify({ error: 'tenant_id é obrigatório.' }));
                      return;
                    }

                    // Security check: Only allow matching company or Super Admin
                    if (userRole !== 'SUPER_ADMIN' && profile?.empresa_id !== tenantId) {
                      res.statusCode = 403;
                      res.end(JSON.stringify({ error: 'Acesso Proibido: Você não tem permissão para visualizar estes dados fiscais.' }));
                      return;
                    }

                    const { data: config, error: configError } = await adminClient
                      .from('configuracoes_fiscais')
                      .select('*')
                      .eq('tenant_id', tenantId)
                      .single();

                    if (configError && configError.code !== 'PGRST116') {
                      res.statusCode = 400;
                      res.end(JSON.stringify({ error: configError.message }));
                      return;
                    }

                    if (!config) {
                      res.statusCode = 200;
                      res.end(JSON.stringify({ success: true, config: null }));
                      return;
                    }

                    // Decrypt password before sending back
                    if (config.certificado_senha_criptografada) {
                      try {
                        config.certificado_senha = decrypt(config.certificado_senha_criptografada);
                      } catch (err) {
                        config.certificado_senha = '';
                      }
                    }

                    res.statusCode = 200;
                    res.end(JSON.stringify({ success: true, config }));
                    return;
                  }

                  if (req.method === 'POST') {
                    const { tenant_id, cnpj, inscricao_estadual, inscricao_municipal, regime_tributario, certificado_a1_url, certificado_senha } = payload;
                    
                    if (!tenant_id || !cnpj || !regime_tributario) {
                      res.statusCode = 400;
                      res.end(JSON.stringify({ error: 'tenant_id, cnpj e regime_tributario são obrigatórios.' }));
                      return;
                    }

                    // Security check: Only allow matching company or Super Admin
                    if (userRole !== 'SUPER_ADMIN' && profile?.empresa_id !== tenant_id) {
                      res.statusCode = 403;
                      res.end(JSON.stringify({ error: 'Acesso Proibido: Você não pertence a esta empresa.' }));
                      return;
                    }

                    // Only Admins / Gerentes / Owners can configure credentials
                    if (userRole !== 'SUPER_ADMIN' && !['GERENTE', 'ADMIN', 'OWNER'].includes(userRole)) {
                      res.statusCode = 403;
                      res.end(JSON.stringify({ error: 'Acesso Proibido: Privilégios administrativos necessários.' }));
                      return;
                    }

                    const encPassword = encrypt(certificado_senha || '');

                    const { data: config, error: upsertError } = await adminClient
                      .from('configuracoes_fiscais')
                      .upsert({
                        tenant_id,
                        cnpj,
                        inscricao_estadual: inscricao_estadual || null,
                        inscricao_municipal: inscricao_municipal || null,
                        regime_tributario,
                        certificado_a1_url: certificado_a1_url || null,
                        certificado_senha_criptografada: encPassword || null
                      }, { onConflict: 'tenant_id' })
                      .select()
                      .single();

                    if (upsertError) {
                      res.statusCode = 400;
                      res.end(JSON.stringify({ error: upsertError.message }));
                      return;
                    }

                    res.statusCode = 200;
                    res.end(JSON.stringify({ success: true, config }));
                    return;
                  }
                }

                // ROUTE: Get Sales History (with role-based sanitization)
                if (pathname === '/api/vendas') {
                  if (req.method === 'GET') {
                    const empresaId = parsedUrl.searchParams.get('empresa_id');
                    const vendedorId = parsedUrl.searchParams.get('vendedor_id');

                    let query = adminClient
                      .from('vendas')
                      .select('*, produtos(*), profiles(*), autorizador:desconto_autorizado_por(nome)');

                    if (userRole !== 'SUPER_ADMIN') {
                      query = query.eq('empresa_id', profile?.empresa_id);
                    } else if (empresaId) {
                      query = query.eq('empresa_id', empresaId);
                    }
                    if (vendedorId) {
                      query = query.eq('vendedor_id', vendedorId);
                    }

                    const { data: sales, error: fetchErr } = await query.order('created_at', { ascending: false });

                    if (fetchErr) {
                      res.statusCode = 400;
                      res.end(JSON.stringify({ error: fetchErr.message }));
                      return;
                    }

                    // Role-based sanitization
                    const allowedRoles = ['ADMIN', 'ADM', 'ADMINISTRADOR', 'RH', 'RH_ADMIN', 'GERENTE', 'SUPER_ADMIN', 'OWNER', 'DONO'];
                    const isAuthorized = allowedRoles.includes(userRole);

                    const sanitizedSales = (sales || []).map(sale => {
                      const newSale = { ...sale };
                      if (!isAuthorized) {
                        delete newSale.desconto_autorizado_por;
                        delete newSale.autorizador;
                      }
                      return newSale;
                    });

                    res.statusCode = 200;
                    res.end(JSON.stringify({ success: true, data: sanitizedSales }));
                    return;
                  }
                }

                // ROUTE: Emit NF-e PDV (Product Sale)
                if (pathname === '/api/fiscal/emitir-nfe-pdv') {
                  if (!['ADMIN', 'ADM', 'ADMINISTRADOR', 'RH', 'RH_ADMIN', 'SUPER_ADMIN', 'OWNER', 'DONO'].includes(userRole)) {
                    res.statusCode = 403;
                    res.end(JSON.stringify({ error: 'Acesso Proibido: Apenas administradores, RH ou Dono possuem permissão para emitir documentos fiscais.' }));
                    return;
                  }
                  const { venda_id, cliente_cpf_cnpj, cliente_nome, cliente_email } = payload;
                  if (!venda_id) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: 'venda_id é obrigatório.' }));
                    return;
                  }

                  // 1. Load sale
                  const { data: venda, error: fetchVendaErr } = await adminClient
                    .from('vendas')
                    .select('*, produtos(*)')
                    .eq('id', venda_id)
                    .single();

                  if (fetchVendaErr || !venda) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: 'Venda não localizada para emissão.' }));
                    return;
                  }

                  if (userRole !== 'SUPER_ADMIN' && venda.empresa_id !== profile?.empresa_id) {
                    res.statusCode = 403;
                    res.end(JSON.stringify({ error: 'Acesso Proibido: Esta venda pertence a outra empresa.' }));
                    return;
                  }

                  const { data: comp } = await adminClient
                    .from('companies')
                    .select('plano, status_assinatura')
                    .eq('id', venda.empresa_id)
                    .single();

                  if (userRole !== 'SUPER_ADMIN') {
                    if (comp?.status_assinatura === 'BLOQUEADO') {
                      res.statusCode = 403;
                      res.end(JSON.stringify({ error: 'Acesso Proibido: A assinatura desta empresa está suspensa por inadimplência.' }));
                      return;
                    }
                    if (comp?.plano && comp.plano.toUpperCase() !== 'ULTIMATE') {
                      res.statusCode = 403;
                      res.end(JSON.stringify({ error: 'Acesso Proibido: O plano da sua empresa não inclui Emissão de NF-e. Faça um upgrade para o plano ULTIMATE.' }));
                      return;
                    }
                  }

                  // 2. Fetch fiscal configs for the tenant
                  const { data: config } = await adminClient
                    .from('configuracoes_fiscais')
                    .select('*')
                    .eq('tenant_id', venda.empresa_id)
                    .single();

                  if (!config) {
                    const errMsg = 'Configurações fiscais ausentes para esta empresa. Cadastre o CNPJ nas configurações.';
                    await adminClient.from('vendas').update({
                      nfe_status: 'ERRO',
                      nfe_erro_detalhe: errMsg
                    }).eq('id', venda_id);

                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: errMsg }));
                    return;
                  }

                  // 3. Validation Stubs
                  if (!cliente_cpf_cnpj || cliente_cpf_cnpj.replace(/\D/g, '').length < 11) {
                    const errMsg = 'Rejeição SEFAZ: CPF/CNPJ do destinatário inválido ou ausente.';
                    await adminClient.from('vendas').update({
                      nfe_status: 'ERRO',
                      nfe_erro_detalhe: errMsg
                    }).eq('id', venda_id);

                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: errMsg }));
                    return;
                  }

                  // Simulate SEFAZ Rejection code on specific inputs
                  if (cliente_cpf_cnpj === '99999999999' || cliente_cpf_cnpj === '99999999999999') {
                    const errMsg = 'Rejeição SEFAZ [Erro 203]: Emissor ou destinatário suspenso pela receita estadual.';
                    await adminClient.from('vendas').update({
                      nfe_status: 'ERRO',
                      nfe_erro_detalhe: errMsg
                    }).eq('id', venda_id);

                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: errMsg }));
                    return;
                  }

                  // Check if product has NCM
                  const ncmCode = venda.produtos?.ncm;
                  if (!ncmCode) {
                    const errMsg = `Rejeição SEFAZ [Erro 320]: Código NCM do produto "${venda.produtos?.nome}" não cadastrado no Catálogo.`;
                    await adminClient.from('vendas').update({
                      nfe_status: 'ERRO',
                      nfe_erro_detalhe: errMsg
                    }).eq('id', venda_id);

                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: errMsg }));
                    return;
                  }

                  // 4. Successful Emission Stub
                  const nfeId = `NFe-${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`;
                  const pdfUrl = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
                  const xmlUrl = 'data:text/xml;charset=utf-8,' + encodeURIComponent(`<nfe><id>${nfeId}</id><prestador>${config.cnpj}</prestador><destinatario>${cliente_cpf_cnpj}</destinatario><total>${venda.valor_total}</total></nfe>`);

                  await adminClient.from('vendas').update({
                    nfe_status: 'EMITIDA',
                    nfe_id: nfeId,
                    nfe_pdf_url: pdfUrl,
                    nfe_xml_url: xmlUrl,
                    nfe_erro_detalhe: null
                  }).eq('id', venda_id);

                  res.statusCode = 200;
                  res.end(JSON.stringify({ success: true, nfe_id: nfeId, nfe_pdf_url: pdfUrl }));
                  return;
                }

                // ROUTE: Get/Post Tenant Settings (Feature Flags)
                if (pathname === '/api/tenant/settings') {
                  const allowedRoles = ['ADMIN', 'ADM', 'ADMINISTRADOR', 'RH', 'RH_ADMIN', 'GERENTE', 'SUPER_ADMIN', 'OWNER', 'DONO'];
                  if (!allowedRoles.includes(userRole)) {
                    res.statusCode = 403;
                    res.end(JSON.stringify({ error: 'Acesso Proibido.' }));
                    return;
                  }

                  if (req.method === 'GET') {
                    const { data: company, error: compErr } = await adminClient
                      .from('companies')
                      .select('settings')
                      .eq('id', profile?.empresa_id)
                      .single();

                    if (compErr || !company) {
                      res.statusCode = 400;
                      res.end(JSON.stringify({ error: compErr?.message || 'Empresa não localizada.' }));
                      return;
                    }

                    res.statusCode = 200;
                    res.end(JSON.stringify({ success: true, settings: company.settings }));
                    return;
                  }

                  if (req.method === 'POST') {
                    if (!['SUPER_ADMIN', 'OWNER', 'DONO', 'ADMIN'].includes(userRole)) {
                      res.statusCode = 403;
                      res.end(JSON.stringify({ error: 'Acesso Proibido: Apenas Donos ou Administradores podem alterar recursos.' }));
                      return;
                    }

                    const { settings } = payload;
                    const { data: updatedCompany, error: updateErr } = await adminClient
                      .from('companies')
                      .update({ settings })
                      .eq('id', profile?.empresa_id)
                      .select('settings')
                      .single();

                    if (updateErr) {
                      res.statusCode = 400;
                      res.end(JSON.stringify({ error: updateErr.message }));
                      return;
                    }

                    res.statusCode = 200;
                    res.end(JSON.stringify({ success: true, settings: updatedCompany.settings }));
                    return;
                  }
                }

                // ROUTE: Get Tenant SaaS Invoices
                if (pathname === '/api/tenant/faturas') {
                  if (req.method === 'GET') {
                    if (!['SUPER_ADMIN', 'OWNER', 'DONO', 'ADMIN'].includes(userRole)) {
                      res.statusCode = 403;
                      res.end(JSON.stringify({ error: 'Acesso Proibido: Privilégios insuficientes.' }));
                      return;
                    }

                    const { data: faturas, error: fetchErr } = await adminClient
                      .from('faturas_saas')
                      .select('*')
                      .eq('tenant_id', profile?.empresa_id)
                      .order('created_at', { ascending: false });

                    if (fetchErr) {
                      res.statusCode = 400;
                      res.end(JSON.stringify({ error: fetchErr.message }));
                      return;
                    }

                    res.statusCode = 200;
                    res.end(JSON.stringify({ success: true, data: faturas }));
                    return;
                  }
                }

                // ROUTE: Webhook for SaaS Invoices (NFS-e Emission on Fatura Paid)
                if (pathname === '/api/webhooks/faturas-saas') {
                  const { fatura_id } = payload;
                  if (!fatura_id) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: 'fatura_id é obrigatório.' }));
                    return;
                  }

                  // 1. Fetch fatura and customer details
                  const { data: fatura, error: fatError } = await adminClient
                    .from('faturas_saas')
                    .select('*, companies(*)')
                    .eq('id', fatura_id)
                    .single();

                  if (fatError || !fatura) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: 'Fatura SaaS não localizada.' }));
                    return;
                  }

                  // 2. Fetch configurations for the tenant (Client)
                  const { data: config } = await adminClient
                    .from('configuracoes_fiscais')
                    .select('*')
                    .eq('tenant_id', fatura.tenant_id)
                    .single();

                  // House Software CNPJ (Simulated Prestador)
                  const houseSoftwareCnpj = '99.999.999/0001-99';

                  // 3. Emit NFS-e Stub
                  const nfseId = `NFSe-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`;
                  const pdfUrl = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';

                  // Update fatura record with NFS-e values
                  await adminClient
                    .from('faturas_saas')
                    .update({
                      status: 'PAGO', // Garantir que está pago
                      nfse_id: nfseId,
                      nfse_pdf_url: pdfUrl
                    })
                    .eq('id', fatura_id);

                  res.statusCode = 200;
                  res.end(JSON.stringify({
                    success: true,
                    mensagem: 'NFS-e de mensalidade emitida via webhook com sucesso!',
                    nfse_id: nfseId,
                    nfse_pdf_url: pdfUrl
                  }));
                  return;
                }

              } catch (err) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err.message }));
              }
            });
            return;
          }
          next();
        });
      }
    }
  ],
  base: '/',
  build: {
    outDir: 'dist',
  },
})

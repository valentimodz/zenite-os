import React, { useState, useEffect } from 'react';
import { supabase, isMissingCredentials } from './supabaseClient';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import CeoDashboard from './components/CeoDashboard';
import ResetPassword from './components/ResetPassword';

function App() {
  if (isMissingCredentials) {
    return <SupabaseConfigRequired />;
  }

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);

  useEffect(() => {
    // Buscar sessão atual no mount
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (currentSession) {
        setSession(currentSession);
        setLoading(false);
      } else {
        const loggedOut = localStorage.getItem('zenite_logged_out');
        if (loggedOut === 'true') {
          setLoading(false);
        } else {
          // Tentar auto-login em ambiente de desenvolvimento
          supabase.auth.signInWithPassword({
            email: 'rodrigo.gerenciaredecred@gmail.com',
            password: 'change123'
          }).then(({ data, error }) => {
            if (!error && data.session) {
              setSession(data.session);
              setLoading(false);
            } else {
              // Fallback para o email anterior em caso de banco não migrado localmente
              supabase.auth.signInWithPassword({
                email: 'rodrigo.gerenciamonkeyshop@gmail.com',
                password: 'change123'
              }).then(({ data: fbData, error: fbError }) => {
                if (!fbError && fbData.session) {
                  setSession(fbData.session);
                } else {
                  console.warn("Auto-login falhou. Redirecionando para login manual.", fbError);
                }
                setLoading(false);
              });
            }
          });
        }
      }
    });

    // Ouvir mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        localStorage.setItem('zenite_logged_out', 'true');
        sessionStorage.removeItem('zenite_super_admin_redirected');
      } else if (event === 'SIGNED_IN') {
        localStorage.removeItem('zenite_logged_out');
      } else if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryMode(true);
      }
      setSession(session);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white gap-4">
        <div className="w-10 h-10 border-4 border-[#6A0DAD] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-gray-500 font-medium">Carregando Zênite...</p>
      </div>
    );
  }

  if (session) {
    if (isRecoveryMode) {
      return <ResetPassword onComplete={() => setIsRecoveryMode(false)} />;
    }

    const isSuperAdminRoute = window.location.pathname === '/super-admin';
    if (isSuperAdminRoute) {
      return <SuperAdminRouteWrapper session={session} />;
    }

    const isCeoRoute = window.location.pathname === '/dashboard/ceo';

    // Para saber o profile da sessão logada no nível do App.jsx
    // Note: Em produção real com react-router, faríamos uma proteção de rota.
    // Aqui usamos um wrapper rápido para checar a role antes de renderizar
    return <RoleProtectedRoute session={session} isCeoRoute={isCeoRoute} />;
  }

  return <Auth />;
}

const SuperAdminRouteWrapper = ({ session }) => {
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    // Rigid security check
    if (session.user.email === 'valentimodz@gmail.com') {
      setAuthorized(true);
      setChecking(false);
    } else {
      // Unauthorized: sign out immediately and redirect to login page
      alert('Acesso Negado: Área Exclusiva para Super Administrador. Deslogando...');
      supabase.auth.signOut().then(() => {
        window.location.href = '/';
      });
    }
  }, [session]);

  if (checking) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white gap-4">
        <div className="w-10 h-10 border-4 border-[#6A0DAD] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-gray-500 font-medium">Verificando permissões de Super Admin...</p>
      </div>
    );
  }

  if (authorized) {
    return <Dashboard session={session} profileDataProps={{ role: 'SUPER_ADMIN', email: 'valentimodz@gmail.com', nome: 'Super Admin' }} />;
  }

  return null;
};

const RoleProtectedRoute = ({ session, isCeoRoute }) => {
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    supabase.from('profiles').select('*').eq('id', session.user.id).single().then(({ data, error }) => {
      let userRole = data?.role || 'ADMIN';
      if (session.user.email === 'valentimodz@gmail.com') userRole = 'SUPER_ADMIN';
      else if (session.user.email === 'valentimodz2@gmail.com') userRole = 'ADMIN';
      else if (session.user.email === 'rodrigo.gerenciaredecred@gmail.com' || session.user.email === 'rodrigo.gerenciamonkeyshop@gmail.com') userRole = 'GERENTE';
      else if (session.user.email === 'teste.ceo@vextron.com') userRole = 'OWNER';
      else if (session.user.email === 'estoque.redecred@gmail.com' || session.user.email === 'estoquista@redecred.com') userRole = 'ESTOQUISTA';

      const userProfile = data ? { ...data, role: userRole } : {
        id: session.user.id,
        email: session.user.email,
        nome: session.user.user_metadata?.nome || session.user.email?.split('@')[0] || 'Usuário',
        role: userRole,
        empresa_id: session.user.user_metadata?.empresa_id || null
      };
      setProfile(userProfile);
      setLoadingProfile(false);
    });
  }, [session.user.id, session.user.email]);

  if (loadingProfile) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white gap-4">
        <div className="w-10 h-10 border-4 border-[#6A0DAD] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (profile?.role === 'SUPER_ADMIN') {
    const hasRedirected = sessionStorage.getItem('zenite_super_admin_redirected');
    if (!hasRedirected && window.location.pathname === '/') {
      sessionStorage.setItem('zenite_super_admin_redirected', 'true');
      window.location.href = '/super-admin';
      return null;
    }
  }

  if (isCeoRoute) {
    if (['OWNER', 'DONO', 'SUPER_ADMIN'].includes(profile?.role)) {
      return <CeoDashboard session={session} profile={profile} />;
    } else {
      alert('Acesso Negado: Área Exclusiva para Sócios');
      window.location.href = '/';
      return null;
    }
  }

  return <Dashboard session={session} profileDataProps={profile} />;
}

function SupabaseConfigRequired() {
  const [copied, setCopied] = useState(false);
  const envTemplate = `VITE_SUPABASE_URL=seu-url-do-supabase\nVITE_SUPABASE_ANON_KEY=sua-anon-key-do-supabase`;

  const handleCopy = () => {
    navigator.clipboard.writeText(envTemplate);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 font-sans relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#6A0DAD]/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#3B0764]/15 rounded-full blur-[120px] pointer-events-none"></div>
      
      <div className="w-full max-w-xl bg-neutral-900/60 backdrop-blur-xl border border-neutral-800/80 rounded-2xl p-8 shadow-2xl relative z-10 transition-all hover:border-[#6A0DAD]/30">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-[#6A0DAD]/15 rounded-xl border border-[#6A0DAD]/30">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-database"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white font-sans">Configuração Necessária</h1>
            <p className="text-sm text-neutral-400">Zênite OS por Vextron Lab</p>
          </div>
        </div>

        <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-4 mb-6 flex items-start gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-alert-triangle mt-0.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
          <div className="text-sm text-neutral-300 leading-relaxed font-sans">
            <span className="font-semibold text-amber-400">Credenciais do Supabase ausentes!</span> A tela ficou preta porque o aplicativo necessita das variáveis de ambiente para inicializar e se comunicar com o banco de dados.
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-neutral-300 mb-2 font-sans">Como resolver passo a passo:</h3>
            <ol className="list-decimal list-inside text-sm text-neutral-400 space-y-2 leading-relaxed font-sans">
              <li>Crie um arquivo chamado <code className="bg-neutral-800 text-neutral-200 px-1.5 py-0.5 rounded text-xs font-mono font-bold">.env</code> na raiz do projeto.</li>
              <li>Copie o modelo de variáveis fornecido abaixo.</li>
              <li>Cole no arquivo e substitua as credenciais do seu projeto Supabase.</li>
              <li>Reinicie o servidor (execute <code className="bg-neutral-800 text-neutral-200 px-1.5 py-0.5 rounded text-xs font-mono font-bold">npm run dev</code>).</li>
            </ol>
          </div>

          <div className="relative">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 font-sans">Conteúdo do arquivo .env</span>
              <button 
                onClick={handleCopy} 
                className="text-xs text-[#a855f7] hover:text-[#c084fc] font-medium flex items-center gap-1.5 transition-colors focus:outline-none font-sans"
              >
                {copied ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check"><path d="M20 6 9 17l-5-5"/></svg>
                    <span className="text-green-400">Copiado!</span>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                    <span>Copiar modelo</span>
                  </>
                )}
              </button>
            </div>
            <pre className="bg-[#050505] border border-neutral-800 rounded-xl p-4 font-mono text-xs text-neutral-300 leading-relaxed overflow-x-auto shadow-inner select-all">
              {envTemplate}
            </pre>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-neutral-800/80 flex items-center justify-between text-xs text-neutral-500 font-sans">
          <span>© 2026 Vextron Lab</span>
          <span>Desenvolvido por @Valentim</span>
        </div>
      </div>
    </div>
  );
}

export default App;

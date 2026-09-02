import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Mail, Lock, User, Briefcase, Loader2, Key } from 'lucide-react';

export default function Auth() {
  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'signup'
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' }); // type: 'success' | 'error'

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');

  // Limpa estados e mensagens ao chavear abas
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setMessage({ text: '', type: '' });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      // 1. Valida as credenciais
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      // 2. BUSCA A IDENTIDADE CORPORATIVA EXATA
      // Verifique se o nome da sua tabela é 'profiles', 'usuarios' ou similar.
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('empresa_id, filial_id')
        .eq('id', authData.user.id)
        .single();

      if (profileError || !profile) {
        throw new Error('Perfil de filial não encontrado no banco de dados.');
      }

      // 3. ISOLAMENTO ABSOLUTO NO CACHE DO NAVEGADOR
      // Isso esmaga o cache antigo e impede que a Islayne herde os IDs do Marlon
      localStorage.setItem('@zenite_empresaId', profile.empresa_id);
      localStorage.setItem('@zenite_filialId', profile.filial_id);

      // IMPORTANTE: Se você usa um Context API (como AuthContext), dispare a atualização dele AQUI.

      setMessage({ text: 'Autenticado com sucesso! Acessando sistema...', type: 'success' });

      // 4. Redirecionamento 
      // window.location.href = '/dashboard'; 

    } catch (err) {
      setMessage({ text: err.message || 'Erro ao realizar login.', type: 'error' });
    }
    finally {
      setLoading(false);
    }
  };

  const handleResetPasswordRequest = async (e) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });

      if (error) throw error;

      setMessage({
        text: 'E-mail de recuperação enviado com sucesso! Verifique sua caixa de entrada.',
        type: 'success',
      });
    } catch (err) {
      setMessage({ text: err.message || 'Erro ao enviar e-mail de recuperação.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!email || !password || !fullName || !companyName) {
      setMessage({ text: 'Por favor, preencha todos os campos.', type: 'error' });
      return;
    }

    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nome_completo: fullName,
            nome_empresa: companyName,
          },
        },
      });

      if (error) throw error;

      setMessage({
        text: 'Cadastro realizado com sucesso! Verifique seu e-mail para confirmação se necessário.',
        type: 'success',
      });
      console.log('Cadastro com sucesso:', data);
    } catch (err) {
      setMessage({ text: err.message || 'Erro ao realizar cadastro.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0A0A0A] border border-[#222222] rounded-lg p-8 shadow-2xl">

        {/* Cabeçalho */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Zênite<span className="text-[#6A0DAD]">.</span>
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            Gestão Multiloja Premium para Lojas de Celulares
          </p>
        </div>

        {/* Abas */}
        <div className="flex border-b border-[#222222] mb-6">
          <button
            onClick={() => handleTabChange('login')}
            className={`flex-1 text-center py-3 font-semibold text-sm transition-colors border-b-2 ${activeTab === 'login'
                ? 'text-white border-[#6A0DAD]'
                : 'text-gray-500 border-transparent hover:text-gray-300'
              }`}
          >
            Entrar
          </button>
          <button
            onClick={() => handleTabChange('signup')}
            className={`flex-1 text-center py-3 font-semibold text-sm transition-colors border-b-2 ${activeTab === 'signup'
                ? 'text-white border-[#6A0DAD]'
                : 'text-gray-500 border-transparent hover:text-gray-300'
              }`}
          >
            Cadastrar
          </button>
        </div>

        {/* Alertas */}
        {message.text && (
          <div
            className={`mb-6 p-4 rounded-md text-sm border ${message.type === 'success'
                ? 'bg-green-950/20 border-green-800 text-green-400'
                : 'bg-red-950/20 border-red-800 text-red-400'
              }`}
          >
            {message.text}
          </div>
        )}

        {/* Aba Entrar */}
        {activeTab === 'login' && (
          <>
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  E-mail
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">
                    <Mail size={18} />
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-black border border-[#6A0DAD]/40 focus:border-[#6A0DAD] rounded-md text-white pl-10 pr-4 py-3 text-sm placeholder-gray-600 outline-none transition-all"
                    placeholder="seuemail@loja.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Senha
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">
                    <Lock size={18} />
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-black border border-[#6A0DAD]/40 focus:border-[#6A0DAD] rounded-md text-white pl-10 pr-4 py-3 text-sm placeholder-gray-600 outline-none transition-all"
                    placeholder="••••••••"
                    required
                  />
                </div>
                <div className="flex justify-end mt-1.5">
                  <button
                    type="button"
                    onClick={() => handleTabChange('forgot')}
                    className="text-xs text-[#6A0DAD] hover:text-[#500885] transition-colors font-medium"
                  >
                    Esqueceu sua senha?
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#6A0DAD] hover:bg-[#500885] disabled:bg-gray-800 disabled:text-gray-500 text-white font-bold py-3 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  'Entrar no Sistema'
                )}
              </button>
            </form>
          </>
        )}

        {/* Aba Recuperar Senha */}
        {activeTab === 'forgot' && (
          <form onSubmit={handleResetPasswordRequest} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                E-mail de Recuperação
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">
                  <Mail size={18} />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black border border-[#6A0DAD]/40 focus:border-[#6A0DAD] rounded-md text-white pl-10 pr-4 py-3 text-sm placeholder-gray-600 outline-none transition-all"
                  placeholder="seuemail@loja.com"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#6A0DAD] hover:bg-[#500885] disabled:bg-gray-800 disabled:text-gray-500 text-white font-bold py-3 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                'Enviar Link de Recuperação'
              )}
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('login')}
              className="w-full bg-transparent hover:bg-white/5 text-gray-400 font-semibold py-3 px-4 rounded-md transition-colors text-xs text-center border border-gray-800/80"
            >
              Voltar para o Login
            </button>
          </form>
        )}

        {/* Aba Cadastrar */}
        {activeTab === 'signup' && (
          <form onSubmit={handleSignUp} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Nome Completo
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">
                  <User size={18} />
                </span>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-black border border-[#6A0DAD]/40 focus:border-[#6A0DAD] rounded-md text-white pl-10 pr-4 py-3 text-sm placeholder-gray-600 outline-none transition-all"
                  placeholder="Ex: João da Silva"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                E-mail
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">
                  <Mail size={18} />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black border border-[#6A0DAD]/40 focus:border-[#6A0DAD] rounded-md text-white pl-10 pr-4 py-3 text-sm placeholder-gray-600 outline-none transition-all"
                  placeholder="Ex: joao@loja.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Senha
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">
                  <Key size={18} />
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black border border-[#6A0DAD]/40 focus:border-[#6A0DAD] rounded-md text-white pl-10 pr-4 py-3 text-sm placeholder-gray-600 outline-none transition-all"
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Nome da Empresa / Loja
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">
                  <Briefcase size={18} />
                </span>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full bg-black border border-[#6A0DAD]/40 focus:border-[#6A0DAD] rounded-md text-white pl-10 pr-4 py-3 text-sm placeholder-gray-600 outline-none transition-all"
                  placeholder="Ex: Zênite Store Centro"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#6A0DAD] hover:bg-[#500885] disabled:bg-gray-800 disabled:text-gray-500 text-white font-bold py-3 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                'Cadastrar Nova Empresa'
              )}
            </button>
          </form>
        )}

      </div>
      <footer className="text-center py-4 bg-black text-[#6B7280] text-xs font-medium mt-6 font-sans">
        © 2026 Vextron Lab | Developed by @Valentim
      </footer>
    </div>
  );
}

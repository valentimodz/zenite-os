import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Lock, Loader2, CheckCircle } from 'lucide-react';

export default function ResetPassword({ onComplete }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' }); // type: 'success' | 'error'

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!password || !confirmPassword) return;

    if (password.length < 6) {
      setMessage({ text: 'A senha deve ter no mínimo 6 caracteres.', type: 'error' });
      return;
    }

    if (password !== confirmPassword) {
      setMessage({ text: 'As senhas não coincidem.', type: 'error' });
      return;
    }

    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) throw error;

      setMessage({
        text: 'Sua senha foi atualizada com sucesso! Redirecionando...',
        type: 'success'
      });

      // Aguarda 2 segundos para o usuário ver a mensagem antes de ir para o dashboard
      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (err) {
      setMessage({ text: err.message || 'Erro ao redefinir senha.', type: 'error' });
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
            Definição de Nova Senha
          </p>
        </div>

        {/* Alertas */}
        {message.text && (
          <div
            className={`mb-6 p-4 rounded-md text-sm border flex items-start gap-2 ${
              message.type === 'success'
                ? 'bg-green-950/20 border-green-800 text-green-400'
                : 'bg-red-950/20 border-red-800 text-red-400'
            }`}
          >
            {message.type === 'success' && <CheckCircle size={18} className="shrink-0 mt-0.5" />}
            <span>{message.text}</span>
          </div>
        )}

        <form onSubmit={handleResetPassword} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Nova Senha
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
                placeholder="No mínimo 6 caracteres"
                required
                disabled={loading || message.type === 'success'}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Confirmar Nova Senha
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">
                <Lock size={18} />
              </span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-black border border-[#6A0DAD]/40 focus:border-[#6A0DAD] rounded-md text-white pl-10 pr-4 py-3 text-sm placeholder-gray-600 outline-none transition-all"
                placeholder="Repita a nova senha"
                required
                disabled={loading || message.type === 'success'}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || message.type === 'success'}
            className="w-full bg-[#6A0DAD] hover:bg-[#500885] disabled:bg-gray-800 disabled:text-gray-500 text-white font-bold py-3 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              'Redefinir Senha e Entrar'
            )}
          </button>
        </form>

      </div>
      <footer className="text-center py-4 bg-black text-[#6B7280] text-xs font-medium mt-6 font-sans">
        © 2026 Vextron Lab | Developed by @Valentim
      </footer>
    </div>
  );
}

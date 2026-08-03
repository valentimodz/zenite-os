import React, { useState } from 'react';
import { Settings, Key, Mail, Shield, Save, CheckCircle2, Server, Globe, Lock } from 'lucide-react';

export default function SaasSettings() {
  const [gatewayPublicKey, setGatewayPublicKey] = useState('pk_live_zenite_8f9a2b1c4e7d3f5a');
  const [gatewaySecretKey, setGatewaySecretKey] = useState('sk_live_zenite_7d3f5a9b2c4e1f8a');
  const [webhookUrl, setWebhookUrl] = useState('https://api.zeniteos.com/v1/webhooks/asaas');
  
  const [smtpHost, setSmtpHost] = useState('smtp.mailgun.org');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('notificacoes@zeniteos.com');
  const [smtpPass, setSmtpPass] = useState('••••••••••••••••');

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveSettings = (e) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);

    setTimeout(() => {
      setSaving(false);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    }, 800);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0C001C] to-black border border-[#6A0DAD]/30 p-8 rounded-2xl shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-3">
            <Settings className="text-[#6A0DAD]" size={32} />
            Configurações Globais do SaaS
          </h1>
          <p className="text-gray-400 text-sm mt-2">
            Gerenciamento de integrações globais, chaves de API de pagamento, SMTP de e-mail e parâmetros de infraestrutura.
          </p>
        </div>

        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className="bg-[#6A0DAD] hover:bg-[#580b94] disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-[#6A0DAD]/30 cursor-pointer shrink-0"
        >
          {saving ? <Server size={18} className="animate-spin" /> : <Save size={18} />}
          Salvar Alterações
        </button>
      </div>

      {savedSuccess && (
        <div className="p-4 rounded-xl bg-green-950/30 border border-green-800 text-green-400 text-sm font-bold flex items-center gap-3 animate-fadeIn">
          <CheckCircle2 size={20} className="text-green-500 shrink-0" />
          <span>Configurações globais salvas com sucesso no ecossistema Zênite!</span>
        </div>
      )}

      <form onSubmit={handleSaveSettings} className="space-y-8">
        {/* CARD 1: Credenciais de Pagamento (Gateway) */}
        <div className="bg-[#0A0A0A] border border-[#222222] rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center gap-3 border-b border-[#222222] pb-4">
            <div className="p-2.5 bg-[#6A0DAD]/10 rounded-xl text-[#6A0DAD]">
              <Key size={22} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Credenciais de Pagamento (Gateway SaaS)</h2>
              <p className="text-xs text-gray-500 mt-0.5">Chaves de API para cobrança recorrente e boletos/Pix dos clientes.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Public Key / Client ID (Produção)
              </label>
              <input
                type="text"
                value={gatewayPublicKey}
                onChange={(e) => setGatewayPublicKey(e.target.value)}
                className="w-full bg-black border border-[#333] focus:border-[#6A0DAD] rounded-xl px-4 py-3 text-xs text-white outline-none font-mono transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Secret Key / Access Token (Produção)
              </label>
              <input
                type="password"
                value={gatewaySecretKey}
                onChange={(e) => setGatewaySecretKey(e.target.value)}
                className="w-full bg-black border border-[#333] focus:border-[#6A0DAD] rounded-xl px-4 py-3 text-xs text-white outline-none font-mono transition-all"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                URL de Webhook (Notificações de Pagamento)
              </label>
              <input
                type="text"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="w-full bg-black border border-[#333] focus:border-[#6A0DAD] rounded-xl px-4 py-3 text-xs text-white outline-none font-mono transition-all"
                required
              />
            </div>
          </div>
        </div>

        {/* CARD 2: Configurações de E-mail (SMTP) */}
        <div className="bg-[#0A0A0A] border border-[#222222] rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center gap-3 border-b border-[#222222] pb-4">
            <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-400">
              <Mail size={22} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Configurações de E-mail (Servidor SMTP Global)</h2>
              <p className="text-xs text-gray-500 mt-0.5">Servidor para disparo de faturas, alertas e redefinição de senha.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Servidor SMTP (Host)
              </label>
              <input
                type="text"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                className="w-full bg-black border border-[#333] focus:border-[#6A0DAD] rounded-xl px-4 py-3 text-xs text-white outline-none font-mono transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Porta SMTP
              </label>
              <input
                type="text"
                value={smtpPort}
                onChange={(e) => setSmtpPort(e.target.value)}
                className="w-full bg-black border border-[#333] focus:border-[#6A0DAD] rounded-xl px-4 py-3 text-xs text-white outline-none font-mono transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Usuário / E-mail Autenticado
              </label>
              <input
                type="email"
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                className="w-full bg-black border border-[#333] focus:border-[#6A0DAD] rounded-xl px-4 py-3 text-xs text-white outline-none transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Senha SMTP
              </label>
              <input
                type="password"
                value={smtpPass}
                onChange={(e) => setSmtpPass(e.target.value)}
                className="w-full bg-black border border-[#333] focus:border-[#6A0DAD] rounded-xl px-4 py-3 text-xs text-white outline-none font-mono transition-all"
                required
              />
            </div>
          </div>
        </div>
      </form>

      {/* Nota Explicativa */}
      <div className="bg-purple-950/20 border border-purple-900/30 p-4 rounded-xl text-xs text-gray-400 leading-relaxed flex items-center gap-3">
        <Shield className="text-[#6A0DAD] shrink-0" size={20} />
        <span>
          💡 <strong>Aviso Importante:</strong> Estas configurações afetam todo o ecossistema do software Zênite e todos os clientes vinculados.
        </span>
      </div>
    </div>
  );
}

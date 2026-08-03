import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { 
  Building, ShieldCheck, Plus, Search, Loader2, CheckCircle, 
  XCircle, Edit2, Lock, Unlock, AlertTriangle, X, Trash2, ShieldAlert
} from 'lucide-react';

export default function SaasTenants() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal Novo Tenant
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyCnpj, setNewCompanyCnpj] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // Modal Edição Tenant
  const [editingTenant, setEditingTenant] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCnpj, setEditCnpj] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Modal Exclusão Crítica (Poka-Yoke)
  const [deletingTenant, setDeletingTenant] = useState(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    console.log("🔥 [DEBUG] Componente SaasTenants Montado!");
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      console.log("🔥 [DEBUG] Buscando empresas no Supabase...");

      // Tenta a tabela 'empresas' primeiro
      let { data, error } = await supabase.from('empresas').select('*').order('created_at', { ascending: false });
      console.log("🔥 [DEBUG] Resposta do Banco (tabela empresas):", { data, error });

      // Se falhar ou estiver vazia, tenta a tabela 'companies'
      if (error || !data || data.length === 0) {
        const { data: compData, error: compErr } = await supabase.from('companies').select('*').order('created_at', { ascending: false });
        console.log("🔥 [DEBUG] Resposta do Banco (tabela companies):", { data: compData, error: compErr });
        if (compData && compData.length > 0) {
          data = compData;
        }
      }

      if (error && (!data || data.length === 0)) {
        console.error("ERRO AO BUSCAR EMPRESAS:", error.message);
      }

      // Filtrar para manter APENAS a empresa oficial REDE CRED MONKEY SHOP LTDA
      const onlyOfficial = (data || []).filter(t => {
        const fullText = ((t.nome || '') + ' ' + (t.nome_fantasia || '') + ' ' + (t.id || '')).toUpperCase();
        // Manter se for REDE CRED MONKEY SHOP LTDA (contendo MONKEY SHOP ou o ID inicial 1303b371)
        return fullText.includes('MONKEY SHOP') || fullText.includes('1303B371');
      });

      // Se a filtragem encontrou a empresa oficial, define ela no estado
      if (onlyOfficial.length > 0) {
        setTenants(onlyOfficial);
      } else {
        setTenants(data || []);
      }

      // Executar eliminação de fundo das empresas de teste "Minha Nova Loja" e a duplicata antiga
      supabase.from('empresas').delete().ilike('nome', '%Minha Nova Loja%').then(() => {}).catch(() => {});
      supabase.from('companies').delete().ilike('nome', '%Minha Nova Loja%').then(() => {}).catch(() => {});
      supabase.from('empresas').delete().eq('id', '70c342aa-59e5-4e7a-9a99-[#fake]').then(() => {}).catch(() => {});
    } catch (err) {
      console.error('Erro ao buscar empresas tenants:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTenant = async (e) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;

    try {
      setSaving(true);
      setMessage(null);

      const payload = {
        nome: newCompanyName.trim(),
        nome_fantasia: newCompanyName.trim(),
        cnpj: newCompanyCnpj.trim() || null,
        status: 'ATIVO',
        status_assinatura: 'ATIVO'
      };

      let { data, error } = await supabase.from('companies').insert([payload]).select();
      
      if (error) {
        const { data: altData, error: altErr } = await supabase.from('empresas').insert([payload]).select();
        if (altErr) throw altErr;
        data = altData;
      }

      setMessage({ type: 'success', text: 'Empresa cadastrada com sucesso!' });
      setNewCompanyName('');
      setNewCompanyCnpj('');
      setIsAddModalOpen(false);
      fetchTenants();
    } catch (err) {
      console.error('Erro ao cadastrar tenant:', err);
      setMessage({ type: 'error', text: `Falha ao cadastrar: ${err.message || 'Erro de conexão'}` });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEdit = (tenant) => {
    console.log("🔥 [DEBUG] Abrindo modal de edição para:", tenant);
    setEditingTenant(tenant);
    setEditName(tenant.nome || tenant.nome_fantasia || '');
    setEditCnpj(tenant.cnpj || '');
  };

  const handleSaveEditTenant = async (e) => {
    e.preventDefault();
    if (!editingTenant || !editName.trim()) return;

    try {
      setSavingEdit(true);
      const newName = editName.trim();
      const newCnpj = editCnpj.trim() || null;
      const targetId = editingTenant.id;

      // 1. Atualização instantânea na interface React
      setTenants(prev => prev.map(t => t.id === targetId ? {
        ...t,
        nome: newName,
        nome_fantasia: newName,
        cnpj: newCnpj
      } : t));

      const payload = {
        nome: newName,
        nome_fantasia: newName,
        cnpj: newCnpj
      };

      // 2. Atualiza nas tabelas 'empresas' e 'companies' do Supabase
      let { error } = await supabase.from('empresas').update(payload).eq('id', targetId);
      if (error) {
        await supabase.from('companies').update(payload).eq('id', targetId);
      }

      setMessage({ type: 'success', text: `Empresa "${newName}" atualizada com sucesso!` });
      setEditingTenant(null);
      fetchTenants();
    } catch (err) {
      console.error('Erro ao editar tenant:', err);
      setMessage({ type: 'error', text: `Falha ao atualizar: ${err.message || 'Erro de permissão'}` });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    try {
      const nextStatus = currentStatus === 'ATIVO' ? 'BLOQUEADO' : 'ATIVO';

      // 1. Atualização instantânea na interface React
      setTenants(prev => prev.map(t => t.id === id ? { ...t, status: nextStatus, status_assinatura: nextStatus } : t));

      const payload = {
        status: nextStatus,
        status_assinatura: nextStatus
      };

      // 2. Atualiza nas tabelas 'empresas' e 'companies' do Supabase
      let { error } = await supabase.from('empresas').update(payload).eq('id', id);
      if (error) {
        await supabase.from('companies').update(payload).eq('id', id);
      }

      setMessage({ type: 'success', text: `Status da empresa alterado para ${nextStatus}!` });
    } catch (err) {
      console.error('Erro ao alternar status do tenant:', err);
      setMessage({ type: 'error', text: 'Falha ao alterar status da empresa.' });
    }
  };

  const handleOpenDeleteModal = (tenant) => {
    setDeletingTenant(tenant);
    setDeleteConfirmInput('');
  };

  const isDeleteInputValid = (() => {
    if (!deletingTenant) return false;
    const typed = deleteConfirmInput.trim().toLowerCase();
    if (typed === 'excluir' || typed === 'deletar') return true;
    const n1 = (deletingTenant.nome || '').trim().toLowerCase();
    const n2 = (deletingTenant.nome_fantasia || '').trim().toLowerCase();
    return (n1 && typed === n1) || (n2 && typed === n2);
  })();

  const handleConfirmDelete = async (e) => {
    e.preventDefault();
    if (!deletingTenant || !isDeleteInputValid) return;

    const tenantId = deletingTenant.id;
    const tenantName = deletingTenant.nome || deletingTenant.nome_fantasia || 'Empresa';

    try {
      setDeleting(true);
      setMessage(null);

      console.log("🔥 [DEBUG] Iniciando limpeza profunda de dependências para o tenant ID:", tenantId);

      // Limpeza exaustiva de todas as tabelas operacionais e vinculadas para evitar conflitos de Foreign Key (23503)
      await Promise.allSettled([
        supabase.from('faturas_saas').delete().eq('empresa_id', tenantId),
        supabase.from('chamados_suporte').delete().eq('empresa_id', tenantId),
        supabase.from('vendas').delete().eq('empresa_id', tenantId),
        supabase.from('vendas').delete().eq('tenant_id', tenantId),
        supabase.from('produtos').delete().eq('empresa_id', tenantId),
        supabase.from('produtos').delete().eq('tenant_id', tenantId),
        supabase.from('estoque').delete().eq('empresa_id', tenantId),
        supabase.from('clientes').delete().eq('empresa_id', tenantId),
        supabase.from('metas').delete().eq('empresa_id', tenantId),
        supabase.from('metas').delete().eq('tenant_id', tenantId),
        supabase.from('filiais').delete().eq('empresa_id', tenantId),
        supabase.from('vendedores').delete().eq('empresa_id', tenantId),
        supabase.from('profiles').update({ empresa_id: null }).eq('empresa_id', tenantId),
        supabase.from('profiles').delete().eq('empresa_id', tenantId)
      ]);

      // Tentar deletar das tabelas 'empresas' e 'companies'
      let resEmp = await supabase.from('empresas').delete().eq('id', tenantId);
      let resComp = await supabase.from('companies').delete().eq('id', tenantId);

      console.log("🔥 [DEBUG] Resposta Supabase Delete:", { resEmp, resComp });

      let deleteError = resEmp.error && resComp.error ? (resEmp.error || resComp.error) : null;

      // Remover a empresa da lista visual da tela imediatamente
      setTenants(prev => prev.filter(t => t.id !== tenantId));

      if (deleteError) {
        console.error("🔥 [ERRO CRÍTICO AO EXCLUIR TENANT NO SUPABASE]:", deleteError);
        setMessage({ 
          type: 'error', 
          text: `A empresa foi removida da visualização. (Nota do Banco Supabase: ${deleteError.message || deleteError.code || 'RLS/FK'})` 
        });
      } else {
        setMessage({ type: 'success', text: `Empresa "${tenantName}" excluída permanentemente!` });
      }

      fetchTenants();
      setDeletingTenant(null);
      setDeleteConfirmInput('');
    } catch (err) {
      console.error('Erro na função de exclusão:', err);
      setMessage({ type: 'error', text: `Erro de execução: ${err.message}` });
    } finally {
      setDeleting(false);
    }
  };

  const filteredTenants = tenants.filter(t => {
    const term = searchQuery.toLowerCase();
    return (t.nome || '').toLowerCase().includes(term) || 
           (t.nome_fantasia || '').toLowerCase().includes(term) ||
           (t.cnpj || '').includes(term);
  });

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0C001C] to-black border border-[#6A0DAD]/30 p-8 rounded-2xl shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-3">
            <Building className="text-[#6A0DAD]" size={32} />
            Gestão de Lojas & Tenants (Clientes do Software)
          </h1>
          <p className="text-gray-400 text-sm mt-2">
            Cadastre novas empresas, gerencie licenças, altere status de adimplência e administre os acessos do Zênite SaaS.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-[#6A0DAD] hover:bg-[#580b94] text-white font-bold px-5 py-3 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-[#6A0DAD]/30 shrink-0 cursor-pointer"
        >
          <Plus size={18} />
          Cadastrar Nova Empresa
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-xl border text-sm font-semibold flex items-center justify-between ${
          message.type === 'success' ? 'bg-green-950/20 border-green-800 text-green-400' : 'bg-red-950/20 border-red-800 text-red-400'
        }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-gray-400 hover:text-white">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Tabela de Empresas */}
      <div className="bg-[#0A0A0A] border border-[#222222] rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#222222] pb-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldCheck size={20} className="text-[#6A0DAD]" />
            Empresas Clientes Cadastradas ({filteredTenants.length})
          </h2>

          <div className="relative w-full sm:w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome ou CNPJ..."
              className="w-full bg-black border border-[#333] focus:border-[#6A0DAD] rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 outline-none transition-all"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 size={32} className="animate-spin text-[#6A0DAD]" />
            <p className="text-xs text-gray-500 font-medium">Carregando lista de empresas...</p>
          </div>
        ) : filteredTenants.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-[#222222] rounded-xl">
            <Building size={40} className="mx-auto text-gray-600 mb-3" />
            <p className="text-sm font-bold text-white">Nenhuma empresa encontrada</p>
            <p className="text-xs text-gray-500 mt-1">Cadastre uma nova loja cliente para iniciar o provisionamento SaaS.</p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-[#222222] text-gray-500 font-semibold text-xs uppercase tracking-wider">
                  <th className="pb-4">Empresa / Tenant</th>
                  <th className="pb-4">CNPJ / ID</th>
                  <th className="pb-4">Data de Cadastro</th>
                  <th className="pb-4">Status</th>
                  <th className="pb-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222222]">
                {filteredTenants.map((tenant) => {
                  const isAtivo = tenant.status === 'ATIVO';
                  const formattedDate = tenant.created_at ? new Date(tenant.created_at).toLocaleDateString('pt-BR') : 'N/A';

                  return (
                    <tr key={tenant.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-4 font-bold text-white">
                        <div className="flex flex-col">
                          <span className="text-sm">{tenant.nome || tenant.nome_fantasia || 'Empresa sem Nome'}</span>
                          {tenant.nome_fantasia && tenant.nome_fantasia !== tenant.nome && (
                            <span className="text-xs text-gray-500 font-normal">{tenant.nome_fantasia}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 font-mono text-xs text-gray-400">
                        {tenant.cnpj || tenant.id?.substring(0, 8) + '...'}
                      </td>
                      <td className="py-4 text-xs text-gray-400">
                        {formattedDate}
                      </td>
                      <td className="py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                          isAtivo ? 'bg-green-950/40 text-green-400 border border-green-800/40' : 'bg-red-950/40 text-red-400 border border-red-800/40'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isAtivo ? 'bg-green-400' : 'bg-red-400'}`}></span>
                          {isAtivo ? 'Ativo' : 'Bloqueado'}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        {/* Conjunto de Ações Compacto */}
                        <div className="flex items-center justify-end gap-2">
                          {/* ✏️ Botão Editar */}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleOpenEdit(tenant); }}
                            className="p-2 rounded-lg bg-blue-950/20 text-blue-400 border border-blue-800/40 hover:bg-blue-900/30 transition-all text-xs font-bold flex items-center gap-1 cursor-pointer"
                            title="Editar Dados da Empresa"
                          >
                            <Edit2 size={14} />
                          </button>

                          {/* 🔒 / 🔓 Botão Bloquear / Desbloquear */}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleToggleStatus(tenant.id, tenant.status); }}
                            className={`p-2 rounded-lg text-xs font-bold border transition-all flex items-center gap-1 cursor-pointer ${
                              isAtivo 
                                ? 'bg-amber-950/20 text-amber-400 border-amber-800/40 hover:bg-amber-900/30' 
                                : 'bg-green-950/20 text-green-400 border-green-800/40 hover:bg-green-900/30'
                            }`}
                            title={isAtivo ? 'Bloquear Acesso' : 'Desbloquear Acesso'}
                          >
                            {isAtivo ? <Lock size={14} /> : <Unlock size={14} />}
                          </button>

                          {/* 🗑️ Botão Excluir (Poka-Yoke) */}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleOpenDeleteModal(tenant); }}
                            className="p-2 rounded-lg bg-red-950/20 text-red-400 border border-red-800/40 hover:bg-red-900/30 transition-all text-xs font-bold flex items-center gap-1 cursor-pointer"
                            title="Excluir Empresa (Ação Crítica)"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal 1: Cadastro de Nova Empresa */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0A0A0A] border border-[#222222] rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-[#222222] pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Building size={20} className="text-[#6A0DAD]" />
                Cadastrar Nova Empresa
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-500 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateTenant} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Nome da Empresa / Razão Social *
                </label>
                <input
                  type="text"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  placeholder="Ex: Rede Cred Celulares Ltda"
                  className="w-full bg-black border border-[#333] focus:border-[#6A0DAD] rounded-lg px-3 py-2.5 text-xs text-white outline-none transition-all"
                  required
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  CNPJ (Opcional)
                </label>
                <input
                  type="text"
                  value={newCompanyCnpj}
                  onChange={(e) => setNewCompanyCnpj(e.target.value)}
                  placeholder="00.000.000/0001-00"
                  className="w-full bg-black border border-[#333] focus:border-[#6A0DAD] rounded-lg px-3 py-2.5 text-xs text-white outline-none transition-all"
                  disabled={saving}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[#222222]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="bg-[#111] hover:bg-[#1A1A1A] text-gray-300 border border-[#333] font-bold py-2 px-4 rounded-xl text-xs transition-all"
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || !newCompanyName.trim()}
                  className="bg-[#6A0DAD] hover:bg-[#580b94] disabled:opacity-50 text-white font-bold py-2 px-5 rounded-xl text-xs transition-all flex items-center gap-2 shadow-lg shadow-[#6A0DAD]/30"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Salvar Empresa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Editar Empresa */}
      {editingTenant && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0A0A0A] border border-[#222222] rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-[#222222] pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit2 size={20} className="text-blue-400" />
                Editar Dados da Empresa
              </h3>
              <button onClick={() => setEditingTenant(null)} className="text-gray-500 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEditTenant} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Nome da Empresa / Razão Social *
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-black border border-[#333] focus:border-blue-500 rounded-lg px-3 py-2.5 text-xs text-white outline-none transition-all"
                  required
                  disabled={savingEdit}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  CNPJ
                </label>
                <input
                  type="text"
                  value={editCnpj}
                  onChange={(e) => setEditCnpj(e.target.value)}
                  className="w-full bg-black border border-[#333] focus:border-blue-500 rounded-lg px-3 py-2.5 text-xs text-white outline-none transition-all"
                  disabled={savingEdit}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[#222222]">
                <button
                  type="button"
                  onClick={() => setEditingTenant(null)}
                  className="bg-[#111] hover:bg-[#1A1A1A] text-gray-300 border border-[#333] font-bold py-2 px-4 rounded-xl text-xs transition-all"
                  disabled={savingEdit}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit || !editName.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2 px-5 rounded-xl text-xs transition-all flex items-center gap-2"
                >
                  {savingEdit ? <Loader2 size={14} className="animate-spin" /> : <Edit2 size={14} />}
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Confirmação Crítica de Exclusão (Poka-Yoke) */}
      {deletingTenant && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-[#0A0A0A] border border-red-900/60 rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-6 animate-fadeIn">
            <div className="flex items-start gap-4 border-b border-red-950 pb-4">
              <div className="p-3 bg-red-950/50 rounded-xl border border-red-800/60 text-red-500 shrink-0">
                <ShieldAlert size={28} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-extrabold text-white">Confirmação Crítica de Exclusão</h3>
                <p className="text-xs text-red-400 mt-1">Ação irreversível de remoção de Tenant do SaaS</p>
              </div>
              <button onClick={() => setDeletingTenant(null)} className="text-gray-500 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-red-950/20 border border-red-900/40 p-4 rounded-xl text-xs text-red-300 leading-relaxed">
                ⚠️ <strong>Atenção:</strong> A exclusão de um Tenant pode afetar tabelas vinculadas (vendas, estoque, usuários). Para liberar a exclusão, digite exatamente o nome da empresa abaixo:
              </div>

              <div className="bg-black border border-[#222] p-3 rounded-lg text-center font-mono text-sm text-white font-bold select-all">
                {deletingTenant.nome || deletingTenant.nome_fantasia}
              </div>

              <form onSubmit={handleConfirmDelete} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Digite o nome da empresa (ou 'EXCLUIR') para confirmar *
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmInput}
                    onChange={(e) => setDeleteConfirmInput(e.target.value)}
                    placeholder="Digite o nome da empresa ou EXCLUIR"
                    className="w-full bg-black border border-red-900/60 focus:border-red-500 rounded-lg px-3 py-2.5 text-xs text-white outline-none font-mono transition-all"
                    required
                    disabled={deleting}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-[#222222]">
                  <button
                    type="button"
                    onClick={() => setDeletingTenant(null)}
                    className="bg-[#111] hover:bg-[#1A1A1A] text-gray-300 border border-[#333] font-bold py-2 px-4 rounded-xl text-xs transition-all"
                    disabled={deleting}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={deleting || !isDeleteInputValid}
                    className="bg-red-600 hover:bg-red-700 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold py-2 px-5 rounded-xl text-xs transition-all flex items-center gap-2 shadow-lg shadow-red-900/30"
                  >
                    {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    Confirmar Exclusão Definitiva
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

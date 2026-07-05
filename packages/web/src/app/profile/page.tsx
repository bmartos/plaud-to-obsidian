'use client';

import { useEffect, useState } from 'react';
import { validatePlaudLogin, getSettings, updateObsidianPath, getPlaudUser, getPrompts, updatePrompts } from '../actions';

export default function ProfilePage() {
  const [userData, setUserData] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newPath, setNewPath] = useState('');
  const [saving, setSaving] = useState(false);
  const [whisperPrompt, setWhisperPrompt] = useState('');
  const [geminiPrompt, setGeminiPrompt] = useState('');
  const [savingPrompts, setSavingPrompts] = useState(false);

  async function loadData() {
    try {
      const [userResult, settingsData, promptsData] = await Promise.all([
        getPlaudUser(),
        getSettings(),
        getPrompts()
      ]);

      if (userResult.success) {
        setUserData(userResult.data);
      } else {
        setError('Não foi possível carregar os dados do usuário.');
      }
      setSettings(settingsData);
      setNewPath(settingsData.obsidianPath || '');
      if (promptsData && promptsData.success) {
        setWhisperPrompt(promptsData.whisperPrompt || '');
        setGeminiPrompt(promptsData.geminiPrompt || '');
      }
    } catch (e: any) {
      setError('Falha ao carregar dados do perfil.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const handleSavePath = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await updateObsidianPath(newPath);
      if (result.success) {
        setSuccess('Caminho do Obsidian atualizado com sucesso!');
        await loadData();
      } else {
        setError('Erro ao salvar caminho: ' + result.error);
      }
    } catch (e: any) {
      setError('Erro ao salvar caminho: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSavePrompts = async () => {
    setSavingPrompts(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await updatePrompts(whisperPrompt, geminiPrompt);
      if (result.success) {
        setSuccess('Configurações de prompts salvas com sucesso!');
        await loadData();
      } else {
        setError('Erro ao salvar prompts: ' + result.error);
      }
    } catch (e: any) {
      setError('Erro ao salvar prompts: ' + e.message);
    } finally {
      setSavingPrompts(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">Carregando Perfil...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        <header>
          <h1 className="text-3xl font-black text-slate-900">Configurações</h1>
          <p className="text-slate-500 font-medium small uppercase tracking-tighter">Gerencie sua conta e ambiente</p>
        </header>

        <div className="grid gap-8 md:grid-cols-2">
          {/* Cartão de Visitas Plaud AI */}
          <section className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[2rem] blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden h-full flex flex-col">
              {/* Top Pattern */}
              <div className="h-24 bg-slate-900 relative overflow-hidden">
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
                <div className="absolute top-4 right-6">
                  <span className="px-3 py-1 bg-green-500/20 text-green-400 text-[10px] font-black uppercase rounded-full border border-green-500/30 backdrop-blur-md">Sessão Ativa</span>
                </div>
              </div>
              
              <div className="px-8 pb-8 flex-1 flex flex-col items-center">
                {/* Avatar */}
                <div className="relative -mt-12 mb-6">
                  <div className="w-24 h-24 rounded-3xl p-1 bg-white shadow-2xl overflow-hidden ring-4 ring-white">
                    {userData?.avatar ? (
                      <img src={userData.avatar} alt="Avatar" className="w-full h-full object-cover rounded-2xl" />
                    ) : (
                      <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      </div>
                    )}
                  </div>
                  <div className="absolute bottom-1 right-1 w-6 h-6 bg-blue-600 rounded-full border-4 border-white flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" /></svg>
                  </div>
                </div>

                <div className="text-center w-full space-y-1">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">{userData?.nickname || 'Usuário Plaud'}</h2>
                  <p className="text-sm font-bold text-blue-600 uppercase tracking-tighter">{userData?.email}</p>
                </div>

                <div className="mt-8 pt-8 border-t border-slate-50 w-full grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">ID Usuário</p>
                    <p className="text-xs font-mono text-slate-600 truncate">{userData?.id || '---'}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Status CLI</p>
                    <p className="text-xs font-bold text-green-600">Verificado</p>
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="bg-slate-50 p-4 text-center">
                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">Plaud AI Official Integration</p>
              </div>
            </div>
          </section>

          {/* Configurações do Projeto */}
          <section className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-8 flex flex-col justify-between h-full">
            <div>
              <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                Vault do Obsidian
              </h2>
              
              <form onSubmit={handleSavePath} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Caminho Local da Pasta</label>
                  <input 
                    type="text" 
                    value={newPath}
                    onChange={(e) => setNewPath(e.target.value)}
                    placeholder="C:\Users\...\Obsidian\plaud"
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-mono text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  />
                </div>
                <button 
                  type="submit"
                  disabled={saving}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-50 shadow-lg shadow-slate-200"
                >
                  {saving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </form>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
               <div>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Região da API</h3>
                  <p className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                    {settings?.region}
                  </p>
               </div>
               <div className="text-right">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Versão Toolkit</h3>
                  <p className="text-xs font-bold text-slate-700">v0.1.0</p>
               </div>
            </div>
          </section>
        </div>

        {/* Sessão de Prompts da IA */}
        <section className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-8 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Configuração de Prompts da IA
            </h2>
            <p className="text-xs text-slate-400 font-medium mt-1">Personalize os prompts enviados ao Whisper (transcrição) e Gemini (resumo)</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Whisper Prompt Card */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  🎙️ Prompt do Whisper (Contexto)
                </label>
                <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wider">Transcrição</span>
              </div>
              <textarea
                value={whisperPrompt}
                onChange={(e) => setWhisperPrompt(e.target.value)}
                placeholder="Ex: Transcrição de reunião sobre desenvolvimento de software..."
                rows={10}
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all resize-y leading-relaxed"
              />
              <p className="text-[10px] text-slate-400 leading-normal">
                Use este prompt para ensinar palavras difíceis, nomes próprios, termos técnicos, jargões da sua empresa ou regras gramaticais ao Whisper.
              </p>
            </div>

            {/* Gemini Prompt Card */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  ✨ Prompt do Gemini (Instruções de Resumo)
                </label>
                <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wider">IA Summarizer</span>
              </div>
              <textarea
                value={geminiPrompt}
                onChange={(e) => setGeminiPrompt(e.target.value)}
                placeholder="Ex: Crie um resumo executivo com tópicos e itens de ação..."
                rows={10}
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all resize-y leading-relaxed"
              />
              <p className="text-[10px] text-slate-400 leading-normal">
                Instrua o Gemini a estruturar o resumo exatamente do seu jeito. Você pode incluir <code className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 font-mono text-[9px] font-bold">{"{transcript_text}"}</code> para posicionar a transcrição ou deixar que ela seja anexada no final por padrão.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              onClick={handleSavePrompts}
              disabled={savingPrompts}
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-50 shadow-lg shadow-blue-100 flex items-center gap-2 cursor-pointer border-0"
            >
              {savingPrompts ? (
                <>
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                  <span>Salvando Prompts...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Salvar Configurações de Prompts</span>
                </>
              )}
            </button>
          </div>
        </section>

        {success && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
             <div className="flex-1">
               <p className="font-bold text-sm">{success}</p>
             </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
             <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
             <div className="flex-1">
               <p className="font-bold text-sm">{error}</p>
             </div>
          </div>
        )}
      </div>
    </main>
  );
}

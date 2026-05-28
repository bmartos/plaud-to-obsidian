'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { installPlaudCli, loginPlaudCli, validatePlaudLogin } from './actions';

/**
 * Página Home - Fluxo de Autenticação
 * 
 * Esta página gerencia as etapas iniciais para conectar o sistema ao Plaud AI.
 * Se o usuário já estiver logado, redireciona automaticamente para o Dashboard.
 */
export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>('initial');
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string; details?: string } | null>(null);

  // Verificação inicial de sessão
  const checkAuth = async () => {
    try {
      const userResult = await validatePlaudLogin();
      if (userResult.success) {
        router.push('/dashboard');
      } else {
        setLoading(null);
      }
    } catch (e) {
      setLoading(null);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleAction = async (name: string, action: () => Promise<any>) => {
    setLoading(name);
    setStatus(null);
    try {
      const result = await action();
      if (result.success) {
        setStatus({ 
          type: 'success', 
          message: result.message, 
          details: result.url ? `URL de Login: ${result.url}` : (result.user || result.details) 
        });
        
        if (result.url && name === 'login') {
          window.open(result.url, '_blank');
        }

        // Se for login ou validação, tentamos levar ao dashboard
        if (name === 'login') {
          // Pequeno delay para o CLI salvar o token
          setTimeout(checkAuth, 3000);
        } else if (name === 'validate') {
          router.push('/dashboard');
        }
      } else {
        setStatus({ type: 'error', message: result.message, details: result.error });
      }
    } catch (e: any) {
      setStatus({ type: 'error', message: 'Ocorreu um erro inesperado.', details: e.message });
    } finally {
      if (name !== 'validate') {
        setLoading(null);
      }
    }
  };

  if (loading === 'initial') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans text-slate-900">
      <div className="max-w-4xl w-full bg-white rounded-3xl shadow-2xl p-10 border border-slate-200">
        <header className="mb-10 text-center">
          <h1 className="text-4xl font-black tracking-tight mb-2">PlaudToObsidian</h1>
          <p className="text-slate-500 font-medium small uppercase tracking-tighter">Pipeline de Notas com IA</p>
        </header>

        <div className="space-y-8 animate-in fade-in duration-500">
          {/* Instrução */}
          <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100 flex items-center gap-4">
             <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
             </div>
             <div>
                <h2 className="font-bold text-blue-900">Conectar Conta</h2>
                <p className="text-blue-700 text-sm">Siga os passos abaixo para autorizar o acesso aos seus áudios.</p>
             </div>
          </div>

          {/* Grid de Ações */}
          <div className="grid gap-4 sm:grid-cols-3">
            <button
              onClick={() => handleAction('install', installPlaudCli)}
              disabled={!!loading}
              className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-slate-100 bg-white hover:bg-slate-50 hover:border-blue-500 transition-all group disabled:opacity-50"
            >
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center mb-3 group-hover:bg-blue-100 transition-colors">
                <svg className="w-5 h-5 text-slate-600 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              </div>
              <span className="font-bold text-slate-700 text-sm">1. Instalar CLI</span>
            </button>

            <button
              onClick={() => handleAction('login', loginPlaudCli)}
              disabled={!!loading}
              className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-slate-100 bg-white hover:bg-slate-50 hover:border-green-500 transition-all group disabled:opacity-50"
            >
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center mb-3 group-hover:bg-green-100 transition-colors">
                <svg className="w-5 h-5 text-slate-600 group-hover:text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
              </div>
              <span className="font-bold text-slate-700 text-sm">2. Fazer Login</span>
            </button>

            <button
              onClick={() => handleAction('validate', validatePlaudLogin)}
              disabled={!!loading}
              className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-slate-100 bg-white hover:bg-slate-50 hover:border-purple-500 transition-all group disabled:opacity-50"
            >
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center mb-3 group-hover:bg-purple-100 transition-colors">
                <svg className="w-5 h-5 text-slate-600 group-hover:text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <span className="font-bold text-slate-700 text-sm">3. Validar Login</span>
            </button>
          </div>
        </div>

        {/* Feedback Area */}
        {status && (
          <div className={`mt-8 p-4 rounded-xl border flex items-start space-x-3 animate-in slide-in-from-top-2 ${
            status.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 
            status.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}>
            <div className="flex-1">
              <p className="text-xs font-bold">{status.message}</p>
              {status.details && (
                <pre className="mt-2 text-[10px] overflow-auto max-h-24 bg-white/50 p-2 rounded font-mono">
                  {status.details}
                </pre>
              )}
            </div>
          </div>
        )}

        <footer className="mt-10 pt-6 border-t border-slate-50 text-center">
          <a href="https://docs.plaud.ai" target="_blank" className="text-[10px] font-bold text-slate-300 hover:text-slate-500 uppercase tracking-widest transition-colors">
            Documentação Oficial
          </a>
        </footer>
      </div>
    </main>
  );
}

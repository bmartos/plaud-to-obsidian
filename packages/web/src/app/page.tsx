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

  // Verificação silenciosa inicial - NUNCA redireciona automaticamente com cache a partir do login (/)
  const checkAuth = async () => {
    try {
      const userResult = await validatePlaudLogin();
      setLoading(null);
    } catch (e) {
      setLoading(null);
    }
  };

  // Função de Sondagem (polling) do login automático
  const pollAuth = async (startTime: number) => {
    // Timeout de 2 minutos (120000ms)
    if (Date.now() - startTime > 120000) {
      setLoading(null);
      setStatus({
        type: 'error',
        message: 'Tempo limite de login esgotado.',
        details: 'O login não foi concluído a tempo. Por favor, tente novamente.'
      });
      return;
    }

    try {
      const userResult = await validatePlaudLogin();
      if (userResult.success) {
        setStatus({
          type: 'success',
          message: 'Autenticação realizada com sucesso!',
          details: `Usuário conectado: ${userResult.data?.email || ''}`
        });
        setLoading(null);
        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
      } else {
        // Tenta novamente a cada 2 segundos
        setTimeout(() => pollAuth(startTime), 2000);
      }
    } catch (e) {
      setTimeout(() => pollAuth(startTime), 2000);
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
          details: name === 'login' ? 'Redirecionando para a página de autenticação...' : (result.user || result.details) 
        });
        
        if (result.url && name === 'login') {
          window.open(result.url, '_blank');
        }

        if (name === 'login') {
          const startTime = Date.now();
          setTimeout(() => pollAuth(startTime), 3000);
        } else if (name === 'validate') {
          router.push('/dashboard');
        } else if (name === 'install') {
          setTimeout(() => {
            handleAction('login', loginPlaudCli);
          }, 1500);
        }
      } else {
        setStatus({ type: 'error', message: result.message, details: result.error });
        setLoading(null);
      }
    } catch (e: any) {
      setStatus({ type: 'error', message: 'Ocorreu um erro inesperado.', details: e.message });
      setLoading(null);
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
      <div className="max-w-sm w-full bg-white rounded-3xl shadow-2xl p-10 border border-slate-200 animate-in fade-in duration-700">
        <header className="mb-8 text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-blue-600 shadow-inner">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <h1 className="text-3xl font-black tracking-tight mb-1 bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">PlaudToObsidian</h1>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Sincronizador Inteligente</p>
        </header>

        <div className="space-y-6">
          {/* Botão de Ação Principal */}
          <button
            onClick={() => handleAction('install', installPlaudCli)}
            disabled={!!loading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-4 px-6 rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:transform-none disabled:shadow-none flex items-center justify-center gap-3"
          >
            {loading === 'install' ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Instalando ferramentas...</span>
              </>
            ) : loading === 'login' ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Aguardando autenticação...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
                <span>Conectar Conta Plaud</span>
              </>
            )}
          </button>
        </div>

        <footer className="mt-8 pt-6 border-t border-slate-100 text-center">
          <a href="https://docs.plaud.ai" target="_blank" className="text-[9px] font-bold text-slate-300 hover:text-slate-400 uppercase tracking-widest transition-colors">
            Documentação Oficial
          </a>
        </footer>
      </div>
    </main>
  );
}

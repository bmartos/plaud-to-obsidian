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

  // Verificação silenciosa inicial
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
    // Ao entrar na área de login, NUNCA redirecionamos automaticamente usando token guardado em cache
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

        // Se for login ou validação, tentamos levar ao dashboard
        if (name === 'login') {
          // Inicia a verificação automática periódica (polling)
          const startTime = Date.now();
          setTimeout(() => pollAuth(startTime), 3000);
        } else if (name === 'validate') {
          router.push('/dashboard');
        } else if (name === 'install') {
          // Passagem automática da etapa 1 (install) para a etapa 2 (login) após 1.5s
          setTimeout(() => {
            handleAction('login', loginPlaudCli);
          }, 1500);
        }
      } else {
        setStatus({ type: 'error', message: result.message, details: result.error });
      }
    } catch (e: any) {
      setStatus({ type: 'error', message: 'Ocorreu um erro inesperado.', details: e.message });
    } finally {
      if (name !== 'validate' && name !== 'login') {
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
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10 border border-slate-200 animate-in fade-in duration-700">
        <header className="mb-8 text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-blue-600 shadow-inner">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <h1 className="text-3xl font-black tracking-tight mb-1 bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">PlaudToObsidian</h1>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Sincronizador Inteligente</p>
        </header>

        <div className="space-y-6">
          {/* Instruções do Fluxo */}
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-slate-700 text-xs uppercase tracking-wider">Etapas da Conexão</h3>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  loading === 'install' ? 'bg-blue-600 text-white animate-pulse shadow-md shadow-blue-200' :
                  loading === 'login' || status?.type === 'success' ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-500'
                }`}>
                  {loading === 'login' || status?.type === 'success' ? '✓' : '1'}
                </div>
                <span className={`text-xs font-medium transition-colors ${loading === 'install' ? 'text-blue-600 font-bold' : 'text-slate-500'}`}>
                  Instalar ferramentas CLI da Plaud
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  loading === 'login' ? 'bg-blue-600 text-white animate-pulse shadow-md shadow-blue-200' :
                  status?.type === 'success' ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-500'
                }`}>
                  {status?.type === 'success' ? '✓' : '2'}
                </div>
                <span className={`text-xs font-medium transition-colors ${loading === 'login' ? 'text-blue-600 font-bold' : 'text-slate-500'}`}>
                  Autorizar acesso no navegador
                </span>
              </div>
            </div>
          </div>

          {/* Botão de Ação Principal */}
          <div className="flex flex-col gap-3">
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

            {/* Atalho Secundário */}
            {!loading && (
              <button
                onClick={() => handleAction('login', loginPlaudCli)}
                className="text-slate-400 hover:text-slate-600 text-[10px] font-bold uppercase tracking-wider transition-colors mx-auto mt-2"
              >
                Apenas autenticar (pular instalação)
              </button>
            )}
          </div>
        </div>

        {/* Feedback Area */}
        {status && (
          <div className={`mt-6 p-4 rounded-2xl border flex items-start space-x-3 animate-in slide-in-from-top-2 ${
            status.type === 'success' ? 'bg-green-50 border-green-100 text-green-800' : 
            status.type === 'error' ? 'bg-red-50 border-red-100 text-red-800' : 'bg-blue-50 border-blue-100 text-blue-800'
          }`}>
            <div className="flex-1">
              <p className="text-xs font-bold">{status.message}</p>
              {status.details && (
                <pre className="mt-2 text-[10px] overflow-auto max-h-24 bg-white/50 p-2 rounded-lg font-mono">
                  {status.details}
                </pre>
              )}
            </div>
          </div>
        )}

        <footer className="mt-8 pt-6 border-t border-slate-100 text-center">
          <a href="https://docs.plaud.ai" target="_blank" className="text-[9px] font-bold text-slate-300 hover:text-slate-400 uppercase tracking-widest transition-colors">
            Documentação Oficial
          </a>
        </footer>
      </div>
    </main>
  );
}

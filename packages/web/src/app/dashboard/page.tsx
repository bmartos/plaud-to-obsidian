'use client';

import { useEffect, useState } from 'react';
import { validatePlaudLogin, getSettings, listRecordings, syncRecordings, processAction, pauseAction, pauseAllActions } from '../actions';

export default function DashboardPage() {
  const [recordings, setRecordings] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    const [userResult, settingsData, recsResult] = await Promise.all([
      validatePlaudLogin(),
      getSettings(),
      listRecordings()
    ]);

    if (!userResult.success) {
      window.location.href = '/';
      return;
    }

    setSettings(settingsData);
    if (recsResult.success) {
      setRecordings(recsResult.data || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    
    // Polling silently every 5 seconds to update progress bars without causing full page loading state
    const interval = setInterval(() => {
      listRecordings().then(res => {
        if (res.success) {
          setRecordings(res.data || []);
        }
      });
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const handleSync = async () => {
    console.log('handleSync called');
    setSyncing(true);
    try {
      const result = await syncRecordings();
      console.log('syncRecordings result:', result);
      if (result.success) {
        alert('Sincronização iniciada em segundo plano!');
      } else {
        alert('Erro ao iniciar sincronização: ' + result.error);
      }
    } finally {
      console.log('setSyncing(false) called');
      setSyncing(false);
    }
  };

  const handleAction = async (type: 'download' | 'transcribe' | 'summarize', id: string) => {
    setProcessingId(`${type}-${id}`);
    try {
      const result = await processAction(type, id);
      if (!result.success) {
        alert(`Erro: ${result.message}
Detalhes: ${result.error}`);
      }
      // UI updates via polling
    } finally {
      setProcessingId(null);
    }
  };

  const handlePause = async (id: string) => {
    setProcessingId(`pause-${id}`);
    try {
      const result = await pauseAction(id);
      if (result.success) {
        // Recarregar dados imediatamente
        const recsResult = await listRecordings();
        if (recsResult.success) {
          setRecordings(recsResult.data || []);
        }
      } else {
        alert(`Erro ao pausar: ${result.message}`);
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handlePauseAll = async () => {
    setSyncing(true);
    try {
      const result = await pauseAllActions();
      if (result.success) {
        // Recarregar dados imediatamente
        const recsResult = await listRecordings();
        if (recsResult.success) {
          setRecordings(recsResult.data || []);
        }
      } else {
        alert(`Erro ao pausar tarefas: ${result.message}`);
      }
    } finally {
      setSyncing(false);
    }
  };

  // Função auxiliar para calcular progresso individual de cada arquivo (download = 33.3%, transcribe = 33.3%, analyze = 33.4%)
  const getRecordProgress = (rec: any) => {
    let progress = 0;
    if (rec.downloaded) progress += 33.3;
    else if (rec.status === 'downloading') progress += (rec.progress || 0) * 0.333;

    if (rec.transcribed) progress += 33.3;
    else if (rec.status === 'transcribing') progress += (rec.progress || 0) * 0.333;

    if (rec.analyzed) progress += 33.4;
    else if (rec.status === 'summarizing') progress += (rec.progress || 0) * 0.334;

    return Math.min(Math.round(progress), 100);
  };

  const totalFiles = recordings.length;
  const toTranscribe = recordings.filter(r => !r.transcribed).length;
  const toSummarize = recordings.filter(r => !r.analyzed).length;

  // Contar quantos arquivos estão 100% concluídos
  const syncedCount = recordings.filter(r => r.downloaded && r.transcribed && r.analyzed).length;

  // Calcular progresso geral ponderado da biblioteca
  const totalProgress = totalFiles > 0
    ? Math.round(recordings.reduce((sum, rec) => sum + getRecordProgress(rec), 0) / totalFiles)
    : 0;

  // Obter gravações que estão sendo processadas no momento
  const activeRecordings = recordings.filter(r => r.status && r.status !== 'idle' && r.status !== 'error');

  // Determine if any task is globally running
  const isAnyProcessing = activeRecordings.length > 0;

  console.log('Dashboard State (sync button disabled reasons):', {
    syncing,
    processingId,
    isAnyProcessing,
    recordingStatuses: recordings.map(r => ({ id: r.id, status: r.status }))
  });


  if (loading && recordings.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <main className="p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-slate-900">Dashboard</h1>
            <p className="text-slate-500 font-medium small uppercase tracking-tighter">PlaudToObsidian Pipeline</p>
          </div>
          <div className="flex items-center gap-3">
            {syncing && (
              <button 
                onClick={handlePauseAll}
                className="px-5 py-3 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 border border-rose-100 shadow-sm cursor-pointer animate-pulse"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M10 9v6m4-6v6" /></svg>
                Cancelar Sincronização
              </button>
            )}
            {!syncing && isAnyProcessing && (
              <button 
                onClick={handlePauseAll}
                disabled={processingId !== null}
                className="px-5 py-3 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 border border-rose-100 shadow-sm cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M10 9v6m4-6v6" /></svg>
                Pausar Tudo
              </button>
            )}
            <button 
              onClick={handleSync}
              disabled={syncing || processingId !== null || isAnyProcessing}
              className={`px-6 py-3 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 ${
                syncing ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : processingId !== null || isAnyProcessing ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-100'
              }`}
            >
              {syncing ? (
                <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-500 animate-spin rounded-full" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              )}
              {syncing ? 'Sincronizando...' : 'Sincronizar Agora'}
            </button>
          </div>
        </header>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Total Files Card */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Total de Arquivos</h3>
             <div className="flex items-end justify-between">
                <div>
                   <p className="text-4xl font-black text-slate-900">{totalFiles}</p>
                   <p className="text-xs font-bold text-slate-500 mt-1">Registrados no banco</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                </div>
             </div>
          </div>

          {/* To Transcribe Card */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">A Serem Transcritos</h3>
             <div className="flex items-end justify-between">
                <div>
                   <p className="text-4xl font-black text-slate-900">{toTranscribe}</p>
                   <p className="text-xs font-bold text-slate-500 mt-1">Aguardando IA/Nuvem</p>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${toTranscribe > 0 ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'}`}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </div>
             </div>
          </div>

          {/* To Summarize Card */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">A Serem Resumidos</h3>
             <div className="flex items-end justify-between">
                <div>
                   <p className="text-4xl font-black text-slate-900">{toSummarize}</p>
                   <p className="text-xs font-bold text-slate-500 mt-1">Aguardando IA/Nuvem</p>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${toSummarize > 0 ? 'bg-rose-50 text-rose-600' : 'bg-green-50 text-green-600'}`}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                </div>
             </div>
          </div>
        </div>

        {/* Barra de Progresso e Carregamento Geral */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                Progresso de Sincronização
                {isAnyProcessing && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 animate-pulse border border-blue-100">
                    Processando...
                  </span>
                )}
                {syncing && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-600 animate-pulse border border-indigo-100">
                    Sincronizando nuvem...
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 font-medium">Percentual de conclusão local da sua biblioteca Plaud (Áudio + Transcrição + Resumos)</p>
            </div>
            <div className="text-left md:text-right">
              <span className="text-3xl font-black text-blue-600">{totalProgress}%</span>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{syncedCount} de {totalFiles} concluídos</p>
            </div>
          </div>

          <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden relative border border-slate-200/50">
            <div 
              className={`h-full rounded-full transition-all duration-1000 ease-out shadow-inner ${
                syncing || isAnyProcessing 
                  ? 'bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600 bg-[length:200%_auto] animate-shimmer' 
                  : 'bg-gradient-to-r from-blue-500 to-indigo-600'
              }`} 
              style={{ width: `${totalProgress}%` }}
            />
          </div>

          {/* Indicador de Tarefas Ativas em Segundo Plano */}
          {(isAnyProcessing || syncing) && (
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2 animate-in fade-in slide-in-from-top-1 duration-300">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Fila de Tarefas Ativas</span>
              <div className="space-y-2">
                {syncing && (
                  <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                    <span className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping" />
                      Sincronizando metadados da nuvem Plaud Cloud...
                    </span>
                    <span className="text-slate-400 animate-pulse">Aguardando</span>
                  </div>
                )}
                {activeRecordings.map((rec) => (
                  <div key={rec.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span className="flex items-center gap-2 truncate max-w-[65%]">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                        {rec.filename}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-blue-600 font-black">
                          {rec.status === 'downloading' ? 'Baixando áudio' : rec.status === 'transcribing' ? 'Transcrevendo' : 'Gerando resumo'} ({rec.progress || 0}%)
                        </span>
                        <button 
                          onClick={() => handlePause(rec.id)}
                          disabled={processingId !== null}
                          className="p-1 hover:bg-slate-200 rounded-lg text-rose-500 hover:text-rose-700 transition-all cursor-pointer"
                          title="Pausar esta tarefa"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 9v6m4-6v6" /></svg>
                        </button>
                      </div>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${rec.progress || 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <section className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden relative">
           <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-black text-slate-800">Suas Gravações (Plaud Cloud)</h2>
              <span className="text-[10px] font-bold text-slate-400 uppercase">{recordings.length} arquivos encontrados</span>
           </div>
           
           <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse">
               <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                 <tr>
                   <th className="p-4 border-b border-slate-100 w-32">Data de Gravação</th>
                   <th className="p-4 border-b border-slate-100 min-w-[200px]">Título</th>
                   <th className="p-4 border-b border-slate-100 w-24">Duração</th>
                   <th className="p-4 border-b border-slate-100 w-24 text-center">Download</th>
                   <th className="p-4 border-b border-slate-100 w-24 text-center">Transcrição</th>
                   <th className="p-4 border-b border-slate-100 w-24 text-center">Resumo</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                 {recordings.length > 0 ? (
                   recordings.map((rec) => (
                     <tr key={rec.id} className="hover:bg-slate-50/50 transition-colors group">
                       <td className="p-4 text-xs font-medium text-slate-500 whitespace-nowrap">{rec.date_formatted}</td>
                       <td className="p-4">
                         <div className="flex flex-col">
                           <span className="text-sm font-bold text-slate-700 group-hover:text-blue-600 transition-colors">{rec.filename}</span>
                           <span className="text-[10px] font-mono text-slate-400 truncate max-w-[200px]" title={rec.id}>{rec.id}</span>
                         </div>
                       </td>
                       <td className="p-4 text-xs font-medium text-slate-500">{rec.duration_text || (Math.round(rec.duration / 60000) + ' min')}</td>
                       
                       {/* Download Column */}
                       <td className="p-4 text-center align-middle">
                         {rec.downloaded ? (
                           <span className="inline-flex px-2 py-1 rounded-md text-[10px] font-black uppercase bg-green-50 text-green-600 border border-green-100">
                             Sim
                           </span>
                          ) : rec.status === 'downloading' ? (
                             <div className="flex flex-col items-center gap-1 w-full max-w-[65px] mx-auto">
                               <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                 <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-500" style={{ width: `${rec.progress || 10}%` }}></div>
                               </div>
                               <button 
                                 onClick={() => handlePause(rec.id)}
                                 disabled={processingId !== null}
                                 className="text-[9px] font-black text-rose-500 hover:text-rose-700 transition-colors uppercase tracking-wider flex items-center gap-0.5 cursor-pointer"
                                 title="Pausar esta etapa"
                               >
                                 <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 9v6m4-6v6" /></svg>
                                 Pausar
                               </button>
                             </div>
                         ) : (
                           <button 
                             onClick={() => handleAction('download', rec.id)}
                             disabled={processingId !== null || isAnyProcessing}
                             className={`inline-flex px-2 py-1 rounded-md text-[10px] font-black uppercase transition-colors ${
                               processingId !== null || isAnyProcessing
                                 ? 'bg-slate-100 text-slate-300 cursor-not-allowed' 
                                 : 'bg-slate-100 text-slate-400 hover:bg-blue-50 hover:text-blue-600 cursor-pointer'
                             }`}
                           >
                             Não
                           </button>
                         )}
                       </td>

                       {/* Transcribe Column */}
                       <td className="p-4 text-center align-middle">
                         {rec.transcribed ? (
                           <span className="inline-flex px-2 py-1 rounded-md text-[10px] font-black uppercase bg-green-50 text-green-600 border border-green-100">
                             Sim
                           </span>
                          ) : rec.status === 'transcribing' ? (
                             <div className="flex flex-col items-center gap-1 w-full max-w-[65px] mx-auto">
                               <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                 <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-500" style={{ width: `${rec.progress || 5}%` }}></div>
                               </div>
                               <button 
                                 onClick={() => handlePause(rec.id)}
                                 disabled={processingId !== null}
                                 className="text-[9px] font-black text-rose-500 hover:text-rose-700 transition-colors uppercase tracking-wider flex items-center gap-0.5 cursor-pointer"
                                 title="Pausar esta etapa"
                               >
                                 <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 9v6m4-6v6" /></svg>
                                 Pausar
                               </button>
                             </div>
                         ) : (
                           <button 
                             onClick={() => handleAction('transcribe', rec.id)}
                             disabled={processingId !== null || isAnyProcessing}
                             className={`inline-flex px-2 py-1 rounded-md text-[10px] font-black uppercase transition-colors ${
                               processingId !== null || isAnyProcessing
                                 ? 'bg-slate-100 text-slate-300 cursor-not-allowed' 
                                 : 'bg-slate-100 text-slate-400 hover:bg-blue-50 hover:text-blue-600 cursor-pointer'
                             }`}
                           >
                             Não
                           </button>
                         )}
                       </td>

                       {/* Summarize Column */}
                       <td className="p-4 text-center align-middle">
                         {rec.analyzed ? (
                           <span className="inline-flex px-2 py-1 rounded-md text-[10px] font-black uppercase bg-green-50 text-green-600 border border-green-100">
                             Sim
                           </span>
                          ) : rec.status === 'summarizing' ? (
                             <div className="flex flex-col items-center gap-1 w-full max-w-[65px] mx-auto">
                               <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                 <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-500" style={{ width: `${rec.progress || 50}%` }}></div>
                               </div>
                               <button 
                                 onClick={() => handlePause(rec.id)}
                                 disabled={processingId !== null}
                                 className="text-[9px] font-black text-rose-500 hover:text-rose-700 transition-colors uppercase tracking-wider flex items-center gap-0.5 cursor-pointer"
                                 title="Pausar esta etapa"
                               >
                                 <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 9v6m4-6v6" /></svg>
                                 Pausar
                               </button>
                             </div>
                         ) : (
                           <button 
                             onClick={() => handleAction('summarize', rec.id)}
                             disabled={processingId !== null || isAnyProcessing}
                             className={`inline-flex px-2 py-1 rounded-md text-[10px] font-black uppercase transition-colors ${
                               processingId !== null || isAnyProcessing
                                 ? 'bg-slate-100 text-slate-300 cursor-not-allowed' 
                                 : 'bg-slate-100 text-slate-400 hover:bg-blue-50 hover:text-blue-600 cursor-pointer'
                             }`}
                           >
                             Não
                           </button>
                         )}
                       </td>
                     </tr>
                   ))
                 ) : (
                   <tr>
                     <td colSpan={6} className="p-20 text-center">
                        <div className="min-h-screen flex items-center justify-center">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        </div>
                        <p className="text-slate-400 font-medium text-sm">Nenhuma gravação encontrada para sincronizar.</p>
                     </td>
                   </tr>
                 )}
               </tbody>
             </table>
           </div>
        </section>
      </div>
    </main>
  );
}

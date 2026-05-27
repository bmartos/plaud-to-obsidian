'use client';

import { useEffect, useState } from 'react';
import { validatePlaudLogin, getSettings, listRecordings, syncRecordings, processAction } from '../actions';

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
    setSyncing(true);
    try {
      const result = await syncRecordings();
      if (result.success) {
        alert('Sincronização iniciada em segundo plano!');
      } else {
        alert('Erro ao iniciar sincronização: ' + result.error);
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleAction = async (type: 'download' | 'transcribe' | 'summarize', id: string) => {
    setProcessingId(`${type}-${id}`);
    try {
      const result = await processAction(type, id);
      if (!result.success) {
        alert(`Erro: ${result.message}\nDetalhes: ${result.error}`);
      }
      // UI updates via polling
    } finally {
      setProcessingId(null);
    }
  };

  const totalFiles = recordings.length;
  const toTranscribe = recordings.filter(r => !r.transcribed).length;
  const toSummarize = recordings.filter(r => !r.analyzed).length;

  // Determine if any task is globally running
  const isAnyProcessing = recordings.some(r => r.status && r.status !== 'idle' && r.status !== 'error');

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
          <button 
            onClick={handleSync}
            disabled={syncing || processingId !== null || isAnyProcessing}
            className={`px-6 py-3 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 ${
              syncing || processingId !== null || isAnyProcessing ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-100'
            }`}
          >
            {syncing ? (
              <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-500 animate-spin rounded-full" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            )}
            {syncing ? 'Sincronizando...' : 'Sincronizar Agora'}
          </button>
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
                            <div className="w-full bg-slate-200 rounded-full h-2.5 max-w-[50px] mx-auto">
                              <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${rec.progress || 10}%` }}></div>
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
                            <div className="w-full bg-slate-200 rounded-full h-2.5 max-w-[50px] mx-auto">
                              <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${rec.progress || 5}%` }}></div>
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
                            <div className="w-full bg-slate-200 rounded-full h-2.5 max-w-[50px] mx-auto">
                              <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${rec.progress || 50}%` }}></div>
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
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                          <svg className="w-8 h-8 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
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

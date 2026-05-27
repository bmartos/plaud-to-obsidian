'use client';

import { useEffect, useState } from 'react';
import { validatePlaudLogin, getSettings, listRecordings, syncRecordings } from '../actions';

export default function DashboardPage() {
  const [recordings, setRecordings] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

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
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncRecordings();
      if (result.success) {
        alert('Sincronização concluída com sucesso!');
        await loadData(); // Recarrega a lista
      } else {
        alert('Erro ao sincronizar: ' + result.error);
      }
    } finally {
      setSyncing(false);
    }
  };

  const pendingCount = recordings.filter(r => !r.is_synced).length;

  if (loading) {
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
            disabled={syncing}
            className={`px-6 py-3 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 ${
              syncing ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-100'
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
          {/* Status Card */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Sincronização</h3>
             <div className="flex items-end justify-between">
                <div>
                   <p className="text-4xl font-black text-slate-900">{pendingCount}</p>
                   <p className="text-xs font-bold text-slate-500 mt-1">Notas pendentes</p>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${pendingCount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'}`}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
             </div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Pasta Obsidian</h3>
             <p className="text-[11px] font-mono text-slate-400 break-all mb-4 truncate">{settings?.obsidianPath}</p>
             <button 
               onClick={() => window.location.href = '/profile'}
               className="text-[10px] font-black uppercase text-blue-600 hover:text-blue-800 transition-colors"
             >
               Alterar Configurações
             </button>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Processamento IA</h3>
             <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <p className="text-xs font-bold text-slate-700">Gemini 2.0 Flash</p>
             </div>
             <p className="text-[10px] text-slate-400 font-medium">Motor de análise estruturada ativo.</p>
          </div>
        </div>

        <section className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
           <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-black text-slate-800">Suas Gravações (Plaud Cloud)</h2>
              <span className="text-[10px] font-bold text-slate-400 uppercase">{recordings.length} arquivos encontrados</span>
           </div>
           
           <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse">
               <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                 <tr>
                   <th className="p-4 border-b border-slate-100">Título</th>
                   <th className="p-4 border-b border-slate-100">Data</th>
                   <th className="p-4 border-b border-slate-100">Duração</th>
                   <th className="p-4 border-b border-slate-100">Status</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                 {recordings.length > 0 ? (
                   recordings.map((rec) => (
                     <tr key={rec.id} className="hover:bg-slate-50/50 transition-colors group">
                       <td className="p-4">
                         <div className="flex flex-col">
                           <span className="text-sm font-bold text-slate-700 group-hover:text-blue-600 transition-colors">{rec.filename}</span>
                           <span className="text-[10px] font-mono text-slate-400">{rec.id}</span>
                         </div>
                       </td>
                       <td className="p-4 text-xs font-medium text-slate-500">{rec.date_formatted}</td>
                       <td className="p-4 text-xs font-medium text-slate-500">{rec.duration_text || (Math.round(rec.duration / 60000) + ' min')}</td>
                       <td className="p-4">
                         {rec.is_synced ? (
                           <span className="px-2 py-1 bg-green-50 text-green-600 text-[10px] font-black uppercase rounded-lg border border-green-100 flex items-center gap-1 w-fit">
                             <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                             Sincronizado
                           </span>
                         ) : (
                           <span className="px-2 py-1 bg-slate-100 text-slate-400 text-[10px] font-black uppercase rounded-lg flex items-center gap-1 w-fit">
                             Nuvem
                           </span>
                         )}
                       </td>
                     </tr>
                   ))
                 ) : (
                   <tr>
                     <td colSpan={4} className="p-20 text-center">
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

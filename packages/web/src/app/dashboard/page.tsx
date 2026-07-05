'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { validatePlaudLogin, getSettings, listRecordings, syncRecordings, processAction, pauseAction, pauseAllActions, getFileContent, deleteRecording } from '../actions';

export default function DashboardPage() {
  const [recordings, setRecordings] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    type: 'audio' | 'text';
    content: string;
    audioUrl?: string;
  }>({ isOpen: false, title: '', type: 'text', content: '' });

  // State for delete confirmation modal
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    id: string;
    filename: string;
    step: 'confirm' | 'deleting-files' | 'deleting-db' | 'done' | 'error';
    errorMessage?: string;
    deletedFiles?: string[];
  }>({ isOpen: false, id: '', filename: '', step: 'confirm' });

  // States for sorting
  const [sortField, setSortField] = useState<string>('start_time');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // States for filtering
  const [dateFilterType, setDateFilterType] = useState<string>('todos'); // 'todos' | 'hoje' | 'ontem' | '7dias' | '30dias' | 'unica' | 'periodo'
  const [customSingleDate, setCustomSingleDate] = useState<string>(''); // YYYY-MM-DD
  const [customStartDate, setCustomStartDate] = useState<string>(''); // YYYY-MM-DD
  const [customEndDate, setCustomEndDate] = useState<string>(''); // YYYY-MM-DD
  
  const [filterDownload, setFilterDownload] = useState<string>('todos'); // 'todos' | 'sim' | 'nao'
  const [filterTranscribe, setFilterTranscribe] = useState<string>('todos'); // 'todos' | 'sim' | 'nao'
  const [filterAnalyze, setFilterAnalyze] = useState<string>('todos'); // 'todos' | 'sim' | 'nao'
  const [searchTitle, setSearchTitle] = useState<string>(''); // busca por título

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  };

  const handleOpenModal = async (type: 'audio' | 'transcription' | 'summary', id: string, filename: string) => {
    if (type === 'audio') {
      setModal({
        isOpen: true,
        title: `Ouvindo Áudio: ${filename}`,
        type: 'audio',
        content: '',
        audioUrl: `/api/audio?id=${id}`
      });
    } else {
      setModal({
        isOpen: true,
        title: type === 'transcription' ? `Transcrição: ${filename}` : `Resumo: ${filename}`,
        type: 'text',
        content: 'Carregando conteúdo...'
      });
      
      const result = await getFileContent(id, type);
      if (result.success && result.content) {
        setModal(prev => ({ ...prev, content: result.content }));
      } else {
        setModal(prev => ({ ...prev, content: `Erro ao carregar arquivo: ${result.error || 'Erro desconhecido.'}` }));
      }
    }
  };

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
      const formatted = (recsResult.data || []).map((r: any) => ({
        ...r,
        filename: r.fullname || r.filename || 'Sem Título'
      }));
      setRecordings(formatted);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    
    // Polling silently every 5 seconds to update progress bars without causing full page loading state
    const interval = setInterval(() => {
      listRecordings().then(res => {
        if (res.success) {
          const formatted = (res.data || []).map((r: any) => ({
            ...r,
            filename: r.fullname || r.filename || 'Sem Título'
          }));
          setRecordings(formatted);
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
        showNotification('Sincronização iniciada em segundo plano!', 'success');
      } else {
        showNotification('Erro ao iniciar sincronização: ' + result.error, 'error');
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
        showNotification(`Erro: ${result.message}. Detalhes: ${result.error}`, 'error');
      }
      // UI updates via polling
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (id: string, filename: string) => {
    setDeleteModal({ isOpen: true, id, filename, step: 'confirm' });
  };

  const confirmDelete = async () => {
    const { id, filename } = deleteModal;
    // Step 1: deletando arquivos
    setDeleteModal(prev => ({ ...prev, step: 'deleting-files' }));
    await new Promise(r => setTimeout(r, 400)); // pequena pausa visual

    const result = await deleteRecording(id);

    if (!result.success) {
      setDeleteModal(prev => ({ ...prev, step: 'error', errorMessage: result.error || result.message }));
      return;
    }

    // Step 2: confirmando deleção no banco
    setDeleteModal(prev => ({ ...prev, step: 'deleting-db', deletedFiles: result.deletedFiles }));
    await new Promise(r => setTimeout(r, 600));

    // Step 3: concluído — remove da lista local imediatamente
    setDeleteModal(prev => ({ ...prev, step: 'done' }));
    setRecordings(prev => prev.filter(r => r.id !== id));
    await new Promise(r => setTimeout(r, 1200));

    setDeleteModal({ isOpen: false, id: '', filename: '', step: 'confirm' });
    showNotification(`"${filename}" deletada com sucesso.`, 'success');
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
        showNotification(`Erro ao pausar: ${result.message}`, 'error');
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
        showNotification(`Erro ao pausar tarefas: ${result.message}`, 'error');
      }
    } finally {
      setSyncing(false);
    }
  };

  const totalFiles = recordings.length;
  const toTranscribe = recordings.filter(r => !r.transcribed).length;
  const toSummarize = recordings.filter(r => !r.analyzed).length;

  const activeRecordings = recordings.filter(r => r.status && r.status !== 'idle' && r.status !== 'error');
  const isAnyProcessing = activeRecordings.length > 0;

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'start_time' ? 'desc' : 'asc');
    }
  };

  const filteredRecordings = recordings.filter(rec => {
    if (searchTitle.trim()) {
      const needle = searchTitle.trim().toLowerCase();
      const haystack = (rec.fullname || rec.filename || '').toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    if (dateFilterType !== 'todos') {
      if (!rec.start_time) return false;
      const recDateStr = rec.start_time.split(' ')[0];
      
      const getLocalDateStr = (offsetDays = 0): string => {
        const d = new Date();
        if (offsetDays !== 0) {
          d.setDate(d.getDate() + offsetDays);
        }
        return d.toLocaleDateString('en-CA');
      };

      if (dateFilterType === 'hoje') {
        const todayStr = getLocalDateStr();
        if (recDateStr !== todayStr) return false;
      } 
      else if (dateFilterType === 'ontem') {
        const yesterdayStr = getLocalDateStr(-1);
        if (recDateStr !== yesterdayStr) return false;
      } 
      else if (dateFilterType === '7dias') {
        const limitStr = getLocalDateStr(-7);
        if (recDateStr < limitStr) return false;
      } 
      else if (dateFilterType === '30dias') {
        const limitStr = getLocalDateStr(-30);
        if (recDateStr < limitStr) return false;
      } 
      else if (dateFilterType === 'unica') {
        if (customSingleDate && recDateStr !== customSingleDate) return false;
      } 
      else if (dateFilterType === 'periodo') {
        if (customStartDate && recDateStr < customStartDate) return false;
        if (customEndDate && recDateStr > customEndDate) return false;
      }
    }

    if (filterDownload !== 'todos') {
      const isDownloaded = rec.downloaded === 1;
      if (filterDownload === 'sim' && !isDownloaded) return false;
      if (filterDownload === 'nao' && isDownloaded) return false;
    }

    if (filterTranscribe !== 'todos') {
      const isTranscribed = rec.transcribed === 1;
      if (filterTranscribe === 'sim' && !isTranscribed) return false;
      if (filterTranscribe === 'nao' && isTranscribed) return false;
    }

    if (filterAnalyze !== 'todos') {
      const isAnalyzed = rec.analyzed === 1;
      if (filterAnalyze === 'sim' && !isAnalyzed) return false;
      if (filterAnalyze === 'nao' && isAnalyzed) return false;
    }

    return true;
  });

  const sortedRecordings = [...filteredRecordings].sort((a, b) => {
    let valA = '';
    let valB = '';

    switch (sortField) {
      case 'start_time':
        valA = a.start_time || '';
        valB = b.start_time || '';
        break;
      case 'filename':
        valA = a.filename || '';
        valB = b.filename || '';
        break;
      case 'duration':
        valA = a.duration_text || '';
        valB = b.duration_text || '';
        break;
      case 'downloaded':
        valA = a.downloaded ? 'Sim' : 'Não';
        valB = b.downloaded ? 'Sim' : 'Não';
        break;
      case 'transcribed':
        valA = a.transcribed ? 'Sim' : 'Não';
        valB = b.transcribed ? 'Sim' : 'Não';
        break;
      case 'analyzed':
        valA = a.analyzed ? 'Sim' : 'Não';
        valB = b.analyzed ? 'Sim' : 'Não';
        break;
      default:
        valA = a.start_time || '';
        valB = b.start_time || '';
    }

    if (sortField === 'start_time') {
      const timeA = new Date(valA.replace(/-/g, '/')).getTime();
      const timeB = new Date(valB.replace(/-/g, '/')).getTime();
      const numA = isNaN(timeA) ? 0 : timeA;
      const numB = isNaN(timeB) ? 0 : timeB;
      return sortDirection === 'asc' ? numA - numB : numB - numA;
    }

    return sortDirection === 'asc' 
      ? valA.localeCompare(valB, 'pt-BR', { sensitivity: 'base' })
      : valB.localeCompare(valA, 'pt-BR', { sensitivity: 'base' });
  });

  const renderHeader = (field: string, label: string, isCenter = false) => {
    const isActive = sortField === field;
    return (
      <button
        onClick={() => handleSort(field)}
        className={`group w-full flex items-center gap-1 hover:text-slate-700 transition-colors uppercase font-black tracking-widest text-[10px] cursor-pointer focus:outline-none ${isCenter ? 'justify-center' : 'justify-start'}`}
        title={
          isActive 
            ? (sortDirection === 'asc' 
                ? (field === 'start_time' ? 'Ordenado por Mais Antigo' : 'Ordenado de A-Z')
                : (field === 'start_time' ? 'Ordenado por Mais Novo' : 'Ordenado de Z-A'))
            : `Ordenar por ${label}`
        }
      >
        <span>{label}</span>
        <span className={`inline-flex items-center transition-all duration-200 ${isActive ? 'text-blue-600 opacity-100' : 'text-slate-300 opacity-0 group-hover:opacity-100'}`}>
          {isActive ? (
            sortDirection === 'asc' ? (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            )
          ) : (
            <svg className="w-3 h-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
            </svg>
          )}
        </span>
      </button>
    );
  };

  if (loading && recordings.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <main className="p-8 font-sans">
      {notification && (
        <div className={`fixed top-6 right-6 z-50 p-4 rounded-2xl shadow-2xl border flex items-center gap-3 animate-in slide-in-from-top-5 fade-in duration-300 ${
          notification.type === 'success' 
            ? 'bg-green-50 text-green-800 border-green-200' 
            : notification.type === 'error'
            ? 'bg-rose-50 text-rose-800 border-rose-200'
            : 'bg-blue-50 text-blue-800 border-blue-200'
        }`}>
          <span className="text-sm font-semibold">{notification.message}</span>
          <button 
            onClick={() => setNotification(null)}
            className="p-1 hover:bg-black/5 rounded-lg text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
            title="Fechar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

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

        {/* Fila de Tarefas Ativas */}
        {(isAnyProcessing || syncing) && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4 animate-in fade-in duration-300">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                Fila de Tarefas Ativas
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
            </div>
            <div className="space-y-4">
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
                        className="p-1 hover:bg-slate-100 rounded-lg text-rose-500 hover:text-rose-700 transition-all cursor-pointer"
                        title="Pausar esta tarefa"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 9v6m4-6v6" /></svg>
                      </button>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200/50">
                    <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${rec.progress || 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <section className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden relative">
           <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-black text-slate-800">Suas Gravações (Plaud Cloud)</h2>
              <span className="text-[10px] font-bold text-slate-400 uppercase">
                {filteredRecordings.length} de {recordings.length} arquivos encontrados
              </span>
           </div>

           {/* Filter Bar */}
           <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex flex-wrap items-center gap-6">
             {/* Title Search */}
             <div className="flex flex-col gap-1.5 min-w-[220px] flex-1">
               <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Buscar por Título</label>
               <div className="relative">
                 <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                 </svg>
                 <input
                   type="text"
                   value={searchTitle}
                   onChange={(e) => setSearchTitle(e.target.value)}
                   placeholder="Digite parte do título..."
                   className="w-full pl-8 pr-8 py-2 bg-white border border-slate-200 rounded-2xl text-slate-700 font-semibold text-xs focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm placeholder:text-slate-300"
                 />
                 {searchTitle && (
                   <button
                     onClick={() => setSearchTitle('')}
                     className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors cursor-pointer"
                     title="Limpar busca"
                   >
                     <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                     </svg>
                   </button>
                 )}
               </div>
             </div>

             <div className="flex flex-col gap-1.5 min-w-[180px]">
               <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Período de Gravação</label>
               <select
                 value={dateFilterType}
                 onChange={(e) => setDateFilterType(e.target.value)}
                 className="px-3.5 py-2 bg-white border border-slate-200 rounded-2xl text-slate-700 font-bold text-xs focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all cursor-pointer shadow-sm"
               >
                 <option value="todos">Todos os Períodos</option>
                 <option value="hoje">Hoje</option>
                 <option value="ontem">Ontem</option>
                 <option value="7dias">Últimos 7 dias</option>
                 <option value="30dias">Últimos 30 dias</option>
                 <option value="unica">Selecionar Data Única...</option>
                 <option value="periodo">Selecionar Intervalo de Datas...</option>
               </select>
             </div>

             {dateFilterType === 'unica' && (
               <div className="flex flex-col gap-1.5 min-w-[140px] animate-in slide-in-from-left-2 duration-200">
                 <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Data do Arquivo</label>
                 <input
                   type="date"
                   value={customSingleDate}
                   onChange={(e) => setCustomSingleDate(e.target.value)}
                   className="px-3.5 py-2 bg-white border border-slate-200 rounded-2xl text-slate-700 font-bold text-xs focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm cursor-pointer"
                 />
               </div>
             )}

             {dateFilterType === 'periodo' && (
               <>
                 <div className="flex flex-col gap-1.5 min-w-[140px] animate-in slide-in-from-left-2 duration-200">
                   <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Data Inicial</label>
                   <input
                     type="date"
                     value={customStartDate}
                     onChange={(e) => setCustomStartDate(e.target.value)}
                     className="px-3.5 py-2 bg-white border border-slate-200 rounded-2xl text-slate-700 font-bold text-xs focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm cursor-pointer"
                   />
                 </div>
                 <div className="flex flex-col gap-1.5 min-w-[140px] animate-in slide-in-from-left-2 duration-200">
                   <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Data Final</label>
                   <input
                     type="date"
                     value={customEndDate}
                     onChange={(e) => setCustomEndDate(e.target.value)}
                     className="px-3.5 py-2 bg-white border border-slate-200 rounded-2xl text-slate-700 font-bold text-xs focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm cursor-pointer"
                   />
                 </div>
               </>
             )}

             <div className="flex flex-col gap-1.5 min-w-[120px]">
               <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Download</label>
               <select
                 value={filterDownload}
                 onChange={(e) => setFilterDownload(e.target.value)}
                 className="px-3.5 py-2 bg-white border border-slate-200 rounded-2xl text-slate-700 font-bold text-xs focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all cursor-pointer shadow-sm"
               >
                 <option value="todos">Todos</option>
                 <option value="sim">Sim</option>
                 <option value="nao">Não</option>
               </select>
             </div>

             <div className="flex flex-col gap-1.5 min-w-[120px]">
               <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Transcrição</label>
               <select
                 value={filterTranscribe}
                 onChange={(e) => setFilterTranscribe(e.target.value)}
                 className="px-3.5 py-2 bg-white border border-slate-200 rounded-2xl text-slate-700 font-bold text-xs focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all cursor-pointer shadow-sm"
               >
                 <option value="todos">Todos</option>
                 <option value="sim">Sim</option>
                 <option value="nao">Não</option>
               </select>
             </div>

             <div className="flex flex-col gap-1.5 min-w-[120px]">
               <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Resumo</label>
               <select
                 value={filterAnalyze}
                 onChange={(e) => setFilterAnalyze(e.target.value)}
                 className="px-3.5 py-2 bg-white border border-slate-200 rounded-2xl text-slate-700 font-bold text-xs focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all cursor-pointer shadow-sm"
               >
                 <option value="todos">Todos</option>
                 <option value="sim">Sim</option>
                 <option value="nao">Não</option>
               </select>
             </div>

             {(searchTitle !== '' || dateFilterType !== 'todos' || filterDownload !== 'todos' || filterTranscribe !== 'todos' || filterAnalyze !== 'todos') && (
               <button
                 onClick={() => {
                   setSearchTitle('');
                   setDateFilterType('todos');
                   setCustomSingleDate('');
                   setCustomStartDate('');
                   setCustomEndDate('');
                   setFilterDownload('todos');
                   setFilterTranscribe('todos');
                   setFilterAnalyze('todos');
                 }}
                 className="self-end px-4 py-2.5 text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-100 hover:border-rose-600 rounded-2xl transition-all cursor-pointer font-bold text-xs flex items-center gap-1.5 shadow-sm"
               >
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                 </svg>
                 Limpar Filtros
               </button>
             )}
           </div>

           <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse">
               <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                 <tr>
                   <th className="p-4 border-b border-slate-100 w-32">{renderHeader('start_time', 'Data de Gravação')}</th>
                   <th className="p-4 border-b border-slate-100 min-w-[200px]">{renderHeader('filename', 'Título')}</th>
                   <th className="p-4 border-b border-slate-100 w-24">{renderHeader('duration', 'Duração')}</th>
                   <th className="p-4 border-b border-slate-100 w-24 text-center">{renderHeader('downloaded', 'Download', true)}</th>
                   <th className="p-4 border-b border-slate-100 w-24 text-center">{renderHeader('transcribed', 'Transcrição', true)}</th>
                   <th className="p-4 border-b border-slate-100 w-24 text-center">{renderHeader('analyzed', 'Resumo', true)}</th>
                   <th className="p-4 border-b border-slate-100 w-12"></th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                 {sortedRecordings.length > 0 ? (
                   sortedRecordings.map((rec) => (
                     <tr key={rec.id} className="hover:bg-slate-50/50 transition-colors group">
                       <td className="p-4 text-xs font-medium text-slate-500 whitespace-nowrap">{rec.date_formatted}</td>
                       <td className="p-4">
                         <div className="flex flex-col">
                           <span className="text-sm font-bold text-slate-700 group-hover:text-blue-600 transition-colors">{rec.filename}</span>
                           <span className="text-[10px] font-mono text-slate-400 truncate max-w-[200px]" title={rec.id}>{rec.id}</span>
                         </div>
                       </td>
                       <td className="p-4 text-xs font-medium text-slate-500">{rec.duration_text || (Math.round(rec.duration / 60000) + ' min')}</td>
                       
                       <td className="p-4 text-center align-middle">
                         {rec.downloaded ? (
                           <button 
                             onClick={() => handleOpenModal('audio', rec.id, rec.filename)}
                             className="inline-flex px-2 py-1 rounded-md text-[10px] font-black uppercase bg-green-50 text-green-600 border border-green-200 hover:bg-green-100 transition-colors cursor-pointer"
                           >
                             Sim
                           </button>
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

                       <td className="p-4 text-center align-middle">
                         {rec.transcribed ? (
                           <button 
                             onClick={() => handleOpenModal('transcription', rec.id, rec.filename)}
                             className="inline-flex px-2 py-1 rounded-md text-[10px] font-black uppercase bg-green-50 text-green-600 border border-green-200 hover:bg-green-100 transition-colors cursor-pointer"
                           >
                             Sim
                           </button>
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

                       <td className="p-4 text-center align-middle">
                         {rec.analyzed ? (
                           <button 
                             onClick={() => handleOpenModal('summary', rec.id, rec.filename)}
                             className="inline-flex px-2 py-1 rounded-md text-[10px] font-black uppercase bg-green-50 text-green-600 border border-green-200 hover:bg-green-100 transition-colors cursor-pointer"
                           >
                             Sim
                           </button>
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
                       <td className="p-4 text-center align-middle">
                         <button
                           onClick={() => handleDelete(rec.id, rec.filename)}
                           disabled={processingId !== null || isAnyProcessing}
                           className="opacity-0 group-hover:opacity-100 transition-all duration-200 p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 disabled:pointer-events-none"
                           title="Deletar gravação"
                         >
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                           </svg>
                         </button>
                       </td>
                     </tr>
                   ))
                 ) : (
                   <tr>
                     <td colSpan={7} className="p-20 text-center">
                        <div className="min-h-[200px] flex flex-col items-center justify-center gap-3">
                          <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-slate-400 font-medium text-sm">Nenhuma gravação encontrada para os filtros selecionados.</p>
                        </div>
                     </td>
                   </tr>
                 )}
               </tbody>
             </table>
           </div>
        </section>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 border border-slate-100 shadow-2xl relative m-4 animate-in zoom-in-95 duration-200">
            {deleteModal.step === 'confirm' && (
              <>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900">Deletar Gravação?</h2>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">Esta ação é irreversível</p>
                  </div>
                </div>
                <p className="text-sm text-slate-600 font-semibold mb-2">Serão permanentemente deletados:</p>
                <ul className="text-xs text-slate-500 space-y-1 mb-6 bg-slate-50 rounded-2xl p-4 font-medium">
                  <li className="flex items-center gap-2"><span className="text-slate-400">🎵</span> Arquivo de áudio (se existir)</li>
                  <li className="flex items-center gap-2"><span className="text-slate-400">📝</span> Arquivo de transcrição (se existir)</li>
                  <li className="flex items-center gap-2"><span className="text-slate-400">📋</span> Arquivo de resumo (se existir)</li>
                  <li className="flex items-center gap-2"><span className="text-slate-400">🗄️</span> Registro no banco de dados</li>
                </ul>
                <p className="text-xs font-black text-slate-700 mb-6 truncate" title={deleteModal.filename}>📁 {deleteModal.filename}</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteModal(prev => ({ ...prev, isOpen: false }))}
                    className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-sm transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="flex-1 px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-bold text-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Deletar
                  </button>
                </div>
              </>
            )}

            {deleteModal.step === 'deleting-files' && (
              <div className="flex flex-col items-center gap-5 py-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center animate-pulse">
                  <svg className="w-7 h-7 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <div>
                  <p className="font-black text-slate-800 text-base">Apagando arquivos...</p>
                  <p className="text-xs text-slate-400 font-medium mt-1">Removendo áudio, transcrição e resumo</p>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-rose-500 h-1.5 rounded-full animate-pulse w-2/3" />
                </div>
              </div>
            )}

            {deleteModal.step === 'deleting-db' && (
              <div className="flex flex-col items-center gap-5 py-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center animate-pulse">
                  <svg className="w-7 h-7 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                  </svg>
                </div>
                <div>
                  <p className="font-black text-slate-800 text-base">Removendo do banco...</p>
                  <p className="text-xs text-slate-400 font-medium mt-1">
                    {deleteModal.deletedFiles && deleteModal.deletedFiles.length > 0
                      ? `${deleteModal.deletedFiles.length} arquivo(s) removido(s) do disco`
                      : 'Nenhum arquivo físico encontrado'}
                  </p>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-amber-500 h-1.5 rounded-full animate-pulse w-4/5" />
                </div>
              </div>
            )}

            {deleteModal.step === 'done' && (
              <div className="flex flex-col items-center gap-5 py-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center">
                  <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="font-black text-slate-800 text-base">Deletado com sucesso!</p>
                  <p className="text-xs text-slate-400 font-medium mt-1">Gravação removida permanentemente</p>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-green-500 h-1.5 rounded-full w-full transition-all duration-500" />
                </div>
              </div>
            )}

            {deleteModal.step === 'error' && (
              <div className="flex flex-col items-center gap-5 py-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center">
                  <svg className="w-7 h-7 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div>
                  <p className="font-black text-slate-800 text-base">Erro ao deletar</p>
                  <p className="text-xs text-rose-400 font-medium mt-1 max-w-[280px]">{deleteModal.errorMessage}</p>
                </div>
                <button
                  onClick={() => setDeleteModal({ isOpen: false, id: '', filename: '', step: 'confirm' })}
                  className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-sm transition-colors cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Component */}
      {modal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-4xl p-8 border border-slate-100 shadow-2xl relative flex flex-col max-h-[85vh] m-4 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <h2 className="text-xl font-bold text-slate-800 truncate max-w-[80%]" title={modal.title}>
                {modal.title}
              </h2>
              <button 
                onClick={() => setModal(prev => ({ ...prev, isOpen: false }))}
                className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                title="Fechar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {modal.type === 'audio' ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-6">
                  <div className="w-20 h-20 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center animate-pulse">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                  </div>
                  <audio 
                    src={modal.audioUrl} 
                    controls 
                    autoPlay
                    className="w-full max-w-xl outline-none"
                  />
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Streaming de áudio direto da sua máquina local</p>
                </div>
              ) : (
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 max-h-[60vh] overflow-y-auto whitespace-pre-wrap font-sans text-slate-700 text-sm leading-relaxed scrollbar-thin">
                  {modal.content}
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="border-t border-slate-100 pt-4 mt-6 flex justify-end">
              <button 
                onClick={() => setModal(prev => ({ ...prev, isOpen: false }))}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

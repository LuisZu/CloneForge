import { useEffect, useRef } from 'react';
import { Loader2, CheckCircle, XCircle, AlertCircle, Circle } from 'lucide-react';
import useAppStore from '../store/appStore';

const STATUS_ICON = {
  pending: <Loader2 size={14} className="text-slate-400 animate-spin shrink-0" />,
  success: <CheckCircle size={14} className="text-green-600 shrink-0" />,
  exists:  <AlertCircle size={14} className="text-amber-500 shrink-0" />,
  error:   <XCircle size={14} className="text-red-500 shrink-0" />,
};

function LiveLogRow({ entry }) {
  return (
    <div className="flex items-start gap-2 px-4 py-1.5 text-xs">
      {STATUS_ICON[entry.status] ?? <Circle size={14} className="text-slate-300 shrink-0" />}
      <div className="flex-1 min-w-0">
        <span className="font-mono text-slate-700">[{entry.schema}].[{entry.name}]</span>
        {entry.status === 'pending' && <span className="text-slate-400 ml-1.5">procesando...</span>}
        {entry.note && <span className="text-slate-500 ml-1.5">&middot; {entry.note}</span>}
        {entry.status === 'error' && entry.error && (
          <p className="text-red-500 mt-0.5 font-mono break-words">{entry.error}</p>
        )}
      </div>
    </div>
  );
}

export default function CloningOverlay() {
  const cloneLoading      = useAppStore((s) => s.cloneLoading);
  const cloneProgress     = useAppStore((s) => s.cloneProgress);
  const cloneLiveLog      = useAppStore((s) => s.cloneLiveLog);
  const dataInsertLoading = useAppStore((s) => s.dataInsertLoading);

  const logEndRef = useRef(null);
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: 'end' });
  }, [cloneLiveLog]);

  const active = cloneLoading || dataInsertLoading;
  if (!active) return null;

  if (dataInsertLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl px-10 py-8 flex flex-col items-center gap-4 min-w-64">
          <Loader2 size={40} className="text-blue-600 animate-spin" />
          <div className="text-center">
            <p className="text-lg font-semibold text-slate-800">Insertando filas</p>
            <p className="text-sm text-slate-500 mt-1">Ejecutando INSERT en la base de datos destino...</p>
          </div>
        </div>
      </div>
    );
  }

  const showProgress = cloneProgress && cloneProgress.total > 0;
  const pct = showProgress ? Math.round((cloneProgress.done / cloneProgress.total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200">
          <Loader2 size={22} className="text-blue-600 animate-spin shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800">Clonando objetos</p>
            <p className="text-xs text-slate-500">Por favor espere, no cierre esta ventana.</p>
          </div>
        </div>

        {showProgress && (
          <div className="px-6 py-3 border-b border-slate-200 bg-slate-50 flex flex-col gap-1.5">
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div className="bg-blue-600 h-2 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs text-slate-500 text-center">
              Lote {cloneProgress.batch}/{cloneProgress.batchCount} &middot;{' '}
              {cloneProgress.done.toLocaleString()} / {cloneProgress.total.toLocaleString()} objetos
            </p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {cloneLiveLog.length === 0 ? (
            <p className="px-6 py-8 text-center text-xs text-slate-400">Preparando...</p>
          ) : (
            cloneLiveLog.map((entry) => <LiveLogRow key={entry.id} entry={entry} />)
          )}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
}

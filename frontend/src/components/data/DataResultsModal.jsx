import { useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import useAppStore from '../../store/appStore';

const EMPTY_RESULTS = [];
const EMPTY_SUMMARY = { total: 0, succeeded: 0, exists: 0, failed: 0 };

const ROW_STYLE = {
  success: { row: 'bg-green-50', icon: <CheckCircle size={14} className="text-green-600 shrink-0" />, label: 'Insertada' },
  exists:  { row: 'bg-amber-50', icon: <AlertCircle size={14} className="text-amber-500 shrink-0" />, label: 'Ya existía' },
  error:   { row: 'bg-red-50',   icon: <XCircle size={14} className="text-red-500 shrink-0" />, label: 'Error' },
};

export default function DataResultsModal() {
  const { showDataResults, dataInsertResults, setShowDataResults } = useAppStore();
  const [statusFilter, setStatusFilter] = useState('all');

  const results = dataInsertResults?.results ?? EMPTY_RESULTS;
  const summary = dataInsertResults?.summary ?? EMPTY_SUMMARY;
  const tableName = dataInsertResults?.tableName;
  const destSchema = dataInsertResults?.destSchema;

  const filteredResults = useMemo(
    () => (statusFilter === 'all' ? results : results.filter((r) => r.status === statusFilter)),
    [results, statusFilter]
  );

  function toggleFilter(value) {
    setStatusFilter((prev) => (prev === value ? 'all' : value));
  }

  if (!dataInsertResults) return null;

  const allSucceeded = summary.failed === 0 && (summary.exists ?? 0) === 0;

  return (
    <Dialog.Root open={showDataResults} onOpenChange={setShowDataResults}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                                   bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <Dialog.Title className="text-lg font-semibold text-slate-800">
              Resultados de Inserción
            </Dialog.Title>
            <Dialog.Close className="text-slate-400 hover:text-slate-600 transition-colors">
              <X size={20} />
            </Dialog.Close>
          </div>

          {/* Table name */}
          <div className="px-6 py-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
            Destino: <span className="font-mono text-slate-700">[{destSchema}].[{tableName}]</span>
          </div>

          {/* Summary — click a status to filter the list below by it */}
          <div className="flex items-center gap-2 px-6 py-3 bg-slate-50 border-b border-slate-200 flex-wrap">
            <span className="text-sm text-slate-600 mr-2">
              Total: <strong className="text-slate-800">{summary.total}</strong>
            </span>

            <button
              onClick={() => toggleFilter('success')}
              className={clsx(
                'flex items-center gap-1.5 text-sm px-2 py-1 rounded-full transition-colors text-green-700',
                statusFilter === 'success' ? 'bg-green-100 ring-1 ring-green-400' : 'hover:bg-green-100/60'
              )}
            >
              <CheckCircle size={14} />
              <strong>{summary.succeeded}</strong> insertadas
            </button>

            {summary.exists > 0 && (
              <button
                onClick={() => toggleFilter('exists')}
                className={clsx(
                  'flex items-center gap-1.5 text-sm px-2 py-1 rounded-full transition-colors text-amber-600',
                  statusFilter === 'exists' ? 'bg-amber-100 ring-1 ring-amber-400' : 'hover:bg-amber-100/60'
                )}
              >
                <AlertCircle size={14} />
                <strong>{summary.exists}</strong> ya existían
              </button>
            )}

            <button
              onClick={() => toggleFilter('error')}
              className={clsx(
                'flex items-center gap-1.5 text-sm px-2 py-1 rounded-full transition-colors text-red-600',
                statusFilter === 'error' ? 'bg-red-100 ring-1 ring-red-400' : 'hover:bg-red-100/60'
              )}
            >
              <XCircle size={14} />
              <strong>{summary.failed}</strong> fallidas
            </button>

            {/* Progress bar */}
            <div className="ml-auto w-28 bg-slate-200 rounded-full h-2 flex overflow-hidden">
              <div
                className="bg-green-500 h-2 transition-all"
                style={{ width: `${summary.total ? (summary.succeeded / summary.total) * 100 : 0}%` }}
              />
              <div
                className="bg-amber-400 h-2 transition-all"
                style={{ width: `${summary.total ? ((summary.exists ?? 0) / summary.total) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {allSucceeded && statusFilter === 'all' ? (
              <div className="flex flex-col items-center justify-center py-12 text-green-600 gap-3">
                <CheckCircle size={36} />
                <p className="text-sm font-medium">
                  {summary.succeeded === 1
                    ? '1 fila insertada exitosamente'
                    : `${summary.succeeded.toLocaleString()} filas insertadas exitosamente`}
                </p>
              </div>
            ) : filteredResults.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-slate-400">
                No hay resultados con ese estado.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredResults.map((r) => {
                  const st = ROW_STYLE[r.status] ?? ROW_STYLE.success;
                  return (
                    <div key={r.row} className={`flex items-start gap-2 px-6 py-3 ${st.row}`}>
                      {st.icon}
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-semibold text-slate-700">Fila {r.row} &middot; {st.label}</span>
                        {r.status === 'exists' && (
                          <p className="text-xs text-amber-600 mt-0.5">
                            Omitida: ya existe un registro con esa llave en destino
                          </p>
                        )}
                        {r.status === 'error' && r.error && (
                          <p className="text-xs text-red-600 mt-0.5 font-mono break-words">{r.error}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-200 flex justify-end">
            <Dialog.Close className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg
                                     hover:bg-slate-700 transition-colors">
              Cerrar
            </Dialog.Close>
          </div>

        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

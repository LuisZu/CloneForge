import { useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, CheckCircle, XCircle } from 'lucide-react';
import clsx from 'clsx';

const EMPTY_ROWS = [];

export default function ColumnResultsModal({ open, results, onClose }) {
  const [statusFilter, setStatusFilter] = useState('all');

  const rows = results?.results ?? EMPTY_ROWS;
  const summary = results?.summary ?? { total: 0, succeeded: 0, failed: 0 };
  const tableName = results?.tableName;
  const destSchema = results?.destSchema;

  const filteredRows = useMemo(
    () => (statusFilter === 'all' ? rows : rows.filter((r) => r.status === statusFilter)),
    [rows, statusFilter]
  );

  function toggleFilter(value) {
    setStatusFilter((prev) => (prev === value ? 'all' : value));
  }

  if (!results) return null;

  return (
    <Dialog.Root open={open} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                                   bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col">

          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <Dialog.Title className="text-lg font-semibold text-slate-800">
              Resultados de Creación de Campos
            </Dialog.Title>
            <Dialog.Close className="text-slate-400 hover:text-slate-600 transition-colors">
              <X size={20} />
            </Dialog.Close>
          </div>

          <div className="px-6 py-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
            Destino: <span className="font-mono text-slate-700">[{destSchema}].[{tableName}]</span>
          </div>

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
              <strong>{summary.succeeded}</strong> creados
            </button>

            <button
              onClick={() => toggleFilter('error')}
              className={clsx(
                'flex items-center gap-1.5 text-sm px-2 py-1 rounded-full transition-colors text-red-600',
                statusFilter === 'error' ? 'bg-red-100 ring-1 ring-red-400' : 'hover:bg-red-100/60'
              )}
            >
              <XCircle size={14} />
              <strong>{summary.failed}</strong> fallidos
            </button>

            <div className="ml-auto w-28 bg-slate-200 rounded-full h-2 flex overflow-hidden">
              <div
                className="bg-green-500 h-2 transition-all"
                style={{ width: `${summary.total ? (summary.succeeded / summary.total) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {summary.failed === 0 && statusFilter === 'all' ? (
              <div className="flex flex-col items-center justify-center py-12 text-green-600 gap-3">
                <CheckCircle size={36} />
                <p className="text-sm font-medium">
                  {summary.succeeded === 1
                    ? '1 campo creado exitosamente'
                    : `${summary.succeeded} campos creados exitosamente`}
                </p>
              </div>
            ) : filteredRows.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-slate-400">
                No hay resultados con ese estado.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredRows.map((r) => (
                  <div key={r.row} className={`flex items-start gap-2 px-6 py-3 ${r.status === 'error' ? 'bg-red-50' : 'bg-green-50'}`}>
                    {r.status === 'error'
                      ? <XCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                      : <CheckCircle size={14} className="text-green-600 shrink-0 mt-0.5" />}
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold text-slate-700">Sentencia {r.row}</span>
                      {r.status === 'error' && r.error && (
                        <p className="text-xs text-red-600 mt-0.5 font-mono break-words">{r.error}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

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

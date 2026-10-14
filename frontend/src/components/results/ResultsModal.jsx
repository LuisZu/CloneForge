import { useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, CheckCircle, XCircle, AlertCircle, RotateCcw, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import ResultRow from './ResultRow';
import useAppStore from '../../store/appStore';
import { useCloneOperation } from '../../hooks/useCloneOperation';

const EMPTY_RESULTS = [];
const EMPTY_SUMMARY = { total: 0, succeeded: 0, exists: 0, failed: 0 };

export default function ResultsModal() {
  const { showResults, cloneResults, cloneLoading, objects, setShowResults, showToast } = useAppStore();
  const { clone, cloneDataOnly } = useCloneOperation();
  const [statusFilter, setStatusFilter] = useState('all');

  const results = cloneResults?.results ?? EMPTY_RESULTS;
  const summary = cloneResults?.summary ?? EMPTY_SUMMARY;

  const failedResults = useMemo(() => results.filter((r) => r.status === 'error'), [results]);

  const filteredResults = useMemo(() => {
    const sorted = [...results].sort((a, b) => {
      const order = { success: 0, exists: 1, error: 2 };
      return (order[a.status] ?? 2) - (order[b.status] ?? 2);
    });
    return statusFilter === 'all' ? sorted : sorted.filter((r) => r.status === statusFilter);
  }, [results, statusFilter]);

  if (!cloneResults) return null;

  function toggleFilter(value) {
    setStatusFilter((prev) => (prev === value ? 'all' : value));
  }

  function handleRetryFailed() {
    // Strip the "__data" suffix used for the synthetic "<table> (datos)"
    // rows so a failed data copy retries the same source table object.
    const baseIds = new Set(
      failedResults.map((r) => (r.id.endsWith('__data') ? r.id.slice(0, -'__data'.length) : r.id))
    );
    const retryObjects = objects.filter((o) => baseIds.has(o.id));

    if (retryObjects.length === 0) {
      showToast('No se encontraron los objetos originales para reintentar — puede que la lista se haya actualizado', 'error');
      return;
    }

    setShowResults(false);
    if (cloneResults?.mode === 'dataOnly') {
      cloneDataOnly(undefined, retryObjects);
    } else {
      clone(undefined, retryObjects);
    }
  }

  return (
    <Dialog.Root open={showResults} onOpenChange={setShowResults}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <Dialog.Title className="text-lg font-semibold text-slate-800">
              {cloneResults.mode === 'dataOnly' ? 'Resultados de Carga de Datos' : 'Resultados de Clonación'}
            </Dialog.Title>
            <Dialog.Close className="text-slate-400 hover:text-slate-600 transition-colors">
              <X size={20} />
            </Dialog.Close>
          </div>

          {/* Summary bar — click a status to filter the list below by it */}
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
              <strong>{summary.succeeded}</strong> exitosos
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
                <strong>{summary.exists}</strong> ya existen
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
              <strong>{summary.failed}</strong> fallidos
            </button>

            {/* Progress bar: green=success, amber=exists, red=error */}
            <div className="ml-auto w-32 bg-slate-200 rounded-full h-2 flex overflow-hidden">
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

          {/* Results list — filtered by the status clicked above */}
          <div className="flex-1 overflow-y-auto">
            {filteredResults.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-slate-400">
                No hay resultados con ese estado.
              </p>
            ) : (
              filteredResults.map((r) => <ResultRow key={r.id} result={r} />)
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
            <div>
              {summary.failed > 0 && (
                <button
                  onClick={handleRetryFailed}
                  disabled={cloneLoading}
                  title="Vuelve a ejecutar únicamente los objetos que fallaron"
                  className={clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors',
                    cloneLoading
                      ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                      : 'bg-white text-red-600 border-red-300 hover:bg-red-50'
                  )}
                >
                  {cloneLoading ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                  Reintentar fallidos ({summary.failed})
                </button>
              )}
            </div>
            <Dialog.Close className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors">
              Cerrar
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

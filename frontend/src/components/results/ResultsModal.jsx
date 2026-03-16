import * as Dialog from '@radix-ui/react-dialog';
import { X, CheckCircle, XCircle } from 'lucide-react';
import ResultRow from './ResultRow';
import useAppStore from '../../store/appStore';

export default function ResultsModal() {
  const { showResults, cloneResults, setShowResults } = useAppStore();

  if (!cloneResults) return null;

  const { results, summary } = cloneResults;

  return (
    <Dialog.Root open={showResults} onOpenChange={setShowResults}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <Dialog.Title className="text-lg font-semibold text-slate-800">
              Resultados de Clonación
            </Dialog.Title>
            <Dialog.Close className="text-slate-400 hover:text-slate-600 transition-colors">
              <X size={20} />
            </Dialog.Close>
          </div>

          {/* Summary bar */}
          <div className="flex items-center gap-6 px-6 py-3 bg-slate-50 border-b border-slate-200">
            <span className="text-sm text-slate-600">
              Total: <strong className="text-slate-800">{summary.total}</strong>
            </span>
            <span className="flex items-center gap-1.5 text-sm text-green-700">
              <CheckCircle size={14} />
              <strong>{summary.succeeded}</strong> exitosos
            </span>
            <span className="flex items-center gap-1.5 text-sm text-red-600">
              <XCircle size={14} />
              <strong>{summary.failed}</strong> fallidos
            </span>

            {/* Progress bar */}
            <div className="ml-auto w-32 bg-slate-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${summary.total ? (summary.succeeded / summary.total) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Results list */}
          <div className="flex-1 overflow-y-auto">
            {results.map((r) => (
              <ResultRow key={r.id} result={r} />
            ))}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-200 flex justify-end">
            <Dialog.Close className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors">
              Cerrar
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

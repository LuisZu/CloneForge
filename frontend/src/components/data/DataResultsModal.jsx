import * as Dialog from '@radix-ui/react-dialog';
import { X, CheckCircle, XCircle } from 'lucide-react';
import useAppStore from '../../store/appStore';

export default function DataResultsModal() {
  const { showDataResults, dataInsertResults, setShowDataResults } = useAppStore();

  if (!dataInsertResults) return null;

  const { results, summary, tableName, destSchema } = dataInsertResults;
  const errors = results.filter((r) => r.status === 'error');

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

          {/* Summary */}
          <div className="flex items-center gap-6 px-6 py-3 bg-slate-50 border-b border-slate-200">
            <span className="text-sm text-slate-600">
              Total: <strong className="text-slate-800">{summary.total}</strong>
            </span>
            <span className="flex items-center gap-1.5 text-sm text-green-700">
              <CheckCircle size={14} />
              <strong>{summary.succeeded}</strong> insertadas
            </span>
            <span className="flex items-center gap-1.5 text-sm text-red-600">
              <XCircle size={14} />
              <strong>{summary.failed}</strong> fallidas
            </span>

            {/* Progress bar */}
            <div className="ml-auto w-28 bg-slate-200 rounded-full h-2 flex overflow-hidden">
              <div
                className="bg-green-500 h-2 transition-all"
                style={{ width: `${summary.total ? (summary.succeeded / summary.total) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {errors.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-green-600 gap-3">
                <CheckCircle size={36} />
                <p className="text-sm font-medium">
                  {summary.succeeded === 1
                    ? '1 fila insertada exitosamente'
                    : `${summary.succeeded.toLocaleString()} filas insertadas exitosamente`}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {errors.map((r) => (
                  <div key={r.row} className="px-6 py-3 bg-red-50">
                    <span className="text-xs font-semibold text-red-700">Fila {r.row}</span>
                    <p className="text-xs text-red-600 mt-0.5 font-mono">{r.error}</p>
                  </div>
                ))}
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

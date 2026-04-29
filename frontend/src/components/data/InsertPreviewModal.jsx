import * as Dialog from '@radix-ui/react-dialog';
import { X, Play, FileCode, AlertTriangle } from 'lucide-react';

export default function InsertPreviewModal({ open, script, rowCount, onClose, onExecute, executing }) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v && !executing) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" />
        <Dialog.Content
          className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                     bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col"
          onInteractOutside={(e) => executing && e.preventDefault()}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200">
            <FileCode size={20} className="text-blue-600 shrink-0" />
            <Dialog.Title className="text-lg font-semibold text-slate-800 flex-1">
              Vista Previa del Script
            </Dialog.Title>
            <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">
              {rowCount} {rowCount === 1 ? 'fila' : 'filas'} seleccionada{rowCount !== 1 ? 's' : ''}
            </span>
            {!executing && (
              <Dialog.Close
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 transition-colors ml-1"
              >
                <X size={20} />
              </Dialog.Close>
            )}
          </div>

          {/* Warning banner */}
          <div className="flex items-center gap-2 px-6 py-2 bg-amber-50 border-b border-amber-100">
            <AlertTriangle size={14} className="text-amber-600 shrink-0" />
            <p className="text-xs text-amber-700">
              Revisa el script antes de ejecutarlo. Esta acción no se puede deshacer automáticamente.
            </p>
          </div>

          {/* Script code block */}
          <div className="flex-1 overflow-auto p-4">
            <pre
              className="font-mono text-xs bg-slate-900 text-emerald-300 p-5 rounded-xl
                         whitespace-pre leading-relaxed overflow-x-auto"
            >
              {script}
            </pre>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              disabled={executing}
              className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-300
                         rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              onClick={onExecute}
              disabled={executing}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium
                         rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play size={14} />
              {executing ? 'Ejecutando...' : 'Aprobar y Ejecutar'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

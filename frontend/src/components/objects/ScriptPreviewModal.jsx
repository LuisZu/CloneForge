import * as Dialog from '@radix-ui/react-dialog';
import { X, Copy, Check, Loader2, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import TypeBadge from './TypeBadge';

export default function ScriptPreviewModal({ object, ddl, loading, error, onClose }) {
  const [copied, setCopied] = useState(false);

  function copyToClipboard() {
    if (!ddl) return;
    navigator.clipboard.writeText(ddl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const isOpen = !!object;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
            <div className="flex items-center gap-3">
              <Dialog.Title className="text-base font-semibold text-slate-800">
                {object ? `[${object.schema}].[${object.name}]` : ''}
              </Dialog.Title>
              {object && <TypeBadge type={object.type} />}
            </div>
            <Dialog.Close className="text-slate-400 hover:text-slate-600 transition-colors">
              <X size={20} />
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-auto bg-slate-950 relative">
            {loading && (
              <div className="flex items-center justify-center h-48 gap-2 text-slate-400">
                <Loader2 size={18} className="animate-spin" />
                <span className="text-sm">Obteniendo script...</span>
              </div>
            )}

            {error && !loading && (
              <div className="flex items-center justify-center h-48 gap-2 text-red-400">
                <AlertCircle size={18} />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {ddl && !loading && (
              <pre className="p-5 text-xs text-slate-100 font-mono leading-relaxed whitespace-pre overflow-x-auto">
                {ddl}
              </pre>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-slate-50 shrink-0 rounded-b-2xl">
            <span className="text-xs text-slate-400">
              {ddl ? `${ddl.split('\n').length} líneas · ${ddl.length.toLocaleString()} caracteres` : ''}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={copyToClipboard}
                disabled={!ddl || loading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-600 hover:border-blue-400 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                {copied ? 'Copiado' : 'Copiar script'}
              </button>
              <Dialog.Close className="px-4 py-1.5 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors">
                Cerrar
              </Dialog.Close>
            </div>
          </div>

        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

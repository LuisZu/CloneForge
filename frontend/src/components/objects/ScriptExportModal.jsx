import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Copy, Download, Check } from 'lucide-react';

export default function ScriptExportModal({ open, sql, onClose }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(sql || '').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleDownload() {
    const blob = new Blob([sql || ''], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'script.sql';
    a.click();
    URL.revokeObjectURL(url);
  }

  const lineCount = sql ? sql.split('\n').length : 0;

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-4xl max-h-[85vh] bg-white rounded-xl shadow-2xl flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
            <div className="flex items-center gap-3">
              <Dialog.Title className="text-base font-semibold text-slate-800">
                Script exportado
              </Dialog.Title>
              {sql && (
                <span className="text-xs text-slate-400 font-mono">
                  {lineCount} líneas
                </span>
              )}
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Code block */}
          <div className="flex-1 overflow-auto bg-slate-900 mx-5 my-4 rounded-lg">
            <pre className="p-4 text-xs font-mono text-emerald-300 whitespace-pre leading-relaxed">
              {sql || ''}
            </pre>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200 shrink-0">
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
            >
              <Download size={14} />
              Descargar .sql
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copiado' : 'Copiar al portapapeles'}
            </button>
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-600 hover:border-slate-400 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

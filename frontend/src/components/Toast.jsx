import { useEffect } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import clsx from 'clsx';
import useAppStore from '../store/appStore';

const ICONS = {
  success: <CheckCircle size={16} className="text-green-600" />,
  error: <XCircle size={16} className="text-red-500" />,
  info: <Info size={16} className="text-blue-500" />,
};

export default function Toast() {
  const { toast, clearToast } = useAppStore();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(clearToast, 4000);
    return () => clearTimeout(t);
  }, [toast, clearToast]);

  if (!toast) return null;

  return (
    <div
      className={clsx(
        'fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg max-w-sm',
        'bg-white border',
        toast.type === 'error' ? 'border-red-200' : toast.type === 'success' ? 'border-green-200' : 'border-blue-200'
      )}
    >
      {ICONS[toast.type] || ICONS.info}
      <span className="text-sm text-slate-700 flex-1">{toast.message}</span>
      <button onClick={clearToast} className="text-slate-400 hover:text-slate-600">
        <X size={14} />
      </button>
    </div>
  );
}

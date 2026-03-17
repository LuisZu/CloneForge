import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import TypeBadge from '../objects/TypeBadge';

const STATE = {
  success: {
    row:   'bg-green-50',
    icon:  <CheckCircle size={16} className="text-green-600 shrink-0" />,
    label: 'OK',
    labelClass: 'text-green-600',
    msgClass: '',
  },
  exists: {
    row:   'bg-amber-50',
    icon:  <AlertCircle size={16} className="text-amber-500 shrink-0" />,
    label: 'YA EXISTE',
    labelClass: 'text-amber-600',
    msgClass: 'text-amber-600',
  },
  error: {
    row:   'bg-red-50',
    icon:  <XCircle size={16} className="text-red-500 shrink-0" />,
    label: 'ERROR',
    labelClass: 'text-red-500',
    msgClass: 'text-red-600',
  },
};

export default function ResultRow({ result }) {
  const s = STATE[result.status] ?? (result.success ? STATE.success : STATE.error);

  return (
    <div className={`flex items-start gap-3 py-3 px-4 border-b border-slate-100 last:border-b-0 ${s.row}`}>
      <div className="mt-0.5">{s.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-800 truncate">
            {result.schema}.{result.name}
          </span>
          <TypeBadge type={result.type} />
        </div>
        {result.error && result.status !== 'success' && (
          <p className={`text-xs mt-1 break-words ${s.msgClass}`}>
            {result.status === 'exists'
              ? 'El objeto ya existe en la base de datos destino.'
              : result.error}
          </p>
        )}
      </div>
      <span className={`text-xs font-semibold shrink-0 ${s.labelClass}`}>
        {s.label}
      </span>
    </div>
  );
}

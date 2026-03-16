import { CheckCircle, XCircle } from 'lucide-react';
import TypeBadge from '../objects/TypeBadge';

export default function ResultRow({ result }) {
  return (
    <div className={`flex items-start gap-3 py-3 px-4 border-b border-slate-100 last:border-b-0 ${result.success ? 'bg-green-50' : 'bg-red-50'}`}>
      <div className="mt-0.5">
        {result.success ? (
          <CheckCircle size={16} className="text-green-600 shrink-0" />
        ) : (
          <XCircle size={16} className="text-red-500 shrink-0" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-800 truncate">
            {result.schema}.{result.name}
          </span>
          <TypeBadge type={result.type} />
        </div>
        {result.error && (
          <p className="text-xs text-red-600 mt-1 break-words">{result.error}</p>
        )}
      </div>
      <span className={`text-xs font-semibold shrink-0 ${result.success ? 'text-green-600' : 'text-red-500'}`}>
        {result.success ? 'OK' : 'ERROR'}
      </span>
    </div>
  );
}

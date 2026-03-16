import { Search, Copy, Loader2 } from 'lucide-react';
import clsx from 'clsx';

const TYPE_FILTERS = ['SP', 'VISTA', 'TABLA', 'FUNCION', 'TRIGGER'];

export default function GridToolbar({
  quickFilter,
  onQuickFilter,
  typeFilter,
  onTypeFilter,
  selectedCount,
  onClone,
  cloneLoading,
  destConnected,
}) {
  function toggleType(type) {
    if (typeFilter.includes(type)) {
      onTypeFilter(typeFilter.filter((t) => t !== type));
    } else {
      onTypeFilter([...typeFilter, type]);
    }
  }

  const canClone = selectedCount > 0 && destConnected && !cloneLoading;

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-white border-b border-slate-200">
      {/* Search */}
      <div className="relative flex-1 min-w-40">
        <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar objeto..."
          value={quickFilter}
          onChange={(e) => onQuickFilter(e.target.value)}
          className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Type filters */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {TYPE_FILTERS.map((type) => (
          <button
            key={type}
            onClick={() => toggleType(type)}
            className={clsx(
              'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
              typeFilter.includes(type)
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'
            )}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Selection count + clone button */}
      <div className="flex items-center gap-3 ml-auto">
        {selectedCount > 0 && (
          <span className="text-sm text-slate-500">
            <strong className="text-slate-700">{selectedCount}</strong> seleccionado{selectedCount !== 1 ? 's' : ''}
          </span>
        )}

        <button
          onClick={onClone}
          disabled={!canClone}
          title={!destConnected ? 'Conecte primero la base de datos destino' : ''}
          className={clsx(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            canClone
              ? 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          )}
        >
          {cloneLoading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Copy size={14} />
          )}
          {cloneLoading ? 'Clonando...' : 'Clonar Seleccionados'}
        </button>
      </div>
    </div>
  );
}

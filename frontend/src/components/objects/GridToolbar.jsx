import { Search, Copy, Loader2, RefreshCw } from 'lucide-react';
import clsx from 'clsx';

const TYPE_FILTERS = ['SP', 'VISTA', 'TABLA', 'FUNCION', 'TRIGGER'];

export default function GridToolbar({
  quickFilter,
  onQuickFilter,
  typeFilter,
  onTypeFilter,
  schemaFilter,
  onSchemaFilter,
  availableSchemas,
  destSchema,
  onDestSchema,
  includeData,
  onIncludeData,
  selectedCount,
  onClone,
  cloneLoading,
  destConnected,
  onRefresh,
  refreshLoading,
}) {
  function toggleType(type) {
    if (typeFilter.includes(type)) {
      onTypeFilter(typeFilter.filter((t) => t !== type));
    } else {
      onTypeFilter([...typeFilter, type]);
    }
  }

  function toggleSchema(schema) {
    if (schemaFilter.includes(schema)) {
      onSchemaFilter(schemaFilter.filter((s) => s !== schema));
    } else {
      onSchemaFilter([...schemaFilter, schema]);
    }
  }

  const allSchemasSelected = availableSchemas.length > 0 && schemaFilter.length === availableSchemas.length;

  function toggleAllSchemas() {
    if (allSchemasSelected) {
      onSchemaFilter([]);
    } else {
      onSchemaFilter([...availableSchemas]);
    }
  }

  const canClone = selectedCount > 0 && destConnected && !cloneLoading;

  return (
    <div className="flex flex-col gap-2 px-4 py-3 bg-white border-b border-slate-200">
      {/* Row 1: search + type filters */}
      <div className="flex flex-wrap items-center gap-3">
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

        {/* Refresh button */}
        <button
          onClick={onRefresh}
          disabled={refreshLoading || !onRefresh}
          title="Refrescar información"
          className={clsx(
            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors shrink-0',
            refreshLoading || !onRefresh
              ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
              : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400 hover:text-blue-600'
          )}
        >
          <RefreshCw size={14} className={refreshLoading ? 'animate-spin' : ''} />
          {refreshLoading ? 'Refrescando...' : 'Refrescar Información'}
        </button>

        {/* Type filters */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-slate-400 font-medium">Tipo:</span>
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
      </div>

      {/* Row 2: schema filter + dest schema input + clone button */}
      {availableSchemas.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          {/* Schema filters */}
          <div className="flex items-center gap-1.5 flex-wrap flex-1">
            <span className="text-xs text-slate-400 font-medium">Esquema:</span>
            <button
              onClick={toggleAllSchemas}
              className={clsx(
                'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                allSchemasSelected
                  ? 'bg-slate-700 text-white border-slate-700'
                  : 'bg-white text-slate-600 border-slate-300 hover:border-slate-500'
              )}
            >
              Todos
            </button>
            {availableSchemas.map((schema) => (
              <button
                key={schema}
                onClick={() => toggleSchema(schema)}
                className={clsx(
                  'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                  schemaFilter.includes(schema)
                    ? 'bg-slate-600 text-white border-slate-600'
                    : 'bg-white text-slate-500 border-slate-300 hover:border-slate-500'
                )}
              >
                {schema}
              </button>
            ))}
          </div>

          {/* Dest schema input + include data + clone button */}
          <div className="flex items-center gap-2 ml-auto">
            <div className="flex flex-col">
              <label className="text-xs text-slate-400 mb-1">Esquema destino (opcional)</label>
              <input
                type="text"
                placeholder="ej: dbo"
                value={destSchema}
                onChange={(e) => onDestSchema(e.target.value)}
                className="w-36 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Include data toggle */}
            <div className="flex flex-col justify-end pb-0.5">
              <span className="text-xs text-slate-400 mb-1">Incluir datos</span>
              <button
                onClick={() => onIncludeData(!includeData)}
                title="Copiar también los registros de las tablas seleccionadas"
                className={clsx(
                  'relative inline-flex items-center h-[34px] gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-colors',
                  includeData
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-slate-500 border-slate-300 hover:border-slate-400'
                )}
              >
                <span className={clsx(
                  'w-7 h-4 rounded-full transition-colors flex items-center px-0.5',
                  includeData ? 'bg-emerald-400' : 'bg-slate-300'
                )}>
                  <span className={clsx(
                    'w-3 h-3 rounded-full bg-white shadow transition-transform',
                    includeData ? 'translate-x-3' : 'translate-x-0'
                  )} />
                </span>
                {includeData ? 'Sí' : 'No'}
              </button>
              <span className="text-xs text-slate-400 mt-0.5 text-center">(solo tablas)</span>
            </div>

            <div className="flex flex-col justify-end">
              {selectedCount > 0 && (
                <span className="text-xs text-slate-500 mb-1 text-right">
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
        </div>
      )}

      {/* Row 2 (no schemas loaded yet): just clone button */}
      {availableSchemas.length === 0 && (
        <div className="flex items-center justify-end gap-3">
          {selectedCount > 0 && (
            <span className="text-sm text-slate-500">
              <strong className="text-slate-700">{selectedCount}</strong> seleccionado{selectedCount !== 1 ? 's' : ''}
            </span>
          )}
          <button
            onClick={onClone}
            disabled={!canClone}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              canClone
                ? 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            )}
          >
            {cloneLoading ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />}
            {cloneLoading ? 'Clonando...' : 'Clonar Seleccionados'}
          </button>
        </div>
      )}
    </div>
  );
}

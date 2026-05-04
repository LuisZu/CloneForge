import { Search, Copy, Download, Loader2, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import MultiSelectDropdown from '../ui/MultiSelectDropdown';

const ALL_TYPES = ['SP', 'VISTA', 'TABLA', 'FUNCION', 'TRIGGER'];

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
  overwriteExisting,
  onOverwriteExisting,
  selectedCount,
  onClone,
  cloneLoading,
  onExport,
  exportLoading,
  destConnected,
  onRefresh,
  refreshLoading,
}) {
  const canClone  = selectedCount > 0 && destConnected && !cloneLoading && !exportLoading;
  const canExport = selectedCount > 0 && !cloneLoading && !exportLoading;

  return (
    <div className="flex flex-col gap-2 px-4 py-3 bg-white border-b border-slate-200">

      {/* Row 1: search + type multiselect + schema multiselect + refresh */}
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

        {/* Type multi-select */}
        <MultiSelectDropdown
          label="Tipo"
          options={ALL_TYPES}
          selected={typeFilter}
          onChange={onTypeFilter}
          placeholder="Todos los tipos"
        />

        {/* Schema multi-select (only when schemas are loaded) */}
        {availableSchemas.length > 0 && (
          <MultiSelectDropdown
            label="Esquema"
            options={availableSchemas}
            selected={schemaFilter}
            onChange={onSchemaFilter}
            placeholder="Todos los esquemas"
          />
        )}

        {/* Refresh */}
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
      </div>

      {/* Row 2: clone options + clone button */}
      <div className="flex flex-wrap items-center gap-3 justify-end">

        {/* Dest schema */}
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
        <div className="flex flex-col">
          <span className="text-xs text-slate-400 mb-1">Incluir datos <span className="text-slate-300">(solo tablas)</span></span>
          <button
            onClick={() => onIncludeData(!includeData)}
            title="Copiar también los registros de las tablas seleccionadas"
            className={clsx(
              'flex items-center gap-2 h-[34px] px-3 rounded-lg text-xs font-medium border transition-colors',
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
        </div>

        {/* Overwrite toggle */}
        <div className="flex flex-col">
          <span className="text-xs text-slate-400 mb-1">Reemplazar si existe</span>
          <button
            onClick={() => onOverwriteExisting(!overwriteExisting)}
            title="Si el objeto ya existe en destino, lo elimina y vuelve a crearlo"
            className={clsx(
              'flex items-center gap-2 h-[34px] px-3 rounded-lg text-xs font-medium border transition-colors',
              overwriteExisting
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-white text-slate-500 border-slate-300 hover:border-slate-400'
            )}
          >
            <span className={clsx(
              'w-7 h-4 rounded-full transition-colors flex items-center px-0.5',
              overwriteExisting ? 'bg-orange-300' : 'bg-slate-300'
            )}>
              <span className={clsx(
                'w-3 h-3 rounded-full bg-white shadow transition-transform',
                overwriteExisting ? 'translate-x-3' : 'translate-x-0'
              )} />
            </span>
            {overwriteExisting ? 'Sí' : 'No'}
          </button>
        </div>

        {/* Export + Clone buttons */}
        <div className="flex flex-col justify-end">
          {selectedCount > 0 && (
            <span className="text-xs text-slate-500 mb-1 text-right">
              <strong className="text-slate-700">{selectedCount}</strong> seleccionado{selectedCount !== 1 ? 's' : ''}
            </span>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={onExport}
              disabled={!canExport}
              title="Genera el script SQL sin ejecutarlo"
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors',
                canExport
                  ? 'bg-white text-slate-600 border-slate-300 hover:border-blue-400 hover:text-blue-600'
                  : 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
              )}
            >
              {exportLoading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {exportLoading ? 'Generando...' : 'Exportar Script'}
            </button>
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
              {cloneLoading ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />}
              {cloneLoading ? 'Clonando...' : 'Clonar Seleccionados'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

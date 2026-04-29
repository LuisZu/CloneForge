import clsx from 'clsx';
import { Download, RefreshCw } from 'lucide-react';

export default function DataToolbar({
  tables,
  selectedTable,
  onSelectTable,
  destSchema,
  onDestSchema,
  selectedCount,
  onInsert,
  insertLoading,
  destConnected,
  rowCount,
  onRefresh,
  refreshLoading,
}) {
  const tableKey = selectedTable ? `${selectedTable.schema}.${selectedTable.name}` : '';

  return (
    <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-end gap-3">

      {/* Table selector */}
      <div className="flex flex-col">
        <span className="text-xs text-slate-400 mb-1">Tabla origen</span>
        <select
          value={tableKey}
          onChange={(e) => {
            const found = tables.find((t) => `${t.schema}.${t.name}` === e.target.value);
            onSelectTable(found || null);
          }}
          className="h-[34px] px-2 border border-slate-300 rounded-lg text-sm text-slate-700 bg-white
                     focus:outline-none focus:ring-2 focus:ring-blue-300 min-w-60"
        >
          <option value="">-- Seleccionar tabla --</option>
          {tables.map((t) => (
            <option key={t.id} value={`${t.schema}.${t.name}`}>
              [{t.schema}].[{t.name}]
            </option>
          ))}
        </select>
      </div>

      {/* Reload objects button */}
      <div className="flex flex-col justify-end">
        <button
          onClick={onRefresh}
          disabled={refreshLoading}
          title="Recargar lista de tablas"
          className="flex items-center gap-1.5 h-[34px] px-3 rounded-lg text-xs font-medium border
                     border-slate-300 bg-white text-slate-500 hover:border-slate-400 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} className={refreshLoading ? 'animate-spin' : ''} />
          {refreshLoading ? 'Cargando...' : 'Recargar'}
        </button>
      </div>

      {/* Destination schema */}
      <div className="flex flex-col">
        <span className="text-xs text-slate-400 mb-1">Esquema destino</span>
        <input
          type="text"
          value={destSchema}
          onChange={(e) => onDestSchema(e.target.value)}
          placeholder="(mismo esquema)"
          className="h-[34px] px-3 border border-slate-300 rounded-lg text-sm text-slate-700 bg-white
                     focus:outline-none focus:ring-2 focus:ring-blue-300 w-44"
        />
      </div>

      {/* Row count */}
      {rowCount > 0 && (
        <div className="flex flex-col">
          <span className="text-xs text-slate-400 mb-1">Filas cargadas</span>
          <span className="h-[34px] flex items-center text-sm text-slate-500">
            {rowCount.toLocaleString()}
          </span>
        </div>
      )}

      <div className="flex-1" />

      {/* Insert button */}
      <div className="flex flex-col justify-end">
        {selectedCount > 0 && (
          <span className="text-xs text-slate-500 mb-1 text-right">
            {selectedCount.toLocaleString()} {selectedCount === 1 ? 'fila seleccionada' : 'filas seleccionadas'}
          </span>
        )}
        <button
          onClick={onInsert}
          disabled={selectedCount === 0 || !destConnected || insertLoading}
          title={
            !destConnected
              ? 'Conecta la base de datos Destino'
              : selectedCount === 0
              ? 'Selecciona al menos una fila'
              : ''
          }
          className={clsx(
            'flex items-center gap-2 h-[34px] px-4 rounded-lg text-sm font-medium transition-colors',
            selectedCount > 0 && destConnected && !insertLoading
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed',
          )}
        >
          <Download size={15} />
          {insertLoading
            ? 'Insertando...'
            : `Insertar${selectedCount > 0 ? ` (${selectedCount.toLocaleString()})` : ''}`}
        </button>
      </div>
    </div>
  );
}

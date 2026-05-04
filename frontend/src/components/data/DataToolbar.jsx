import clsx from 'clsx';
import { Download, FileDown, RefreshCw } from 'lucide-react';
import SingleSelectDropdown from '../ui/SingleSelectDropdown';

export default function DataToolbar({
  tables,
  selectedTable,
  onSelectTable,
  destSchema,
  onDestSchema,
  selectedCount,
  onInsert,
  insertLoading,
  onExport,
  destConnected,
  rowCount,
  onRefresh,
  refreshLoading,
}) {
  const tableOptions = tables.map((t) => ({
    value: `${t.schema}.${t.name}`,
    label: `[${t.schema}].[${t.name}]`,
    data: t,
  }));

  const selectedValue = selectedTable
    ? `${selectedTable.schema}.${selectedTable.name}`
    : null;

  function handleTableChange(value) {
    if (!value) { onSelectTable(null); return; }
    const found = tables.find((t) => `${t.schema}.${t.name}` === value);
    onSelectTable(found ?? null);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-white border-b border-slate-200">

      {/* Table selector */}
      <SingleSelectDropdown
        label="Tabla"
        options={tableOptions}
        selected={selectedValue}
        onChange={handleTableChange}
        placeholder="Seleccionar tabla..."
      />

      {/* Reload */}
      <button
        onClick={onRefresh}
        disabled={refreshLoading}
        title="Recargar lista de tablas"
        className={clsx(
          'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors shrink-0',
          refreshLoading
            ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
            : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400 hover:text-blue-600',
        )}
      >
        <RefreshCw size={14} className={refreshLoading ? 'animate-spin' : ''} />
        {refreshLoading ? 'Refrescando...' : 'Refrescar Información'}
      </button>

      {/* Destination schema */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-slate-400 font-medium shrink-0">Esquema destino:</span>
        <input
          type="text"
          value={destSchema}
          onChange={(e) => onDestSchema(e.target.value)}
          placeholder="ej: dbo"
          className="w-36 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Row count */}
      {rowCount > 0 && (
        <span className="text-xs text-slate-400">
          {rowCount.toLocaleString()} filas cargadas
        </span>
      )}

      <div className="flex-1" />

      {/* Export + Insert buttons */}
      <div className="flex flex-col items-end">
        {selectedCount > 0 && (
          <span className="text-xs text-slate-500 mb-1">
            <strong className="text-slate-700">{selectedCount.toLocaleString()}</strong>{' '}
            {selectedCount === 1 ? 'fila seleccionada' : 'filas seleccionadas'}
          </span>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={onExport}
            disabled={selectedCount === 0 || insertLoading}
            title={selectedCount === 0 ? 'Selecciona al menos una fila' : 'Ver el script SQL sin ejecutarlo'}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors',
              selectedCount > 0 && !insertLoading
                ? 'bg-white text-slate-600 border-slate-300 hover:border-blue-400 hover:text-blue-600'
                : 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed',
            )}
          >
            <FileDown size={14} />
            Exportar Script
          </button>
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
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              selectedCount > 0 && destConnected && !insertLoading
                ? 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed',
            )}
          >
            <Download size={14} />
            {insertLoading
              ? 'Insertando...'
              : `Insertar${selectedCount > 0 ? ` (${selectedCount.toLocaleString()})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

import clsx from 'clsx';
import { RefreshCw, PlusCircle } from 'lucide-react';
import SingleSelectDropdown from '../ui/SingleSelectDropdown';

export default function CompareColumnsToolbar({
  tables,
  selectedTable,
  onSelectTable,
  destSchema,
  onDestSchema,
  onCompare,
  compareLoading,
  compared,
  destConnected,
  selectedCount,
  onAddFields,
}) {
  const tableOptions = tables.map((t) => ({
    value: `${t.schema}.${t.name}`,
    label: `[${t.schema}].[${t.name}]`,
    data: t,
  }));

  const selectedValue = selectedTable ? `${selectedTable.schema}.${selectedTable.name}` : null;

  function handleTableChange(value) {
    if (!value) { onSelectTable(null); return; }
    const found = tables.find((t) => `${t.schema}.${t.name}` === value);
    onSelectTable(found ?? null);
  }

  const canCompare = !!selectedTable && destConnected && !compareLoading;

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-white border-b border-slate-200">
      <SingleSelectDropdown
        label="Tabla"
        options={tableOptions}
        selected={selectedValue}
        onChange={handleTableChange}
        placeholder="Seleccionar tabla..."
      />

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

      <button
        onClick={onCompare}
        disabled={!canCompare}
        title={!destConnected ? 'Conecte primero la base de datos destino' : !selectedTable ? 'Seleccione una tabla' : ''}
        className={clsx(
          'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors shrink-0',
          canCompare
            ? 'bg-white text-slate-600 border-slate-300 hover:border-blue-400 hover:text-blue-600'
            : 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
        )}
      >
        <RefreshCw size={14} className={compareLoading ? 'animate-spin' : ''} />
        {compareLoading ? 'Comparando...' : compared ? 'Actualizar comparación' : 'Comparar Campos'}
      </button>

      <div className="flex-1" />

      {selectedCount > 0 && (
        <span className="text-xs text-slate-500">
          <strong className="text-slate-700">{selectedCount}</strong> campo{selectedCount !== 1 ? 's' : ''} seleccionado{selectedCount !== 1 ? 's' : ''}
        </span>
      )}
      <button
        onClick={onAddFields}
        disabled={selectedCount === 0 || !destConnected}
        title={selectedCount === 0 ? 'Selecciona al menos un campo faltante' : ''}
        className={clsx(
          'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
          selectedCount > 0 && destConnected
            ? 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
        )}
      >
        <PlusCircle size={14} />
        Agregar Campos a Destino
      </button>
    </div>
  );
}

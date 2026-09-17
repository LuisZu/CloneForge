import { useCallback, useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { GitCompare } from 'lucide-react';

import useAppStore from '../../store/appStore';
import TypeBadge from '../objects/TypeBadge';
import DiffStatusBadge from './DiffStatusBadge';
import CompareObjectsToolbar from './CompareObjectsToolbar';
import ScriptExportModal from '../objects/ScriptExportModal';
import { useCompareObjects } from '../../hooks/useCompareObjects';
import { useCloneOperation } from '../../hooks/useCloneOperation';

const TYPE_ALL = ['SP', 'VISTA', 'TABLA', 'FUNCION', 'TRIGGER', 'INDICE'];

function TypeBadgeCellRenderer({ value }) {
  return <TypeBadge type={value} />;
}

function DiffStatusCellRenderer({ value }) {
  return <DiffStatusBadge status={value} />;
}

export default function CompareObjectsView() {
  const gridRef = useRef();
  const [quickFilter, setQuickFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState(TYPE_ALL);
  const [schemaFilter, setSchemaFilter] = useState([]);
  const [onlyDiffs, setOnlyDiffs] = useState(true);

  const {
    sourceConnected,
    destConnected,
    destSchema,
    setDestSchema,
    overwriteExisting,
    setOverwriteExisting,
    setSelectedObjects,
    showToast,
  } = useAppStore();

  const { compare, loading: compareLoading, error, compared, diffRows } = useCompareObjects();
  const { clone, exportScript, exportLoading } = useCloneOperation();
  const [exportSql, setExportSql] = useState(null);
  const cloneLoading = useAppStore((s) => s.cloneLoading);
  const selectedCount = useAppStore((s) => s.selectedObjects.length);

  const availableSchemas = useMemo(() => {
    const set = new Set(diffRows.map((o) => o.schema));
    return [...set].sort();
  }, [diffRows]);

  const prevSchemasRef = useRef([]);
  useMemo(() => {
    const prev = prevSchemasRef.current;
    if (availableSchemas.length > 0 && (prev.length === 0 || prev.join() !== availableSchemas.join())) {
      setSchemaFilter(availableSchemas);
      prevSchemasRef.current = availableSchemas;
    }
  }, [availableSchemas]);

  const columnDefs = useMemo(() => [
    {
      checkboxSelection: true,
      headerCheckboxSelection: false,
      width: 48,
      minWidth: 48,
      maxWidth: 48,
      resizable: false,
      sortable: false,
      filter: false,
      cellStyle: ({ data }) =>
        data?.diffStatus !== 'MISSING_IN_DEST' ? { opacity: 0.25, pointerEvents: 'none' } : null,
    },
    { field: 'schema', headerName: 'Esquema', width: 120, filter: true, sortable: true },
    { field: 'name', headerName: 'Nombre', flex: 1, filter: true, sortable: true, minWidth: 200 },
    {
      field: 'type', headerName: 'Tipo', width: 130,
      cellRenderer: TypeBadgeCellRenderer, filter: true, sortable: true,
    },
    {
      field: 'diffStatus', headerName: 'Estado', width: 160,
      cellRenderer: DiffStatusCellRenderer, filter: true, sortable: true,
    },
  ], []);

  const defaultColDef = useMemo(() => ({ resizable: true }), []);

  const isExternalFilterPresent = useCallback(() => true, []);
  const doesExternalFilterPass = useCallback(
    ({ data }) =>
      typeFilter.includes(data.type) &&
      schemaFilter.includes(data.schema) &&
      (!onlyDiffs || data.diffStatus !== 'MATCH'),
    [typeFilter, schemaFilter, onlyDiffs]
  );

  function onSelectionChanged() {
    const api = gridRef.current?.api;
    const rows = api?.getSelectedRows() || [];
    const eligible = rows.filter((r) => r.diffStatus === 'MISSING_IN_DEST');
    const ineligible = rows.filter((r) => r.diffStatus !== 'MISSING_IN_DEST');

    if (ineligible.length > 0 && api) {
      ineligible.forEach((row) => api.getRowNode(row.id)?.setSelected(false, false));
      showToast('Solo se pueden seleccionar objetos que faltan en Destino', 'error');
    }

    setSelectedObjects(eligible);
  }

  function handleClone() {
    clone(() => {
      gridRef.current?.api?.deselectAll();
      compare();
    });
  }

  function refilter() {
    gridRef.current?.api?.onFilterChanged();
  }

  if (!sourceConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
        <GitCompare size={40} className="opacity-30" />
        <p className="text-sm">Conecta la base de datos Origen para comparar objetos</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <CompareObjectsToolbar
        quickFilter={quickFilter}
        onQuickFilter={setQuickFilter}
        typeFilter={typeFilter}
        onTypeFilter={(f) => { setTypeFilter(f); refilter(); }}
        schemaFilter={schemaFilter}
        onSchemaFilter={(f) => { setSchemaFilter(f); refilter(); }}
        availableSchemas={availableSchemas}
        onlyDiffs={onlyDiffs}
        onOnlyDiffs={(v) => { setOnlyDiffs(v); refilter(); }}
        destSchema={destSchema}
        onDestSchema={setDestSchema}
        overwriteExisting={overwriteExisting}
        onOverwriteExisting={setOverwriteExisting}
        selectedCount={selectedCount}
        onClone={handleClone}
        cloneLoading={cloneLoading}
        onExport={() => exportScript((sql) => setExportSql(sql))}
        exportLoading={exportLoading}
        destConnected={destConnected}
        onCompare={compare}
        compareLoading={compareLoading}
        compared={compared}
      />

      <div className="flex-1 ag-theme-alpine" style={{ minHeight: 0 }}>
        {error ? (
          <div className="flex items-center justify-center h-64 text-red-500 text-sm">Error: {error}</div>
        ) : !compared ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-2">
            <GitCompare size={32} className="opacity-30" />
            <p className="text-sm">
              {destConnected
                ? 'Presiona "Comparar" para ver las diferencias entre Origen y Destino'
                : 'Conecta la base de datos Destino y presiona "Comparar"'}
            </p>
          </div>
        ) : compareLoading ? (
          <div className="flex items-center justify-center h-64 text-slate-500 text-sm">Comparando...</div>
        ) : (
          <AgGridReact
            ref={gridRef}
            rowData={diffRows}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            quickFilterText={quickFilter}
            rowSelection="multiple"
            suppressRowClickSelection={true}
            onSelectionChanged={onSelectionChanged}
            isExternalFilterPresent={isExternalFilterPresent}
            doesExternalFilterPass={doesExternalFilterPass}
            getRowId={(params) => params.data.id}
            animateRows={true}
            pagination={true}
            paginationPageSize={50}
          />
        )}
      </div>

      <ScriptExportModal
        open={exportSql !== null}
        sql={exportSql}
        onClose={() => setExportSql(null)}
      />
    </div>
  );
}

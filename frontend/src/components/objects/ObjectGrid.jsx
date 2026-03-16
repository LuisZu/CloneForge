import { useCallback, useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

import useAppStore from '../../store/appStore';
import TypeBadge from './TypeBadge';
import GridToolbar from './GridToolbar';
import { useCloneOperation } from '../../hooks/useCloneOperation';

const TYPE_ALL = ['SP', 'VISTA', 'TABLA', 'FUNCION', 'TRIGGER'];

function TypeBadgeCellRenderer({ value }) {
  return <TypeBadge type={value} />;
}

function DateCellRenderer({ value }) {
  if (!value) return null;
  return <span>{new Date(value).toLocaleDateString('es-ES')}</span>;
}

export default function ObjectGrid() {
  const gridRef = useRef();
  const [quickFilter, setQuickFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState(TYPE_ALL);
  const [schemaFilter, setSchemaFilter] = useState([]);

  const {
    objects,
    objectsLoading,
    objectsError,
    cloneResults,
    cloneLoading,
    destConnected,
    destSchema,
    setDestSchema,
    setSelectedObjects,
  } = useAppStore();

  const { clone } = useCloneOperation();
  const selectedCount = useAppStore((s) => s.selectedObjects.length);

  // Derive unique schemas from loaded objects, sorted alphabetically
  const availableSchemas = useMemo(() => {
    const set = new Set(objects.map((o) => o.schema));
    return [...set].sort();
  }, [objects]);

  // When objects load, initialise schemaFilter to all schemas
  const prevSchemasRef = useRef([]);
  useMemo(() => {
    const prev = prevSchemasRef.current;
    if (
      availableSchemas.length > 0 &&
      (prev.length === 0 || prev.join() !== availableSchemas.join())
    ) {
      setSchemaFilter(availableSchemas);
      prevSchemasRef.current = availableSchemas;
    }
  }, [availableSchemas]);

  // Build a map from object id → result for row styling
  const resultMap = useMemo(() => {
    if (!cloneResults) return {};
    return Object.fromEntries(cloneResults.results.map((r) => [r.id, r]));
  }, [cloneResults]);

  const columnDefs = useMemo(() => [
    {
      checkboxSelection: true,
      headerCheckboxSelection: true,
      width: 48,
      minWidth: 48,
      maxWidth: 48,
      resizable: false,
      sortable: false,
      filter: false,
    },
    { field: 'schema', headerName: 'Esquema', width: 120, filter: true, sortable: true },
    { field: 'name', headerName: 'Nombre', flex: 1, filter: true, sortable: true, minWidth: 200 },
    {
      field: 'type',
      headerName: 'Tipo',
      width: 130,
      cellRenderer: TypeBadgeCellRenderer,
      filter: true,
      sortable: true,
    },
    {
      field: 'modifiedAt',
      headerName: 'Modificado',
      width: 130,
      cellRenderer: DateCellRenderer,
      sortable: true,
    },
    {
      headerName: 'Estado',
      width: 140,
      cellRenderer: ({ data }) => {
        const r = resultMap[data.id];
        if (!r) return null;
        if (r.success) {
          return <span className="text-green-600 text-xs font-medium">✓ Exitoso</span>;
        }
        return (
          <span className="text-red-500 text-xs font-medium" title={r.error}>
            ✗ Error
          </span>
        );
      },
      sortable: false,
      filter: false,
    },
  ], [resultMap]);

  const defaultColDef = useMemo(() => ({ resizable: true }), []);

  // External filter: type AND schema
  const isExternalFilterPresent = useCallback(() => true, []);
  const doesExternalFilterPass = useCallback(
    ({ data }) => typeFilter.includes(data.type) && schemaFilter.includes(data.schema),
    [typeFilter, schemaFilter]
  );

  function onSelectionChanged() {
    const rows = gridRef.current?.api?.getSelectedRows() || [];
    setSelectedObjects(rows);
  }

  function getRowClass({ data }) {
    const r = resultMap[data?.id];
    if (!r) return '';
    return r.success ? 'bg-green-50' : 'bg-red-50';
  }

  if (objectsError) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500 text-sm">
        Error: {objectsError}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <GridToolbar
        quickFilter={quickFilter}
        onQuickFilter={(v) => {
          setQuickFilter(v);
          gridRef.current?.api?.setQuickFilter(v);
        }}
        typeFilter={typeFilter}
        onTypeFilter={(f) => {
          setTypeFilter(f);
          gridRef.current?.api?.onFilterChanged();
        }}
        schemaFilter={schemaFilter}
        onSchemaFilter={(f) => {
          setSchemaFilter(f);
          gridRef.current?.api?.onFilterChanged();
        }}
        availableSchemas={availableSchemas}
        destSchema={destSchema}
        onDestSchema={setDestSchema}
        selectedCount={selectedCount}
        onClone={clone}
        cloneLoading={cloneLoading}
        destConnected={destConnected}
      />

      <div className="flex-1 ag-theme-alpine" style={{ minHeight: 0 }}>
        {objectsLoading ? (
          <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
            Cargando objetos...
          </div>
        ) : objects.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
            Conecte a una base de datos origen para ver los objetos
          </div>
        ) : (
          <AgGridReact
            ref={gridRef}
            rowData={objects}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            rowSelection="multiple"
            suppressRowClickSelection={true}
            onSelectionChanged={onSelectionChanged}
            isExternalFilterPresent={isExternalFilterPresent}
            doesExternalFilterPass={doesExternalFilterPass}
            getRowClass={getRowClass}
            animateRows={true}
            pagination={true}
            paginationPageSize={50}
          />
        )}
      </div>
    </div>
  );
}

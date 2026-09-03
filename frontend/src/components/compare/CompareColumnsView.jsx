import { useMemo, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { Columns3 } from 'lucide-react';

import useAppStore from '../../store/appStore';
import DiffStatusBadge from './DiffStatusBadge';
import CompareColumnsToolbar from './CompareColumnsToolbar';
import ColumnResultsModal from './ColumnResultsModal';
import InsertPreviewModal from '../data/InsertPreviewModal';
import { useCompareColumns } from '../../hooks/useCompareColumns';

function DiffStatusCellRenderer({ value }) {
  return <DiffStatusBadge status={value} />;
}

export default function CompareColumnsView() {
  const gridRef = useRef();
  const { sourceConnected, destConnected } = useAppStore();

  const {
    tables, selectedTable, setSelectedTable,
    destSchema, setDestSchema,
    compare, loading, error, compared, diffRows,
    selectedFields, setSelectedFields,
    openPreview, previewScript, previewOpen, closePreview,
    executeAdd, addLoading,
    addResults, showAddResults, setShowAddResults,
  } = useCompareColumns();

  const effectiveDestSchema = destSchema || selectedTable?.schema || '';

  const columnDefs = useMemo(() => [
    {
      checkboxSelection: (params) => params.data?.diffStatus === 'MISSING_IN_DEST',
      headerCheckboxSelection: false,
      width: 48,
      minWidth: 48,
      maxWidth: 48,
      resizable: false,
      sortable: false,
      filter: false,
    },
    { headerName: 'Campo', field: 'name', flex: 1, minWidth: 160, filter: true, sortable: true },
    {
      headerName: 'Nombre de la Tabla', width: 170,
      valueGetter: () => selectedTable?.name || '',
    },
    { headerName: 'Tipo de Dato', field: 'dataType', width: 160, sortable: true },
    {
      headerName: 'Default', field: 'defaultValue', width: 150,
      valueFormatter: ({ value }) => value || '-',
    },
    {
      headerName: 'Esquema Origen', width: 140,
      valueGetter: () => selectedTable?.schema || '',
    },
    {
      headerName: 'Esquema Destino', width: 140,
      valueGetter: () => effectiveDestSchema,
    },
    {
      headerName: 'Estado', field: 'diffStatus', width: 160,
      cellRenderer: DiffStatusCellRenderer, filter: true, sortable: true,
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [selectedTable, effectiveDestSchema]);

  const defaultColDef = useMemo(() => ({ resizable: true }), []);

  function onSelectionChanged() {
    const rows = gridRef.current?.api?.getSelectedRows() || [];
    setSelectedFields(rows);
  }

  function handleAddFields() {
    openPreview();
  }

  function handleExecute() {
    executeAdd(() => gridRef.current?.api?.deselectAll());
  }

  if (!sourceConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
        <Columns3 size={40} className="opacity-30" />
        <p className="text-sm">Conecta la base de datos Origen para comparar campos</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <CompareColumnsToolbar
        tables={tables}
        selectedTable={selectedTable}
        onSelectTable={setSelectedTable}
        destSchema={destSchema}
        onDestSchema={setDestSchema}
        onCompare={compare}
        compareLoading={loading}
        compared={compared}
        destConnected={destConnected}
        selectedCount={selectedFields.length}
        onAddFields={handleAddFields}
      />

      <div className="flex-1 ag-theme-alpine" style={{ minHeight: 0 }}>
        {error ? (
          <div className="flex items-center justify-center h-64 text-red-500 text-sm">Error: {error}</div>
        ) : !selectedTable ? (
          <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
            Selecciona una tabla para comparar sus campos
          </div>
        ) : !compared ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-2">
            <Columns3 size={32} className="opacity-30" />
            <p className="text-sm">
              {destConnected
                ? 'Presiona "Comparar Campos" para ver las diferencias'
                : 'Conecta la base de datos Destino y presiona "Comparar Campos"'}
            </p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-64 text-slate-500 text-sm">Comparando...</div>
        ) : (
          <AgGridReact
            ref={gridRef}
            rowData={diffRows}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            rowSelection="multiple"
            suppressRowClickSelection={true}
            onSelectionChanged={onSelectionChanged}
            getRowId={(params) => params.data.name.toLowerCase()}
            animateRows={true}
            pagination={true}
            paginationPageSize={50}
          />
        )}
      </div>

      <InsertPreviewModal
        open={previewOpen}
        script={previewScript}
        rowCount={selectedFields.length}
        itemLabel="campo"
        onClose={closePreview}
        onExecute={handleExecute}
        executing={addLoading}
      />

      <ColumnResultsModal
        open={showAddResults}
        results={addResults}
        onClose={() => setShowAddResults(false)}
      />
    </div>
  );
}

import { useCallback, useMemo, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

function formatDisplayValue(value) {
  if (value === null || value === undefined) return '';
  if (value && typeof value === 'object' && value.type === 'Buffer') return '(binary)';
  if (value instanceof Date) return value.toISOString().slice(0, 19).replace('T', ' ');
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
    return value.slice(0, 19).replace('T', ' ');
  }
  return String(value);
}

export default function RowGrid({ columns, rows, onSelectionChange }) {
  const gridRef = useRef();

  const colDefs = useMemo(() => {
    if (!columns.length) return [];
    return [
      {
        checkboxSelection: true,
        headerCheckboxSelection: true,
        headerCheckboxSelectionFilteredOnly: true,
        width: 48,
        minWidth: 48,
        maxWidth: 48,
        resizable: false,
        sortable: false,
        filter: false,
        pinned: 'left',
      },
      ...columns.map((col) => ({
        field: col.name,
        headerName: col.name,
        headerTooltip: `${col.dataType}${col.isIdentity ? ' · IDENTITY' : ''}${col.isComputed ? ' · COMPUTED' : ''}`,
        sortable: true,
        filter: true,
        resizable: true,
        minWidth: 80,
        headerClass: col.isIdentity ? 'ag-header-identity' : '',
        valueFormatter: ({ value }) => formatDisplayValue(value),
        cellStyle: ({ value }) => {
          if (value === null || value === undefined) return { color: '#cbd5e1', fontStyle: 'italic' };
          if (col.isIdentity) return { color: '#2563eb', fontWeight: 500 };
          return null;
        },
      })),
    ];
  }, [columns]);

  const defaultColDef = useMemo(() => ({ resizable: true }), []);

  const onSelectionChanged = useCallback(() => {
    const selected = gridRef.current?.api?.getSelectedRows() || [];
    onSelectionChange(selected);
  }, [onSelectionChange]);

  return (
    <div className="h-full ag-theme-alpine">
      <AgGridReact
        ref={gridRef}
        rowData={rows}
        columnDefs={colDefs}
        defaultColDef={defaultColDef}
        rowSelection="multiple"
        suppressRowClickSelection={true}
        onSelectionChanged={onSelectionChanged}
        animateRows={true}
        pagination={true}
        paginationPageSize={100}
      />
    </div>
  );
}

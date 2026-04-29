import { Database } from 'lucide-react';
import useAppStore from '../../store/appStore';
import { useDataTransfer } from '../../hooks/useDataTransfer';
import { useSourceConnection } from '../../hooks/useSourceConnection';
import DataToolbar from './DataToolbar';
import RowGrid from './RowGrid';
import DataResultsModal from './DataResultsModal';
import InsertPreviewModal from './InsertPreviewModal';

export default function DataTransferView() {
  const { objects, sourceConnected, destConnected } = useAppStore();
  const tables = objects.filter((o) => o.type === 'TABLA');
  const { refresh, loading: refreshLoading } = useSourceConnection();

  const {
    selectedTable, setSelectedTable,
    columns, rows, rowsLoading, rowsError,
    selectedRows, setSelectedRows,
    destSchema, setDestSchema,
    openPreview,
    previewScript,
    previewOpen,
    closePreview,
    executeInsert,
    insertLoading,
  } = useDataTransfer();

  if (!sourceConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
        <Database size={40} className="opacity-30" />
        <p className="text-sm">Conecta la base de datos Origen para ver las tablas</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <DataToolbar
        tables={tables}
        selectedTable={selectedTable}
        onSelectTable={setSelectedTable}
        destSchema={destSchema}
        onDestSchema={setDestSchema}
        selectedCount={selectedRows.length}
        onInsert={openPreview}
        insertLoading={insertLoading}
        destConnected={destConnected}
        rowCount={rows.length}
        onRefresh={refresh}
        refreshLoading={refreshLoading}
      />

      <div className="flex-1" style={{ minHeight: 0 }}>
        {rowsLoading ? (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            Cargando filas...
          </div>
        ) : rowsError ? (
          <div className="flex items-center justify-center h-full text-red-500 text-sm px-8 text-center">
            Error: {rowsError}
          </div>
        ) : rows.length > 0 ? (
          <RowGrid
            columns={columns}
            rows={rows}
            onSelectionChange={setSelectedRows}
          />
        ) : selectedTable ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            La tabla no tiene filas
          </div>
        ) : tables.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
            <p className="text-sm">No hay tablas cargadas.</p>
            <p className="text-xs">Usa el botón "Refrescar Información" para cargarlas.</p>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            Selecciona una tabla para ver sus filas
          </div>
        )}
      </div>

      <InsertPreviewModal
        open={previewOpen}
        script={previewScript}
        rowCount={selectedRows.length}
        onClose={closePreview}
        onExecute={executeInsert}
        executing={insertLoading}
      />

      <DataResultsModal />
    </div>
  );
}

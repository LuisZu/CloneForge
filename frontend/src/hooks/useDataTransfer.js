import { useState, useCallback } from 'react';
import useAppStore from '../store/appStore';
import { fetchTableRows, runScript } from '../api/cloneforge';
import { generateInsertScript } from '../utils/insertScriptGenerator';

export function useDataTransfer() {
  const {
    sourceConfig,
    destConfig,
    setDataInsertResults,
    setDataInsertLoading,
    setShowDataResults,
    showToast,
  } = useAppStore();

  const dataInsertLoading = useAppStore((s) => s.dataInsertLoading);

  const [selectedTable, _setSelectedTable] = useState(null);
  const [columns, setColumns]               = useState([]);
  const [rows, setRows]                     = useState([]);
  const [rowsLoading, setRowsLoading]       = useState(false);
  const [rowsError, setRowsError]           = useState(null);
  const [selectedRows, setSelectedRows]     = useState([]);
  const [destSchema, setDestSchema]         = useState('');
  const [previewScript, setPreviewScript]   = useState('');
  const [previewOpen, setPreviewOpen]       = useState(false);

  const setSelectedTable = useCallback(async (table) => {
    _setSelectedTable(table);
    setSelectedRows([]);
    setRowsError(null);
    if (!table) { setColumns([]); setRows([]); return; }

    setRowsLoading(true);
    try {
      const result = await fetchTableRows(sourceConfig, table.schema, table.name);
      setColumns(result.columns);
      setRows(result.rows);
    } catch (err) {
      setRowsError(err.response?.data?.error || err.message);
      setColumns([]);
      setRows([]);
    } finally {
      setRowsLoading(false);
    }
  }, [sourceConfig]);

  // Step 1: generate the SQL preview and open the approval modal
  const openPreview = useCallback(() => {
    if (!selectedTable || selectedRows.length === 0) return;
    const script = generateInsertScript(selectedTable, columns, selectedRows, destSchema);
    setPreviewScript(script);
    setPreviewOpen(true);
  }, [selectedTable, selectedRows, columns, destSchema]);

  // Step 2: execute the approved script on the destination database
  const executeInsert = useCallback(async (afterInsert) => {
    setDataInsertLoading(true);
    try {
      const result = await runScript(destConfig, previewScript);
      setPreviewOpen(false);
      setDataInsertResults({
        ...result,
        tableName: selectedTable.name,
        destSchema: destSchema || selectedTable.schema,
      });
      setShowDataResults(true);
      setSelectedRows([]);
      if (afterInsert) afterInsert();
    } catch (err) {
      showToast(err.response?.data?.error || err.message, 'error');
    } finally {
      setDataInsertLoading(false);
    }
  }, [
    destConfig, previewScript, selectedTable, destSchema,
    setDataInsertLoading, setDataInsertResults, setShowDataResults, showToast,
  ]);

  return {
    selectedTable, setSelectedTable,
    columns, rows, rowsLoading, rowsError,
    selectedRows, setSelectedRows,
    destSchema, setDestSchema,
    openPreview,
    previewScript,
    previewOpen,
    closePreview: () => setPreviewOpen(false),
    executeInsert,
    insertLoading: dataInsertLoading,
  };
}

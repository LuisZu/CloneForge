import { useState, useCallback } from 'react';
import useAppStore from '../store/appStore';
import { fetchTableRows, insertRows as apiInsertRows } from '../api/cloneforge';

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

  const insert = useCallback(async () => {
    if (!selectedTable || selectedRows.length === 0) return;
    setDataInsertLoading(true);
    try {
      const result = await apiInsertRows(
        destConfig,
        selectedTable.schema,
        selectedTable.name,
        destSchema || null,
        columns,
        selectedRows,
      );
      setDataInsertResults({
        ...result,
        tableName: selectedTable.name,
        destSchema: destSchema || selectedTable.schema,
      });
      setShowDataResults(true);
    } catch (err) {
      showToast(err.response?.data?.error || err.message, 'error');
    } finally {
      setDataInsertLoading(false);
    }
  }, [
    selectedTable, selectedRows, columns, destConfig, destSchema,
    setDataInsertLoading, setDataInsertResults, setShowDataResults, showToast,
  ]);

  return {
    selectedTable, setSelectedTable,
    columns, rows, rowsLoading, rowsError,
    selectedRows, setSelectedRows,
    destSchema, setDestSchema,
    insert,
    insertLoading: dataInsertLoading,
  };
}

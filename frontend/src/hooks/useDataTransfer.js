import { useState, useCallback } from 'react';
import useAppStore from '../store/appStore';
import { fetchTableRows, runScript } from '../api/cloneforge';
import { generateInsertScript } from '../utils/insertScriptGenerator';

// Rows per request. The backend still executes one round trip per row
// internally, so this doesn't speed that up — but it means the UI gets a
// progress update every INSERT_ROW_CHUNK_SIZE rows instead of staring at a
// single spinner for the whole operation (which, for thousands of rows,
// made a perfectly healthy run look identical to a frozen one).
const INSERT_ROW_CHUNK_SIZE = 300;

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export function useDataTransfer() {
  const {
    sourceConfig,
    destConfig,
    setDataInsertResults,
    setDataInsertLoading,
    setDataInsertProgress,
    setShowDataResults,
    showToast,
  } = useAppStore();

  const dataInsertLoading = useAppStore((s) => s.dataInsertLoading);
  const dataInsertProgress = useAppStore((s) => s.dataInsertProgress);

  const [selectedTable, _setSelectedTable] = useState(null);
  const [columns, setColumns]               = useState([]);
  const [rows, setRows]                     = useState([]);
  const [rowsLoading, setRowsLoading]       = useState(false);
  const [rowsError, setRowsError]           = useState(null);
  const [selectedRows, setSelectedRows]     = useState([]);
  const [destSchema, setDestSchema]         = useState('');
  const [validateExists, setValidateExists] = useState(true);
  const [previewScript, setPreviewScript]   = useState('');
  const [previewOpen, setPreviewOpen]       = useState(false);
  const [exportSql, setExportSql]           = useState(null);

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

  // Step 1a: generate the SQL preview and open the approval modal
  const openPreview = useCallback(() => {
    if (!selectedTable || selectedRows.length === 0) return;
    const script = generateInsertScript(selectedTable, columns, selectedRows, destSchema, validateExists);
    setPreviewScript(script);
    setPreviewOpen(true);
  }, [selectedTable, selectedRows, columns, destSchema, validateExists]);

  // Step 1b: generate the script and open the export modal (no execution)
  const openExport = useCallback(() => {
    if (!selectedTable || selectedRows.length === 0) return;
    const script = generateInsertScript(selectedTable, columns, selectedRows, destSchema, validateExists);
    setExportSql(script);
  }, [selectedTable, selectedRows, columns, destSchema, validateExists]);

  // Step 2: execute the approved script on the destination database.
  // Sent in row-chunks (not as the single `previewScript` the user reviewed)
  // so the UI can show live progress, and so one chunk's connection drop
  // doesn't lose the rows already inserted by previous chunks.
  const executeInsert = useCallback(async (afterInsert) => {
    const rowChunks = chunk(selectedRows, INSERT_ROW_CHUNK_SIZE);
    setDataInsertLoading(true);
    setDataInsertProgress({ done: 0, total: selectedRows.length, batch: 0, batchCount: rowChunks.length });

    const allResults = [];
    let succeeded = 0, exists = 0, failed = 0;
    let rowOffset = 0;

    try {
      for (let c = 0; c < rowChunks.length; c++) {
        const rowsChunk = rowChunks[c];
        const script = generateInsertScript(selectedTable, columns, rowsChunk, destSchema, validateExists);

        try {
          const result = await runScript(destConfig, script);
          for (const r of result.results) {
            allResults.push({ ...r, row: r.row + rowOffset });
          }
          succeeded += result.summary.succeeded;
          exists    += result.summary.exists;
          failed    += result.summary.failed;
        } catch (err) {
          // Whole chunk's request failed (connection drop, timeout) — mark
          // its rows as failed with that reason and keep going.
          const message = err.response?.data?.error || err.message || 'Error al ejecutar el lote';
          for (let i = 0; i < rowsChunk.length; i++) {
            allResults.push({ row: rowOffset + i + 1, status: 'error', error: message });
          }
          failed += rowsChunk.length;
        }

        rowOffset += rowsChunk.length;
        setDataInsertProgress({ done: rowOffset, total: selectedRows.length, batch: c + 1, batchCount: rowChunks.length });
      }

      setPreviewOpen(false);
      setDataInsertResults({
        results: allResults,
        summary: { total: allResults.length, succeeded, exists, failed },
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
      setDataInsertProgress(null);
    }
  }, [
    destConfig, selectedRows, columns, selectedTable, destSchema, validateExists,
    setDataInsertLoading, setDataInsertProgress, setDataInsertResults, setShowDataResults, showToast,
  ]);

  return {
    selectedTable, setSelectedTable,
    columns, rows, rowsLoading, rowsError,
    selectedRows, setSelectedRows,
    destSchema, setDestSchema,
    validateExists, setValidateExists,
    openPreview,
    previewScript,
    previewOpen,
    closePreview: () => setPreviewOpen(false),
    executeInsert,
    insertLoading: dataInsertLoading,
    insertProgress: dataInsertProgress,
    openExport,
    exportSql,
    closeExport: () => setExportSql(null),
  };
}

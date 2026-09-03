import { useState, useCallback, useMemo } from 'react';
import useAppStore from '../store/appStore';
import { fetchSourceColumns, fetchDestinationColumns, runScript } from '../api/cloneforge';
import { generateAddColumnsScript } from '../utils/alterTableGenerator';

export function useCompareColumns() {
  const { sourceConfig, destConfig, sourceConnected, destConnected, objects, showToast } = useAppStore();

  const tables = useMemo(() => objects.filter((o) => o.type === 'TABLA'), [objects]);

  const [selectedTable, _setSelectedTable] = useState(null);
  const [destSchema, setDestSchema] = useState('');
  const [sourceCols, setSourceCols] = useState([]);
  const [destCols, setDestCols] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [compared, setCompared] = useState(false);

  const [selectedFields, setSelectedFields] = useState([]);
  const [previewScript, setPreviewScript] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addResults, setAddResults] = useState(null);
  const [showAddResults, setShowAddResults] = useState(false);

  const setSelectedTable = useCallback((table) => {
    _setSelectedTable(table);
    setCompared(false);
    setSourceCols([]);
    setDestCols([]);
    setSelectedFields([]);
    setError(null);
  }, []);

  const compare = useCallback(async () => {
    if (!selectedTable || !sourceConnected || !destConnected) return;
    setLoading(true);
    setError(null);
    setSelectedFields([]);
    try {
      const [srcCols, dstCols] = await Promise.all([
        fetchSourceColumns(sourceConfig, selectedTable.schema, selectedTable.name),
        fetchDestinationColumns(destConfig, destSchema || selectedTable.schema, selectedTable.name),
      ]);
      setSourceCols(srcCols);
      setDestCols(dstCols);
      setCompared(true);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      showToast('Error al comparar campos', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedTable, sourceConfig, destConfig, destSchema, sourceConnected, destConnected, showToast]);

  const diffRows = useMemo(() => {
    if (!compared) return [];
    const destMap = new Map(destCols.map((c) => [c.name.toLowerCase(), c]));
    const sourceMap = new Map(sourceCols.map((c) => [c.name.toLowerCase(), c]));

    const rows = sourceCols.map((col) => ({
      ...col,
      diffStatus: destMap.has(col.name.toLowerCase()) ? 'MATCH' : 'MISSING_IN_DEST',
    }));

    for (const col of destCols) {
      if (!sourceMap.has(col.name.toLowerCase())) {
        rows.push({ ...col, diffStatus: 'MISSING_IN_SOURCE' });
      }
    }
    return rows;
  }, [compared, sourceCols, destCols]);

  const openPreview = useCallback(() => {
    if (!selectedTable || selectedFields.length === 0) return;
    const script = generateAddColumnsScript(selectedTable, destSchema, selectedFields);
    setPreviewScript(script);
    setPreviewOpen(true);
  }, [selectedTable, selectedFields, destSchema]);

  const executeAdd = useCallback(async (afterAdd) => {
    setAddLoading(true);
    try {
      const result = await runScript(destConfig, previewScript);
      setPreviewOpen(false);
      setAddResults({
        ...result,
        tableName: selectedTable.name,
        destSchema: destSchema || selectedTable.schema,
      });
      setShowAddResults(true);
      setSelectedFields([]);
      if (afterAdd) afterAdd();
      // Refresh the diff so newly-created columns now show as matched
      const [srcCols, dstCols] = await Promise.all([
        fetchSourceColumns(sourceConfig, selectedTable.schema, selectedTable.name),
        fetchDestinationColumns(destConfig, destSchema || selectedTable.schema, selectedTable.name),
      ]);
      setSourceCols(srcCols);
      setDestCols(dstCols);
    } catch (err) {
      showToast(err.response?.data?.error || err.message, 'error');
    } finally {
      setAddLoading(false);
    }
  }, [destConfig, sourceConfig, previewScript, selectedTable, destSchema, showToast]);

  return {
    tables, selectedTable, setSelectedTable,
    destSchema, setDestSchema,
    compare, loading, error, compared, diffRows,
    selectedFields, setSelectedFields,
    openPreview, previewScript, previewOpen, closePreview: () => setPreviewOpen(false),
    executeAdd, addLoading,
    addResults, showAddResults, setShowAddResults,
  };
}

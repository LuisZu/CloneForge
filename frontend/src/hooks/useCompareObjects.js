import { useState, useCallback, useMemo } from 'react';
import useAppStore from '../store/appStore';
import { fetchDestinationObjects } from '../api/cloneforge';

/**
 * Compares the object list already loaded from the source connection
 * (useAppStore.objects) against a fresh snapshot of the destination
 * connection, matching by `id` (built from schema+name+type, so it's
 * stable across databases as long as naming matches).
 */
export function useCompareObjects() {
  const { sourceConnected, destConnected, destConfig, objects: sourceObjects, showToast } = useAppStore();

  const [destObjects, setDestObjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [compared, setCompared] = useState(false);

  const compare = useCallback(async () => {
    if (!sourceConnected || !destConnected) return;
    setLoading(true);
    setError(null);
    try {
      const objs = await fetchDestinationObjects(destConfig);
      setDestObjects(objs);
      setCompared(true);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      showToast('Error al comparar objetos', 'error');
    } finally {
      setLoading(false);
    }
  }, [destConfig, sourceConnected, destConnected, showToast]);

  const diffRows = useMemo(() => {
    if (!compared) return [];
    const destMap = new Map(destObjects.map((o) => [o.id, o]));
    const sourceMap = new Map(sourceObjects.map((o) => [o.id, o]));

    const rows = sourceObjects.map((obj) => ({
      ...obj,
      diffStatus: destMap.has(obj.id) ? 'MATCH' : 'MISSING_IN_DEST',
    }));

    for (const obj of destObjects) {
      if (!sourceMap.has(obj.id)) {
        rows.push({ ...obj, diffStatus: 'MISSING_IN_SOURCE' });
      }
    }
    return rows;
  }, [compared, sourceObjects, destObjects]);

  return { compare, loading, error, compared, diffRows };
}

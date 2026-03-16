import { useState } from 'react';
import { testSourceConnection, fetchObjects } from '../api/cloneforge';
import useAppStore from '../store/appStore';

export function useSourceConnection() {
  const [loading, setLoading] = useState(false);
  const {
    sourceConfig,
    setSourceConnected,
    setObjects,
    setObjectsLoading,
    setObjectsError,
    showToast,
  } = useAppStore();

  async function connect() {
    setLoading(true);
    try {
      const { connected, serverVersion, error } = await testSourceConnection(sourceConfig);
      if (!connected) {
        setSourceConnected(false);
        showToast(error || 'No se pudo conectar al origen', 'error');
        return;
      }
      setSourceConnected(true, serverVersion);
      showToast('Conectado al origen', 'success');

      // Automatically load objects
      setObjectsLoading(true);
      setObjectsError(null);
      try {
        const objs = await fetchObjects(sourceConfig);
        setObjects(objs);
      } catch (err) {
        setObjectsError(err.response?.data?.error || err.message);
        showToast('Error al cargar los objetos', 'error');
      } finally {
        setObjectsLoading(false);
      }
    } catch (err) {
      setSourceConnected(false);
      showToast(err.response?.data?.error || err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    if (!useAppStore.getState().sourceConnected) return;
    setObjectsLoading(true);
    setObjectsError(null);
    try {
      const objs = await fetchObjects(sourceConfig);
      setObjects(objs);
      showToast('Información actualizada', 'success');
    } catch (err) {
      setObjectsError(err.response?.data?.error || err.message);
      showToast('Error al refrescar los objetos', 'error');
    } finally {
      setObjectsLoading(false);
    }
  }

  return { connect, refresh, loading };
}

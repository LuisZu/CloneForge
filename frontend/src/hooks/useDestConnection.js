import { useState } from 'react';
import { testDestinationConnection } from '../api/cloneforge';
import useAppStore from '../store/appStore';

export function useDestConnection() {
  const [loading, setLoading] = useState(false);
  const { destConfig, setDestConnected, showToast } = useAppStore();

  async function connect() {
    setLoading(true);
    try {
      const { connected, serverVersion, error } = await testDestinationConnection(destConfig);
      if (!connected) {
        setDestConnected(false);
        showToast(error || 'No se pudo conectar al destino', 'error');
        return;
      }
      setDestConnected(true, serverVersion);
      showToast('Conectado al destino', 'success');
    } catch (err) {
      setDestConnected(false);
      showToast(err.response?.data?.error || err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  return { connect, loading };
}

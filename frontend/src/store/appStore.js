import { create } from 'zustand';

const defaultConn = {
  server: '',
  port: 1433,
  database: '',
  user: '',
  password: '',
  trustServerCertificate: true,
  encrypt: false,
};

const useAppStore = create((set) => ({
  // ── Source connection ──────────────────────────────────────────────────────
  sourceConfig: { ...defaultConn },
  sourceConnected: false,
  sourceVersion: '',
  setSourceConfig: (partial) =>
    set((s) => ({ sourceConfig: { ...s.sourceConfig, ...partial } })),
  setSourceConnected: (connected, version = '') =>
    set({ sourceConnected: connected, sourceVersion: version }),

  // ── Destination connection ─────────────────────────────────────────────────
  destConfig: { ...defaultConn },
  destConnected: false,
  destVersion: '',
  setDestConfig: (partial) =>
    set((s) => ({ destConfig: { ...s.destConfig, ...partial } })),
  setDestConnected: (connected, version = '') =>
    set({ destConnected: connected, destVersion: version }),

  // ── Objects list ──────────────────────────────────────────────────────────
  objects: [],
  objectsLoading: false,
  objectsError: null,
  setObjects: (objects) => set({ objects }),
  setObjectsLoading: (loading) => set({ objectsLoading: loading }),
  setObjectsError: (error) => set({ objectsError: error }),

  // ── Selection ─────────────────────────────────────────────────────────────
  selectedObjects: [],
  setSelectedObjects: (selectedObjects) => set({ selectedObjects }),

  // ── Destination schema override ───────────────────────────────────────────
  destSchema: '',
  setDestSchema: (destSchema) => set({ destSchema }),

  // ── Clone results ─────────────────────────────────────────────────────────
  cloneResults: null,
  cloneLoading: false,
  showResults: false,
  setCloneResults: (results) => set({ cloneResults: results }),
  setCloneLoading: (loading) => set({ cloneLoading: loading }),
  setShowResults: (show) => set({ showResults: show }),

  // ── Toast notifications ───────────────────────────────────────────────────
  toast: null,
  showToast: (message, type = 'info') => {
    set({ toast: { message, type, id: Date.now() } });
  },
  clearToast: () => set({ toast: null }),
}));

export default useAppStore;

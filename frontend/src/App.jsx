import { useState } from 'react';
import { GitBranch, Copy, Table2 } from 'lucide-react';
import clsx from 'clsx';
import ConnectionForm from './components/connection/ConnectionForm';
import ObjectGrid from './components/objects/ObjectGrid';
import DataTransferView from './components/data/DataTransferView';
import ResultsModal from './components/results/ResultsModal';
import TextReplacements from './components/replacements/TextReplacements';
import CloningOverlay from './components/CloningOverlay';
import Toast from './components/Toast';
import useAppStore from './store/appStore';
import { useSourceConnection } from './hooks/useSourceConnection';
import { useDestConnection } from './hooks/useDestConnection';

const TABS = [
  { id: 'objects', label: 'Clonar Objetos', icon: Copy },
  { id: 'data',    label: 'Insertar Datos', icon: Table2 },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('objects');

  const {
    sourceConfig, setSourceConfig, sourceConnected, sourceVersion,
    destConfig, setDestConfig, destConnected, destVersion,
  } = useAppStore();

  const { connect: connectSource, loading: sourceLoading } = useSourceConnection();
  const { connect: connectDest, loading: destLoading } = useDestConnection();

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* Header */}
      <header className="bg-slate-900 text-white px-6 py-3 flex items-center gap-3 shadow-md">
        <GitBranch size={22} className="text-blue-400" />
        <h1 className="text-lg font-bold tracking-tight">CloneForge</h1>
        <span className="text-slate-400 text-sm ml-1">SQL Server Object Cloning Tool</span>
        <div className="ml-auto flex items-center gap-4 text-xs text-slate-400">
          {sourceConnected && (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              Origen conectado
            </span>
          )}
          {destConnected && (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              Destino conectado
            </span>
          )}
        </div>
      </header>

      <div className="flex flex-1 gap-4 p-4" style={{ minHeight: 0 }}>
        {/* Left sidebar */}
        <aside className="w-80 shrink-0 flex flex-col gap-4">
          <ConnectionForm
            label="Base de Datos Origen"
            config={sourceConfig}
            onChange={setSourceConfig}
            onConnect={connectSource}
            loading={sourceLoading}
            connected={sourceConnected}
          />
          {sourceConnected && sourceVersion && (
            <p className="text-xs text-slate-500 -mt-2 px-1">{sourceVersion}</p>
          )}

          <ConnectionForm
            label="Base de Datos Destino"
            config={destConfig}
            onChange={setDestConfig}
            onConnect={connectDest}
            loading={destLoading}
            connected={destConnected}
          />
          {destConnected && destVersion && (
            <p className="text-xs text-slate-500 -mt-2 px-1">{destVersion}</p>
          )}

          {activeTab === 'objects' && <TextReplacements />}

          {activeTab === 'objects' ? (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-700 space-y-1">
              <p className="font-semibold">Flujo de trabajo:</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-600">
                <li>Conectar base de datos Origen</li>
                <li>Seleccionar objetos a clonar</li>
                <li>Conectar base de datos Destino</li>
                <li>Presionar "Clonar Seleccionados"</li>
              </ol>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-700 space-y-1">
              <p className="font-semibold">Flujo de trabajo:</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-600">
                <li>Conectar base de datos Origen</li>
                <li>Seleccionar una tabla del listado</li>
                <li>Seleccionar las filas a insertar</li>
                <li>Conectar base de datos Destino</li>
                <li>Presionar "Insertar"</li>
              </ol>
            </div>
          )}
        </aside>

        {/* Main area */}
        <main className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">

          {/* Tab bar */}
          <div className="border-b border-slate-200 px-4 flex items-center gap-1 pt-2">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px',
                  activeTab === id
                    ? 'border-blue-600 text-blue-700 bg-blue-50'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50',
                )}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1" style={{ minHeight: 0 }}>
            {activeTab === 'objects' ? <ObjectGrid /> : <DataTransferView />}
          </div>
        </main>
      </div>

      <ResultsModal />
      <CloningOverlay />
      <Toast />
    </div>
  );
}

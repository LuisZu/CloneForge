import { useState } from 'react';
import { GitBranch, Copy, Table2, GitCompare, Columns3 } from 'lucide-react';
import clsx from 'clsx';
import ConnectionForm from './components/connection/ConnectionForm';
import ObjectGrid from './components/objects/ObjectGrid';
import DataTransferView from './components/data/DataTransferView';
import CompareObjectsView from './components/compare/CompareObjectsView';
import CompareColumnsView from './components/compare/CompareColumnsView';
import ResultsModal from './components/results/ResultsModal';
import TextReplacements from './components/replacements/TextReplacements';
import CloningOverlay from './components/CloningOverlay';
import Toast from './components/Toast';
import useAppStore from './store/appStore';
import { useSourceConnection } from './hooks/useSourceConnection';
import { useDestConnection } from './hooks/useDestConnection';

const TABS = [
  { id: 'objects',        label: 'Clonar Objetos',   icon: Copy },
  { id: 'compareObjects', label: 'Comparar Objetos', icon: GitCompare },
  { id: 'data',           label: 'Insertar Datos',   icon: Table2 },
  { id: 'compareColumns', label: 'Comparar Campos',  icon: Columns3 },
];

const TAB_VIEWS = {
  objects: ObjectGrid,
  compareObjects: CompareObjectsView,
  data: DataTransferView,
  compareColumns: CompareColumnsView,
};

const TAB_INSTRUCTIONS = {
  objects: [
    'Conectar base de datos Origen',
    'Seleccionar objetos a clonar',
    'Conectar base de datos Destino',
    'Presionar "Clonar Seleccionados"',
  ],
  compareObjects: [
    'Conectar ambas bases de datos',
    'Presionar "Comparar"',
    'Revisar los objetos que faltan en Destino',
    'Seleccionarlos y presionar "Clonar Faltantes hacia Destino"',
  ],
  data: [
    'Conectar base de datos Origen',
    'Seleccionar una tabla del listado',
    'Seleccionar las filas a insertar',
    'Conectar base de datos Destino',
    'Presionar "Insertar"',
  ],
  compareColumns: [
    'Conectar ambas bases de datos',
    'Seleccionar una tabla y presionar "Comparar Campos"',
    'Revisar los campos que faltan en Destino',
    'Seleccionarlos y presionar "Agregar Campos a Destino"',
  ],
};

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

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-700 space-y-1">
            <p className="font-semibold">Flujo de trabajo:</p>
            <ol className="list-decimal list-inside space-y-1 text-blue-600">
              {TAB_INSTRUCTIONS[activeTab].map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
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
            {(() => {
              const ActiveView = TAB_VIEWS[activeTab];
              return <ActiveView />;
            })()}
          </div>
        </main>
      </div>

      <ResultsModal />
      <CloningOverlay />
      <Toast />
    </div>
  );
}

import { useState } from 'react';
import { Server, Database, User, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import clsx from 'clsx';

export default function ConnectionForm({ label, config, onChange, onConnect, loading, connected }) {
  const [showPass, setShowPass] = useState(false);

  function field(key, value) {
    onChange({ [key]: value });
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <Database size={18} className="text-blue-600" />
        <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">{label}</h2>
        {connected && (
          <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
            Conectado
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Server */}
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-xs font-medium text-slate-500 mb-1">Servidor</label>
          <div className="relative">
            <Server size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="192.168.1.10 o localhost"
              value={config.server}
              onChange={(e) => field('server', e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Port */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Puerto</label>
          <input
            type="number"
            placeholder="1433"
            value={config.port}
            onChange={(e) => field('port', parseInt(e.target.value, 10) || 1433)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Database */}
        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-500 mb-1">Base de datos</label>
          <div className="relative">
            <Database size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="NombreBaseDatos"
              value={config.database}
              onChange={(e) => field('database', e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* User */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Usuario</label>
          <div className="relative">
            <User size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="sa"
              value={config.user}
              onChange={(e) => field('user', e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Contraseña</label>
          <div className="relative">
            <Lock size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type={showPass ? 'text' : 'password'}
              placeholder="••••••••"
              value={config.password}
              onChange={(e) => field('password', e.target.value)}
              className="w-full pl-8 pr-8 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
            >
              {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        {/* Trust cert */}
        <div className="col-span-2 flex items-center gap-2">
          <input
            type="checkbox"
            id={`trustCert-${label}`}
            checked={config.trustServerCertificate}
            onChange={(e) => field('trustServerCertificate', e.target.checked)}
            className="rounded"
          />
          <label htmlFor={`trustCert-${label}`} className="text-xs text-slate-500">
            Confiar en certificado del servidor (TrustServerCertificate)
          </label>
        </div>
      </div>

      <button
        onClick={onConnect}
        disabled={loading || !config.server || !config.database || !config.user}
        className={clsx(
          'mt-4 w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-colors',
          loading || !config.server || !config.database || !config.user
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
        )}
      >
        {loading && <Loader2 size={14} className="animate-spin" />}
        {loading ? 'Conectando...' : 'Conectar'}
      </button>
    </div>
  );
}

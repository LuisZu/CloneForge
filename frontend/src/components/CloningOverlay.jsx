import { Loader2 } from 'lucide-react';
import useAppStore from '../store/appStore';

export default function CloningOverlay() {
  const cloneLoading      = useAppStore((s) => s.cloneLoading);
  const dataInsertLoading = useAppStore((s) => s.dataInsertLoading);

  const active = cloneLoading || dataInsertLoading;
  if (!active) return null;

  const title   = cloneLoading ? 'Clonando scripts'          : 'Insertando filas';
  const subtitle = cloneLoading ? 'Por favor espere, no cierre esta ventana.'
                                : 'Ejecutando INSERT en la base de datos destino...';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl px-10 py-8 flex flex-col items-center gap-4 min-w-64">
        <Loader2 size={40} className="text-blue-600 animate-spin" />
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-800">{title}</p>
          <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

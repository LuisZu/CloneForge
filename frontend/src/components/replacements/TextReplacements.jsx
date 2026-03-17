import { useState } from 'react';
import { Plus, Trash2, ArrowRight, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import useAppStore from '../../store/appStore';

export default function TextReplacements() {
  const { textReplacements, setTextReplacements } = useAppStore();
  const [open, setOpen] = useState(false);

  function addRule() {
    setTextReplacements([
      ...textReplacements,
      { id: Date.now(), find: '', replace: '' },
    ]);
    setOpen(true);
  }

  function updateRule(id, field, value) {
    setTextReplacements(
      textReplacements.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  }

  function removeRule(id) {
    setTextReplacements(textReplacements.filter((r) => r.id !== id));
  }

  const activeCount = textReplacements.filter((r) => r.find.trim()).length;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Header / toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <ArrowRight size={14} className="text-amber-500" />
          Reemplazos de texto
          {activeCount > 0 && (
            <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">
              {activeCount}
            </span>
          )}
        </span>
        <ChevronDown
          size={14}
          className={clsx('text-slate-400 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 flex flex-col gap-2 border-t border-slate-100">
          <p className="text-xs text-slate-400 mt-3">
            Se aplican a todos los scripts antes de clonar, en orden.
          </p>

          {textReplacements.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-2">
              Sin reglas. Agrega una para empezar.
            </p>
          )}

          {textReplacements.map((rule, idx) => (
            <div key={rule.id} className="flex items-center gap-1.5">
              <span className="text-xs text-slate-300 w-4 shrink-0 text-right">{idx + 1}</span>
              <input
                type="text"
                placeholder="Buscar…"
                value={rule.find}
                onChange={(e) => updateRule(rule.id, 'find', e.target.value)}
                className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <ArrowRight size={12} className="text-slate-300 shrink-0" />
              <input
                type="text"
                placeholder="Reemplazar por…"
                value={rule.replace}
                onChange={(e) => updateRule(rule.id, 'replace', e.target.value)}
                className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button
                onClick={() => removeRule(rule.id)}
                className="text-slate-300 hover:text-red-500 transition-colors shrink-0"
                title="Eliminar regla"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}

          <button
            onClick={addRule}
            className="mt-1 flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 font-medium self-start"
          >
            <Plus size={13} />
            Agregar reemplazo
          </button>
        </div>
      )}
    </div>
  );
}

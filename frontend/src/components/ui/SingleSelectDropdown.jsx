import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import clsx from 'clsx';

/**
 * Dropdown single-select with live search. Same visual design as MultiSelectDropdown.
 *
 * Props:
 *  - label       string              — label shown before the trigger button
 *  - options     { value, label }[]  — all available options
 *  - selected    string | null       — currently selected value
 *  - onChange    fn(string | null)   — called when selection changes
 *  - placeholder string              — shown when nothing is selected
 */
export default function SingleSelectDropdown({ label, options, selected, onChange, placeholder = 'Seleccionar...' }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    function onMouseDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50);
    } else {
      setSearch('');
    }
  }, [open]);

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  const selectedOption = options.find((o) => o.value === selected) ?? null;

  function pick(opt) {
    onChange(opt.value);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative flex items-center gap-1.5">
      {label && (
        <span className="text-xs text-slate-400 font-medium shrink-0">{label}:</span>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors min-w-52 max-w-72',
          open
            ? 'border-blue-500 ring-2 ring-blue-100 bg-white'
            : 'border-slate-300 bg-white hover:border-blue-400',
        )}
      >
        <span className="flex-1 text-left truncate text-sm">
          {selectedOption
            ? <span className="font-medium text-slate-700">{selectedOption.label}</span>
            : <span className="text-slate-400">{placeholder}</span>}
        </span>

        {selectedOption && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(null); }}
            className="text-slate-400 hover:text-red-500 transition-colors"
            title="Limpiar selección"
          >
            <X size={12} />
          </button>
        )}

        <ChevronDown
          size={14}
          className={clsx('text-slate-400 transition-transform shrink-0', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="absolute z-30 top-full left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl w-72 flex flex-col overflow-hidden">
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
            <Search size={13} className="text-slate-400 shrink-0" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar tabla..."
              className="flex-1 text-sm outline-none placeholder:text-slate-400"
            />
          </div>

          {/* Options list */}
          <div className="overflow-y-auto max-h-56">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-xs text-slate-400 text-center">Sin resultados</p>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => pick(opt)}
                  className={clsx(
                    'w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50 transition-colors',
                    opt.value === selected && 'bg-blue-50',
                  )}
                >
                  <span
                    className={clsx(
                      'w-3 h-3 rounded-full border-2 shrink-0',
                      opt.value === selected
                        ? 'border-blue-600 bg-blue-600'
                        : 'border-slate-300 bg-white',
                    )}
                  />
                  <span
                    className={clsx(
                      'text-sm truncate font-mono',
                      opt.value === selected ? 'text-blue-700 font-semibold' : 'text-slate-700',
                    )}
                  >
                    {opt.label}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

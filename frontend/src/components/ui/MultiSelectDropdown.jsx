import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import clsx from 'clsx';

/**
 * Dropdown multi-select with live search.
 *
 * Props:
 *  - label       string   — label shown before the trigger button
 *  - options     string[] — all available options
 *  - selected    string[] — currently selected values
 *  - onChange    fn(string[]) — called when selection changes
 *  - placeholder string   — shown when nothing is selected
 */
export default function MultiSelectDropdown({ label, options, selected, onChange, placeholder = 'Seleccionar...' }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const searchRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    function onMouseDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  // Focus search when opening
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50);
    } else {
      setSearch('');
    }
  }, [open]);

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(search.toLowerCase())
  );

  const allSelected = options.length > 0 && selected.length === options.length;
  const noneSelected = selected.length === 0;

  function toggleAll() {
    onChange(allSelected ? [] : [...options]);
  }

  function toggle(opt) {
    if (selected.includes(opt)) {
      onChange(selected.filter((s) => s !== opt));
    } else {
      onChange([...selected, opt]);
    }
  }

  // Trigger label
  let triggerLabel;
  if (noneSelected)   triggerLabel = <span className="text-slate-400">{placeholder}</span>;
  else if (allSelected) triggerLabel = <span className="font-medium">Todos ({options.length})</span>;
  else if (selected.length <= 2) triggerLabel = <span className="font-medium">{selected.join(', ')}</span>;
  else triggerLabel = <span className="font-medium">{selected.length} de {options.length}</span>;

  return (
    <div ref={containerRef} className="relative flex items-center gap-1.5">
      {label && (
        <span className="text-xs text-slate-400 font-medium shrink-0">{label}:</span>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors min-w-36 max-w-52',
          open
            ? 'border-blue-500 ring-2 ring-blue-100 bg-white'
            : 'border-slate-300 bg-white hover:border-blue-400'
        )}
      >
        <span className="flex-1 text-left truncate text-sm">{triggerLabel}</span>
        {!noneSelected && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange([]); }}
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
        <div className="absolute z-30 top-full left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl w-56 flex flex-col overflow-hidden">
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
            <Search size={13} className="text-slate-400 shrink-0" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="flex-1 text-sm outline-none placeholder:text-slate-400"
            />
          </div>

          {/* Select all */}
          {!search && (
            <label className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="rounded accent-blue-600"
              />
              <span className="text-sm font-medium text-slate-600">Seleccionar todos</span>
            </label>
          )}

          {/* Options list */}
          <div className="overflow-y-auto max-h-48">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-xs text-slate-400 text-center">Sin resultados</p>
            ) : (
              filtered.map((opt) => (
                <label
                  key={opt}
                  className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(opt)}
                    onChange={() => toggle(opt)}
                    className="rounded accent-blue-600"
                  />
                  <span className="text-sm text-slate-700">{opt}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

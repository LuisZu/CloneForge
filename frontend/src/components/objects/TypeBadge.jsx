const TYPE_STYLES = {
  SP:      'bg-purple-100 text-purple-700',
  VISTA:   'bg-blue-100 text-blue-700',
  TABLA:   'bg-amber-100 text-amber-700',
  FUNCION: 'bg-green-100 text-green-700',
  TRIGGER: 'bg-rose-100 text-rose-700',
};

const TYPE_LABEL = {
  SP:      'SP',
  VISTA:   'Vista',
  TABLA:   'Tabla',
  FUNCION: 'Función',
  TRIGGER: 'Trigger',
};

export default function TypeBadge({ type }) {
  const style = TYPE_STYLES[type] || 'bg-slate-100 text-slate-600';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${style}`}>
      {TYPE_LABEL[type] || type}
    </span>
  );
}

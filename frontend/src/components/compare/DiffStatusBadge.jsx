const STATUS_STYLES = {
  MISSING_IN_DEST:   'bg-amber-100 text-amber-700',
  MISSING_IN_SOURCE: 'bg-slate-100 text-slate-500',
  MATCH:             'bg-green-100 text-green-700',
};

const STATUS_LABEL = {
  MISSING_IN_DEST:   'Falta en Destino',
  MISSING_IN_SOURCE: 'Falta en Origen',
  MATCH:             'Existe en ambos',
};

export default function DiffStatusBadge({ status }) {
  const style = STATUS_STYLES[status] || 'bg-slate-100 text-slate-600';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${style}`}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

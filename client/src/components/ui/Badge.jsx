import { STATUS_META } from '../../lib/format';

const TONES = {
  brand: 'bg-brand-50 text-brand-600',
  sky: 'bg-sky-50 text-sky',
  amber: 'bg-amber-50 text-[#8a5d05]',
  rose: 'bg-rose-50 text-rose',
  violet: 'bg-violet-50 text-violet',
  gray: 'bg-line-soft text-muted',
};

export function Badge({ tone = 'gray', children, className = '' }) {
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]} ${className}`}>{children}</span>;
}

export function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status, tone: 'gray' };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

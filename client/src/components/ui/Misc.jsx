import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { api } from '../../lib/api';
import { useDebounced } from '../../lib/useAsync';
import { initials } from '../../lib/format';

export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0"><h1 className="text-2xl font-semibold sm:text-[28px]">{title}</h1>{description && <p className="mt-1 text-sm text-muted">{description}</p>}</div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'brand' }) {
  const tones = { brand: 'bg-brand-50 text-brand', sky: 'bg-sky-50 text-sky', amber: 'bg-amber-50 text-amber', violet: 'bg-violet-50 text-violet', rose: 'bg-rose-50 text-rose' };
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{label}</span>
        {Icon && <span className={`grid h-8 w-8 place-items-center rounded-lg ${tones[tone]}`}><Icon className="h-4 w-4" /></span>}
      </div>
      <div className="mt-2 font-display text-3xl font-semibold tracking-tight">{value ?? '—'}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="input pl-9" />
    </div>
  );
}

export function Avatar({ name, size = 36 }) {
  const hue = [...(name || '?')].reduce((a, c) => a + c.charCodeAt(0), 0) % 5;
  const palette = ['bg-brand-50 text-brand-600', 'bg-sky-50 text-sky', 'bg-violet-50 text-violet', 'bg-amber-50 text-[#8a5d05]', 'bg-rose-50 text-rose'];
  return <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full font-semibold ${palette[hue]}`} style={{ width: size, height: size, fontSize: size * 0.38 }}>{initials(name)}</span>;
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <button key={t.value} role="tab" aria-selected={value === t.value} onClick={() => onChange(t.value)}
          className={`-mb-px whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors ${value === t.value ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'}`}>
          {t.label}{t.count != null && <span className="ml-1.5 rounded-full bg-line-soft px-1.5 py-0.5 text-xs text-muted">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

// Skill chips: matched (green), partial (amber), missing (red outline), neutral
export function SkillChip({ children, kind = 'neutral', onRemove }) {
  const kinds = {
    neutral: 'bg-line-soft text-ink',
    matched: 'bg-brand-50 text-brand-600',
    partial: 'bg-amber-50 text-[#8a5d05]',
    missing: 'border border-rose/40 bg-white text-rose',
    required: 'bg-forest text-white',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${kinds[kind]}`}>
      {children}
      {onRemove && <button type="button" onClick={onRemove} aria-label={`Remove ${children}`} className="-mr-0.5 rounded p-0.5 hover:bg-black/10"><X className="h-3 w-3" /></button>}
    </span>
  );
}

// Free-text tag entry with suggestions from the skills table.
export function SkillInput({ value, onChange, label, hint, placeholder = 'Type a skill and press Enter' }) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState([]);
  const q = useDebounced(text, 200);
  const box = useRef(null);

  useEffect(() => {
    if (!q.trim()) { setOptions([]); return; }
    api.get('/skills', { params: { q } }).then((r) => setOptions(r.data.skills.map((s) => s.name).filter((n) => !value.includes(n)))).catch(() => setOptions([]));
  }, [q, value]);
  useEffect(() => {
    const close = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const add = (name) => {
    const clean = name.trim();
    if (clean && !value.some((v) => v.toLowerCase() === clean.toLowerCase())) onChange([...value, clean]);
    setText(''); setOpen(false);
  };
  return (
    <div ref={box} className="relative">
      {label && <label className="label">{label}</label>}
      <div className="input flex min-h-10 flex-wrap items-center gap-1.5 !py-1.5 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
        {value.map((s) => <SkillChip key={s} onRemove={() => onChange(value.filter((v) => v !== s))}>{s}</SkillChip>)}
        <input value={text} onChange={(e) => { setText(e.target.value); setOpen(true); }} placeholder={value.length ? '' : placeholder} aria-label={label || 'Add skill'}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(text); }
            if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1));
          }}
          className="min-w-[8rem] flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-faint" />
      </div>
      {open && options.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-line bg-white py-1 shadow-lg">
          {options.slice(0, 8).map((o) => <li key={o}><button type="button" onClick={() => add(o)} className="block w-full px-3 py-1.5 text-left text-sm hover:bg-paper">{o}</button></li>)}
        </ul>
      )}
      {hint && <p className="mt-1.5 text-[13px] text-muted">{hint}</p>}
    </div>
  );
}

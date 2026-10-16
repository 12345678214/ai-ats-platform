import { forwardRef, useId } from 'react';

export function Field({ label, error, hint, required, children, id }) {
  return (
    <div>
      {label && <label htmlFor={id} className="label">{label}{required && <span className="text-rose"> *</span>}</label>}
      {children}
      {error ? <p role="alert" className="mt-1.5 text-[13px] text-rose">{error}</p> : hint ? <p className="mt-1.5 text-[13px] text-muted">{hint}</p> : null}
    </div>
  );
}

export const Input = forwardRef(function Input({ label, error, hint, required, className = '', ...rest }, ref) {
  const id = useId();
  return (
    <Field label={label} error={error} hint={hint} required={required} id={id}>
      <input id={id} ref={ref} aria-invalid={!!error} className={`input ${error ? 'input-error' : ''} ${className}`} {...rest} />
    </Field>
  );
});

export const Textarea = forwardRef(function Textarea({ label, error, hint, required, rows = 4, ...rest }, ref) {
  const id = useId();
  return (
    <Field label={label} error={error} hint={hint} required={required} id={id}>
      <textarea id={id} ref={ref} rows={rows} aria-invalid={!!error} className={`input resize-y ${error ? 'input-error' : ''}`} {...rest} />
    </Field>
  );
});

export function Select({ label, error, hint, required, options, placeholder, className = '', ...rest }) {
  const id = useId();
  return (
    <Field label={label} error={error} hint={hint} required={required} id={id}>
      <select id={id} aria-invalid={!!error} className={`input pr-8 ${error ? 'input-error' : ''} ${className}`} {...rest}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  );
}

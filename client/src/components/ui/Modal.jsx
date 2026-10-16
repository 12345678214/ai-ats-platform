import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import Button from './Button';

function useDialog(open, onClose) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previous?.focus?.();
    };
  }, [open, onClose]);
  return ref;
}

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }) {
  const ref = useDialog(open, onClose);
  if (!open) return null;
  const width = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' }[size];
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-forest/40 sm:place-items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}
        className={`flex max-h-[92vh] w-full ${width} flex-col rounded-t-2xl bg-white shadow-2xl outline-none sm:rounded-2xl`} style={{ animation: 'pop .18s ease-out' }}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div><h2 className="text-lg font-semibold">{title}</h2>{description && <p className="mt-0.5 text-sm text-muted">{description}</p>}</div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-muted hover:bg-line-soft hover:text-ink"><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, subtitle, children, width = 'max-w-2xl' }) {
  const ref = useDialog(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-forest/40" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}
        className={`ml-auto flex h-full w-full ${width} flex-col bg-paper shadow-2xl outline-none`} style={{ animation: 'slide-in .2s ease-out' }}>
        <div className="flex items-start justify-between gap-4 border-b border-line bg-white px-5 py-4">
          <div className="min-w-0"><h2 className="truncate text-lg font-semibold">{title}</h2>{subtitle && <p className="truncate text-sm text-muted">{subtitle}</p>}</div>
          <button onClick={onClose} aria-label="Close panel" className="rounded-lg p-1 text-muted hover:bg-line-soft hover:text-ink"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </aside>
    </div>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger = false, loading = false }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>{confirmLabel}</Button></>}>
      <p className="text-sm text-muted">{message}</p>
    </Modal>
  );
}

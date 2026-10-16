import { AlertTriangle, Loader2 } from 'lucide-react';
import Button from './Button';

export function Spinner({ className = '' }) {
  return <Loader2 className={`animate-spin text-brand ${className}`} aria-label="Loading" />;
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-sm text-muted" role="status">
      <Spinner className="h-6 w-6" />{label}
    </div>
  );
}

export function SkeletonRows({ rows = 5, className = 'h-12' }) {
  return <div className="space-y-2" role="status" aria-label="Loading">{Array.from({ length: rows }).map((_, i) => <div key={i} className={`skeleton ${className}`} />)}</div>;
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-white/60 px-6 py-14 text-center">
      {Icon && <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand"><Icon className="h-6 w-6" /></div>}
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center rounded-xl border border-rose/30 bg-rose-50 px-6 py-12 text-center">
      <AlertTriangle className="mb-3 h-8 w-8 text-rose" />
      <h3 className="text-base font-semibold">We couldn&apos;t load this</h3>
      <p className="mt-1.5 max-w-md text-sm text-muted">{message}</p>
      {onRetry && <Button variant="secondary" className="mt-5" onClick={() => onRetry()}>Try again</Button>}
    </div>
  );
}

// Shows the right state for a useAsync result.
export function Async({ state, skeleton, children, emptyWhen, empty }) {
  if (state.loading && !state.data) return skeleton || <PageLoader />;
  if (state.error) return <ErrorState message={state.error} onRetry={state.reload} />;
  if (emptyWhen && emptyWhen(state.data)) return empty;
  return children(state.data);
}

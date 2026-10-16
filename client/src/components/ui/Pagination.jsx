import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ pagination, onPage }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  const { page, totalPages, total, limit } = pagination;
  const from = (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);
  const btn = 'grid h-9 w-9 place-items-center rounded-lg border border-line bg-white text-muted hover:bg-paper disabled:opacity-40';
  return (
    <nav className="mt-4 flex items-center justify-between gap-3 text-sm text-muted" aria-label="Pagination">
      <span>{from}–{to} of {total}</span>
      <div className="flex items-center gap-2">
        <button className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
        <span className="min-w-16 text-center">Page {page} of {totalPages}</span>
        <button className={btn} disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
      </div>
    </nav>
  );
}

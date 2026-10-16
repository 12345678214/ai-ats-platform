import { useState } from 'react';
import { SearchX } from 'lucide-react';
import { api } from '../../lib/api';
import { useAsync, useDebounced } from '../../lib/useAsync';
import { Async, EmptyState, SkeletonRows } from '../../components/ui/States';
import { PageHeader, SearchInput } from '../../components/ui/Misc';
import { Select } from '../../components/ui/Field';
import Pagination from '../../components/ui/Pagination';

// Generic searchable, filterable, paginated admin table.
export default function AdminList({ title, description, path, filters = [], columns, actions, searchPlaceholder = 'Search' }) {
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [values, setValues] = useState({});
  const [page, setPage] = useState(1);
  const params = { q: dq || undefined, page, limit: 10, ...Object.fromEntries(Object.entries(values).filter(([, v]) => v)) };
  const state = useAsync(() => api.get(path, { params }).then((r) => r.data), [path, dq, page, JSON.stringify(values)]);
  const reload = () => state.reload({ silent: true });

  return (
    <div>
      <PageHeader title={title} description={description} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder={searchPlaceholder} className="sm:w-80" />
        {filters.map((f) => <Select key={f.key} aria-label={f.label} value={values[f.key] || ''} placeholder={f.label} options={f.options} className="sm:w-44" onChange={(e) => { setValues({ ...values, [f.key]: e.target.value }); setPage(1); }} />)}
      </div>
      <Async state={state} skeleton={<SkeletonRows rows={6} className="h-14" />} emptyWhen={(d) => d.items.length === 0} empty={<EmptyState icon={SearchX} title="Nothing matches" description="Try a different search or clear a filter." />}>
        {(d) => (
          <>
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead className="border-b border-line bg-paper"><tr>{columns.map((c) => <th key={c.header} className={`th ${c.className || ''}`}>{c.header}</th>)}{actions && <th className="th" />}</tr></thead>
                <tbody className="divide-y divide-line-soft">{d.items.map((row) => (
                  <tr key={row.id}>{columns.map((c) => <td key={c.header} className={`td ${c.className || ''}`}>{c.render(row)}</td>)}{actions && <td className="td"><div className="flex justify-end gap-1.5">{actions(row, reload)}</div></td>}</tr>
                ))}</tbody>
              </table>
            </div>
            <Pagination pagination={d.pagination} onPage={setPage} />
          </>
        )}
      </Async>
    </div>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Eye, MoreHorizontal, Pause, Pencil, Play, Plus, Trash2, Users, XCircle } from 'lucide-react';
import { api, parseError } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { useAsync, useDebounced } from '../../lib/useAsync';
import { timeAgo } from '../../lib/format';
import { Async, EmptyState, SkeletonRows } from '../../components/ui/States';
import { PageHeader, SearchInput, Tabs } from '../../components/ui/Misc';
import { StatusBadge } from '../../components/ui/Badge';
import { ConfirmDialog } from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import Button from '../../components/ui/Button';

const TABS = [['', 'All'], ['ACTIVE', 'Active'], ['DRAFT', 'Drafts'], ['PAUSED', 'Paused'], ['CLOSED', 'Closed']];

export default function RecruiterJobs() {
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [page, setPage] = useState(1);
  const [del, setDel] = useState(null);
  const [menu, setMenu] = useState(null);
  const state = useAsync(() => api.get('/recruiter/jobs', { params: { status: status || undefined, q: dq || undefined, page } }).then((r) => r.data), [status, dq, page]);

  const setJobStatus = async (job, next, msg) => {
    setMenu(null);
    try { await api.patch(`/recruiter/jobs/${job.id}/status`, { status: next }); toast.success(msg); state.reload({ silent: true }); } catch (e) { toast.error(parseError(e).message); }
  };
  const remove = async () => {
    try { await api.delete(`/recruiter/jobs/${del.id}`); toast.success('Job deleted'); setDel(null); state.reload({ silent: true }); }
    catch (e) { toast.error(parseError(e).message); setDel(null); }
  };

  return (
    <div>
      <PageHeader title="Jobs & applicants" description="Open a job to review its ranked applicants." actions={<Button to="/recruiter/jobs/new" icon={Plus}>Post a job</Button>} />
      <Tabs tabs={TABS.map(([value, label]) => ({ value, label }))} value={status} onChange={(v) => { setStatus(v); setPage(1); }} />
      <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search your jobs" className="mt-4 max-w-sm" />
      <div className="mt-4">
        <Async state={state} skeleton={<SkeletonRows rows={5} className="h-16" />} emptyWhen={(d) => d.items.length === 0}
          empty={<EmptyState icon={Briefcase} title={status || q ? 'No jobs match' : 'No jobs yet'} description="Describe the role and we extract the skills it needs, so applicants can be scored against them." action={<Button to="/recruiter/jobs/new" icon={Plus}>Post your first job</Button>} />}>
          {(d) => (
            <>
              <div className="card overflow-x-auto">
                <table className="w-full min-w-[820px]">
                  <thead className="border-b border-line bg-paper"><tr><th className="th">Job</th><th className="th">Status</th><th className="th text-right">Applicants</th><th className="th text-right">Shortlisted</th><th className="th text-right">Avg match</th><th className="th text-right">Views</th><th className="th" /></tr></thead>
                  <tbody className="divide-y divide-line-soft">
                    {d.items.map((j) => (
                      <tr key={j.id} className="hover:bg-paper">
                        <td className="td"><Link to={`/recruiter/jobs/${j.id}/applicants`} className="font-medium hover:text-brand">{j.title}</Link><p className="text-xs text-muted">{j.location} · created {timeAgo(j.createdAt)}</p>{j.isFlagged && <p className="mt-0.5 text-xs font-medium text-rose">Hidden by moderation: {j.flagReason}</p>}</td>
                        <td className="td"><StatusBadge status={j.status} /></td>
                        <td className="td text-right font-medium">{j.applicantCount}</td>
                        <td className="td text-right">{j.shortlistedCount}</td>
                        <td className="td text-right">{j.avgMatchScore != null ? `${j.avgMatchScore}%` : '—'}</td>
                        <td className="td text-right text-muted">{j.viewCount}</td>
                        <td className="td">
                          <div className="relative flex justify-end gap-1">
                            <Button to={`/recruiter/jobs/${j.id}/applicants`} variant="secondary" size="sm" icon={Users}>Applicants</Button>
                            <button className="rounded-lg p-1.5 text-muted hover:bg-line-soft" aria-label={`More actions for ${j.title}`} aria-expanded={menu === j.id} onClick={() => setMenu(menu === j.id ? null : j.id)}><MoreHorizontal className="h-5 w-5" /></button>
                            {menu === j.id && (
                              <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-line bg-white py-1 text-sm shadow-lg" onMouseLeave={() => setMenu(null)}>
                                <Link to={`/recruiter/jobs/${j.id}/edit`} className="flex items-center gap-2 px-3 py-2 hover:bg-paper"><Pencil className="h-4 w-4" />Edit</Link>
                                <Link to={`/recruiter/jobs/${j.id}`} className="flex items-center gap-2 px-3 py-2 hover:bg-paper"><Eye className="h-4 w-4" />Preview</Link>
                                {j.status !== 'ACTIVE' && <button className="flex w-full items-center gap-2 px-3 py-2 hover:bg-paper" onClick={() => setJobStatus(j, 'ACTIVE', 'Job is live')}><Play className="h-4 w-4" />{j.status === 'DRAFT' ? 'Publish' : 'Reopen'}</button>}
                                {j.status === 'ACTIVE' && <button className="flex w-full items-center gap-2 px-3 py-2 hover:bg-paper" onClick={() => setJobStatus(j, 'PAUSED', 'Job paused')}><Pause className="h-4 w-4" />Pause</button>}
                                {j.status !== 'CLOSED' && <button className="flex w-full items-center gap-2 px-3 py-2 hover:bg-paper" onClick={() => setJobStatus(j, 'CLOSED', 'Job closed')}><XCircle className="h-4 w-4" />Close</button>}
                                <button className="flex w-full items-center gap-2 px-3 py-2 text-rose hover:bg-rose-50" onClick={() => { setMenu(null); setDel(j); }}><Trash2 className="h-4 w-4" />Delete</button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination pagination={d.pagination} onPage={setPage} />
            </>
          )}
        </Async>
      </div>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={remove} danger title="Delete this job?" message={`“${del?.title}” will be permanently deleted. Jobs with applicants cannot be deleted; close them instead.`} confirmLabel="Delete job" />
    </div>
  );
}

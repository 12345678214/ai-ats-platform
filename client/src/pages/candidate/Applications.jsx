import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, CircleDot, FileText, MapPin, Video } from 'lucide-react';
import { api, parseError } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../lib/useAsync';
import { STATUS_META, formatDate, formatDateTime, timeAgo } from '../../lib/format';
import { Async, EmptyState, SkeletonRows, PageLoader } from '../../components/ui/States';
import { PageHeader, Tabs } from '../../components/ui/Misc';
import { StatusBadge } from '../../components/ui/Badge';
import { ConfirmDialog, Drawer } from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import Button from '../../components/ui/Button';

const TABS = [['', 'All'], ['APPLIED', 'Applied'], ['REVIEWING', 'In review'], ['SHORTLISTED', 'Shortlisted'], ['INTERVIEW', 'Interview'], ['OFFER', 'Offer'], ['REJECTED', 'Rejected'], ['WITHDRAWN', 'Withdrawn']];

function ApplicationDrawer({ id, onClose, onChanged }) {
  const toast = useToast();
  const state = useAsync(() => (id ? api.get(`/candidate/applications/${id}`).then((r) => r.data.application) : Promise.resolve(null)), [id]);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const withdraw = async () => {
    setBusy(true);
    try { await api.patch(`/candidate/applications/${id}/withdraw`); toast.success('Application withdrawn'); setConfirm(false); state.reload({ silent: true }); onChanged(); }
    catch (e) { toast.error(parseError(e).message); } finally { setBusy(false); }
  };
  const a = state.data;
  return (
    <Drawer open={!!id} onClose={onClose} title={a?.job.title || 'Application'} subtitle={a ? `${a.job.company.name} · ${a.job.location}` : ''}>
      {state.loading && !a ? <PageLoader /> : state.error ? <p className="p-5 text-sm text-rose">{state.error}</p> : a && (
        <div className="space-y-5 p-5">
          <div className="card flex items-center justify-between p-4"><div><p className="text-xs text-muted">Current status</p><div className="mt-1"><StatusBadge status={a.status} /></div></div>
            <Button to={`/candidate/jobs/${a.job.id}`} variant="secondary" size="sm">View job</Button></div>

          {a.interviews.length > 0 && (
            <section className="card p-4"><h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><CalendarClock className="h-4 w-4 text-amber" />Interviews</h3>
              <ul className="space-y-3">{a.interviews.map((i) => (
                <li key={i.id} className={`rounded-lg border p-3 ${i.status === 'CANCELLED' ? 'border-line bg-paper opacity-70' : 'border-amber/30 bg-amber-50'}`}>
                  <div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">{formatDateTime(i.scheduledAt)}</p><StatusBadge status={i.status} /></div>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">{i.mode === 'VIDEO' ? <Video className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}{i.durationMins} min · {i.mode.toLowerCase()}</p>
                  {i.location && <p className="mt-1 break-all text-xs">{/^https?:\/\//.test(i.location) ? <a className="text-brand underline" href={i.location} target="_blank" rel="noreferrer noopener">{i.location}</a> : i.location}</p>}
                  {i.notes && <p className="mt-1 text-xs text-muted">{i.notes}</p>}
                </li>))}</ul>
            </section>
          )}

          <section className="card p-4"><h3 className="mb-4 text-sm font-semibold">Timeline</h3>
            <ol className="relative space-y-4 border-l border-line pl-5">
              {[...a.history].reverse().map((h, i) => (
                <li key={h.id} className="relative"><CircleDot className={`absolute -left-[29px] top-0.5 h-4 w-4 rounded-full bg-paper ${i === 0 ? 'text-brand' : 'text-faint'}`} />
                  <p className="text-sm font-medium">{STATUS_META[h.toStatus]?.label || h.toStatus}</p><p className="text-xs text-muted">{formatDate(h.createdAt, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p></li>
              ))}
            </ol>
          </section>

          {a.coverLetter && <section className="card p-4"><h3 className="mb-2 text-sm font-semibold">Your cover letter</h3><p className="whitespace-pre-line text-sm text-muted">{a.coverLetter}</p></section>}
          <p className="text-xs text-muted">Resume used: {a.resume?.originalName || 'removed'}</p>
          {!['WITHDRAWN', 'REJECTED', 'HIRED'].includes(a.status) && <Button variant="dangerOutline" onClick={() => setConfirm(true)}>Withdraw application</Button>}
          <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={withdraw} loading={busy} danger title="Withdraw this application?" message="The recruiter will no longer see you in the pipeline. You can apply again later." confirmLabel="Withdraw" />
        </div>
      )}
    </Drawer>
  );
}

export default function Applications() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);
  const state = useAsync(() => api.get('/candidate/applications', { params: { status: status || undefined, page } }).then((r) => r.data), [status, page]);

  return (
    <div>
      <PageHeader title="My applications" description="Track every application from submission to decision." />
      <Tabs tabs={TABS.map(([value, label]) => ({ value, label }))} value={status} onChange={(v) => { setStatus(v); setPage(1); }} />
      <div className="mt-5">
        <Async state={state} skeleton={<SkeletonRows rows={5} className="h-16" />} emptyWhen={(d) => d.items.length === 0}
          empty={<EmptyState icon={FileText} title={status ? 'No applications in this stage' : 'You haven’t applied yet'} description="Applications you submit will appear here with live status updates." action={<Button to="/candidate/jobs">Browse jobs</Button>} />}>
          {(d) => (
            <>
              <div className="card overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead className="border-b border-line bg-paper"><tr><th className="th">Role</th><th className="th">Applied</th><th className="th">Next step</th><th className="th">Status</th></tr></thead>
                  <tbody className="divide-y divide-line-soft">
                    {d.items.map((a) => (
                      <tr key={a.id} className="cursor-pointer hover:bg-paper" onClick={() => setOpen(a.id)}>
                        <td className="td"><button className="text-left" onClick={(e) => { e.stopPropagation(); setOpen(a.id); }}><span className="block font-medium hover:text-brand">{a.job.title}</span><span className="block text-xs text-muted">{a.job.company.name}</span></button></td>
                        <td className="td text-muted">{timeAgo(a.appliedAt)}</td>
                        <td className="td text-muted">{a.nextInterview ? <span className="text-[#8a5d05]">Interview {formatDateTime(a.nextInterview.scheduledAt)}</span> : '—'}</td>
                        <td className="td"><StatusBadge status={a.status} /></td>
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
      <ApplicationDrawer id={open} onClose={() => setOpen(null)} onChanged={() => state.reload({ silent: true })} />
    </div>
  );
}

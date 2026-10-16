import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CalendarClock, CheckCheck, FileText, Sparkles, Info, UserPlus } from 'lucide-react';
import { api, parseError } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../lib/useAsync';
import { timeAgo } from '../../lib/format';
import { Async, EmptyState, SkeletonRows } from '../../components/ui/States';
import { PageHeader } from '../../components/ui/Misc';
import Pagination from '../../components/ui/Pagination';
import Button from '../../components/ui/Button';

const ICONS = { APPLICATION_RECEIVED: UserPlus, STATUS_CHANGED: FileText, INTERVIEW_SCHEDULED: CalendarClock, INTERVIEW_UPDATED: CalendarClock, MATCH_READY: Sparkles, SYSTEM: Info };
const notifyChanged = () => window.dispatchEvent(new Event('notifications:changed'));

export default function Notifications() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const state = useAsync(() => api.get('/notifications', { params: { page, unread: unreadOnly || undefined } }).then((r) => r.data), [page, unreadOnly]);

  const markRead = async (n) => {
    if (n.isRead) return;
    await api.patch(`/notifications/${n.id}/read`).catch(() => {});
    state.reload({ silent: true }); notifyChanged();
  };
  const markAll = async () => {
    try { await api.patch('/notifications/read-all'); toast.success('All caught up'); state.reload({ silent: true }); notifyChanged(); } catch (e) { toast.error(parseError(e).message); }
  };

  return (
    <div>
      <PageHeader title="Notifications" description="Application updates, interviews and new matches."
        actions={<>
          <Button variant="secondary" size="sm" onClick={() => { setUnreadOnly((v) => !v); setPage(1); }} aria-pressed={unreadOnly}>{unreadOnly ? 'Show all' : 'Unread only'}</Button>
          <Button variant="secondary" size="sm" icon={CheckCheck} onClick={markAll} disabled={!state.data?.unread}>Mark all read</Button>
        </>} />
      <Async state={state} skeleton={<SkeletonRows rows={6} className="h-[72px]" />} emptyWhen={(d) => d.items.length === 0}
        empty={<EmptyState icon={Bell} title={unreadOnly ? 'No unread notifications' : 'Nothing here yet'} description="When something happens on your applications or jobs, you will see it here." />}>
        {(d) => (
          <>
            <ul className="card divide-y divide-line-soft overflow-hidden">
              {d.items.map((n) => {
                const Icon = ICONS[n.type] || Info;
                const body = (
                  <div className={`flex items-start gap-3.5 px-5 py-4 ${n.isRead ? '' : 'bg-brand-50/40'}`}>
                    <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ${n.isRead ? 'bg-line-soft text-muted' : 'bg-brand-50 text-brand'}`}><Icon className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{n.title}</p><p className="mt-0.5 text-sm text-muted">{n.message}</p><p className="mt-1 text-xs text-faint">{timeAgo(n.createdAt)}</p></div>
                    {!n.isRead && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand" aria-label="Unread" />}
                  </div>
                );
                return <li key={n.id}>{n.link ? <Link to={n.link} onClick={() => markRead(n)} className="block hover:bg-paper">{body}</Link> : <button className="block w-full text-left hover:bg-paper" onClick={() => markRead(n)}>{body}</button>}</li>;
              })}
            </ul>
            <Pagination pagination={d.pagination} onPage={setPage} />
          </>
        )}
      </Async>
    </div>
  );
}

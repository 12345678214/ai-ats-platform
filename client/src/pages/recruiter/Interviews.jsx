import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, MapPin, Video } from 'lucide-react';
import { api, parseError } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../lib/useAsync';
import { formatDateTime } from '../../lib/format';
import { Async, EmptyState, SkeletonRows } from '../../components/ui/States';
import { Avatar, PageHeader, Tabs } from '../../components/ui/Misc';
import { StatusBadge } from '../../components/ui/Badge';
import Button from '../../components/ui/Button';

export default function Interviews() {
  const toast = useToast();
  const [tab, setTab] = useState('upcoming');
  const state = useAsync(() => api.get('/recruiter/interviews').then((r) => r.data.interviews), []);
  const act = async (id, status) => { try { await api.patch(`/recruiter/interviews/${id}`, { status }); toast.success(status === 'COMPLETED' ? 'Marked completed' : 'Interview cancelled'); state.reload({ silent: true }); } catch (e) { toast.error(parseError(e).message); } };
  const now = Date.now();
  return (
    <div>
      <PageHeader title="Interviews" description="Everything you have scheduled across all jobs. Schedule new ones from an applicant’s profile." />
      <Async state={state} skeleton={<SkeletonRows rows={4} className="h-20" />}>
        {(all) => {
          const upcoming = all.filter((i) => i.status === 'SCHEDULED' && new Date(i.scheduledAt) >= now);
          const past = all.filter((i) => !(i.status === 'SCHEDULED' && new Date(i.scheduledAt) >= now)).reverse();
          const list = tab === 'upcoming' ? upcoming : past;
          return (
            <>
              <Tabs value={tab} onChange={setTab} tabs={[{ value: 'upcoming', label: 'Upcoming', count: upcoming.length }, { value: 'past', label: 'Past & cancelled', count: past.length }]} />
              <div className="mt-5">
                {list.length === 0 ? <EmptyState icon={CalendarClock} title={tab === 'upcoming' ? 'No upcoming interviews' : 'Nothing here yet'} description="Open an applicant and choose “Schedule interview” to invite them." /> : (
                  <ul className="space-y-3">{list.map((i) => (
                    <li key={i.id} className="card flex flex-wrap items-center gap-4 p-4">
                      <Avatar name={i.application.candidate.user.name} size={42} />
                      <div className="min-w-0 flex-1"><Link to={`/recruiter/jobs/${i.application.jobId}/applicants?application=${i.application.id}`} className="font-medium hover:text-brand">{i.application.candidate.user.name}</Link>
                        <p className="text-sm text-muted">{i.application.job.title}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted"><span className="font-medium text-ink">{formatDateTime(i.scheduledAt)}</span><span>{i.durationMins} min</span><span className="inline-flex items-center gap-1">{i.mode === 'ONSITE' ? <MapPin className="h-3 w-3" /> : <Video className="h-3 w-3" />}{i.mode.toLowerCase()}</span></p></div>
                      <StatusBadge status={i.status} />
                      {i.status === 'SCHEDULED' && <div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => act(i.id, 'COMPLETED')}>Mark done</Button><Button size="sm" variant="ghost" onClick={() => act(i.id, 'CANCELLED')}>Cancel</Button></div>}
                    </li>))}</ul>
                )}
              </div>
            </>
          );
        }}
      </Async>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { Briefcase, CalendarClock, Gauge, Plus, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { PIPELINE, STATUS_META, formatDateTime, timeAgo } from '../../lib/format';
import { Async, EmptyState, SkeletonRows } from '../../components/ui/States';
import { Avatar, PageHeader, StatCard } from '../../components/ui/Misc';
import { StatusBadge } from '../../components/ui/Badge';
import MatchRing from '../../components/ui/MatchRing';
import Button from '../../components/ui/Button';

export default function RecruiterDashboard() {
  const state = useAsync(() => api.get('/recruiter/dashboard').then((r) => r.data), []);
  return (
    <div>
      <Async state={state} skeleton={<><div className="skeleton mb-6 h-12 w-72" /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-28" />)}</div></>}>
        {(d) => {
          const max = Math.max(1, ...PIPELINE.map((s) => d.pipeline[s] || 0));
          return (
            <>
              <PageHeader title={d.company.name} description="Your hiring pipeline at a glance." actions={<Button to="/recruiter/jobs/new" icon={Plus}>Post a job</Button>} />
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard label="Active jobs" value={d.stats.activeJobs} hint={`${d.stats.totalJobs} total`} icon={Briefcase} tone="brand" />
                  <StatCard label="Applicants" value={d.stats.totalApplicants} hint={`${d.stats.newApplicants} not yet reviewed`} icon={Users} tone="sky" />
                  <StatCard label="Interviews upcoming" value={d.stats.interviewsScheduled} icon={CalendarClock} tone="amber" />
                  <StatCard label="Average match" value={d.stats.avgMatchScore != null ? `${d.stats.avgMatchScore}%` : '—'} hint="Across all applicants" icon={Gauge} tone="violet" />
                </div>
                <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
                  <section className="card">
                    <div className="border-b border-line px-5 py-4"><h2 className="font-semibold">Latest applicants</h2></div>
                    {d.recentApplicants.length === 0 ? <div className="p-5"><EmptyState icon={Users} title="No applicants yet" description="Publish a job and candidates will start appearing here, already scored." action={<Button to="/recruiter/jobs/new">Post a job</Button>} /></div> : (
                      <ul className="divide-y divide-line-soft">{d.recentApplicants.map((a) => (
                        <li key={a.id}><Link to={`/recruiter/jobs/${a.job.id}/applicants?application=${a.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-paper">
                          <Avatar name={a.candidate.user.name} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{a.candidate.user.name}</p><p className="truncate text-xs text-muted">{a.job.title} · {timeAgo(a.appliedAt)}</p></div>
                          <StatusBadge status={a.status} /><MatchRing score={a.match?.score} pending={a.match?.status !== 'COMPLETED'} size={40} stroke={4} />
                        </Link></li>))}</ul>
                    )}
                  </section>
                  <div className="space-y-6">
                    <section className="card p-5"><h2 className="font-semibold">Pipeline</h2>
                      <ul className="mt-4 space-y-2.5">{PIPELINE.map((s) => (
                        <li key={s} className="text-sm"><div className="mb-1 flex justify-between"><span className="text-muted">{STATUS_META[s].label}</span><span className="font-medium">{d.pipeline[s] || 0}</span></div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-line-soft"><div className="h-full rounded-full bg-brand" style={{ width: `${((d.pipeline[s] || 0) / max) * 100}%` }} /></div></li>))}</ul>
                    </section>
                    <section className="card p-5"><h2 className="font-semibold">Upcoming interviews</h2>
                      {d.upcomingInterviews.length === 0 ? <p className="mt-2 text-sm text-muted">Nothing scheduled.</p> : (
                        <ul className="mt-3 space-y-3">{d.upcomingInterviews.map((i) => (
                          <li key={i.id}><Link to={`/recruiter/jobs/${i.application.jobId}/applicants?application=${i.application.id}`} className="block rounded-lg bg-amber-50 p-3 hover:bg-amber-50/70">
                            <p className="text-sm font-medium">{i.application.candidate.user.name}</p><p className="text-xs text-muted">{i.application.job.title}</p><p className="mt-1 text-xs font-medium text-[#8a5d05]">{formatDateTime(i.scheduledAt)}</p></Link></li>))}</ul>
                      )}
                    </section>
                  </div>
                </div>
              </div>
            </>
          );
        }}
      </Async>
    </div>
  );
}

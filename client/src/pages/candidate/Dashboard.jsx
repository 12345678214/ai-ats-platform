import { Link } from 'react-router-dom';
import { Bookmark, CalendarClock, FileText, Send, Sparkles, Trophy } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../../lib/useAsync';
import { formatDateTime, timeAgo } from '../../lib/format';
import { Async, EmptyState, SkeletonRows } from '../../components/ui/States';
import { PageHeader, StatCard } from '../../components/ui/Misc';
import { StatusBadge } from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import JobCard from '../../components/jobs/JobCard';

export default function CandidateDashboard() {
  const { user } = useAuth();
  const state = useAsync(() => api.get('/candidate/dashboard').then((r) => r.data), []);
  return (
    <div>
      <PageHeader title={`Hi, ${user.name.split(' ')[0]}`} description="Here is where your job search stands." actions={<Button to="/candidate/jobs" icon={Sparkles}>Find jobs</Button>} />
      <Async state={state} skeleton={<div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-28" />)}</div><SkeletonRows rows={4} className="h-16" /></div>}>
        {(d) => (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Applications" value={d.stats.totalApplications} hint={`${d.stats.active} still active`} icon={Send} tone="sky" />
              <StatCard label="Shortlisted" value={d.stats.shortlisted} icon={Trophy} tone="brand" />
              <StatCard label="Interviews" value={d.stats.interviews} hint={`${d.upcomingInterviews.length} upcoming`} icon={CalendarClock} tone="amber" />
              <StatCard label="Saved jobs" value={d.stats.savedJobs} icon={Bookmark} tone="violet" />
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
              <section className="card">
                <div className="flex items-center justify-between border-b border-line px-5 py-4"><h2 className="font-semibold">Recent applications</h2><Link to="/candidate/applications" className="text-sm font-medium text-brand hover:underline">View all</Link></div>
                {d.recentApplications.length === 0 ? (
                  <div className="p-5"><EmptyState icon={FileText} title="No applications yet" description="Apply to a role and its progress will be tracked here." action={<Button to="/candidate/jobs">Browse jobs</Button>} /></div>
                ) : (
                  <ul className="divide-y divide-line-soft">
                    {d.recentApplications.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                        <div className="min-w-0"><Link to={`/candidate/jobs/${a.job.id}`} className="block truncate text-sm font-medium hover:text-brand">{a.job.title}</Link><p className="truncate text-xs text-muted">{a.job.company.name} · applied {timeAgo(a.appliedAt)}</p></div>
                        <StatusBadge status={a.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <div className="space-y-6">
                <section className="card p-5">
                  <div className="flex items-baseline justify-between"><h2 className="font-semibold">Profile strength</h2><span className="font-display text-2xl font-semibold text-brand">{d.completion.percent}%</span></div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-line-soft" role="progressbar" aria-valuenow={d.completion.percent} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${d.completion.percent}%` }} /></div>
                  {d.completion.missing.length > 0 ? (
                    <><p className="mt-3 text-sm text-muted">Complete these to rank higher with recruiters:</p><ul className="mt-2 space-y-1 text-sm">{d.completion.missing.slice(0, 4).map((m) => <li key={m} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-amber" />{m}</li>)}</ul>
                      <Button to="/candidate/profile" variant="secondary" size="sm" className="mt-4">Improve profile</Button></>
                  ) : <p className="mt-3 text-sm text-muted">Your profile is complete.</p>}
                </section>
                <section className="card p-5">
                  <h2 className="font-semibold">Upcoming interviews</h2>
                  {d.upcomingInterviews.length === 0 ? <p className="mt-2 text-sm text-muted">Nothing scheduled.</p> : (
                    <ul className="mt-3 space-y-3">{d.upcomingInterviews.map((i) => (
                      <li key={i.id} className="rounded-lg bg-amber-50 p-3"><p className="text-sm font-medium">{i.application.job.title}</p><p className="text-xs text-muted">{i.application.job.company.name}</p><p className="mt-1 text-xs font-medium text-[#8a5d05]">{formatDateTime(i.scheduledAt)} · {i.durationMins} min</p></li>
                    ))}</ul>
                  )}
                </section>
              </div>
            </div>

            {d.recommended.length > 0 && (
              <section>
                <h2 className="mb-1 text-lg font-semibold">Recommended for your skills</h2><p className="mb-4 text-sm text-muted">Open roles that overlap most with the skills on your profile.</p>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{d.recommended.map((j) => <div key={j.id} className="relative flex"><JobCard job={j} base="/candidate/jobs" /></div>)}</div>
              </section>
            )}
          </div>
        )}
      </Async>
    </div>
  );
}

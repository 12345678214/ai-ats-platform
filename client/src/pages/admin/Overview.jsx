import { Link } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Briefcase, Building2, FileText, Flag, ShieldAlert, UserX, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { STATUS_META, formatDate } from '../../lib/format';
import { Async } from '../../components/ui/States';
import { PageHeader, StatCard } from '../../components/ui/Misc';

const tip = { contentStyle: { borderRadius: 10, border: '1px solid #dce3e0', fontSize: 13 } };
const axis = { stroke: '#8a9b96', fontSize: 12, tickLine: false, axisLine: false };

export default function Overview() {
  const stats = useAsync(() => api.get('/admin/stats').then((r) => r.data), []);
  const analytics = useAsync(() => api.get('/admin/analytics').then((r) => r.data), []);
  return (
    <div>
      <PageHeader title="Platform overview" description="Activity and moderation across the whole platform." />
      <Async state={stats}>
        {(s) => (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Users" value={s.totals.users} hint={`${s.totals.candidates} candidates · ${s.totals.recruiters} recruiters`} icon={Users} tone="sky" />
              <StatCard label="Companies" value={s.totals.companies} icon={Building2} tone="violet" />
              <StatCard label="Active jobs" value={s.totals.activeJobs} hint={`${s.totals.totalJobs} total`} icon={Briefcase} tone="brand" />
              <StatCard label="Applications" value={s.totals.applications} icon={FileText} tone="amber" />
            </div>
            <section className="card p-5">
              <h2 className="font-semibold">Needs attention</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {[[Flag, 'Flagged jobs', s.moderation.flaggedJobs, '/admin/jobs', 'rose'], [ShieldAlert, 'Unverified companies', s.moderation.unverifiedCompanies, '/admin/companies', 'amber'], [UserX, 'Deactivated users', s.moderation.deactivatedUsers, '/admin/users', 'gray']].map(([Icon, label, n, to]) => (
                  <Link key={label} to={to} className="flex items-center gap-3 rounded-lg border border-line p-3.5 hover:bg-paper"><Icon className="h-5 w-5 text-muted" /><span className="flex-1 text-sm">{label}</span><span className="font-display text-xl font-semibold">{n}</span></Link>
                ))}
              </div>
            </section>
            <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              <section className="card p-5"><h2 className="font-semibold">Growth, last 30 days</h2>
                <Async state={analytics} skeleton={<div className="skeleton mt-4 h-64" />}>
                  {(a) => (<div className="mt-4 h-64" role="img" aria-label="Chart of new users, jobs and applications per day"><ResponsiveContainer width="100%" height="100%"><AreaChart data={a.series} margin={{ left: -20, right: 8 }}>
                    <CartesianGrid vertical={false} stroke="#ebf0ee" /><XAxis dataKey="date" {...axis} interval={6} tickFormatter={(v) => formatDate(v, { month: 'short', day: 'numeric' })} /><YAxis {...axis} allowDecimals={false} /><Tooltip {...tip} labelFormatter={(v) => formatDate(v)} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="applications" name="Applications" stroke="#0e7c66" fill="#0e7c66" fillOpacity={0.12} strokeWidth={2} />
                    <Area type="monotone" dataKey="users" name="New users" stroke="#2f6aa3" fill="#2f6aa3" fillOpacity={0.1} strokeWidth={2} />
                    <Area type="monotone" dataKey="jobs" name="New jobs" stroke="#c98a12" fill="#c98a12" fillOpacity={0.1} strokeWidth={2} /></AreaChart></ResponsiveContainer></div>)}
                </Async></section>
              <section className="card p-5"><h2 className="font-semibold">Applications by status</h2>
                <div className="mt-4 h-64" role="img" aria-label="Bar chart of applications by status"><ResponsiveContainer width="100%" height="100%"><BarChart layout="vertical" data={Object.entries(s.applicationsByStatus).map(([k, v]) => ({ status: STATUS_META[k]?.label || k, count: v }))} margin={{ left: 10, right: 16 }}>
                  <CartesianGrid horizontal={false} stroke="#ebf0ee" /><XAxis type="number" {...axis} allowDecimals={false} /><YAxis type="category" dataKey="status" {...axis} width={80} /><Tooltip {...tip} cursor={{ fill: '#f4f6f5' }} /><Bar dataKey="count" name="Applications" fill="#123b33" radius={[0, 6, 6, 0]} barSize={18} /></BarChart></ResponsiveContainer></div></section>
            </div>
            <Async state={analytics} skeleton={null}>
              {(a) => (<div className="grid gap-6 md:grid-cols-2">
                <section className="card p-5"><h2 className="font-semibold">Most requested skills</h2><ul className="mt-4 space-y-3">{a.topSkills.map((t) => <li key={t.skill} className="text-sm"><div className="mb-1 flex justify-between"><span>{t.skill}</span><span className="text-muted">{t.jobs} jobs</span></div><div className="h-1.5 rounded-full bg-line-soft"><div className="h-full rounded-full bg-brand" style={{ width: `${(t.jobs / a.topSkills[0].jobs) * 100}%` }} /></div></li>)}</ul></section>
                <section className="card p-5"><h2 className="font-semibold">Companies with most jobs</h2><ul className="mt-4 divide-y divide-line-soft">{a.topCompanies.map((t) => <li key={t.company} className="flex justify-between py-2.5 text-sm"><span>{t.company}</span><span className="text-muted">{t.jobs} jobs</span></li>)}</ul></section>
              </div>)}
            </Async>
          </div>
        )}
      </Async>
    </div>
  );
}

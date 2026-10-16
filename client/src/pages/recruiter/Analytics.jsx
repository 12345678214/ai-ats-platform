import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3 } from 'lucide-react';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { STATUS_META, formatDate } from '../../lib/format';
import { Async, EmptyState } from '../../components/ui/States';
import { PageHeader, StatCard } from '../../components/ui/Misc';
import { StatusBadge } from '../../components/ui/Badge';

const tip = { contentStyle: { borderRadius: 10, border: '1px solid #dce3e0', fontSize: 13 } };
const axis = { stroke: '#8a9b96', fontSize: 12, tickLine: false, axisLine: false };

export default function Analytics() {
  const state = useAsync(() => api.get('/recruiter/analytics').then((r) => r.data), []);
  return (
    <div>
      <PageHeader title="Analytics" description="How your jobs are performing over the last 30 days." />
      <Async state={state} emptyWhen={(d) => d.perJob.length === 0} empty={<EmptyState icon={BarChart3} title="No data yet" description="Publish a job and analytics will appear as applications come in." />}>
        {(d) => {
          const total = d.series.reduce((s, x) => s + x.applications, 0);
          const funnel = d.funnel.map((f) => ({ ...f, label: STATUS_META[f.stage].label }));
          const colors = ['#c4453d', '#c98a12', '#2f6aa3', '#0e7c66'];
          return (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <StatCard label="Applications (30 days)" value={total} tone="sky" />
                <StatCard label="Reached interview" value={d.funnel.find((f) => f.stage === 'INTERVIEW')?.count ?? 0} tone="amber" hint="All time" />
                <StatCard label="Average days to hire" value={d.avgDaysToHire ?? '—'} tone="brand" hint={d.avgDaysToHire == null ? 'No hires recorded yet' : 'From application to hired'} />
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <section className="card p-5"><h2 className="font-semibold">Applications per day</h2>
                  <div className="mt-4 h-64" role="img" aria-label="Line chart of applications per day"><ResponsiveContainer width="100%" height="100%"><AreaChart data={d.series} margin={{ left: -20, right: 8 }}>
                    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0e7c66" stopOpacity={0.25} /><stop offset="100%" stopColor="#0e7c66" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid vertical={false} stroke="#ebf0ee" /><XAxis dataKey="date" {...axis} tickFormatter={(v) => formatDate(v, { month: 'short', day: 'numeric' })} interval={6} /><YAxis {...axis} allowDecimals={false} /><Tooltip {...tip} labelFormatter={(v) => formatDate(v)} />
                    <Area type="monotone" dataKey="applications" name="Applications" stroke="#0e7c66" strokeWidth={2} fill="url(#g)" /></AreaChart></ResponsiveContainer></div></section>
                <section className="card p-5"><h2 className="font-semibold">Hiring funnel</h2><p className="text-xs text-muted">Applicants who reached each stage or beyond</p>
                  <div className="mt-4 h-64" role="img" aria-label="Bar chart of the hiring funnel"><ResponsiveContainer width="100%" height="100%"><BarChart data={funnel} layout="vertical" margin={{ left: 10, right: 16 }}>
                    <CartesianGrid horizontal={false} stroke="#ebf0ee" /><XAxis type="number" {...axis} allowDecimals={false} /><YAxis type="category" dataKey="label" {...axis} width={80} /><Tooltip {...tip} cursor={{ fill: '#f4f6f5' }} />
                    <Bar dataKey="count" name="Applicants" fill="#123b33" radius={[0, 6, 6, 0]} barSize={20} /></BarChart></ResponsiveContainer></div></section>
                <section className="card p-5"><h2 className="font-semibold">Match score distribution</h2><p className="text-xs text-muted">How well your applicants fit their jobs</p>
                  <div className="mt-4 h-60" role="img" aria-label="Bar chart of match score distribution"><ResponsiveContainer width="100%" height="100%"><BarChart data={d.scoreDistribution} margin={{ left: -20 }}>
                    <CartesianGrid vertical={false} stroke="#ebf0ee" /><XAxis dataKey="range" {...axis} /><YAxis {...axis} allowDecimals={false} /><Tooltip {...tip} cursor={{ fill: '#f4f6f5' }} />
                    <Bar dataKey="count" name="Applicants" radius={[6, 6, 0, 0]} barSize={44}>{d.scoreDistribution.map((_, i) => <Cell key={i} fill={colors[i]} />)}</Bar></BarChart></ResponsiveContainer></div></section>
                <section className="card p-5"><h2 className="font-semibold">Most common skill gaps</h2><p className="text-xs text-muted">Skills your applicants are missing most often</p>
                  {d.topMissingSkills.length === 0 ? <p className="mt-6 text-sm text-muted">No gaps found yet.</p> : (
                    <ul className="mt-4 space-y-3">{d.topMissingSkills.map((s) => { const max = d.topMissingSkills[0].count; return (
                      <li key={s.skill} className="text-sm"><div className="mb-1 flex justify-between"><span>{s.skill}</span><span className="text-muted">{s.count} applicant{s.count > 1 ? 's' : ''}</span></div><div className="h-1.5 rounded-full bg-line-soft"><div className="h-full rounded-full bg-rose" style={{ width: `${(s.count / max) * 100}%` }} /></div></li>); })}</ul>)}
                </section>
              </div>
              <section className="card overflow-x-auto"><div className="border-b border-line px-5 py-4"><h2 className="font-semibold">Job performance</h2></div>
                <table className="w-full min-w-[640px]"><thead className="border-b border-line bg-paper"><tr><th className="th">Job</th><th className="th">Status</th><th className="th text-right">Views</th><th className="th text-right">Applicants</th><th className="th text-right">View → apply</th><th className="th text-right">Shortlisted</th><th className="th text-right">Avg match</th></tr></thead>
                  <tbody className="divide-y divide-line-soft">{d.perJob.map((j) => (<tr key={j.id}><td className="td font-medium">{j.title}</td><td className="td"><StatusBadge status={j.status} /></td><td className="td text-right">{j.views}</td><td className="td text-right">{j.applicants}</td><td className="td text-right">{j.conversion}%</td><td className="td text-right">{j.shortlisted}</td><td className="td text-right">{j.avgScore != null ? `${j.avgScore}%` : '—'}</td></tr>))}</tbody></table></section>
            </div>
          );
        }}
      </Async>
    </div>
  );
}

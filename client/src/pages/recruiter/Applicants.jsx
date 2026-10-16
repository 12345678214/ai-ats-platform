import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, KanbanSquare, MessageSquare, Pencil, Sparkles, Table2, Users } from 'lucide-react';
import { api, parseError } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { useAsync, useDebounced } from '../../lib/useAsync';
import { PIPELINE, STATUS_META, timeAgo } from '../../lib/format';
import { Async, EmptyState, SkeletonRows } from '../../components/ui/States';
import { Avatar, SearchInput, SkillChip } from '../../components/ui/Misc';
import { StatusBadge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Field';
import MatchRing from '../../components/ui/MatchRing';
import Pagination from '../../components/ui/Pagination';
import Button from '../../components/ui/Button';
import ApplicantDrawer from './ApplicantDrawer';

function MatchPreview({ match }) {
  if (!match || match.status === 'PENDING') return <span className="text-xs text-muted">Scoring…</span>;
  if (match.status === 'FAILED') return <span className="text-xs text-rose">Scoring failed</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {match.matchedSkills.slice(0, 3).map((s) => <SkillChip key={s} kind="matched">{s}</SkillChip>)}
      {match.missingSkills.slice(0, 2).map((s) => <SkillChip key={s} kind="missing">{s}</SkillChip>)}
      {match.matchedSkills.length + match.missingSkills.length > 5 && <span className="px-1 text-xs text-muted">…</span>}
    </div>
  );
}

function Pipeline({ items, onOpen, onMove }) {
  const [over, setOver] = useState(null);
  const [dragId, setDragId] = useState(null);
  const columns = useMemo(() => PIPELINE.map((s) => ({ status: s, items: items.filter((i) => i.status === s) })), [items]);
  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:-mx-8 sm:px-8" role="list" aria-label="Applicant pipeline">
      {columns.map((col) => (
        <section key={col.status} role="listitem" aria-label={`${STATUS_META[col.status].label}, ${col.items.length} applicants`}
          onDragOver={(e) => { e.preventDefault(); setOver(col.status); }} onDragLeave={() => setOver((o) => (o === col.status ? null : o))}
          onDrop={() => { setOver(null); if (dragId) onMove(dragId, col.status); setDragId(null); }}
          className={`w-[272px] shrink-0 rounded-xl border p-2.5 transition-colors ${over === col.status ? 'border-brand bg-brand-50' : 'border-line bg-line-soft/60'}`}>
          <header className="mb-2.5 flex items-center justify-between px-1.5"><h3 className="text-sm font-semibold">{STATUS_META[col.status].label}</h3><span className="rounded-full bg-white px-2 py-0.5 text-xs text-muted">{col.items.length}</span></header>
          <div className="min-h-24 space-y-2">
            {col.items.map((a) => (
              <article key={a.id} draggable onDragStart={() => setDragId(a.id)} onDragEnd={() => setDragId(null)}
                className={`card cursor-grab p-3 transition-shadow hover:shadow-md active:cursor-grabbing ${dragId === a.id ? 'opacity-40' : ''}`}>
                <button onClick={() => onOpen(a.id)} className="block w-full text-left">
                  <div className="flex items-start gap-2.5"><Avatar name={a.candidate.name} size={32} />
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{a.candidate.name}</p><p className="truncate text-xs text-muted">{a.candidate.headline || '—'}</p></div>
                    <MatchRing score={a.match?.score} pending={a.match?.status !== 'COMPLETED'} size={38} stroke={4} /></div>
                  <div className="mt-2.5"><MatchPreview match={a.match} /></div>
                  <p className="mt-2 flex items-center justify-between text-xs text-faint"><span>{timeAgo(a.appliedAt)}</span>{a.noteCount > 0 && <span className="inline-flex items-center gap-1"><MessageSquare className="h-3 w-3" />{a.noteCount}</span>}</p>
                </button>
                <label className="sr-only" htmlFor={`mv-${a.id}`}>Move {a.candidate.name}</label>
                <select id={`mv-${a.id}`} className="mt-2 w-full rounded-md border border-line bg-white px-1.5 py-1 text-xs text-muted lg:hidden" value={a.status} onChange={(e) => onMove(a.id, e.target.value)}>{PIPELINE.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}</select>
              </article>
            ))}
            {col.items.length === 0 && <p className="px-2 py-6 text-center text-xs text-faint">Drop applicants here</p>}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function Applicants() {
  const { id } = useParams();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState('table');
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [status, setStatus] = useState('');
  const [minScore, setMinScore] = useState('');
  const [sort, setSort] = useState('match');
  const [page, setPage] = useState(1);
  const [ranking, setRanking] = useState(false);
  const job = useAsync(() => api.get(`/recruiter/jobs/${id}`).then((r) => r.data.job), [id]);
  const limit = view === 'board' ? 100 : 15;
  const state = useAsync(() => api.get(`/recruiter/jobs/${id}/applications`, { params: { q: dq || undefined, status: view === 'board' ? undefined : status || undefined, minScore: minScore || undefined, sort, page: view === 'board' ? 1 : page, limit } }).then((r) => r.data), [id, dq, status, minScore, sort, page, view]);
  const openId = params.get('application');
  const setOpen = (v) => { const n = new URLSearchParams(params); if (v) n.set('application', v); else n.delete('application'); setParams(n, { replace: true }); };

  // Auto-refresh while any applicant is still waiting for its AI score.
  const pending = state.data?.items.some((i) => !i.match || i.match.status === 'PENDING');
  useAsync(async () => { if (pending) { await new Promise((r) => setTimeout(r, 2500)); state.reload({ silent: true }); } return null; }, [pending, state.data]);

  const move = async (appId, next) => {
    const prev = state.data;
    state.setData({ ...prev, items: prev.items.map((i) => (i.id === appId ? { ...i, status: next } : i)) });
    try { await api.patch(`/recruiter/applications/${appId}/status`, { status: next }); toast.success(`Moved to ${STATUS_META[next].label}`); state.reload({ silent: true }); }
    catch (e) { state.setData(prev); toast.error(parseError(e).message); }
  };
  const rerank = async () => {
    setRanking(true);
    try { const { data } = await api.post(`/recruiter/jobs/${id}/rank`); toast.success(data.message); state.reload({ silent: true }); } catch (e) { toast.error(parseError(e).message); } finally { setRanking(false); }
  };

  const counts = state.data?.statusCounts || {};
  const total = Object.entries(counts).filter(([k]) => k !== 'WITHDRAWN').reduce((s, [, n]) => s + n, 0);
  return (
    <div>
      <Link to="/recruiter/jobs" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />All jobs</Link>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0"><h1 className="text-2xl font-semibold sm:text-[28px]">{job.data?.title || 'Applicants'}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">{job.data && <StatusBadge status={job.data.status} />}<span>{total} applicant{total === 1 ? '' : 's'}</span>{job.data && <span>· {job.data.skills.length} skills in scoring</span>}</p></div>
        <div className="flex flex-wrap gap-2"><Button variant="secondary" icon={Pencil} to={`/recruiter/jobs/${id}/edit`}>Edit job</Button><Button variant="secondary" icon={Sparkles} loading={ranking} onClick={rerank}>Re-run AI ranking</Button></div>
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search name, email, headline" className="lg:w-80" />
        <Select aria-label="Minimum match score" value={minScore} onChange={(e) => { setMinScore(e.target.value); setPage(1); }} placeholder="Any match" className="lg:w-40" options={[{ value: '75', label: 'Strong (75+)' }, { value: '55', label: 'Good (55+)' }, { value: '35', label: 'Fair (35+)' }]} />
        <Select aria-label="Sort applicants" value={sort} onChange={(e) => setSort(e.target.value)} className="lg:w-44" options={[{ value: 'match', label: 'Best match first' }, { value: 'newest', label: 'Newest first' }, { value: 'oldest', label: 'Oldest first' }, { value: 'name', label: 'Name A–Z' }]} />
        <div className="inline-flex rounded-lg border border-line bg-white p-0.5 lg:ml-auto" role="group" aria-label="View">
          {[['table', 'Table', Table2], ['board', 'Pipeline', KanbanSquare]].map(([v, label, Icon]) => (
            <button key={v} onClick={() => setView(v)} aria-pressed={view === v} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${view === v ? 'bg-forest text-white' : 'text-muted hover:text-ink'}`}><Icon className="h-4 w-4" />{label}</button>
          ))}
        </div>
      </div>

      {view === 'table' && (
        <div className="mb-4 flex gap-1.5 overflow-x-auto" role="tablist" aria-label="Filter by status">
          {[['', 'All', total], ...PIPELINE.map((s) => [s, STATUS_META[s].label, counts[s] || 0])].map(([s, label, n]) => (
            <button key={s} role="tab" aria-selected={status === s} onClick={() => { setStatus(s); setPage(1); }} className={`whitespace-nowrap rounded-full border px-3 py-1 text-sm ${status === s ? 'border-forest bg-forest text-white' : 'border-line bg-white text-muted hover:text-ink'}`}>{label} <span className={status === s ? 'text-white/70' : 'text-faint'}>{n}</span></button>
          ))}
        </div>
      )}

      <Async state={state} skeleton={<SkeletonRows rows={6} className="h-[72px]" />} emptyWhen={(d) => d.items.length === 0}
        empty={<EmptyState icon={Users} title={dq || status || minScore ? 'No applicants match these filters' : 'No applicants yet'} description={dq || status || minScore ? 'Try clearing a filter.' : 'Applicants appear here as soon as they apply, already scored against this job.'} />}>
        {(d) => view === 'board' ? <Pipeline items={d.items} onOpen={setOpen} onMove={move} /> : (
          <>
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[860px]">
                <thead className="border-b border-line bg-paper"><tr><th className="th w-16">Match</th><th className="th">Candidate</th><th className="th">Skill fit</th><th className="th">Applied</th><th className="th">Status</th></tr></thead>
                <tbody className="divide-y divide-line-soft">
                  {d.items.map((a) => (
                    <tr key={a.id} onClick={() => setOpen(a.id)} className={`cursor-pointer hover:bg-paper ${openId === a.id ? 'bg-brand-50/50' : ''}`}>
                      <td className="td"><MatchRing score={a.match?.score} pending={a.match?.status !== 'COMPLETED'} size={44} stroke={4} /></td>
                      <td className="td"><button className="flex items-center gap-3 text-left" onClick={(e) => { e.stopPropagation(); setOpen(a.id); }}><Avatar name={a.candidate.name} /><span className="min-w-0"><span className="block truncate text-sm font-medium hover:text-brand">{a.candidate.name}</span><span className="block truncate text-xs text-muted">{a.candidate.headline || a.candidate.email} · {a.candidate.yearsExperience} yrs</span></span></button></td>
                      <td className="td max-w-[320px]"><MatchPreview match={a.match} /></td>
                      <td className="td whitespace-nowrap text-muted">{timeAgo(a.appliedAt)}</td>
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
      <ApplicantDrawer id={openId} onClose={() => setOpen(null)} onChanged={() => state.reload({ silent: true })} />
    </div>
  );
}

import { useState } from 'react';
import { CalendarPlus, Download, ExternalLink, Github, Linkedin, Mail, MapPin, MessageSquarePlus, RefreshCw, ThumbsDown, Trophy, UserCheck, Video } from 'lucide-react';
import { api, parseError } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../lib/useAsync';
import { PIPELINE, STATUS_META, formatDate, formatDateTime, scoreTone, timeAgo, toInputDateTime } from '../../lib/format';
import { Drawer, Modal } from '../../components/ui/Modal';
import { PageLoader } from '../../components/ui/States';
import { Avatar, SkillChip, Tabs } from '../../components/ui/Misc';
import { StatusBadge } from '../../components/ui/Badge';
import { Input, Select, Textarea } from '../../components/ui/Field';
import MatchRing from '../../components/ui/MatchRing';
import Button from '../../components/ui/Button';

function ScheduleModal({ applicationId, open, onClose, onDone }) {
  const toast = useToast();
  const [form, setForm] = useState({ scheduledAt: toInputDateTime(Date.now() + 2 * 86400000), durationMins: 45, mode: 'VIDEO', location: '', notes: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async () => {
    setBusy(true); setErrors({});
    try {
      await api.post(`/recruiter/applications/${applicationId}/interviews`, { ...form, scheduledAt: new Date(form.scheduledAt).toISOString(), durationMins: Number(form.durationMins), location: form.location || undefined, notes: form.notes || undefined });
      toast.success('Interview scheduled. The candidate has been notified.'); onDone();
    } catch (e) { const p = parseError(e); setErrors(p.fields); if (!Object.keys(p.fields).length) toast.error(p.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Schedule interview" description="The candidate is notified immediately."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={submit} icon={CalendarPlus}>Send invite</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Date & time" type="datetime-local" value={form.scheduledAt} onChange={set('scheduledAt')} error={errors.scheduledAt} />
        <Input label="Duration (minutes)" type="number" min="10" step="5" value={form.durationMins} onChange={set('durationMins')} error={errors.durationMins} />
        <Select label="Format" value={form.mode} onChange={set('mode')} options={[{ value: 'VIDEO', label: 'Video call' }, { value: 'PHONE', label: 'Phone' }, { value: 'ONSITE', label: 'On-site' }]} />
        <Input label="Link or address" value={form.location} onChange={set('location')} placeholder="https://meet… or office address" error={errors.location} />
        <div className="sm:col-span-2"><Textarea label="Notes for the candidate" rows={3} value={form.notes} onChange={set('notes')} /></div>
      </div>
    </Modal>
  );
}

function MatchPanel({ match, job, onRescore, rescoring }) {
  if (!match || match.status === 'PENDING') return <p className="rounded-lg bg-line-soft p-4 text-sm text-muted">The score is still being calculated. It appears here within a few seconds.</p>;
  if (match.status === 'FAILED') return (
    <div className="rounded-lg bg-rose-50 p-4 text-sm"><p className="font-medium text-rose">Scoring failed</p><p className="mt-1 text-muted">{match.error}</p><Button className="mt-3" size="sm" variant="secondary" icon={RefreshCw} loading={rescoring} onClick={onRescore}>Retry scoring</Button></div>
  );
  const tone = scoreTone(match.score);
  const parts = [['Skills', match.skillScore, '60%'], ['Experience', match.experienceScore, '20%'], ['Education', match.educationScore, '10%'], ['Text similarity', match.textScore, '10%']];
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4 rounded-xl p-4" style={{ background: tone.bg }}>
        <MatchRing score={match.score} size={72} stroke={6} />
        <div><p className="font-display text-xl font-semibold" style={{ color: tone.color }}>{tone.label} match</p><p className="mt-1 text-sm text-ink/80">{match.summary}</p></div>
      </div>
      <div className="card p-4"><h3 className="mb-3 text-sm font-semibold">How the score is made up</h3>
        <ul className="space-y-3">{parts.map(([label, v, w]) => (
          <li key={label}><div className="mb-1 flex justify-between text-sm"><span>{label} <span className="text-xs text-faint">weight {w}</span></span><span className="font-medium">{Math.round(v)}</span></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-line-soft"><div className="h-full rounded-full" style={{ width: `${v}%`, background: scoreTone(v).color }} /></div></li>))}</ul></div>
      <div className="card space-y-4 p-4">
        <div><h3 className="mb-2 text-sm font-semibold">Matched skills ({match.matchedSkills.length})</h3><div className="flex flex-wrap gap-1.5">{match.matchedSkills.length ? match.matchedSkills.map((s) => <SkillChip key={s} kind="matched">{s}</SkillChip>) : <span className="text-sm text-muted">None</span>}</div></div>
        {match.partialSkills.length > 0 && <div><h3 className="mb-2 text-sm font-semibold">Related experience</h3><div className="flex flex-wrap gap-1.5">{match.partialSkills.map((s) => <SkillChip key={s} kind="partial">{s}</SkillChip>)}</div></div>}
        <div><h3 className="mb-2 text-sm font-semibold">Missing skills ({match.missingSkills.length})</h3><div className="flex flex-wrap gap-1.5">{match.missingSkills.length ? match.missingSkills.map((s) => <SkillChip key={s} kind="missing">{s}</SkillChip>) : <span className="text-sm text-muted">None, all job skills were found.</span>}</div></div>
        {match.extraSkills.length > 0 && <div><h3 className="mb-2 text-sm font-semibold">Also brings</h3><div className="flex flex-wrap gap-1.5">{match.extraSkills.slice(0, 12).map((s) => <SkillChip key={s}>{s}</SkillChip>)}</div></div>}
      </div>
      <Button variant="ghost" size="sm" icon={RefreshCw} loading={rescoring} onClick={onRescore}>Re-score this applicant</Button>
    </div>
  );
}

export default function ApplicantDrawer({ id, onClose, onChanged }) {
  const toast = useToast();
  const state = useAsync(() => (id ? api.get(`/recruiter/applications/${id}`).then((r) => r.data.application) : Promise.resolve(null)), [id]);
  const [tab, setTab] = useState('overview');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const [schedule, setSchedule] = useState(false);
  const a = state.data;

  const refresh = () => { state.reload({ silent: true }); onChanged(); };
  const run = async (key, fn, ok) => { setBusy(key); try { await fn(); if (ok) toast.success(ok); refresh(); } catch (e) { toast.error(parseError(e).message); } finally { setBusy(''); } };
  const setStatus = (status) => run(status, () => api.patch(`/recruiter/applications/${id}/status`, { status }), `Moved to ${STATUS_META[status].label}`);
  const openResume = async () => {
    try { const res = await api.get(`/resumes/${a.resume.id}/file`, { responseType: 'blob' }); const url = URL.createObjectURL(res.data); window.open(url, '_blank', 'noopener'); setTimeout(() => URL.revokeObjectURL(url), 60000); }
    catch (e) { toast.error(parseError(e).message); }
  };

  const c = a?.candidate;
  return (
    <Drawer open={!!id} onClose={() => { setTab('overview'); onClose(); }} title={c?.name || 'Applicant'} subtitle={a ? `${a.job.title} · applied ${timeAgo(a.appliedAt)}` : ''} width="max-w-3xl">
      {state.loading && !a ? <PageLoader /> : state.error ? <p className="p-5 text-sm text-rose">{state.error}</p> : a && (
        <div>
          <div className="space-y-4 border-b border-line bg-white px-5 py-4">
            <div className="flex items-center gap-4">
              <Avatar name={c.name} size={52} />
              <div className="min-w-0 flex-1"><p className="truncate font-semibold">{c.headline || 'No headline'}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted"><a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 hover:text-brand"><Mail className="h-3.5 w-3.5" />{c.email}</a>{c.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{c.location}</span>}</p></div>
              <MatchRing score={a.match?.score} pending={a.match?.status !== 'COMPLETED'} size={56} showLabel />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={a.status} />
              {a.status !== 'WITHDRAWN' && <>
                <span className="mx-1 h-5 w-px bg-line" />
                <Button size="sm" variant="secondary" icon={UserCheck} loading={busy === 'SHORTLISTED'} disabled={a.status === 'SHORTLISTED'} onClick={() => setStatus('SHORTLISTED')}>Shortlist</Button>
                <Button size="sm" variant="secondary" icon={CalendarPlus} onClick={() => setSchedule(true)}>Schedule interview</Button>
                <Button size="sm" variant="dangerOutline" icon={ThumbsDown} loading={busy === 'REJECTED'} disabled={a.status === 'REJECTED'} onClick={() => setStatus('REJECTED')}>Reject</Button>
                <select aria-label="Change status" className="input !h-8 !w-auto !py-0 text-[13px]" value={a.status} onChange={(e) => setStatus(e.target.value)}>{PIPELINE.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}</select>
              </>}
            </div>
          </div>
          <div className="bg-white px-5"><Tabs value={tab} onChange={setTab} tabs={[{ value: 'overview', label: 'Overview' }, { value: 'match', label: 'AI match' }, { value: 'notes', label: 'Notes', count: a.notes.length }, { value: 'activity', label: 'Activity' }]} /></div>

          <div className="space-y-5 p-5">
            {tab === 'overview' && (<>
              {c.summary && <section className="card p-4"><h3 className="mb-2 text-sm font-semibold">Summary</h3><p className="text-sm text-muted">{c.summary}</p></section>}
              {a.coverLetter && <section className="card p-4"><h3 className="mb-2 text-sm font-semibold">Cover letter</h3><p className="whitespace-pre-line text-sm text-muted">{a.coverLetter}</p></section>}
              <section className="card p-4"><h3 className="mb-3 text-sm font-semibold">Skills ({c.skills.length})</h3><div className="flex flex-wrap gap-1.5">{c.skills.map((s) => <SkillChip key={s.name} kind={a.match?.matchedSkills?.includes(s.name) ? 'matched' : 'neutral'}>{s.name}</SkillChip>)}</div></section>
              <div className="grid gap-5 sm:grid-cols-2">
                <section className="card p-4"><h3 className="mb-3 text-sm font-semibold">Experience · {c.yearsExperience} yrs</h3>{c.experience.length ? <ul className="space-y-3">{c.experience.map((x, i) => <li key={i} className="text-sm"><p className="font-medium">{x.title || x.company}</p><p className="text-muted">{[x.company, x.period].filter(Boolean).join(' · ')}</p></li>)}</ul> : <p className="text-sm text-muted">None listed.</p>}</section>
                <section className="card p-4"><h3 className="mb-3 text-sm font-semibold">Education</h3>{c.education.length ? <ul className="space-y-3">{c.education.map((x, i) => <li key={i} className="text-sm"><p className="font-medium">{x.degree}</p><p className="text-muted">{[x.institution, x.year].filter(Boolean).join(' · ')}</p></li>)}</ul> : <p className="text-sm text-muted">None listed.</p>}</section>
              </div>
              <section className="card flex flex-wrap items-center gap-3 p-4">
                {a.resume ? <Button variant="secondary" size="sm" icon={Download} onClick={openResume}>View resume ({a.resume.originalName})</Button> : <span className="text-sm text-muted">Resume was removed by the candidate.</span>}
                {c.linkedinUrl && <a className="inline-flex items-center gap-1.5 text-sm text-brand hover:underline" href={c.linkedinUrl} target="_blank" rel="noreferrer noopener"><Linkedin className="h-4 w-4" />LinkedIn</a>}
                {c.githubUrl && <a className="inline-flex items-center gap-1.5 text-sm text-brand hover:underline" href={c.githubUrl} target="_blank" rel="noreferrer noopener"><Github className="h-4 w-4" />GitHub</a>}
                {c.portfolioUrl && <a className="inline-flex items-center gap-1.5 text-sm text-brand hover:underline" href={c.portfolioUrl} target="_blank" rel="noreferrer noopener"><ExternalLink className="h-4 w-4" />Portfolio</a>}
              </section>
            </>)}

            {tab === 'match' && <MatchPanel match={a.match} job={a.job} rescoring={busy === 'rescore'} onRescore={() => run('rescore', () => api.post(`/recruiter/applications/${id}/rescore`), 'Score refreshed')} />}

            {tab === 'notes' && (<>
              <div className="card p-4"><Textarea label="Add a private note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Interview feedback, concerns, next steps…" hint="Only recruiters on this job can see notes. Candidates never see them." />
                <div className="mt-3 flex justify-end"><Button size="sm" icon={MessageSquarePlus} disabled={!note.trim()} loading={busy === 'note'} onClick={() => run('note', async () => { await api.post(`/recruiter/applications/${id}/notes`, { content: note }); setNote(''); }, 'Note added')}>Add note</Button></div></div>
              {a.notes.length === 0 ? <p className="text-center text-sm text-muted">No notes yet.</p> : <ul className="space-y-3">{a.notes.map((n) => <li key={n.id} className="card p-4"><p className="whitespace-pre-line text-sm">{n.content}</p><p className="mt-2 text-xs text-muted">{n.author.name} · {timeAgo(n.createdAt)}</p></li>)}</ul>}
            </>)}

            {tab === 'activity' && (<>
              <section className="card p-4"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Interviews</h3><Button size="sm" variant="secondary" icon={CalendarPlus} onClick={() => setSchedule(true)}>Schedule</Button></div>
                {a.interviews.length === 0 ? <p className="text-sm text-muted">No interviews scheduled.</p> : <ul className="space-y-2">{a.interviews.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3"><div><p className="text-sm font-medium">{formatDateTime(i.scheduledAt)}</p><p className="flex items-center gap-1 text-xs text-muted"><Video className="h-3 w-3" />{i.durationMins} min · {i.mode.toLowerCase()}</p></div>
                    <div className="flex items-center gap-2"><StatusBadge status={i.status} />{i.status === 'SCHEDULED' && <><Button size="sm" variant="ghost" onClick={() => run('i' + i.id, () => api.patch(`/recruiter/interviews/${i.id}`, { status: 'COMPLETED' }), 'Marked completed')}>Complete</Button><Button size="sm" variant="ghost" onClick={() => run('c' + i.id, () => api.patch(`/recruiter/interviews/${i.id}`, { status: 'CANCELLED' }), 'Interview cancelled')}>Cancel</Button></>}</div></li>))}</ul>}
              </section>
              <section className="card p-4"><h3 className="mb-3 text-sm font-semibold">Status history</h3>
                <ol className="space-y-2.5">{[...a.history].reverse().map((h) => <li key={h.id} className="flex items-center justify-between text-sm"><span>{h.fromStatus ? `${STATUS_META[h.fromStatus].label} → ` : ''}<b>{STATUS_META[h.toStatus].label}</b></span><span className="text-xs text-muted">{formatDate(h.createdAt, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span></li>)}</ol></section>
            </>)}
          </div>
          <ScheduleModal applicationId={id} open={schedule} onClose={() => setSchedule(false)} onDone={() => { setSchedule(false); refresh(); }} />
        </div>
      )}
    </Drawer>
  );
}

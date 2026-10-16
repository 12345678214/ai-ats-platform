import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileUp, Loader2, Plus, RefreshCw, Star, Trash2 } from 'lucide-react';
import { api, parseError } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../lib/useAsync';
import { formatDate } from '../../lib/format';
import { Async, SkeletonRows } from '../../components/ui/States';
import { PageHeader, SkillInput, SkillChip } from '../../components/ui/Misc';
import { Badge } from '../../components/ui/Badge';
import { ConfirmDialog } from '../../components/ui/Modal';
import { Input, Textarea } from '../../components/ui/Field';
import Button from '../../components/ui/Button';

const blankEdu = { degree: '', field: '', institution: '', year: '' };
const blankExp = { title: '', company: '', period: '', description: '' };

function Section({ title, description, children, action }) {
  return (
    <section className="card"><div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4"><div><h2 className="font-semibold">{title}</h2>{description && <p className="mt-0.5 text-sm text-muted">{description}</p>}</div>{action}</div><div className="p-5">{children}</div></section>
  );
}

function ResumeSection({ profile, onChanged }) {
  const toast = useToast();
  const input = useRef(null);
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [del, setDel] = useState(null);
  const resumes = useAsync(() => api.get('/candidate/resumes').then((r) => r.data.resumes), []);

  const upload = async (file) => {
    if (!file) return;
    if (!/\.(pdf|docx)$/i.test(file.name)) return toast.error('Please choose a PDF or DOCX file');
    if (file.size > 5 * 1024 * 1024) return toast.error('That file is over the 5 MB limit');
    const form = new FormData();
    form.append('resume', file);
    setUploading(true);
    try {
      const { data } = await api.post('/candidate/resumes', form);
      if (data.resume.parseStatus === 'PARSED') toast.success(`Resume parsed. Found ${data.resume.parsedData?.skills?.length || 0} skills.`);
      else toast.info(`Uploaded, but parsing failed: ${data.resume.parseError}`);
      resumes.reload({ silent: true }); onChanged();
    } catch (e) { toast.error(parseError(e).message); } finally { setUploading(false); if (input.current) input.current.value = ''; }
  };
  const act = async (fn, ok) => { try { await fn(); if (ok) toast.success(ok); resumes.reload({ silent: true }); onChanged(); } catch (e) { toast.error(parseError(e).message); } };
  const download = async (r) => {
    try {
      const res = await api.get(`/resumes/${r.id}/file`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { toast.error(parseError(e).message); }
  };

  return (
    <Section title="Resume" description="We read your resume to extract skills, education and experience. Recruiters see it when you apply.">
      <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files[0]); }}
        className={`flex flex-col items-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${drag ? 'border-brand bg-brand-50' : 'border-line'}`}>
        {uploading ? <><Loader2 className="h-7 w-7 animate-spin text-brand" /><p className="mt-3 text-sm font-medium">Reading your resume…</p></> : (
          <><FileUp className="h-7 w-7 text-brand" /><p className="mt-3 text-sm font-medium">Drop your resume here, or <button type="button" className="text-brand underline" onClick={() => input.current?.click()}>browse</button></p><p className="mt-1 text-xs text-muted">PDF or DOCX, up to 5 MB</p></>
        )}
        <input ref={input} type="file" accept=".pdf,.docx" className="sr-only" aria-label="Upload resume" onChange={(e) => upload(e.target.files[0])} />
      </div>
      <div className="mt-4">
        <Async state={resumes} skeleton={<SkeletonRows rows={2} className="h-14" />}>
          {(list) => list.length === 0 ? <p className="text-sm text-muted">No resumes uploaded yet.</p> : (
            <ul className="divide-y divide-line-soft rounded-lg border border-line">
              {list.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1"><p className="flex items-center gap-2 truncate text-sm font-medium">{r.originalName}{r.isPrimary && <Badge tone="brand">Primary</Badge>}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">{formatDate(r.createdAt)} · {(r.sizeBytes / 1024).toFixed(0)} KB ·{' '}
                      {r.parseStatus === 'PARSED' ? <span className="inline-flex items-center gap-1 text-brand"><CheckCircle2 className="h-3.5 w-3.5" />Parsed, {r.parsedData?.skills?.length || 0} skills</span>
                        : <span className="inline-flex items-center gap-1 text-rose" title={r.parseError}><AlertTriangle className="h-3.5 w-3.5" />Parsing failed</span>}</p></div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" icon={Download} onClick={() => download(r)} aria-label="View resume" />
                    {r.parseStatus === 'FAILED' && <Button variant="ghost" size="sm" icon={RefreshCw} onClick={() => act(() => api.post(`/candidate/resumes/${r.id}/reparse`), 'Reparsed')} aria-label="Retry parsing" />}
                    {!r.isPrimary && <Button variant="ghost" size="sm" icon={Star} onClick={() => act(() => api.patch(`/candidate/resumes/${r.id}/primary`), 'Primary resume updated')} aria-label="Make primary" />}
                    <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setDel(r)} aria-label="Delete resume" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Async>
      </div>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} danger title="Delete this resume?" message={`“${del?.originalName}” will be removed. Applications that used it keep their history.`} confirmLabel="Delete"
        onConfirm={async () => { await act(() => api.delete(`/candidate/resumes/${del.id}`), 'Resume deleted'); setDel(null); }} />
    </Section>
  );
}

export default function Profile() {
  const toast = useToast();
  const state = useAsync(() => api.get('/candidate/profile').then((r) => r.data.profile), []);
  const [form, setForm] = useState(null);
  const [skills, setSkills] = useState([]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [savingSkills, setSavingSkills] = useState(false);

  useEffect(() => {
    const p = state.data;
    if (!p) return;
    setForm({
      name: p.name, headline: p.headline || '', phone: p.phone || '', location: p.location || '', summary: p.summary || '', yearsExperience: p.yearsExperience ?? 0,
      linkedinUrl: p.linkedinUrl || '', githubUrl: p.githubUrl || '', portfolioUrl: p.portfolioUrl || '', openToWork: p.openToWork,
      education: p.education?.length ? p.education : [], experience: p.experience?.length ? p.experience : [],
    });
    setSkills(p.skills.map((s) => s.name));
  }, [state.data]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setItem = (key, i, field, value) => setForm({ ...form, [key]: form[key].map((it, idx) => (idx === i ? { ...it, [field]: value } : it)) });

  const save = async () => {
    setSaving(true); setErrors({});
    try { await api.put('/candidate/profile', { ...form, yearsExperience: Number(form.yearsExperience) || 0 }); toast.success('Profile saved'); state.reload({ silent: true }); }
    catch (e) { const p = parseError(e); setErrors(p.fields); toast.error(Object.keys(p.fields).length ? 'Please fix the highlighted fields' : p.message); } finally { setSaving(false); }
  };
  const saveSkills = async () => {
    setSavingSkills(true);
    try { await api.put('/candidate/skills', { skills }); toast.success('Skills saved'); state.reload({ silent: true }); } catch (e) { toast.error(parseError(e).message); } finally { setSavingSkills(false); }
  };

  return (
    <div>
      <PageHeader title="Profile & resume" description="A complete profile helps recruiters find and rank you." />
      <Async state={state} skeleton={<SkeletonRows rows={4} className="h-40" />}>
        {(p) => form && (
          <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
            <div className="space-y-6 xl:order-1">
              <ResumeSection profile={p} onChanged={() => state.reload({ silent: true })} />

              <Section title="Skills" description="Skills pulled from your resume are included. Add or remove anything." action={<Button size="sm" loading={savingSkills} onClick={saveSkills}>Save skills</Button>}>
                <SkillInput value={skills} onChange={setSkills} hint="Press Enter to add. Suggestions come from skills already used on the platform." />
                {p.skills.some((s) => s.source === 'RESUME') && <p className="mt-3 text-xs text-muted">Found in your resume: {p.skills.filter((s) => s.source === 'RESUME').map((s) => s.name).join(', ')}</p>}
              </Section>

              <Section title="About you" action={<Button size="sm" loading={saving} onClick={save}>Save changes</Button>}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Full name" value={form.name} onChange={set('name')} error={errors.name} />
                  <Input label="Headline" value={form.headline} onChange={set('headline')} placeholder="e.g. Full Stack Developer" error={errors.headline} />
                  <Input label="Phone" value={form.phone} onChange={set('phone')} error={errors.phone} />
                  <Input label="Location" value={form.location} onChange={set('location')} placeholder="City, country" error={errors.location} />
                  <Input label="Years of experience" type="number" min="0" step="0.5" value={form.yearsExperience} onChange={set('yearsExperience')} error={errors.yearsExperience} />
                  <label className="flex items-center gap-2.5 pt-7 text-sm"><input type="checkbox" checked={form.openToWork} onChange={(e) => setForm({ ...form, openToWork: e.target.checked })} className="h-4 w-4 accent-[#0e7c66]" />Open to new opportunities</label>
                  <div className="sm:col-span-2"><Textarea label="Summary" value={form.summary} onChange={set('summary')} maxLength={2000} error={errors.summary} hint="Two or three sentences on what you do best." /></div>
                  <Input label="LinkedIn" value={form.linkedinUrl} onChange={set('linkedinUrl')} placeholder="https://" error={errors.linkedinUrl} />
                  <Input label="GitHub" value={form.githubUrl} onChange={set('githubUrl')} placeholder="https://" error={errors.githubUrl} />
                  <div className="sm:col-span-2"><Input label="Portfolio" value={form.portfolioUrl} onChange={set('portfolioUrl')} placeholder="https://" error={errors.portfolioUrl} /></div>
                </div>
              </Section>

              <Section title="Experience" action={<Button variant="secondary" size="sm" icon={Plus} onClick={() => setForm({ ...form, experience: [...form.experience, { ...blankExp }] })}>Add</Button>}>
                {form.experience.length === 0 ? <p className="text-sm text-muted">No experience added. It is filled in automatically when your resume is parsed.</p> : (
                  <div className="space-y-4">{form.experience.map((x, i) => (
                    <div key={i} className="rounded-lg border border-line p-4"><div className="grid gap-3 sm:grid-cols-3">
                      <Input label="Title" value={x.title} onChange={(e) => setItem('experience', i, 'title', e.target.value)} />
                      <Input label="Company" value={x.company} onChange={(e) => setItem('experience', i, 'company', e.target.value)} />
                      <Input label="Period" value={x.period} placeholder="Jan 2022 – Present" onChange={(e) => setItem('experience', i, 'period', e.target.value)} /></div>
                      <div className="mt-3 flex justify-end"><Button variant="ghost" size="sm" icon={Trash2} onClick={() => setForm({ ...form, experience: form.experience.filter((_, j) => j !== i) })}>Remove</Button></div></div>
                  ))}</div>
                )}
              </Section>

              <Section title="Education" action={<Button variant="secondary" size="sm" icon={Plus} onClick={() => setForm({ ...form, education: [...form.education, { ...blankEdu }] })}>Add</Button>}>
                {form.education.length === 0 ? <p className="text-sm text-muted">No education added yet.</p> : (
                  <div className="space-y-4">{form.education.map((x, i) => (
                    <div key={i} className="rounded-lg border border-line p-4"><div className="grid gap-3 sm:grid-cols-2">
                      <Input label="Degree" value={x.degree} onChange={(e) => setItem('education', i, 'degree', e.target.value)} placeholder="Bachelor of Technology" />
                      <Input label="Field" value={x.field} onChange={(e) => setItem('education', i, 'field', e.target.value)} />
                      <Input label="Institution" value={x.institution} onChange={(e) => setItem('education', i, 'institution', e.target.value)} />
                      <Input label="Year" value={x.year} onChange={(e) => setItem('education', i, 'year', e.target.value)} /></div>
                      <div className="mt-3 flex justify-end"><Button variant="ghost" size="sm" icon={Trash2} onClick={() => setForm({ ...form, education: form.education.filter((_, j) => j !== i) })}>Remove</Button></div></div>
                  ))}</div>
                )}
              </Section>
            </div>

            <aside className="xl:order-2 xl:sticky xl:top-24 xl:self-start">
              <div className="card p-5">
                <div className="flex items-baseline justify-between"><h2 className="font-semibold">Profile strength</h2><span className="font-display text-3xl font-semibold text-brand">{p.completion.percent}%</span></div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-line-soft"><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${p.completion.percent}%` }} /></div>
                {p.completion.missing.length > 0 ? <ul className="mt-4 space-y-2 text-sm">{p.completion.missing.map((m) => <li key={m} className="flex items-start gap-2 text-muted"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />{m}</li>)}</ul>
                  : <p className="mt-4 flex items-center gap-2 text-sm text-brand"><CheckCircle2 className="h-4 w-4" />Everything is filled in.</p>}
              </div>
            </aside>
          </div>
        )}
      </Async>
    </div>
  );
}

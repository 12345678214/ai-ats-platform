import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { api, parseError } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../lib/useAsync';
import { JOB_TYPES, LEVELS, WORK_MODES, enumOptions } from '../../lib/format';
import { Async, SkeletonRows } from '../../components/ui/States';
import { PageHeader, SkillInput } from '../../components/ui/Misc';
import { Input, Select, Textarea } from '../../components/ui/Field';
import Button from '../../components/ui/Button';

const BLANK = { title: '', description: '', requirements: '', location: '', workMode: 'ONSITE', jobType: 'FULL_TIME', experienceLevel: 'MID', minExperience: 0, salaryMin: '', salaryMax: '', currency: 'USD', deadline: '', status: 'DRAFT' };

function Form({ job, id }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState(() => (job ? { ...BLANK, ...job, requirements: job.requirements || '', salaryMin: job.salaryMin ?? '', salaryMax: job.salaryMax ?? '', deadline: job.deadline ? job.deadline.slice(0, 10) : '' } : BLANK));
  const [required, setRequired] = useState(job ? job.skills.filter((s) => s.isRequired).map((s) => s.name) : []);
  const [preferred, setPreferred] = useState(job ? job.skills.filter((s) => !s.isRequired).map((s) => s.name) : []);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (status) => {
    setBusy(status); setErrors({});
    const skills = [...required.map((name) => ({ name, isRequired: true })), ...preferred.filter((n) => !required.includes(n)).map((name) => ({ name, isRequired: false }))];
    const body = { ...form, status, skills: skills.length ? skills : undefined, deadline: form.deadline ? new Date(form.deadline).toISOString() : '' };
    delete body.id; delete body.skills_; delete body.company; delete body.applicantCount; delete body.createdAt; delete body.updatedAt; delete body.publishedAt; delete body.viewCount; delete body.isFlagged; delete body.flagReason; delete body.recruiterId; delete body.companyId;
    if (id && !skills.length) body.skills = [];
    try {
      const { data } = id ? await api.put(`/recruiter/jobs/${id}`, body) : await api.post('/recruiter/jobs', body);
      toast.success(status === 'ACTIVE' ? 'Job published' : 'Job saved');
      navigate(`/recruiter/jobs/${data.job.id}/applicants`);
    } catch (e) {
      const p = parseError(e); setErrors(p.fields);
      toast.error(Object.keys(p.fields).length ? 'Please fix the highlighted fields' : p.message);
    } finally { setBusy(null); }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <section className="card space-y-4 p-5">
          <h2 className="font-semibold">Role details</h2>
          <Input label="Job title" required value={form.title} onChange={set('title')} error={errors.title} placeholder="e.g. Senior Backend Engineer" />
          <Textarea label="Description" required rows={8} value={form.description} onChange={set('description')} error={errors.description} hint="What will this person do? Mention the tools they will use. Skills are extracted from this text." />
          <Textarea label="Requirements" rows={4} value={form.requirements} onChange={set('requirements')} error={errors.requirements} hint="Experience, education and must-haves. Anything after “nice to have” is treated as optional." />
        </section>
        <section className="card p-5">
          <div className="mb-4 flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand"><Sparkles className="h-4 w-4" /></span>
            <div><h2 className="font-semibold">Skills used for AI matching</h2><p className="text-sm text-muted">Leave both lists empty and we will extract skills from the description when you save. Or list them yourself for full control.</p></div></div>
          <div className="space-y-4"><SkillInput label="Required skills" value={required} onChange={setRequired} /><SkillInput label="Nice to have" value={preferred} onChange={setPreferred} /></div>
        </section>
        <section className="card p-5">
          <h2 className="mb-4 font-semibold">Logistics</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Location" required value={form.location} onChange={set('location')} error={errors.location} placeholder="City, country or Remote" />
            <Select label="Work mode" value={form.workMode} onChange={set('workMode')} options={enumOptions(WORK_MODES)} />
            <Select label="Job type" value={form.jobType} onChange={set('jobType')} options={enumOptions(JOB_TYPES)} />
            <Select label="Experience level" value={form.experienceLevel} onChange={set('experienceLevel')} options={enumOptions(LEVELS)} />
            <Input label="Minimum years of experience" type="number" min="0" step="0.5" value={form.minExperience} onChange={set('minExperience')} error={errors.minExperience} />
            <Input label="Application deadline" type="date" value={form.deadline} onChange={set('deadline')} error={errors.deadline} />
            <Input label="Salary from (per year)" type="number" min="0" value={form.salaryMin} onChange={set('salaryMin')} error={errors.salaryMin} />
            <Input label="Salary to (per year)" type="number" min="0" value={form.salaryMax} onChange={set('salaryMax')} error={errors.salaryMax} />
            <Input label="Currency" value={form.currency} maxLength={3} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} error={errors.currency} />
          </div>
        </section>
      </div>
      <aside className="xl:sticky xl:top-24 xl:self-start"><div className="card space-y-3 p-5">
        <h2 className="font-semibold">Publish</h2><p className="text-sm text-muted">Published jobs appear on the public job board right away.</p>
        <Button className="w-full" loading={busy === 'ACTIVE'} disabled={!!busy} onClick={() => submit('ACTIVE')}>{id && job.status === 'ACTIVE' ? 'Save changes' : 'Publish job'}</Button>
        <Button className="w-full" variant="secondary" loading={busy === 'DRAFT'} disabled={!!busy} onClick={() => submit(id && job.status !== 'DRAFT' ? job.status : 'DRAFT')}>{id && job.status !== 'DRAFT' ? `Save as ${job.status.toLowerCase()}` : 'Save as draft'}</Button>
        <Button className="w-full" variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
      </div></aside>
    </div>
  );
}

export default function JobForm() {
  const { id } = useParams();
  const state = useAsync(() => (id ? api.get(`/recruiter/jobs/${id}`).then((r) => r.data.job) : Promise.resolve(null)), [id]);
  return (
    <div>
      <PageHeader title={id ? 'Edit job' : 'Post a job'} description="Describe the role. Skills drive how applicants are scored." />
      <Async state={state} skeleton={<SkeletonRows rows={3} className="h-48" />}>{(job) => <Form key={job?.id || 'new'} job={job} id={id} />}</Async>
    </div>
  );
}

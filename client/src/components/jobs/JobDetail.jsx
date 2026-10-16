import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Bookmark, BookmarkCheck, Briefcase, Building2, CheckCircle2, Clock, Eye, Globe, MapPin, Wallet } from 'lucide-react';
import { api, parseError } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../lib/useAsync';
import { JOB_TYPES, LEVELS, WORK_MODES, formatDate, formatSalary, timeAgo } from '../../lib/format';
import { Async, PageLoader } from '../ui/States';
import { Avatar, SkillChip } from '../ui/Misc';
import { StatusBadge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { Textarea } from '../ui/Field';
import Button from '../ui/Button';

function ApplyModal({ job, open, onClose, onApplied }) {
  const toast = useToast();
  const resumes = useAsync(() => api.get('/candidate/resumes').then((r) => r.data.resumes), [open]);
  const [resumeId, setResumeId] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await api.post(`/jobs/${job.id}/apply`, { resumeId: resumeId || resumes.data?.[0]?.id, coverLetter: coverLetter || undefined });
      toast.success(`Application sent to ${job.company.name}`);
      onApplied();
    } catch (e) { toast.error(parseError(e).message); } finally { setBusy(false); }
  };
  const list = resumes.data || [];
  return (
    <Modal open={open} onClose={onClose} title={`Apply to ${job.title}`} description={job.company.name}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={!list.length} onClick={submit}>Send application</Button></>}>
      {resumes.loading ? <PageLoader /> : !list.length ? (
        <div className="rounded-lg bg-amber-50 p-4 text-sm">
          <p className="font-medium">You need a resume before you can apply.</p>
          <p className="mt-1 text-muted">Upload a PDF or DOCX in your profile. We read it to match your skills to this job.</p>
          <Button to="/candidate/profile" variant="secondary" size="sm" className="mt-3">Go to profile</Button>
        </div>
      ) : (
        <div className="space-y-5">
          <fieldset>
            <legend className="label">Resume</legend>
            <div className="space-y-2">
              {list.map((r, i) => (
                <label key={r.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-line p-3 has-[:checked]:border-brand has-[:checked]:bg-brand-50">
                  <input type="radio" name="resume" value={r.id} defaultChecked={i === 0} onChange={() => setResumeId(r.id)} className="accent-[#0e7c66]" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.originalName}</span>
                  {r.isPrimary && <span className="text-xs text-brand">Primary</span>}
                </label>
              ))}
            </div>
          </fieldset>
          <Textarea label="Cover letter (optional)" rows={5} value={coverLetter} onChange={(e) => setCoverLetter(e.target.value)} maxLength={4000} hint="Say why this role and team interest you." />
        </div>
      )}
    </Modal>
  );
}

export default function JobDetail({ backTo, backLabel = 'All jobs' }) {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const state = useAsync(() => api.get(`/jobs/${id}`).then((r) => r.data.job), [id, user?.id]);
  const [applyOpen, setApplyOpen] = useState(false);

  const toggleSave = async (job) => {
    try {
      if (job.isSaved) await api.delete(`/candidate/saved-jobs/${job.id}`); else await api.post(`/candidate/saved-jobs/${job.id}`);
      state.reload({ silent: true });
    } catch (e) { toast.error(parseError(e).message); }
  };

  return (
    <div>
      <Link to={backTo} className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />{backLabel}</Link>
      <Async state={state}>
        {(job) => {
          const required = job.skills.filter((s) => s.isRequired);
          const preferred = job.skills.filter((s) => !s.isRequired);
          const salary = formatSalary(job);
          const isCandidate = user?.role === 'CANDIDATE';
          const applied = job.applicationStatus && job.applicationStatus !== 'WITHDRAWN';
          const closed = job.status !== 'ACTIVE';
          return (
            <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
              <div className="space-y-6">
                <header className="card p-6">
                  <div className="flex items-start gap-4">
                    <Avatar name={job.company.name} size={52} />
                    <div className="min-w-0">
                      <h1 className="text-2xl font-semibold sm:text-3xl">{job.title}</h1>
                      <p className="mt-1 text-muted">{job.company.name}{job.company.isVerified && <span className="ml-2 text-sm text-brand">· Verified company</span>}</p>
                    </div>
                  </div>
                  <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
                    <div className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /><dd>{job.location} · {WORK_MODES[job.workMode]}</dd></div>
                    <div className="flex items-center gap-1.5"><Briefcase className="h-4 w-4" /><dd>{JOB_TYPES[job.jobType]} · {LEVELS[job.experienceLevel]}</dd></div>
                    {salary && <div className="flex items-center gap-1.5"><Wallet className="h-4 w-4" /><dd>{salary} / year</dd></div>}
                    {job.minExperience > 0 && <div className="flex items-center gap-1.5"><Clock className="h-4 w-4" /><dd>{job.minExperience}+ years experience</dd></div>}
                  </dl>
                </header>
                <section className="card p-6"><h2 className="text-lg font-semibold">About the role</h2><p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-ink/90">{job.description}</p>
                  {job.requirements && <><h2 className="mt-6 text-lg font-semibold">Requirements</h2><p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-ink/90">{job.requirements}</p></>}
                </section>
                {job.skills.length > 0 && (
                  <section className="card p-6"><h2 className="text-lg font-semibold">Skills</h2>
                    {required.length > 0 && <div className="mt-3"><p className="mb-2 text-sm text-muted">Required</p><div className="flex flex-wrap gap-2">{required.map((s) => <SkillChip key={s.id} kind="required">{s.name}</SkillChip>)}</div></div>}
                    {preferred.length > 0 && <div className="mt-4"><p className="mb-2 text-sm text-muted">Nice to have</p><div className="flex flex-wrap gap-2">{preferred.map((s) => <SkillChip key={s.id}>{s.name}</SkillChip>)}</div></div>}
                  </section>
                )}
              </div>

              <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
                <div className="card p-5">
                  {closed && <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm">This job is <b>{job.status.toLowerCase()}</b> and not visible to candidates.</p>}
                  {isCandidate ? (
                    applied ? (
                      <div className="text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-brand" /><p className="mt-2 font-medium">You applied to this job</p><div className="mt-2"><StatusBadge status={job.applicationStatus} /></div>
                        <Button to="/candidate/applications" variant="secondary" className="mt-4 w-full">Track application</Button></div>
                    ) : (
                      <>
                        <Button className="w-full" size="lg" disabled={closed} onClick={() => setApplyOpen(true)}>{job.applicationStatus === 'WITHDRAWN' ? 'Apply again' : 'Apply now'}</Button>
                        <Button variant="secondary" className="mt-2 w-full" icon={job.isSaved ? BookmarkCheck : Bookmark} onClick={() => toggleSave(job)}>{job.isSaved ? 'Saved' : 'Save for later'}</Button>
                      </>
                    )
                  ) : !user ? (
                    <><Button className="w-full" size="lg" onClick={() => navigate('/login', { state: { from: `/jobs/${job.id}` } })}>Sign in to apply</Button>
                      <p className="mt-3 text-center text-sm text-muted">New here? <Link to="/register" className="font-medium text-brand">Create a candidate account</Link></p></>
                  ) : (
                    <p className="text-sm text-muted">You are signed in as a {user.role.toLowerCase()}. Only candidates can apply.</p>
                  )}
                  <dl className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
                    <div className="flex justify-between"><dt className="text-muted">Posted</dt><dd>{job.publishedAt ? timeAgo(job.publishedAt) : '—'}</dd></div>
                    {job.deadline && <div className="flex justify-between"><dt className="text-muted">Apply by</dt><dd>{formatDate(job.deadline)}</dd></div>}
                    <div className="flex items-center justify-between"><dt className="flex items-center gap-1.5 text-muted"><Eye className="h-3.5 w-3.5" />Views</dt><dd>{job.viewCount}</dd></div>
                  </dl>
                </div>
                <div className="card p-5 text-sm">
                  <h2 className="flex items-center gap-2 font-semibold"><Building2 className="h-4 w-4 text-muted" />About {job.company.name}</h2>
                  <p className="mt-2 text-muted">{[job.company.industry, job.company.location].filter(Boolean).join(' · ') || 'No company details yet.'}</p>
                  {job.company.website && <a href={job.company.website} target="_blank" rel="noreferrer noopener" className="mt-3 inline-flex items-center gap-1.5 text-brand hover:underline"><Globe className="h-4 w-4" />Website</a>}
                </div>
              </aside>
              {isCandidate && <ApplyModal job={job} open={applyOpen} onClose={() => setApplyOpen(false)} onApplied={() => { setApplyOpen(false); state.reload({ silent: true }); }} />}
            </div>
          );
        }}
      </Async>
    </div>
  );
}

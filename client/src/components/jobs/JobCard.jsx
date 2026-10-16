import { Link } from 'react-router-dom';
import { Bookmark, BookmarkCheck, MapPin, Clock, Wallet } from 'lucide-react';
import { Avatar, SkillChip } from '../ui/Misc';
import { StatusBadge } from '../ui/Badge';
import { JOB_TYPES, WORK_MODES, formatSalary, timeAgo } from '../../lib/format';

export default function JobCard({ job, base, onToggleSave, canSave }) {
  const salary = formatSalary(job);
  const skills = job.skills.slice(0, 4);
  return (
    <article className="card group flex flex-col p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start gap-3">
        <Avatar name={job.company.name} size={42} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold leading-snug"><Link to={`${base}/${job.id}`} className="after:absolute after:inset-0 hover:text-brand focus-visible:outline-none">{job.title}</Link></h3>
          <p className="truncate text-sm text-muted">{job.company.name}{job.company.isVerified && <span className="ml-1.5 text-xs text-brand">· Verified</span>}</p>
        </div>
        {canSave && (
          <button onClick={() => onToggleSave(job)} aria-label={job.isSaved ? 'Remove from saved jobs' : 'Save job'} aria-pressed={!!job.isSaved}
            className="relative z-10 rounded-lg p-1.5 text-muted hover:bg-line-soft hover:text-brand">
            {job.isSaved ? <BookmarkCheck className="h-5 w-5 text-brand" /> : <Bookmark className="h-5 w-5" />}
          </button>
        )}
      </div>
      <dl className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-muted">
        <div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /><dt className="sr-only">Location</dt><dd>{job.location} · {WORK_MODES[job.workMode]}</dd></div>
        <div className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /><dt className="sr-only">Type</dt><dd>{JOB_TYPES[job.jobType]}</dd></div>
        {salary && <div className="flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" /><dt className="sr-only">Salary</dt><dd>{salary}</dd></div>}
      </dl>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {skills.map((s) => <SkillChip key={s.id} kind={s.isRequired ? 'neutral' : 'neutral'}>{s.name}</SkillChip>)}
        {job.skills.length > 4 && <span className="px-1 py-1 text-xs text-muted">+{job.skills.length - 4}</span>}
      </div>
      <div className="mt-auto flex items-center justify-between pt-5 text-xs text-muted">
        <span>{job.publishedAt ? `Posted ${timeAgo(job.publishedAt)}` : 'Not published'}</span>
        {job.applicationStatus && <StatusBadge status={job.applicationStatus} />}
        {job.skillFit != null && !job.applicationStatus && <span className="font-medium text-brand">{job.skillFit}% skill fit</span>}
      </div>
    </article>
  );
}

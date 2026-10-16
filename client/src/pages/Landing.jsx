import { ArrowRight, FileSearch, GitBranch, ShieldCheck, Sparkles, UserRound, Users } from 'lucide-react';
import Button from '../components/ui/Button';
import MatchRing from '../components/ui/MatchRing';
import { Avatar, SkillChip } from '../components/ui/Misc';

const SAMPLE = [
  { name: 'Aarav Sharma', role: 'Full Stack Developer · 4 yrs', score: 93, matched: ['React', 'Node.js', 'PostgreSQL', 'Prisma'], missing: [] },
  { name: 'Rohan Mehta', role: 'Backend Engineer · 5 yrs', score: 61, matched: ['PostgreSQL', 'Docker'], missing: ['React', 'Node.js'] },
  { name: 'Diego Alvarez', role: 'Java Developer · 7 yrs', score: 54, matched: ['PostgreSQL'], missing: ['React', 'Node.js'] },
  { name: 'Priya Nair', role: 'Frontend Engineer · 3 yrs', score: 42, matched: ['React'], missing: ['Node.js', 'Prisma'] },
];

function RankingPreview() {
  return (
    <div className="card overflow-hidden shadow-xl shadow-forest/10" aria-label="Sample applicant ranking">
      <div className="flex items-center justify-between border-b border-line bg-paper px-5 py-3.5">
        <div><p className="text-sm font-semibold">Senior Full Stack Engineer</p><p className="text-xs text-muted">4 applicants, ranked by match</p></div>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs text-muted ring-1 ring-line">Sample data</span>
      </div>
      <ul>
        {SAMPLE.map((c, i) => (
          <li key={c.name} className={`flex items-center gap-4 px-5 py-4 ${i ? 'border-t border-line-soft' : 'bg-brand-50/50'}`}>
            <MatchRing score={c.score} size={54} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2"><Avatar name={c.name} size={22} /><p className="truncate text-sm font-semibold">{c.name}</p></div>
              <p className="mt-0.5 truncate text-xs text-muted">{c.role}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {c.matched.map((s) => <SkillChip key={s} kind="matched">{s}</SkillChip>)}
                {c.missing.map((s) => <SkillChip key={s} kind="missing">{s}</SkillChip>)}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const STEPS = [
  { icon: UserRound, title: 'Candidates apply with a resume', body: 'They upload a PDF or DOCX once. A Python service reads it and pulls out skills, education and years of experience.' },
  { icon: Sparkles, title: 'Every applicant is scored', body: 'Their skills are compared with what the role asks for. The score and the reasons behind it are saved with the application.' },
  { icon: Users, title: 'Recruiters review in rank order', body: 'Filter, sort, add notes and move people through a pipeline from applied to offer.' },
  { icon: GitBranch, title: 'Everyone stays informed', body: 'Interview invites and status changes reach the candidate as notifications, and their application page shows the full timeline.' },
];

const WEIGHTS = [
  ['Skills', 60, 'Required skills count double. Related skills (MySQL for PostgreSQL) earn partial credit.'],
  ['Experience', 20, 'Years of experience measured against the job’s minimum.'],
  ['Education', 10, 'Highest degree compared with what the posting asks for.'],
  ['Text similarity', 10, 'How closely the resume language matches the job description.'],
];

export default function Landing() {
  return (
    <>
      <section className="mx-auto grid max-w-[1180px] items-center gap-12 px-4 pb-16 pt-14 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
        <div>
          <h1 className="text-[40px] font-semibold leading-[1.05] sm:text-6xl">Read fewer resumes. Talk to the right people sooner.</h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">Shortlist scores every applicant against the job and shows why. Recruiters get a ranked pipeline; candidates get a clear view of where they stand.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button to="/register?role=RECRUITER" size="lg" icon={ArrowRight}>Post a job</Button>
            <Button to="/jobs" variant="secondary" size="lg">Browse open roles</Button>
          </div>
        </div>
        <RankingPreview />
      </section>

      <section id="how" className="border-y border-line bg-white py-16">
        <div className="mx-auto max-w-[1180px] px-4 sm:px-8">
          <h2 className="max-w-xl text-3xl font-semibold">From application to offer, in one place</h2>
          <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <li key={title}>
                <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-forest font-display font-semibold text-white">{i + 1}</span><Icon className="h-5 w-5 text-brand" /></div>
                <h3 className="mt-4 text-lg font-semibold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-4 py-16 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div>
            <h2 className="text-3xl font-semibold">A score you can explain to a hiring manager</h2>
            <p className="mt-4 text-muted">No black box. Each match breaks down into four parts, and recruiters see exactly which skills were found, which were close, and which are missing.</p>
            <div className="mt-6 flex items-center gap-2 text-sm text-muted"><ShieldCheck className="h-4 w-4 text-brand" />Candidates never see recruiter notes or scores.</div>
          </div>
          <div className="card divide-y divide-line-soft">
            {WEIGHTS.map(([label, pct, text]) => (
              <div key={label} className="p-5">
                <div className="flex items-baseline justify-between"><h3 className="font-semibold">{label}</h3><span className="font-display text-xl font-semibold text-brand">{pct}%</span></div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line-soft"><div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} /></div>
                <p className="mt-2 text-sm text-muted">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-4 sm:px-8">
        <div className="flex flex-col items-start justify-between gap-6 rounded-2xl bg-forest p-8 text-white sm:flex-row sm:items-center sm:p-10">
          <div className="flex items-start gap-4"><FileSearch className="mt-1 h-7 w-7 shrink-0 text-white/70" /><div><h2 className="text-2xl font-semibold !text-white">Hiring this quarter?</h2><p className="mt-1 text-white/70">Create a recruiter account and publish your first role in a few minutes.</p></div></div>
          <Button to="/register?role=RECRUITER" variant="secondary" size="lg">Create recruiter account</Button>
        </div>
      </section>
    </>
  );
}

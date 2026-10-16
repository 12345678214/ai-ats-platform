// End-to-end workflow test. Requires: PostgreSQL migrated, Python AI service and the API running.
//   API_URL=http://localhost:4000/api node tests/e2e.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const PDFDocument = require('pdfkit');

const API = process.env.API_URL || 'http://localhost:4000/api';
const run = Date.now().toString(36);
let passed = 0;
let failed = 0;

async function call(method, path, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${path}`, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* binary or empty */ }
  return { status: res.status, json, text };
}

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`  ✗ ${name}\n      ${err.message}`);
  }
}
const eq = (a, b, msg = '') => { if (a !== b) throw new Error(`${msg} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const ok = (v, msg) => { if (!v) throw new Error(msg); };

function makeResumePdf(lines) {
  return new Promise((resolve) => {
    const doc = new PDFDocument();
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    lines.forEach((l) => doc.text(l));
    doc.end();
  });
}
const upload = (buf, name, type = 'application/pdf') => {
  const form = new FormData();
  form.append('resume', new Blob([buf], { type }), name);
  return form;
};
async function waitFor(fn, { tries = 40, delay = 250 } = {}) {
  for (let i = 0; i < tries; i += 1) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, delay));
  }
  throw new Error('timed out waiting for condition');
}

const S = {}; // shared state

console.log(`\nATS end-to-end test against ${API}\n`);

await check('API and AI service are healthy', async () => {
  const r = await call('GET', '/health');
  eq(r.status, 200);
  ok(r.json.ai.ok, `AI service not reachable: ${r.json.ai.error}`);
});

console.log('\nAuthentication & validation');
await check('registers a recruiter with a company', async () => {
  const r = await call('POST', '/auth/register', { body: { name: 'Test Recruiter', email: `rec-${run}@test.dev`, password: 'Passw0rd!x', role: 'RECRUITER', companyName: `TestCo ${run}` } });
  eq(r.status, 201); S.rec = r.json.token;
});
await check('registers two candidates', async () => {
  for (const [key, name] of [['cand', 'Strong Candidate'], ['cand2', 'Weak Candidate']]) {
    const r = await call('POST', '/auth/register', { body: { name, email: `${key}-${run}@test.dev`, password: 'Passw0rd!x', role: 'CANDIDATE' } });
    eq(r.status, 201); S[key] = r.json.token;
  }
});
await check('rejects weak passwords and duplicate emails', async () => {
  const weak = await call('POST', '/auth/register', { body: { name: 'X Y', email: `w-${run}@test.dev`, password: 'short', role: 'CANDIDATE' } });
  eq(weak.status, 422); ok(weak.json.error.details.some((d) => d.field === 'password'), 'password detail missing');
  const dup = await call('POST', '/auth/register', { body: { name: 'Dup', email: `cand-${run}@test.dev`, password: 'Passw0rd!x', role: 'CANDIDATE' } });
  eq(dup.status, 409);
});
await check('cannot self-register as admin', async () => {
  const r = await call('POST', '/auth/register', { body: { name: 'Evil', email: `evil-${run}@test.dev`, password: 'Passw0rd!x', role: 'ADMIN' } });
  eq(r.status, 422);
});
await check('login works; wrong password and missing token are rejected', async () => {
  eq((await call('POST', '/auth/login', { body: { email: `cand-${run}@test.dev`, password: 'Passw0rd!x' } })).status, 200);
  eq((await call('POST', '/auth/login', { body: { email: `cand-${run}@test.dev`, password: 'wrong-pass1' } })).status, 401);
  eq((await call('GET', '/candidate/dashboard')).status, 401);
  eq((await call('GET', '/candidate/dashboard', { token: 'garbage' })).status, 401);
});

console.log('\nRole-based access control');
await check('roles cannot cross into each other\'s APIs', async () => {
  eq((await call('GET', '/recruiter/dashboard', { token: S.cand })).status, 403);
  eq((await call('GET', '/candidate/dashboard', { token: S.rec })).status, 403);
  eq((await call('GET', '/admin/stats', { token: S.rec })).status, 403);
  eq((await call('GET', '/admin/users', { token: S.cand })).status, 403);
});

console.log('\nRecruiter: create job with AI skill extraction');
await check('creates an ACTIVE job; skills are extracted from the description by the AI service', async () => {
  const r = await call('POST', '/recruiter/jobs', { token: S.rec, body: {
    title: 'Full Stack Developer', location: 'Remote', workMode: 'REMOTE', jobType: 'FULL_TIME', experienceLevel: 'MID', status: 'ACTIVE',
    description: 'Build web features with React and Node.js backed by PostgreSQL. Bachelor degree in computer science. Nice to have: Docker.',
    requirements: '2+ years of experience building REST APIs.',
  } });
  eq(r.status, 201, JSON.stringify(r.json));
  S.job = r.json.job;
  const names = S.job.skills.map((s) => s.name);
  ok(['React', 'Node.js', 'PostgreSQL'].every((n) => names.includes(n)), `skills were ${names}`);
  eq(S.job.skills.find((s) => s.name === 'Docker').isRequired, false, 'Docker should be optional');
  eq(S.job.minExperience, 2);
});
await check('validates job input', async () => {
  const r = await call('POST', '/recruiter/jobs', { token: S.rec, body: { title: 'x', description: 'short', location: '' } });
  eq(r.status, 422);
});

console.log('\nCandidate: profile, resume upload & parsing');
await check('cannot apply without a resume', async () => {
  const r = await call('POST', `/jobs/${S.job.id}/apply`, { token: S.cand, body: {} });
  eq(r.status, 400);
});
await check('rejects non-PDF/DOCX uploads and spoofed files', async () => {
  eq((await call('POST', '/candidate/resumes', { token: S.cand, form: upload(Buffer.from('<script>alert(1)</script>'), 'x.html', 'text/html') })).status, 400);
  eq((await call('POST', '/candidate/resumes', { token: S.cand, form: upload(Buffer.from('MZ not really a pdf'), 'evil.pdf') })).status, 400);
});
await check('uploads a PDF resume; AI parser extracts skills, education, experience', async () => {
  const pdf = await makeResumePdf([
    'Strong Candidate', 'strong@example.com | +1 415 555 0101', 'Summary', 'Full stack developer with 4 years of experience.',
    'Experience', 'Acme Software Jan 2022 - Present', 'Full Stack Developer', 'Education', 'State University', 'Bachelor of Science in Computer Science 2017 - 2021',
    'Skills', 'React, Node.js, Express.js, PostgreSQL, Docker, REST APIs, Git',
  ]);
  const r = await call('POST', '/candidate/resumes', { token: S.cand, form: upload(pdf, 'strong.pdf') });
  eq(r.status, 201, JSON.stringify(r.json));
  eq(r.json.resume.parseStatus, 'PARSED');
  const names = r.json.profile.skills.map((s) => s.name);
  ok(['React', 'Node.js', 'PostgreSQL', 'Docker'].every((n) => names.includes(n)), `profile skills ${names}`);
  ok(r.json.profile.yearsExperience >= 4, `years ${r.json.profile.yearsExperience}`);
  ok(r.json.profile.education.length > 0, 'education not synced');
  ok(r.json.profile.completion.percent > 0, 'completion missing');
  S.resumeId = r.json.resume.id;
});
await check('uploads a DOCX resume for the second candidate', async () => {
  const docx = (await import('node:child_process')).execSync(
    `python3 -c "import docx,sys,io;d=docx.Document();[d.add_paragraph(t) for t in ['Weak Candidate','Summary','Cashier with customer service background.','Skills','Excel, Word']];b=io.BytesIO();d.save(b);sys.stdout.buffer.write(b.getvalue())"`,
    { maxBuffer: 10_000_000 },
  );
  const r = await call('POST', '/candidate/resumes', { token: S.cand2, form: upload(docx, 'weak.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') });
  eq(r.status, 201, JSON.stringify(r.json)); eq(r.json.resume.parseStatus, 'PARSED');
});
await check('updates profile and manual skills', async () => {
  const p = await call('PUT', '/candidate/profile', { token: S.cand, body: { headline: 'Full Stack Developer', phone: '+1 415 555 0101', location: 'Remote', summary: 'Full stack developer who enjoys shipping product features.', githubUrl: 'https://github.com/strong' } });
  eq(p.status, 200); eq(p.json.profile.headline, 'Full Stack Developer');
  const s = await call('PUT', '/candidate/skills', { token: S.cand, body: { skills: ['TypeScript', 'Jest'] } });
  ok(s.json.profile.skills.some((x) => x.name === 'TypeScript'), 'manual skill missing');
  ok(s.json.profile.completion.percent >= 80, `completion ${s.json.profile.completion.percent}`);
});

console.log('\nJob board');
await check('public search finds the job; filters narrow results', async () => {
  let r = await call('GET', `/jobs?q=full%20stack&workMode=REMOTE`, { token: S.cand });
  ok(r.json.items.some((j) => j.id === S.job.id), 'job not found by q');
  r = await call('GET', `/jobs?skills=react,docker&limit=50`);
  ok(r.json.items.some((j) => j.id === S.job.id), 'skill filter');
  r = await call('GET', `/jobs?workMode=ONSITE&q=full%20stack`);
  ok(!r.json.items.some((j) => j.id === S.job.id), 'workMode filter should exclude');
  eq((await call('GET', '/jobs?limit=500')).status, 422);
});
await check('save / unsave job', async () => {
  eq((await call('POST', `/candidate/saved-jobs/${S.job.id}`, { token: S.cand })).status, 201);
  const l = await call('GET', '/candidate/saved-jobs', { token: S.cand });
  ok(l.json.items.some((j) => j.id === S.job.id), 'not saved');
  const d = await call('GET', `/jobs/${S.job.id}`, { token: S.cand });
  eq(d.json.job.isSaved, true);
  eq((await call('DELETE', `/candidate/saved-jobs/${S.job.id}`, { token: S.cand })).status, 204);
});

console.log('\nApply → AI match → recruiter review');
await check('both candidates apply; duplicate application is blocked', async () => {
  const a = await call('POST', `/jobs/${S.job.id}/apply`, { token: S.cand, body: { coverLetter: 'I would love to join.' } });
  eq(a.status, 201, JSON.stringify(a.json)); S.app1 = a.json.application.id;
  const b = await call('POST', `/jobs/${S.job.id}/apply`, { token: S.cand2, body: {} });
  eq(b.status, 201); S.app2 = b.json.application.id;
  eq((await call('POST', `/jobs/${S.job.id}/apply`, { token: S.cand, body: {} })).status, 409);
});
await check('recruiter is notified of both applicants', async () => {
  const n = await call('GET', '/notifications?unread=true', { token: S.rec });
  ok(n.json.items.filter((x) => x.type === 'APPLICATION_RECEIVED').length >= 2, 'notifications missing');
});
await check('AI match scores are generated and the strong candidate outranks the weak one', async () => {
  const list = await waitFor(async () => {
    const r = await call('GET', `/recruiter/jobs/${S.job.id}/applications?sort=match`, { token: S.rec });
    return r.json.items.length === 2 && r.json.items.every((i) => i.match?.status === 'COMPLETED') ? r.json : null;
  });
  const [first, second] = list.items;
  eq(first.id, S.app1, 'strong candidate should be first');
  ok(first.match.score > 70, `strong score ${first.match.score}`);
  ok(second.match.score < 40, `weak score ${second.match.score}`);
  ok(first.match.matchedSkills.includes('React'), 'matched skills');
  ok(second.match.missingSkills.includes('React'), 'missing skills');
  ok(first.match.summary.length > 20, 'summary');
});
await check('recruiter filters: min score, search, status', async () => {
  let r = await call('GET', `/recruiter/jobs/${S.job.id}/applications?minScore=60`, { token: S.rec });
  eq(r.json.items.length, 1);
  r = await call('GET', `/recruiter/jobs/${S.job.id}/applications?q=weak`, { token: S.rec });
  eq(r.json.items[0].id, S.app2);
  r = await call('GET', `/recruiter/jobs/${S.job.id}/applications?status=SHORTLISTED`, { token: S.rec });
  eq(r.json.items.length, 0);
});
await check('recruiter views full candidate profile and downloads the resume', async () => {
  const r = await call('GET', `/recruiter/applications/${S.app1}`, { token: S.rec });
  eq(r.status, 200); eq(r.json.application.candidate.name, 'Strong Candidate');
  ok(r.json.application.match.score > 70, 'match in detail');
  const f = await call('GET', `/resumes/${S.resumeId}/file`, { token: S.rec });
  eq(f.status, 200); ok(f.text.startsWith('%PDF'), 'resume bytes');
  eq((await call('GET', `/resumes/${S.resumeId}/file`, { token: S.cand2 })).status, 403, 'other candidate must not read it');
});

console.log('\nShortlist → interview → candidate tracking');
await check('shortlist, add note, schedule interview; candidate is notified', async () => {
  eq((await call('PATCH', `/recruiter/applications/${S.app1}/status`, { token: S.rec, body: { status: 'SHORTLISTED' } })).status, 200);
  eq((await call('POST', `/recruiter/applications/${S.app1}/notes`, { token: S.rec, body: { content: 'Great stack fit.' } })).status, 201);
  const when = new Date(Date.now() + 3 * 86_400_000).toISOString();
  const i = await call('POST', `/recruiter/applications/${S.app1}/interviews`, { token: S.rec, body: { scheduledAt: when, durationMins: 60, mode: 'VIDEO', location: 'https://meet.example.com/x' } });
  eq(i.status, 201); S.interview = i.json.interview.id;
  const past = await call('POST', `/recruiter/applications/${S.app1}/interviews`, { token: S.rec, body: { scheduledAt: '2020-01-01T10:00:00Z' } });
  eq(past.status, 422);
  const d = await call('GET', `/recruiter/applications/${S.app1}`, { token: S.rec });
  eq(d.json.application.status, 'INTERVIEW'); eq(d.json.application.notes.length, 1);
  ok(d.json.application.history.length >= 3, 'history');
  const n = await call('GET', '/notifications', { token: S.cand });
  const types = n.json.items.map((x) => x.type);
  ok(types.includes('STATUS_CHANGED') && types.includes('INTERVIEW_SCHEDULED'), `candidate notifications ${types}`);
});
await check('candidate sees status, history and interview — but not recruiter notes or AI score', async () => {
  const l = await call('GET', '/candidate/applications', { token: S.cand });
  eq(l.json.items[0].status, 'INTERVIEW'); ok(l.json.items[0].nextInterview, 'next interview');
  const d = await call('GET', `/candidate/applications/${S.app1}`, { token: S.cand });
  ok(d.json.application.history.length >= 3 && d.json.application.interviews.length === 1, 'tracking');
  ok(!('notes' in d.json.application) && !('match' in d.json.application), 'must not leak recruiter-only data');
});
await check('reject and withdraw flows', async () => {
  eq((await call('PATCH', `/recruiter/applications/${S.app2}/status`, { token: S.rec, body: { status: 'REJECTED' } })).status, 200);
  eq((await call('PATCH', `/candidate/applications/${S.app2}/withdraw`, { token: S.cand2 })).status, 400);
  eq((await call('PATCH', `/recruiter/interviews/${S.interview}`, { token: S.rec, body: { status: 'CANCELLED' } })).status, 200);
});
await check('a recruiter cannot touch another recruiter\'s applicants', async () => {
  const other = await call('POST', '/auth/register', { body: { name: 'Other Rec', email: `rec2-${run}@test.dev`, password: 'Passw0rd!x', role: 'RECRUITER', companyName: `Other ${run}` } });
  eq((await call('GET', `/recruiter/applications/${S.app1}`, { token: other.json.token })).status, 404);
  eq((await call('PATCH', `/recruiter/applications/${S.app1}/status`, { token: other.json.token, body: { status: 'REJECTED' } })).status, 404);
  eq((await call('GET', `/recruiter/jobs/${S.job.id}/applications`, { token: other.json.token })).status, 404);
});
await check('re-run AI ranking for the whole job', async () => {
  const r = await call('POST', `/recruiter/jobs/${S.job.id}/rank`, { token: S.rec });
  eq(r.status, 200); ok(r.json.scored >= 2, JSON.stringify(r.json));
});

console.log('\nDashboards & analytics');
await check('candidate, recruiter dashboards and analytics return real data', async () => {
  const c = await call('GET', '/candidate/dashboard', { token: S.cand });
  eq(c.status, 200); eq(c.json.stats.totalApplications, 1); ok(c.json.upcomingInterviews !== undefined, 'shape');
  const r = await call('GET', '/recruiter/dashboard', { token: S.rec });
  eq(r.status, 200); eq(r.json.stats.totalApplicants, 2); ok(r.json.stats.avgMatchScore > 0, 'avg score');
  const a = await call('GET', '/recruiter/analytics', { token: S.rec });
  eq(a.status, 200); ok(a.json.funnel.length === 6 && a.json.series.length === 30, 'analytics shape');
  ok(a.json.perJob[0].applicants === 2, 'per job');
});
await check('job lifecycle: pause hides it, delete is blocked when it has applicants', async () => {
  eq((await call('PATCH', `/recruiter/jobs/${S.job.id}/status`, { token: S.rec, body: { status: 'PAUSED' } })).status, 200);
  eq((await call('GET', `/jobs/${S.job.id}`)).status, 404);
  eq((await call('GET', `/jobs/${S.job.id}`, { token: S.rec })).status, 200, 'owner still sees it');
  eq((await call('DELETE', `/recruiter/jobs/${S.job.id}`, { token: S.rec })).status, 409);
  eq((await call('PATCH', `/recruiter/jobs/${S.job.id}/status`, { token: S.rec, body: { status: 'ACTIVE' } })).status, 200);
});

console.log('\nAdmin');
await check('admin stats, listings and moderation', async () => {
  const login = await call('POST', '/auth/login', { body: { email: 'admin@ats.dev', password: 'Admin@12345' } });
  if (login.status !== 200) throw new Error('admin@ats.dev not found — run `npm run db:seed` first');
  S.admin = login.json.token;
  const st = await call('GET', '/admin/stats', { token: S.admin });
  eq(st.status, 200); ok(st.json.totals.users >= 5, 'users total');
  ok((await call('GET', '/admin/users?role=CANDIDATE', { token: S.admin })).json.items.length > 0, 'users list');
  ok((await call('GET', '/admin/jobs', { token: S.admin })).json.items.length > 0, 'jobs list');
  ok((await call('GET', '/admin/applications', { token: S.admin })).json.items.length > 0, 'apps list');
  ok((await call('GET', '/admin/companies', { token: S.admin })).json.items.length > 0, 'companies list');
  eq((await call('GET', '/admin/analytics', { token: S.admin })).status, 200);

  eq((await call('PATCH', `/admin/jobs/${S.job.id}/flag`, { token: S.admin, body: { isFlagged: true, reason: 'Spam test' } })).status, 200);
  eq((await call('GET', `/jobs/${S.job.id}`)).status, 404, 'flagged job hidden');
  const n = await call('GET', '/notifications', { token: S.rec });
  ok(n.json.items.some((x) => x.title.includes('moderation')), 'recruiter told');
  await call('PATCH', `/admin/jobs/${S.job.id}/flag`, { token: S.admin, body: { isFlagged: false } });
  eq((await call('GET', `/jobs/${S.job.id}`)).status, 200, 'restored');
});
await check('deactivating a user blocks login and live tokens', async () => {
  const users = await call('GET', `/admin/users?q=cand2-${run}`, { token: S.admin });
  const id = users.json.items[0].id;
  eq((await call('PATCH', `/admin/users/${id}/active`, { token: S.admin, body: { isActive: false } })).status, 200);
  eq((await call('GET', '/candidate/dashboard', { token: S.cand2 })).status, 403, 'existing token blocked');
  eq((await call('POST', '/auth/login', { body: { email: `cand2-${run}@test.dev`, password: 'Passw0rd!x' } })).status, 403);
  await call('PATCH', `/admin/users/${id}/active`, { token: S.admin, body: { isActive: true } });
  eq((await call('POST', '/auth/login', { body: { email: `cand2-${run}@test.dev`, password: 'Passw0rd!x' } })).status, 200);
});
await check('admins cannot deactivate themselves', async () => {
  const me = await call('GET', '/auth/me', { token: S.admin });
  eq((await call('PATCH', `/admin/users/${me.json.user.id}/active`, { token: S.admin, body: { isActive: false } })).status, 400);
});
await check('unknown routes return JSON 404', async () => {
  const r = await call('GET', '/nope');
  eq(r.status, 404); ok(r.json.error.message, 'json error');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);

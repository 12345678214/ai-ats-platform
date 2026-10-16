/* Seeds a realistic demo workspace. Resumes are real generated PDFs that go through the
 * same Python parser and matcher as user uploads, so every score you see is computed.
 *
 *   npm run db:seed              # only when the database is empty
 *   node prisma/seed.js --reset  # wipe everything, then seed
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const PDFDocument = require('pdfkit');
const prisma = require('../src/config/prisma');
const ai = require('../src/services/ai.service');
const { upsertSkills } = require('../src/services/skill.service');
const resumeService = require('../src/services/resume.service');
const applicationService = require('../src/services/application.service');
const matching = require('../src/services/matching.service');
const { RESUME_DIR } = require('../src/middleware/upload');

const PASSWORD = 'Password@123';
const ADMIN_PASSWORD = 'Admin@12345';
const daysAgo = (n, hour = 10) => { const d = new Date(Date.now() - n * 86_400_000); d.setUTCHours(hour, 0, 0, 0); return d; };
const inDays = (n, hour = 15) => { const d = new Date(Date.now() + n * 86_400_000); d.setUTCHours(hour, 0, 0, 0); return d; };

const RECRUITERS = [
  { name: 'Maya Fernandez', email: 'recruiter@ats.dev', title: 'Head of Talent', company: { name: 'Northwind Labs', industry: 'Developer Tools', size: '201-500', location: 'Remote (Global)', website: 'https://northwind.example', description: 'We build observability tooling used by engineering teams at 4,000 companies.', isVerified: true } },
  { name: 'Daniel Okafor', email: 'recruiter2@ats.dev', title: 'Technical Recruiter', company: { name: 'Brightpath Health', industry: 'Healthcare Technology', size: '51-200', location: 'Austin, TX', website: 'https://brightpath.example', description: 'Brightpath connects patients and clinics through a scheduling and records platform.', isVerified: false } },
];

const CANDIDATES = [
  { name: 'Aarav Sharma', email: 'candidate@ats.dev', headline: 'Full Stack Developer', location: 'Jaipur, India', years: 4, degree: 'Bachelor of Technology in Computer Science', school: 'Malaviya National Institute of Technology', gradYear: 2021, skills: ['React', 'Node.js', 'Express.js', 'PostgreSQL', 'Prisma', 'Docker', 'AWS', 'Jest', 'REST APIs', 'Git'], roles: [['Fieldstone Software', 'Full Stack Developer', 2022, 2026], ['Pixel Forge', 'Software Engineer Intern', 2021, 2022]], blurb: 'Full stack developer who ships end-to-end features with React, Node.js and PostgreSQL, and cares about testing and clean APIs.' },
  { name: 'Priya Nair', email: 'priya@ats.dev', headline: 'Frontend Engineer', location: 'Bengaluru, India', years: 3, degree: 'Bachelor of Engineering in Information Technology', school: 'PES University', gradYear: 2022, skills: ['React', 'TypeScript', 'Next.js', 'Tailwind CSS', 'Redux', 'Jest', 'Figma', 'Responsive Design', 'Git'], roles: [['Lumen Commerce', 'Frontend Engineer', 2022, 2026]], blurb: 'Frontend engineer focused on design systems, accessibility and fast React interfaces.' },
  { name: 'Rohan Mehta', email: 'rohan@ats.dev', headline: 'Backend Engineer', location: 'Pune, India', years: 5, degree: "Master of Technology in Software Engineering", school: 'BITS Pilani', gradYear: 2019, skills: ['Python', 'Django', 'PostgreSQL', 'Redis', 'Docker', 'Kubernetes', 'AWS', 'Microservices', 'REST APIs', 'Linux'], roles: [['Cartwheel Payments', 'Senior Backend Engineer', 2021, 2026], ['DataBridge', 'Backend Engineer', 2019, 2021]], blurb: 'Backend engineer building payment and ledger services in Python with a strong operations mindset.' },
  { name: 'Sara Khan', email: 'sara@ats.dev', headline: 'Data Scientist', location: 'Hyderabad, India', years: 2, degree: 'Master of Science in Data Science', school: 'University of Hyderabad', gradYear: 2024, skills: ['Python', 'Pandas', 'NumPy', 'scikit-learn', 'TensorFlow', 'SQL', 'Machine Learning', 'Data Visualization'], roles: [['Insightly', 'Data Scientist', 2024, 2026]], blurb: 'Data scientist who turns messy operational data into forecasting and classification models.' },
  { name: 'Liam Carter', email: 'liam@ats.dev', headline: 'DevOps Engineer', location: 'Austin, TX', years: 6, degree: 'Bachelor of Science in Computer Science', school: 'University of Texas', gradYear: 2018, skills: ['AWS', 'Terraform', 'Kubernetes', 'Docker', 'Jenkins', 'Linux', 'Python', 'CI/CD', 'Bash'], roles: [['Skyline Cloud', 'DevOps Engineer', 2020, 2026], ['Hostly', 'Systems Administrator', 2018, 2020]], blurb: 'DevOps engineer automating infrastructure and delivery pipelines for high-traffic services.' },
  { name: 'Meera Iyer', email: 'meera@ats.dev', headline: 'Junior Web Developer', location: 'Chennai, India', years: 0.5, degree: 'Bachelor of Computer Applications', school: 'Loyola College', gradYear: 2025, skills: ['JavaScript', 'React', 'Node.js', 'MongoDB', 'HTML5', 'CSS3', 'Git'], roles: [['Brightside Studio', 'Web Development Intern', 2025, 2025]], blurb: 'Recent graduate building small full stack projects with the MERN stack.' },
  { name: 'Diego Alvarez', email: 'diego@ats.dev', headline: 'Java Backend Developer', location: 'Madrid, Spain', years: 7, degree: 'Bachelor of Science in Computer Engineering', school: 'Universidad Politecnica de Madrid', gradYear: 2016, skills: ['Java', 'Spring Boot', 'MySQL', 'Hibernate', 'Microservices', 'AWS', 'REST APIs', 'Jenkins'], roles: [['Iberia Digital', 'Senior Java Developer', 2019, 2026], ['Banco Norte', 'Java Developer', 2016, 2019]], blurb: 'Java developer with a banking background who designs resilient Spring Boot services.' },
  { name: 'Hannah Weber', email: 'hannah@ats.dev', headline: 'Mobile Developer', location: 'Berlin, Germany', years: 3, degree: 'Bachelor of Science in Computer Science', school: 'Technical University of Berlin', gradYear: 2022, skills: ['React Native', 'JavaScript', 'TypeScript', 'Android', 'Redux', 'Git'], roles: [['Appwerk', 'Mobile Developer', 2022, 2026]], blurb: 'Mobile developer shipping cross-platform apps with React Native.' },
];

const JOBS = [
  { r: 0, title: 'Senior Full Stack Engineer', loc: 'Remote (Global)', mode: 'REMOTE', type: 'FULL_TIME', level: 'SENIOR', exp: 4, sal: [95000, 130000], status: 'ACTIVE', age: 12, views: 214, desc: 'Own features end to end across our React dashboard and Node.js services. You will design APIs, model data in PostgreSQL and mentor two mid-level engineers.', req: '4+ years of experience building production web apps. Bachelor degree in computer science or equivalent.', skills: [['React', 1], ['Node.js', 1], ['PostgreSQL', 1], ['Prisma', 1], ['REST APIs', 1], ['Docker', 0], ['AWS', 0]] },
  { r: 0, title: 'Frontend Engineer', loc: 'Berlin, Germany', mode: 'HYBRID', type: 'FULL_TIME', level: 'MID', exp: 2, sal: [60000, 85000], status: 'ACTIVE', age: 9, views: 168, desc: 'Build the component library and data-heavy views that thousands of engineers use every day. Accessibility and performance are part of the definition of done.', req: '2+ years of experience with modern React.', skills: [['React', 1], ['TypeScript', 1], ['Tailwind CSS', 1], ['Jest', 1], ['Redux', 0], ['Figma', 0]] },
  { r: 0, title: 'Backend Engineer (Python)', loc: 'Pune, India', mode: 'HYBRID', type: 'FULL_TIME', level: 'MID', exp: 3, sal: [40000, 60000], status: 'ACTIVE', age: 7, views: 131, desc: 'Scale the ingestion pipeline that processes billions of events a day. You will write Python services, tune PostgreSQL queries and improve reliability.', req: '3+ years of experience with Python web frameworks.', skills: [['Python', 1], ['Django', 1], ['PostgreSQL', 1], ['Docker', 1], ['AWS', 0], ['Redis', 0]] },
  { r: 0, title: 'DevOps Engineer', loc: 'Austin, TX', mode: 'ONSITE', type: 'FULL_TIME', level: 'SENIOR', exp: 4, sal: [110000, 145000], status: 'ACTIVE', age: 20, views: 96, desc: 'Run and evolve our Kubernetes platform on AWS. Codify infrastructure with Terraform and improve deployment safety for every team.', req: '4+ years of experience in infrastructure or SRE roles.', skills: [['AWS', 1], ['Kubernetes', 1], ['Terraform', 1], ['CI/CD', 1], ['Linux', 1], ['Python', 0]] },
  { r: 0, title: 'Junior Web Developer', loc: 'Remote (India)', mode: 'REMOTE', type: 'FULL_TIME', level: 'ENTRY', exp: 0, sal: [12000, 18000], status: 'ACTIVE', age: 4, views: 302, desc: 'Join the web team to build and polish customer-facing pages. You will pair with senior engineers and ship small features in your first month.', req: 'Strong fundamentals; projects or internships welcome.', skills: [['JavaScript', 1], ['React', 1], ['HTML5', 1], ['CSS3', 1], ['Git', 1], ['Node.js', 0]] },
  { r: 0, title: 'Staff Platform Engineer', loc: 'Remote (Global)', mode: 'REMOTE', type: 'FULL_TIME', level: 'LEAD', exp: 8, sal: [160000, 200000], status: 'DRAFT', age: 1, views: 0, desc: 'Define the technical direction of our internal platform. This role is still being scoped with engineering leadership and is not yet published.', req: '8+ years of experience.', skills: [['Kubernetes', 1], ['AWS', 1], ['System Design', 1]] },
  { r: 1, title: 'Data Scientist', loc: 'Austin, TX', mode: 'HYBRID', type: 'FULL_TIME', level: 'MID', exp: 2, sal: [90000, 120000], status: 'ACTIVE', age: 10, views: 143, desc: 'Develop models that predict appointment no-shows and optimise clinic schedules. You will work with clinicians and ship models to production with the platform team.', req: '2+ years of experience. Master degree preferred.', skills: [['Python', 1], ['Pandas', 1], ['scikit-learn', 1], ['SQL', 1], ['Machine Learning', 1], ['TensorFlow', 0]] },
  { r: 1, title: 'Java Backend Developer', loc: 'Madrid, Spain', mode: 'HYBRID', type: 'FULL_TIME', level: 'SENIOR', exp: 5, sal: [55000, 75000], status: 'ACTIVE', age: 15, views: 88, desc: 'Maintain and extend the Spring Boot services behind our clinic scheduling product, with a focus on data integrity and uptime.', req: '5+ years of experience with Java.', skills: [['Java', 1], ['Spring Boot', 1], ['MySQL', 1], ['Hibernate', 1], ['Microservices', 0], ['AWS', 0]] },
  { r: 1, title: 'Mobile Engineer (React Native)', loc: 'Remote (EU)', mode: 'REMOTE', type: 'CONTRACT', level: 'MID', exp: 3, sal: [70000, 90000], status: 'ACTIVE', age: 6, views: 74, desc: 'Own the patient mobile app on iOS and Android. You will ship weekly releases and partner with design on accessibility improvements.', req: '3+ years of experience shipping mobile apps.', skills: [['React Native', 1], ['TypeScript', 1], ['Android', 0], ['Redux', 0]] },
  { r: 1, title: 'QA Automation Engineer', loc: 'Austin, TX', mode: 'ONSITE', type: 'FULL_TIME', level: 'MID', exp: 2, sal: [70000, 90000], status: 'PAUSED', age: 30, views: 51, desc: 'Build end-to-end test suites for our scheduling flows. Hiring is paused while the team plan is finalised.', req: '2+ years of experience in test automation.', skills: [['Selenium', 1], ['Cypress', 1], ['Jest', 0]] },
  { r: 1, title: 'Customer Support Engineer', loc: 'Austin, TX', mode: 'ONSITE', type: 'PART_TIME', level: 'ENTRY', exp: 0, sal: [30000, 40000], status: 'CLOSED', age: 45, views: 120, desc: 'Help clinics troubleshoot integrations. This position has been filled and is kept for reporting.', req: 'Great communication.', skills: [['SQL', 1], ['REST APIs', 0]] },
];

// [candidate index, job index, final status, applied N days ago]
const APPLICATIONS = [
  [0, 0, 'INTERVIEW', 8], [0, 4, 'APPLIED', 2], [0, 2, 'REVIEWING', 5],
  [1, 1, 'SHORTLISTED', 7], [1, 0, 'APPLIED', 3], [1, 4, 'REJECTED', 3],
  [2, 2, 'OFFER', 6], [2, 0, 'REVIEWING', 9], [2, 3, 'APPLIED', 4],
  [3, 6, 'SHORTLISTED', 8], [3, 2, 'APPLIED', 2],
  [4, 3, 'INTERVIEW', 15], [4, 2, 'REVIEWING', 5],
  [5, 4, 'REVIEWING', 3], [5, 1, 'REJECTED', 6],
  [6, 7, 'SHORTLISTED', 12], [6, 0, 'APPLIED', 4],
  [7, 8, 'REVIEWING', 4], [7, 1, 'APPLIED', 1],
];

function resumePdf(c, filePath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    const h = (t) => { doc.moveDown(0.6).font('Helvetica-Bold').fontSize(12).text(t); doc.font('Helvetica').fontSize(10); };
    doc.font('Helvetica-Bold').fontSize(20).text(c.name.toUpperCase(), { align: 'center' });
    doc.font('Helvetica').fontSize(10).text(`${c.email} | +1 555 010 ${String(c.name.length * 37).padStart(4, '0').slice(0, 4)} | ${c.location}`, { align: 'center' });
    h('Summary');
    doc.text(`${c.blurb} ${c.years >= 1 ? `${c.years} years of experience.` : 'Early-career engineer.'}`);
    h('Experience');
    c.roles.forEach(([company, title, from, to]) => {
      doc.font('Helvetica-Bold').text(`${company}   Jan ${from} - ${to >= 2026 ? 'Present' : `Dec ${to}`}`);
      doc.font('Helvetica').text(title);
      doc.text(`• Delivered projects using ${c.skills.slice(0, 4).join(', ')}.`);
    });
    h('Education');
    doc.text(c.school);
    doc.text(`${c.degree} ${c.gradYear - 4} - ${c.gradYear}`);
    h('Skills');
    doc.text(c.skills.join(', '));
    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

async function wipe() {
  for (const m of ['notification', 'recruiterNote', 'interview', 'applicationStatusHistory', 'matchResult', 'application', 'savedJob', 'resume', 'candidateSkill', 'jobSkill', 'job', 'skill', 'recruiterProfile', 'candidateProfile', 'company', 'user']) {
    await prisma[m].deleteMany();
  }
  fs.rmSync(RESUME_DIR, { recursive: true, force: true });
  fs.mkdirSync(RESUME_DIR, { recursive: true });
}

async function main() {
  const health = await ai.health();
  if (!health.ok) throw new Error(`Start the Python AI service first (${health.error}). Seeding needs it to parse resumes and score applicants.`);
  const reset = process.argv.includes('--reset');
  if ((await prisma.user.count()) > 0 && !reset) {
    console.log('Database already contains data. Re-run with --reset to wipe and reseed.');
    return;
  }
  if (reset) await wipe();

  const hash = await bcrypt.hash(PASSWORD, 10);
  await prisma.user.create({ data: { name: 'Platform Admin', email: 'admin@ats.dev', passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10), role: 'ADMIN' } });

  const recruiters = [];
  for (const r of RECRUITERS) {
    const user = await prisma.user.create({ data: { name: r.name, email: r.email, passwordHash: hash, role: 'RECRUITER', lastLoginAt: daysAgo(0) } });
    const company = await prisma.company.create({ data: r.company });
    const profile = await prisma.recruiterProfile.create({ data: { userId: user.id, companyId: company.id, jobTitle: r.title } });
    recruiters.push({ user, profile, company });
  }

  const jobs = [];
  for (const j of JOBS) {
    const rec = recruiters[j.r];
    const job = await prisma.job.create({
      data: {
        recruiterId: rec.profile.id, companyId: rec.company.id, title: j.title, description: j.desc, requirements: j.req, location: j.loc,
        workMode: j.mode, jobType: j.type, experienceLevel: j.level, minExperience: j.exp, salaryMin: j.sal[0], salaryMax: j.sal[1],
        currency: j.loc.includes('Spain') || j.loc.includes('Berlin') || j.loc.includes('EU') ? 'EUR' : j.loc.includes('India') || j.loc.includes('Pune') ? 'USD' : 'USD',
        status: j.status, viewCount: j.views, publishedAt: j.status === 'DRAFT' ? null : daysAgo(j.age), createdAt: daysAgo(j.age + 1),
      },
    });
    const skills = await upsertSkills(j.skills.map(([name]) => name));
    await prisma.jobSkill.createMany({ data: j.skills.map(([name, req], i) => ({ jobId: job.id, skillId: skills.find((s) => s.name === name).id, isRequired: !!req })) });
    jobs.push(job);
  }

  const candidates = [];
  for (const c of CANDIDATES) {
    const user = await prisma.user.create({ data: { name: c.name, email: c.email, passwordHash: hash, role: 'CANDIDATE', createdAt: daysAgo(20 + candidates.length), lastLoginAt: daysAgo(1) } });
    const profile = await prisma.candidateProfile.create({
      data: {
        userId: user.id, headline: c.headline, location: c.location, phone: `+1 555 01${candidates.length}0`, yearsExperience: c.years,
        summary: c.blurb, githubUrl: `https://github.com/${c.name.split(' ')[0].toLowerCase()}-demo`,
        education: [{ degree: c.degree, field: '', institution: c.school, year: String(c.gradYear) }],
        experience: c.roles.map(([company, title, from, to]) => ({ title, company, period: `${from} - ${to >= 2026 ? 'Present' : to}`, description: '' })),
      },
    });
    const skills = await upsertSkills(c.skills);
    await prisma.candidateSkill.createMany({ data: skills.map((s) => ({ candidateId: profile.id, skillId: s.id, source: 'MANUAL' })) });

    const storedName = `${crypto.randomBytes(16).toString('hex')}.pdf`;
    const filePath = path.join(RESUME_DIR, storedName);
    await resumePdf(c, filePath);
    const stat = fs.statSync(filePath);
    const resume = await prisma.resume.create({
      data: { candidateId: profile.id, originalName: `${c.name.replace(' ', '_')}_Resume.pdf`, storedName, mimeType: 'application/pdf', sizeBytes: stat.size, isPrimary: true },
    });
    await resumeService.parseAndSync(resume, profile);
    candidates.push({ user, profile, c });
  }

  // Applications go through the real service, then recruiters move them through the pipeline.
  const appIds = [];
  for (const [ci, ji, finalStatus, ago] of APPLICATIONS) {
    const cand = candidates[ci];
    const job = jobs[ji];
    const app = await applicationService.apply({ id: cand.user.id, name: cand.user.name }, job.id, { coverLetter: `Hello, I am excited about the ${JOBS[ji].title} role and believe my background is a strong fit.` }, { autoScore: false });
    await prisma.application.update({ where: { id: app.id }, data: { appliedAt: daysAgo(ago, 9 + (ci % 6)) } });
    appIds.push([app.id, ji, finalStatus, ci]);
  }
  for (const jobIdx of [...new Set(APPLICATIONS.map((a) => a[1]))]) await matching.rankJob(jobs[jobIdx].id);

  const pipeline = { REVIEWING: ['REVIEWING'], SHORTLISTED: ['REVIEWING', 'SHORTLISTED'], INTERVIEW: ['REVIEWING', 'SHORTLISTED'], OFFER: ['REVIEWING', 'SHORTLISTED', 'INTERVIEW', 'OFFER'], REJECTED: ['REVIEWING', 'REJECTED'], APPLIED: [] };
  for (const [appId, ji, finalStatus, ci] of appIds) {
    const recUser = recruiters[JOBS[ji].r].user;
    for (const step of pipeline[finalStatus] || []) await applicationService.changeStatus(recUser, appId, step);
    if (finalStatus === 'INTERVIEW') await applicationService.scheduleInterview(recUser, appId, { scheduledAt: inDays(2 + (ci % 3)), durationMins: 45, mode: 'VIDEO', location: 'https://meet.example.com/ats-interview', notes: 'Technical deep dive with the hiring manager.' });
    if (['SHORTLISTED', 'INTERVIEW', 'OFFER'].includes(finalStatus)) await applicationService.addNote(recUser, appId, 'Strong profile. Good alignment with the required stack, check depth on system design in the next round.');
  }

  // A few saved jobs for the demo candidate
  await prisma.savedJob.createMany({ data: [jobs[1].id, jobs[3].id, jobs[6].id].map((jobId) => ({ candidateId: candidates[0].profile.id, jobId })) });

  console.log('\nSeed complete.\n');
  console.log('  Role        Email                  Password');
  console.log(`  Admin       admin@ats.dev          ${ADMIN_PASSWORD}`);
  console.log(`  Recruiter   recruiter@ats.dev      ${PASSWORD}   (Northwind Labs)`);
  console.log(`  Recruiter   recruiter2@ats.dev     ${PASSWORD}   (Brightpath Health)`);
  console.log(`  Candidate   candidate@ats.dev      ${PASSWORD}   (Aarav Sharma, full demo profile)`);
  console.log(`  Candidates  priya|rohan|sara|liam|meera|diego|hannah @ats.dev  ${PASSWORD}\n`);
}

main()
  .catch((e) => { console.error(e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

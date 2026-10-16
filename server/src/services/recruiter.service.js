const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');

async function getRecruiter(userId) {
  const r = await prisma.recruiterProfile.findUnique({ where: { userId }, include: { company: true } });
  if (!r) throw ApiError.notFound('Recruiter profile not found');
  return r;
}

async function getCompany(userId) {
  const r = await getRecruiter(userId);
  return { ...r.company, jobTitle: r.jobTitle, phone: r.phone };
}

async function updateCompany(userId, body) {
  const r = await getRecruiter(userId);
  const { jobTitle, phone, ...company } = body;
  await prisma.company.update({ where: { id: r.companyId }, data: company });
  if (jobTitle !== undefined || phone !== undefined) await prisma.recruiterProfile.update({ where: { id: r.id }, data: { jobTitle, phone } });
  return getCompany(userId);
}

const dayKey = (d) => d.toISOString().slice(0, 10);

function lastNDays(n) {
  const out = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i -= 1) out.push(new Date(today.getTime() - i * 86_400_000));
  return out;
}

async function dashboard(userId) {
  const r = await getRecruiter(userId);
  const jobScope = { recruiterId: r.id };
  const [jobCounts, appCounts, recent, interviews, scoreAgg, unread] = await Promise.all([
    prisma.job.groupBy({ by: ['status'], where: jobScope, _count: { _all: true } }),
    prisma.application.groupBy({ by: ['status'], where: { job: jobScope }, _count: { _all: true } }),
    prisma.application.findMany({
      where: { job: jobScope, status: { not: 'WITHDRAWN' } }, orderBy: { appliedAt: 'desc' }, take: 6,
      include: { job: { select: { id: true, title: true } }, candidate: { select: { headline: true, user: { select: { name: true } } } }, match: { select: { score: true, status: true } } },
    }),
    prisma.interview.findMany({
      where: { status: 'SCHEDULED', scheduledAt: { gte: new Date() }, application: { job: jobScope } },
      orderBy: { scheduledAt: 'asc' }, take: 5,
      include: { application: { select: { id: true, jobId: true, job: { select: { title: true } }, candidate: { select: { user: { select: { name: true } } } } } } },
    }),
    prisma.matchResult.aggregate({ where: { status: 'COMPLETED', application: { job: jobScope, status: { not: 'WITHDRAWN' } } }, _avg: { score: true } }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);
  const jobs = Object.fromEntries(jobCounts.map((j) => [j.status, j._count._all]));
  const apps = Object.fromEntries(appCounts.map((a) => [a.status, a._count._all]));
  const totalApps = Object.values(apps).reduce((a, b) => a + b, 0) - (apps.WITHDRAWN || 0);
  return {
    company: { id: r.company.id, name: r.company.name, isVerified: r.company.isVerified },
    stats: {
      activeJobs: jobs.ACTIVE || 0,
      totalJobs: Object.values(jobs).reduce((a, b) => a + b, 0),
      totalApplicants: totalApps,
      newApplicants: apps.APPLIED || 0,
      shortlisted: apps.SHORTLISTED || 0,
      interviewsScheduled: interviews.length,
      avgMatchScore: scoreAgg._avg.score != null ? Math.round(scoreAgg._avg.score * 10) / 10 : null,
      unreadNotifications: unread,
    },
    jobsByStatus: jobs,
    pipeline: apps,
    recentApplicants: recent,
    upcomingInterviews: interviews,
  };
}

async function analytics(userId, days = 30) {
  const r = await getRecruiter(userId);
  const since = new Date(Date.now() - days * 86_400_000);
  const jobScope = { recruiterId: r.id };

  const [apps, jobs, matches, hires] = await Promise.all([
    prisma.application.findMany({ where: { job: jobScope, appliedAt: { gte: since } }, select: { appliedAt: true, status: true } }),
    prisma.job.findMany({
      where: jobScope, orderBy: { createdAt: 'desc' }, take: 50,
      select: { id: true, title: true, status: true, viewCount: true, publishedAt: true, createdAt: true, applications: { select: { status: true, match: { select: { score: true, status: true } } } } },
    }),
    prisma.matchResult.findMany({ where: { status: 'COMPLETED', application: { job: jobScope } }, select: { score: true, matchedSkills: true, missingSkills: true } }),
    prisma.application.findMany({ where: { job: jobScope, status: 'HIRED' }, select: { appliedAt: true, updatedAt: true } }),
  ]);

  const series = lastNDays(days).map((d) => ({ date: dayKey(d), applications: 0 }));
  const idx = new Map(series.map((s, i) => [s.date, i]));
  apps.forEach((a) => { const i = idx.get(dayKey(a.appliedAt)); if (i != null) series[i].applications += 1; });

  const funnelOrder = ['APPLIED', 'REVIEWING', 'SHORTLISTED', 'INTERVIEW', 'OFFER', 'HIRED'];
  const allStatuses = jobs.flatMap((j) => j.applications.map((a) => a.status));
  const reached = (stage) => {
    const at = funnelOrder.indexOf(stage);
    return allStatuses.filter((s) => funnelOrder.indexOf(s) >= at).length;
  };
  const funnel = funnelOrder.map((stage) => ({ stage, count: reached(stage) }));

  const perJob = jobs.map((j) => {
    const live = j.applications.filter((a) => a.status !== 'WITHDRAWN');
    const scores = live.map((a) => a.match).filter((m) => m && m.status === 'COMPLETED').map((m) => m.score);
    const shortlisted = live.filter((a) => ['SHORTLISTED', 'INTERVIEW', 'OFFER', 'HIRED'].includes(a.status)).length;
    return {
      id: j.id, title: j.title, status: j.status, views: j.viewCount, applicants: live.length, shortlisted,
      conversion: j.viewCount ? Math.round((live.length / j.viewCount) * 1000) / 10 : 0,
      avgScore: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null,
    };
  });

  const buckets = [
    { range: '0-24', count: 0 }, { range: '25-49', count: 0 }, { range: '50-74', count: 0 }, { range: '75-100', count: 0 },
  ];
  matches.forEach((m) => { buckets[Math.min(3, Math.floor(m.score / 25))].count += 1; });

  const gap = new Map();
  matches.forEach((m) => m.missingSkills.forEach((s) => gap.set(s, (gap.get(s) || 0) + 1)));
  const topMissing = [...gap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([skill, count]) => ({ skill, count }));

  const ttH = hires.length
    ? Math.round(hires.reduce((sum, h) => sum + (h.updatedAt - h.appliedAt) / 86_400_000, 0) / hires.length)
    : null;

  return { days, series, funnel, perJob, scoreDistribution: buckets, topMissingSkills: topMissing, avgDaysToHire: ttH };
}

module.exports = { getRecruiter, getCompany, updateCompany, dashboard, analytics };

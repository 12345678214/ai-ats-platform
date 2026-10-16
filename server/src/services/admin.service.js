const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { paginated } = require('../utils/pagination');
const { notify } = require('./notification.service');

const dayKey = (d) => d.toISOString().slice(0, 10);

async function stats() {
  const [users, activeJobs, totalJobs, apps, companies, flagged, pendingCompanies, inactiveUsers] = await Promise.all([
    prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
    prisma.job.count({ where: { status: 'ACTIVE' } }),
    prisma.job.count(),
    prisma.application.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.company.count(),
    prisma.job.count({ where: { isFlagged: true } }),
    prisma.company.count({ where: { isVerified: false, isActive: true } }),
    prisma.user.count({ where: { isActive: false } }),
  ]);
  const byRole = Object.fromEntries(users.map((u) => [u.role, u._count._all]));
  const byStatus = Object.fromEntries(apps.map((a) => [a.status, a._count._all]));
  return {
    totals: {
      users: Object.values(byRole).reduce((a, b) => a + b, 0),
      candidates: byRole.CANDIDATE || 0,
      recruiters: byRole.RECRUITER || 0,
      admins: byRole.ADMIN || 0,
      companies, activeJobs, totalJobs,
      applications: Object.values(byStatus).reduce((a, b) => a + b, 0),
    },
    moderation: { flaggedJobs: flagged, unverifiedCompanies: pendingCompanies, deactivatedUsers: inactiveUsers },
    applicationsByStatus: byStatus,
  };
}

async function analytics(days = 30) {
  const since = new Date(Date.now() - days * 86_400_000);
  const [users, jobs, apps, topSkills, topCompanies] = await Promise.all([
    prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.job.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.application.findMany({ where: { appliedAt: { gte: since } }, select: { appliedAt: true } }),
    prisma.jobSkill.groupBy({ by: ['skillId'], _count: { _all: true }, orderBy: { _count: { skillId: 'desc' } }, take: 10 }),
    prisma.job.groupBy({ by: ['companyId'], _count: { _all: true }, orderBy: { _count: { companyId: 'desc' } }, take: 5 }),
  ]);
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const series = [];
  for (let i = days - 1; i >= 0; i -= 1) series.push({ date: dayKey(new Date(today.getTime() - i * 86_400_000)), users: 0, jobs: 0, applications: 0 });
  const idx = new Map(series.map((s, i) => [s.date, i]));
  users.forEach((u) => { const i = idx.get(dayKey(u.createdAt)); if (i != null) series[i].users += 1; });
  jobs.forEach((j) => { const i = idx.get(dayKey(j.createdAt)); if (i != null) series[i].jobs += 1; });
  apps.forEach((a) => { const i = idx.get(dayKey(a.appliedAt)); if (i != null) series[i].applications += 1; });

  const skills = await prisma.skill.findMany({ where: { id: { in: topSkills.map((s) => s.skillId) } } });
  const companies = await prisma.company.findMany({ where: { id: { in: topCompanies.map((c) => c.companyId) } }, select: { id: true, name: true } });
  return {
    days,
    series,
    topSkills: topSkills.map((s) => ({ skill: skills.find((k) => k.id === s.skillId)?.name, jobs: s._count._all })),
    topCompanies: topCompanies.map((c) => ({ company: companies.find((k) => k.id === c.companyId)?.name, jobs: c._count._all })),
  };
}

async function listUsers(q) {
  const where = {};
  if (q.role) where.role = q.role;
  if (q.active) where.isActive = q.active === 'true';
  if (q.q) where.OR = [{ name: { contains: q.q, mode: 'insensitive' } }, { email: { contains: q.q, mode: 'insensitive' } }];
  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.limit, take: q.limit,
      select: {
        id: true, name: true, email: true, role: true, isActive: true, createdAt: true, lastLoginAt: true,
        recruiterProfile: { select: { company: { select: { id: true, name: true } } } },
        candidateProfile: { select: { headline: true, location: true, _count: { select: { applications: true } } } },
      },
    }),
    prisma.user.count({ where }),
  ]);
  return paginated(rows, total, q);
}

async function setUserActive(adminId, id, isActive) {
  if (id === adminId) throw ApiError.badRequest('You cannot deactivate your own account');
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw ApiError.notFound('User not found');
  if (user.role === 'ADMIN') throw ApiError.forbidden('Admin accounts cannot be deactivated here');
  return prisma.user.update({ where: { id }, data: { isActive }, select: { id: true, name: true, isActive: true } });
}

async function listJobs(q) {
  const where = {};
  if (q.status) where.status = q.status;
  if (q.flagged) where.isFlagged = q.flagged === 'true';
  if (q.q) where.OR = [{ title: { contains: q.q, mode: 'insensitive' } }, { company: { name: { contains: q.q, mode: 'insensitive' } } }];
  const [rows, total] = await Promise.all([
    prisma.job.findMany({
      where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.limit, take: q.limit,
      include: { company: { select: { id: true, name: true } }, recruiter: { select: { user: { select: { name: true, email: true } } } }, _count: { select: { applications: true } } },
    }),
    prisma.job.count({ where }),
  ]);
  return paginated(rows.map(({ _count, recruiter, ...j }) => ({ ...j, applicantCount: _count.applications, recruiter: recruiter.user })), total, q);
}

async function flagJob(id, { isFlagged, reason }) {
  const job = await prisma.job.findUnique({ where: { id }, include: { recruiter: { select: { userId: true } } } });
  if (!job) throw ApiError.notFound('Job not found');
  const updated = await prisma.job.update({ where: { id }, data: { isFlagged, flagReason: isFlagged ? reason || 'Flagged by an administrator' : null } });
  await notify(job.recruiter.userId, {
    type: 'SYSTEM',
    title: isFlagged ? 'Job hidden by moderation' : 'Job restored',
    message: isFlagged ? `"${job.title}" was hidden from search. Reason: ${updated.flagReason}` : `"${job.title}" is visible again.`,
    link: '/recruiter/jobs',
  });
  return updated;
}

async function setJobStatus(id, status) {
  return prisma.job.update({ where: { id }, data: { status } });
}

async function deleteJob(id) {
  await prisma.job.delete({ where: { id } });
}

async function listApplications(q) {
  const where = {};
  if (q.status) where.status = q.status;
  if (q.q) where.OR = [{ candidate: { user: { name: { contains: q.q, mode: 'insensitive' } } } }, { job: { title: { contains: q.q, mode: 'insensitive' } } }];
  const [rows, total] = await Promise.all([
    prisma.application.findMany({
      where, orderBy: { appliedAt: 'desc' }, skip: (q.page - 1) * q.limit, take: q.limit,
      include: {
        job: { select: { id: true, title: true, company: { select: { name: true } } } },
        candidate: { select: { user: { select: { name: true, email: true } } } },
        match: { select: { score: true, status: true } },
      },
    }),
    prisma.application.count({ where }),
  ]);
  return paginated(rows, total, q);
}

async function listCompanies(q) {
  const where = {};
  if (q.active) where.isActive = q.active === 'true';
  if (q.q) where.name = { contains: q.q, mode: 'insensitive' };
  const [rows, total] = await Promise.all([
    prisma.company.findMany({
      where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.limit, take: q.limit,
      include: { _count: { select: { jobs: true, recruiters: true } }, recruiters: { take: 1, select: { user: { select: { name: true, email: true } } } } },
    }),
    prisma.company.count({ where }),
  ]);
  return paginated(rows.map(({ _count, recruiters, ...c }) => ({ ...c, jobCount: _count.jobs, recruiterCount: _count.recruiters, owner: recruiters[0]?.user || null })), total, q);
}

async function updateCompany(id, data) {
  const company = await prisma.company.update({ where: { id }, data });
  // Deactivating a company also takes its live jobs off the public site.
  return company;
}

module.exports = { stats, analytics, listUsers, setUserActive, listJobs, flagJob, setJobStatus, deleteJob, listApplications, listCompanies, updateCompany };

const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { upsertSkills } = require('./skill.service');
const { profileCompletion } = require('../utils/profileCompletion');
const { jobInclude, formatJob, publicWhere } = require('./job.service');
const { paginated } = require('../utils/pagination');

async function loadProfile(userId) {
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId },
    include: { user: { select: { name: true, email: true } }, skills: { include: { skill: true }, orderBy: { skill: { name: 'asc' } } } },
  });
  if (!profile) throw ApiError.notFound('Candidate profile not found');
  return profile;
}

async function formatProfile(profile) {
  const resumeCount = await prisma.resume.count({ where: { candidateId: profile.id } });
  const { user, skills, ...rest } = profile;
  return {
    ...rest,
    name: user.name,
    email: user.email,
    skills: skills.map((s) => ({ id: s.skill.id, name: s.skill.name, source: s.source })),
    completion: profileCompletion(profile, { skillCount: skills.length, resumeCount }),
  };
}

async function getProfile(userId) {
  return formatProfile(await loadProfile(userId));
}

async function updateProfile(userId, body) {
  const profile = await loadProfile(userId);
  const { name, ...data } = body;
  await prisma.$transaction(async (tx) => {
    if (name) await tx.user.update({ where: { id: userId }, data: { name } });
    if (Object.keys(data).length) await tx.candidateProfile.update({ where: { id: profile.id }, data });
  });
  return getProfile(userId);
}

async function setSkills(userId, names) {
  const profile = await loadProfile(userId);
  const skills = await upsertSkills(names);
  await prisma.$transaction([
    // Replace manual skills, keep the ones that came from the resume parser unless re-selected.
    prisma.candidateSkill.deleteMany({ where: { candidateId: profile.id, source: 'MANUAL' } }),
    prisma.candidateSkill.createMany({ data: skills.map((s) => ({ candidateId: profile.id, skillId: s.id, source: 'MANUAL' })), skipDuplicates: true }),
  ]);
  return getProfile(userId);
}

async function removeSkill(userId, skillId) {
  const profile = await loadProfile(userId);
  await prisma.candidateSkill.deleteMany({ where: { candidateId: profile.id, skillId } });
}

// ───────── Saved jobs ─────────
async function saveJob(userId, jobId) {
  const profile = await loadProfile(userId);
  const job = await prisma.job.findFirst({ where: { id: jobId, ...publicWhere() }, select: { id: true } });
  if (!job) throw ApiError.notFound('Job not found');
  await prisma.savedJob.upsert({
    where: { candidateId_jobId: { candidateId: profile.id, jobId } },
    update: {},
    create: { candidateId: profile.id, jobId },
  });
}

async function unsaveJob(userId, jobId) {
  const profile = await loadProfile(userId);
  await prisma.savedJob.deleteMany({ where: { candidateId: profile.id, jobId } });
}

async function listSaved(userId, { page, limit }) {
  const profile = await loadProfile(userId);
  const where = { candidateId: profile.id };
  const [rows, total] = await Promise.all([
    prisma.savedJob.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit, include: { job: { include: jobInclude } } }),
    prisma.savedJob.count({ where }),
  ]);
  return paginated(rows.map((r) => formatJob(r.job, { isSaved: true, savedAt: r.createdAt })), total, { page, limit });
}

// ───────── Dashboard ─────────
// Recommendations are ranked by real skill overlap with the candidate's profile.
async function recommendations(profile, limit = 4) {
  const skillIds = profile.skills.map((s) => s.skillId);
  if (!skillIds.length) return [];
  const applied = await prisma.application.findMany({ where: { candidateId: profile.id }, select: { jobId: true } });
  const jobs = await prisma.job.findMany({
    where: { ...publicWhere(), id: { notIn: applied.map((a) => a.jobId) }, skills: { some: { skillId: { in: skillIds } } } },
    include: jobInclude,
    take: 60,
    orderBy: { publishedAt: 'desc' },
  });
  const mine = new Set(skillIds);
  return jobs
    .map((j) => {
      const required = j.skills.filter((s) => s.isRequired);
      const pool = required.length ? required : j.skills;
      const hit = pool.filter((s) => mine.has(s.skillId)).length;
      return { job: j, fit: pool.length ? Math.round((hit / pool.length) * 100) : 0 };
    })
    .sort((a, b) => b.fit - a.fit)
    .slice(0, limit)
    .map(({ job, fit }) => formatJob(job, { skillFit: fit }));
}

async function dashboard(userId) {
  const profile = await prisma.candidateProfile.findUnique({ where: { userId }, include: { skills: true } });
  if (!profile) throw ApiError.notFound('Candidate profile not found');
  const [statusCounts, recent, savedCount, resumeCount, interviews, unread] = await Promise.all([
    prisma.application.groupBy({ by: ['status'], where: { candidateId: profile.id }, _count: { _all: true } }),
    prisma.application.findMany({
      where: { candidateId: profile.id }, orderBy: { appliedAt: 'desc' }, take: 5,
      include: { job: { select: { id: true, title: true, company: { select: { name: true } } } } },
    }),
    prisma.savedJob.count({ where: { candidateId: profile.id } }),
    prisma.resume.count({ where: { candidateId: profile.id } }),
    prisma.interview.findMany({
      where: { status: 'SCHEDULED', scheduledAt: { gte: new Date() }, application: { candidateId: profile.id } },
      orderBy: { scheduledAt: 'asc' }, take: 5,
      include: { application: { select: { job: { select: { title: true, company: { select: { name: true } } } } } } },
    }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);
  const byStatus = Object.fromEntries(statusCounts.map((s) => [s.status, s._count._all]));
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
  return {
    stats: {
      totalApplications: total,
      active: total - (byStatus.REJECTED || 0) - (byStatus.WITHDRAWN || 0) - (byStatus.HIRED || 0),
      shortlisted: byStatus.SHORTLISTED || 0,
      interviews: byStatus.INTERVIEW || 0,
      offers: (byStatus.OFFER || 0) + (byStatus.HIRED || 0),
      savedJobs: savedCount,
      unreadNotifications: unread,
    },
    byStatus,
    completion: profileCompletion(profile, { skillCount: profile.skills.length, resumeCount }),
    recentApplications: recent,
    upcomingInterviews: interviews,
    recommended: await recommendations(profile),
  };
}

module.exports = { getProfile, updateProfile, setSkills, removeSkill, saveJob, unsaveJob, listSaved, dashboard };

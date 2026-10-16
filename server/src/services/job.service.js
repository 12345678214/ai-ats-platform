const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const ai = require('./ai.service');
const { upsertSkills } = require('./skill.service');
const { paginated } = require('../utils/pagination');
const { slugify } = require('../utils/slug');

const jobInclude = {
  company: { select: { id: true, name: true, logoUrl: true, location: true, industry: true, isVerified: true, isActive: true, website: true } },
  skills: { include: { skill: true } },
  _count: { select: { applications: true } },
};

function formatJob(job, extra = {}) {
  const { skills, _count, ...rest } = job;
  return {
    ...rest,
    skills: (skills || []).map((js) => ({ id: js.skill.id, name: js.skill.name, isRequired: js.isRequired })),
    applicantCount: _count?.applications ?? undefined,
    ...extra,
  };
}

const publicWhere = () => ({
  status: 'ACTIVE',
  isFlagged: false,
  company: { isActive: true },
  OR: [{ deadline: null }, { deadline: { gt: new Date() } }],
});

async function search(query, candidateId) {
  const and = [publicWhere()];
  if (query.q) {
    and.push({
      OR: [
        { title: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
        { company: { name: { contains: query.q, mode: 'insensitive' } } },
        { skills: { some: { skill: { name: { contains: query.q, mode: 'insensitive' } } } } },
      ],
    });
  }
  if (query.location) and.push({ location: { contains: query.location, mode: 'insensitive' } });
  if (query.workMode) and.push({ workMode: query.workMode });
  if (query.jobType) and.push({ jobType: query.jobType });
  if (query.experienceLevel) and.push({ experienceLevel: query.experienceLevel });
  if (query.salaryMin) and.push({ OR: [{ salaryMax: { gte: query.salaryMin } }, { salaryMin: { gte: query.salaryMin } }] });
  if (query.skills) {
    const slugs = query.skills.split(',').map(slugify).filter(Boolean);
    if (slugs.length) and.push({ skills: { some: { skill: { slug: { in: slugs } } } } });
  }
  const orderBy = {
    newest: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    oldest: [{ publishedAt: 'asc' }],
    salary: [{ salaryMax: { sort: 'desc', nulls: 'last' } }],
    title: [{ title: 'asc' }],
  }[query.sort];
  const where = { AND: and };
  const skip = (query.page - 1) * query.limit;

  const [rows, total] = await Promise.all([
    prisma.job.findMany({ where, orderBy, skip, take: query.limit, include: jobInclude }),
    prisma.job.count({ where }),
  ]);

  let applied = new Map();
  let saved = new Set();
  if (candidateId && rows.length) {
    const ids = rows.map((r) => r.id);
    const [a, s] = await Promise.all([
      prisma.application.findMany({ where: { candidateId, jobId: { in: ids } }, select: { jobId: true, status: true } }),
      prisma.savedJob.findMany({ where: { candidateId, jobId: { in: ids } }, select: { jobId: true } }),
    ]);
    applied = new Map(a.map((x) => [x.jobId, x.status]));
    saved = new Set(s.map((x) => x.jobId));
  }
  const items = rows.map((r) =>
    formatJob(r, candidateId ? { applicationStatus: applied.get?.(r.id) || null, isSaved: saved.has(r.id) } : {}),
  );
  return paginated(items, total, { page: query.page, limit: query.limit });
}

async function getPublic(id, viewer) {
  const job = await prisma.job.findUnique({ where: { id }, include: jobInclude });
  if (!job) throw ApiError.notFound('Job not found');

  const isOwner = viewer?.role === 'RECRUITER' && (await ownsJob(viewer.id, job.id));
  const isAdmin = viewer?.role === 'ADMIN';
  const visible = job.status === 'ACTIVE' && !job.isFlagged && job.company.isActive;
  if (!visible && !isOwner && !isAdmin) throw ApiError.notFound('This job is no longer available');

  if (!isOwner && !isAdmin) {
    await prisma.job.update({ where: { id }, data: { viewCount: { increment: 1 } } });
    job.viewCount += 1;
  }

  const extra = {};
  if (viewer?.role === 'CANDIDATE') {
    const cand = await prisma.candidateProfile.findUnique({ where: { userId: viewer.id }, select: { id: true } });
    if (cand) {
      const [app, savedRow] = await Promise.all([
        prisma.application.findUnique({ where: { jobId_candidateId: { jobId: id, candidateId: cand.id } }, select: { id: true, status: true } }),
        prisma.savedJob.findUnique({ where: { candidateId_jobId: { candidateId: cand.id, jobId: id } } }),
      ]);
      extra.application = app;
      extra.applicationStatus = app?.status || null;
      extra.isSaved = !!savedRow;
    }
  }
  if (!isOwner && !isAdmin) delete job._count;
  return formatJob(job, extra);
}

async function ownsJob(userId, jobId) {
  const job = await prisma.job.findFirst({ where: { id: jobId, recruiter: { userId } }, select: { id: true } });
  return !!job;
}

async function syncSkills(jobId, skills) {
  const resolved = await upsertSkills(skills.map((s) => ({ name: s.name })));
  const bySlug = new Map(resolved.map((r) => [r.slug, r]));
  const rows = skills
    .map((s) => ({ skill: bySlug.get(slugify(s.name)), isRequired: s.isRequired !== false }))
    .filter((r) => r.skill);
  const seen = new Set();
  const data = rows.filter((r) => (seen.has(r.skill.id) ? false : seen.add(r.skill.id))).map((r) => ({ jobId, skillId: r.skill.id, isRequired: r.isRequired }));
  await prisma.$transaction([
    prisma.jobSkill.deleteMany({ where: { jobId } }),
    prisma.jobSkill.createMany({ data }),
  ]);
}

// If the recruiter did not list skills, ask the AI service to extract them from the description.
async function deriveSkills(body) {
  try {
    const out = await ai.extractJobSkills({ title: body.title, description: body.description, requirements: body.requirements });
    return { skills: out.skills.map((s) => ({ name: s.name, isRequired: s.required })), minExperience: out.minExperience };
  } catch (err) {
    console.warn('[jobs] skill extraction skipped:', err.message);
    return { skills: [], minExperience: null };
  }
}

async function create(recruiter, body) {
  const { skills, ...data } = body;
  let finalSkills = skills;
  if (!finalSkills || finalSkills.length === 0) {
    const derived = await deriveSkills(body);
    finalSkills = derived.skills;
    if (!body.minExperience && derived.minExperience) data.minExperience = derived.minExperience;
  }
  const job = await prisma.job.create({
    data: {
      ...data,
      recruiterId: recruiter.id,
      companyId: recruiter.companyId,
      publishedAt: data.status === 'ACTIVE' ? new Date() : null,
    },
  });
  if (finalSkills.length) await syncSkills(job.id, finalSkills);
  return getForRecruiter(job.id);
}

async function update(recruiter, id, body) {
  const existing = await prisma.job.findFirst({ where: { id, recruiterId: recruiter.id } });
  if (!existing) throw ApiError.notFound('Job not found');
  const { skills, ...data } = body;
  if (data.status === 'ACTIVE' && !existing.publishedAt) data.publishedAt = new Date();
  await prisma.job.update({ where: { id }, data });
  if (skills) await syncSkills(id, skills);
  return getForRecruiter(id);
}

async function setStatus(recruiter, id, status) {
  const existing = await prisma.job.findFirst({ where: { id, recruiterId: recruiter.id } });
  if (!existing) throw ApiError.notFound('Job not found');
  const data = { status };
  if (status === 'ACTIVE' && !existing.publishedAt) data.publishedAt = new Date();
  await prisma.job.update({ where: { id }, data });
  return getForRecruiter(id);
}

async function remove(recruiter, id) {
  const job = await prisma.job.findFirst({ where: { id, recruiterId: recruiter.id }, include: { _count: { select: { applications: true } } } });
  if (!job) throw ApiError.notFound('Job not found');
  if (job._count.applications > 0) {
    throw ApiError.conflict('This job already has applicants. Close it instead of deleting it so their history is kept.');
  }
  await prisma.job.delete({ where: { id } });
}

async function getForRecruiter(id) {
  const job = await prisma.job.findUnique({ where: { id }, include: jobInclude });
  return formatJob(job);
}

async function listForRecruiter(recruiter, { status, q, page, limit }) {
  const where = { recruiterId: recruiter.id };
  if (status) where.status = status;
  if (q) where.title = { contains: q, mode: 'insensitive' };
  const [rows, total] = await Promise.all([
    prisma.job.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit, include: jobInclude }),
    prisma.job.count({ where }),
  ]);
  const ids = rows.map((r) => r.id);
  const shortlisted = ids.length
    ? await prisma.application.groupBy({ by: ['jobId'], where: { jobId: { in: ids }, status: { in: ['SHORTLISTED', 'INTERVIEW', 'OFFER', 'HIRED'] } }, _count: { _all: true } })
    : [];
  const avg = ids.length
    ? await prisma.matchResult.findMany({ where: { application: { jobId: { in: ids } }, status: 'COMPLETED' }, select: { score: true, application: { select: { jobId: true } } } })
    : [];
  const shortMap = new Map(shortlisted.map((s) => [s.jobId, s._count._all]));
  const scoreMap = new Map();
  avg.forEach((m) => {
    const arr = scoreMap.get(m.application.jobId) || [];
    arr.push(m.score);
    scoreMap.set(m.application.jobId, arr);
  });
  const items = rows.map((r) => {
    const scores = scoreMap.get(r.id) || [];
    return formatJob(r, {
      shortlistedCount: shortMap.get(r.id) || 0,
      avgMatchScore: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null,
    });
  });
  return paginated(items, total, { page, limit });
}

module.exports = { search, getPublic, create, update, setStatus, remove, getForRecruiter, listForRecruiter, ownsJob, formatJob, jobInclude, publicWhere };

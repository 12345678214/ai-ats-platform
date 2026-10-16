const prisma = require('../config/prisma');
const jobService = require('../services/job.service');
const asyncHandler = require('../utils/asyncHandler');
const { parsePagination } = require('../utils/pagination');

async function candidateIdOf(user) {
  if (!user || user.role !== 'CANDIDATE') return null;
  const c = await prisma.candidateProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
  return c?.id || null;
}

exports.search = asyncHandler(async (req, res) => {
  res.json(await jobService.search(req.validatedQuery, await candidateIdOf(req.user)));
});
exports.get = asyncHandler(async (req, res) => res.json({ job: await jobService.getPublic(req.params.id, req.user) }));

// Skills autocomplete for forms and filters
exports.skills = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  const skills = await prisma.skill.findMany({
    where: q ? { name: { contains: q, mode: 'insensitive' } } : {},
    orderBy: q ? { name: 'asc' } : { jobs: { _count: 'desc' } },
    take: 20,
    select: { id: true, name: true, category: true },
  });
  res.json({ skills });
});

// Recruiter-owned jobs
exports.listMine = asyncHandler(async (req, res) => {
  const recruiter = await require('../services/recruiter.service').getRecruiter(req.user.id);
  const { page, limit } = parsePagination(req.query, { defaultLimit: 10 });
  const status = ['DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED'].includes(req.query.status) ? req.query.status : undefined;
  res.json(await jobService.listForRecruiter(recruiter, { status, q: req.query.q, page, limit }));
});
exports.getMine = asyncHandler(async (req, res) => {
  const recruiter = await require('../services/recruiter.service').getRecruiter(req.user.id);
  if (!(await jobService.ownsJob(req.user.id, req.params.id))) return res.status(404).json({ error: { message: 'Job not found' } });
  res.json({ job: await jobService.getForRecruiter(req.params.id), companyId: recruiter.companyId });
});
exports.create = asyncHandler(async (req, res) => {
  const recruiter = await require('../services/recruiter.service').getRecruiter(req.user.id);
  res.status(201).json({ job: await jobService.create(recruiter, req.body) });
});
exports.update = asyncHandler(async (req, res) => {
  const recruiter = await require('../services/recruiter.service').getRecruiter(req.user.id);
  res.json({ job: await jobService.update(recruiter, req.params.id, req.body) });
});
exports.setStatus = asyncHandler(async (req, res) => {
  const recruiter = await require('../services/recruiter.service').getRecruiter(req.user.id);
  res.json({ job: await jobService.setStatus(recruiter, req.params.id, req.body.status) });
});
exports.remove = asyncHandler(async (req, res) => {
  const recruiter = await require('../services/recruiter.service').getRecruiter(req.user.id);
  await jobService.remove(recruiter, req.params.id);
  res.status(204).end();
});

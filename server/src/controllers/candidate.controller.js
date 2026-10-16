const fs = require('fs');
const path = require('path');
const asyncHandler = require('../utils/asyncHandler');
const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const candidateService = require('../services/candidate.service');
const resumeService = require('../services/resume.service');
const applicationService = require('../services/application.service');
const { RESUME_DIR } = require('../middleware/upload');
const { parsePagination } = require('../utils/pagination');

exports.dashboard = asyncHandler(async (req, res) => res.json(await candidateService.dashboard(req.user.id)));
exports.getProfile = asyncHandler(async (req, res) => res.json({ profile: await candidateService.getProfile(req.user.id) }));
exports.updateProfile = asyncHandler(async (req, res) => res.json({ profile: await candidateService.updateProfile(req.user.id, req.body) }));
exports.setSkills = asyncHandler(async (req, res) => res.json({ profile: await candidateService.setSkills(req.user.id, req.body.skills) }));
exports.removeSkill = asyncHandler(async (req, res) => {
  await candidateService.removeSkill(req.user.id, req.params.skillId);
  res.status(204).end();
});

exports.listResumes = asyncHandler(async (req, res) => {
  const candidate = await applicationService.getCandidate(req.user.id);
  res.json({ resumes: await resumeService.list(candidate.id) });
});
exports.uploadResume = asyncHandler(async (req, res) => {
  const candidate = await applicationService.getCandidate(req.user.id);
  const resume = await resumeService.handleUpload(candidate, req.file);
  res.status(201).json({ resume, profile: await candidateService.getProfile(req.user.id) });
});
exports.reparseResume = asyncHandler(async (req, res) => {
  const candidate = await applicationService.getCandidate(req.user.id);
  res.json({ resume: await resumeService.reparse(candidate, req.params.id) });
});
exports.primaryResume = asyncHandler(async (req, res) => {
  const candidate = await applicationService.getCandidate(req.user.id);
  await resumeService.setPrimary(candidate.id, req.params.id);
  res.json({ resumes: await resumeService.list(candidate.id) });
});
exports.deleteResume = asyncHandler(async (req, res) => {
  const candidate = await applicationService.getCandidate(req.user.id);
  await resumeService.remove(candidate, req.params.id);
  res.status(204).end();
});

// Download: the owning candidate, the recruiter who received the application, or an admin.
exports.downloadResume = asyncHandler(async (req, res) => {
  const resume = await prisma.resume.findUnique({ where: { id: req.params.id }, include: { candidate: { select: { userId: true } } } });
  if (!resume) throw ApiError.notFound('Resume not found');
  const { user } = req;
  let allowed = user.role === 'ADMIN' || resume.candidate.userId === user.id;
  if (!allowed && user.role === 'RECRUITER') {
    allowed = !!(await prisma.application.findFirst({ where: { resumeId: resume.id, job: { recruiter: { userId: user.id } } }, select: { id: true } }));
  }
  if (!allowed) throw ApiError.forbidden();
  const file = path.join(RESUME_DIR, resume.storedName);
  if (!fs.existsSync(file)) throw ApiError.notFound('The file is no longer available');
  res.setHeader('Content-Type', resume.mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(resume.originalName)}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  fs.createReadStream(file).pipe(res);
});

exports.apply = asyncHandler(async (req, res) => {
  const application = await applicationService.apply(req.user, req.params.id, req.body);
  res.status(201).json({ application });
});
exports.listApplications = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query, { defaultLimit: 10 });
  const status = req.query.status || undefined;
  res.json(await applicationService.listForCandidate(req.user, { status, page, limit }));
});
exports.getApplication = asyncHandler(async (req, res) => res.json({ application: await applicationService.getForCandidate(req.user, req.params.id) }));
exports.withdraw = asyncHandler(async (req, res) => {
  await applicationService.withdraw(req.user, req.params.id);
  res.json({ message: 'Application withdrawn' });
});

exports.listSaved = asyncHandler(async (req, res) => res.json(await candidateService.listSaved(req.user.id, parsePagination(req.query, { defaultLimit: 12 }))));
exports.saveJob = asyncHandler(async (req, res) => {
  await candidateService.saveJob(req.user.id, req.params.jobId);
  res.status(201).json({ saved: true });
});
exports.unsaveJob = asyncHandler(async (req, res) => {
  await candidateService.unsaveJob(req.user.id, req.params.jobId);
  res.status(204).end();
});

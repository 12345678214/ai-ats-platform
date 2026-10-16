const asyncHandler = require('../utils/asyncHandler');
const recruiterService = require('../services/recruiter.service');
const applicationService = require('../services/application.service');
const matching = require('../services/matching.service');
const ai = require('../services/ai.service');
const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');

exports.dashboard = asyncHandler(async (req, res) => res.json(await recruiterService.dashboard(req.user.id)));
exports.analytics = asyncHandler(async (req, res) => {
  const days = Math.min(90, Math.max(7, parseInt(req.query.days, 10) || 30));
  res.json(await recruiterService.analytics(req.user.id, days));
});
exports.getCompany = asyncHandler(async (req, res) => res.json({ company: await recruiterService.getCompany(req.user.id) }));
exports.updateCompany = asyncHandler(async (req, res) => res.json({ company: await recruiterService.updateCompany(req.user.id, req.body) }));

exports.listApplicants = asyncHandler(async (req, res) => res.json(await applicationService.listForJob(req.user, req.params.id, req.validatedQuery)));
exports.getApplication = asyncHandler(async (req, res) => res.json({ application: await applicationService.getForRecruiter(req.user, req.params.id) }));
exports.changeStatus = asyncHandler(async (req, res) => {
  await applicationService.changeStatus(req.user, req.params.id, req.body.status);
  res.json({ application: await applicationService.getForRecruiter(req.user, req.params.id) });
});
exports.addNote = asyncHandler(async (req, res) => res.status(201).json({ note: await applicationService.addNote(req.user, req.params.id, req.body.content) }));
exports.scheduleInterview = asyncHandler(async (req, res) => {
  const interview = await applicationService.scheduleInterview(req.user, req.params.id, req.body);
  res.status(201).json({ interview });
});
exports.updateInterview = asyncHandler(async (req, res) => res.json({ interview: await applicationService.updateInterview(req.user, req.params.id, req.body) }));
exports.listInterviews = asyncHandler(async (req, res) => res.json({ interviews: await applicationService.listInterviews(req.user, { upcomingOnly: req.query.upcoming === 'true' }) }));

// Re-run AI ranking for every applicant of a job (e.g. after the job description changed).
exports.rankJob = asyncHandler(async (req, res) => {
  await applicationService.assertJobOwner(req.user.id, req.params.id);
  ai.assertAvailable(await ai.health());
  const summary = await matching.rankJob(req.params.id);
  res.json({ message: `Scored ${summary.scored} applicant(s)`, ...summary });
});
exports.rescoreApplication = asyncHandler(async (req, res) => {
  const app = await prisma.application.findFirst({ where: { id: req.params.id, job: { recruiter: { userId: req.user.id } } } });
  if (!app) throw ApiError.notFound('Application not found');
  const match = await matching.computeForApplication(app.id, { announce: false });
  res.json({ match });
});

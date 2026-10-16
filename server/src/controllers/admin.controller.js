const asyncHandler = require('../utils/asyncHandler');
const admin = require('../services/admin.service');

exports.stats = asyncHandler(async (_req, res) => res.json(await admin.stats()));
exports.analytics = asyncHandler(async (req, res) => res.json(await admin.analytics(Math.min(90, Math.max(7, parseInt(req.query.days, 10) || 30)))));
exports.users = asyncHandler(async (req, res) => res.json(await admin.listUsers(req.validatedQuery)));
exports.setUserActive = asyncHandler(async (req, res) => res.json({ user: await admin.setUserActive(req.user.id, req.params.id, req.body.isActive) }));
exports.jobs = asyncHandler(async (req, res) => res.json(await admin.listJobs(req.validatedQuery)));
exports.flagJob = asyncHandler(async (req, res) => res.json({ job: await admin.flagJob(req.params.id, req.body) }));
exports.setJobStatus = asyncHandler(async (req, res) => res.json({ job: await admin.setJobStatus(req.params.id, req.body.status) }));
exports.deleteJob = asyncHandler(async (req, res) => { await admin.deleteJob(req.params.id); res.status(204).end(); });
exports.applications = asyncHandler(async (req, res) => res.json(await admin.listApplications(req.validatedQuery)));
exports.companies = asyncHandler(async (req, res) => res.json(await admin.listCompanies(req.validatedQuery)));
exports.verifyCompany = asyncHandler(async (req, res) => res.json({ company: await admin.updateCompany(req.params.id, { isVerified: req.body.isVerified }) }));
exports.setCompanyActive = asyncHandler(async (req, res) => res.json({ company: await admin.updateCompany(req.params.id, { isActive: req.body.isActive }) }));

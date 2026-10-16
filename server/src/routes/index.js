const router = require('express').Router();
const { authenticate, optionalAuth, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimit');
const { resumeUpload } = require('../middleware/upload');

const v = {
  auth: require('../validators/auth.validators'),
  job: require('../validators/job.validators'),
  cand: require('../validators/candidate.validators'),
  app: require('../validators/application.validators'),
  admin: require('../validators/admin.validators'),
};
const authC = require('../controllers/auth.controller');
const jobC = require('../controllers/job.controller');
const candC = require('../controllers/candidate.controller');
const recC = require('../controllers/recruiter.controller');
const adminC = require('../controllers/admin.controller');
const notifC = require('../controllers/notification.controller');
const ai = require('../services/ai.service');

router.get('/health', async (_req, res) => res.json({ status: 'ok', ai: await ai.health(), time: new Date().toISOString() }));

// ── Auth
router.post('/auth/register', authLimiter, validate(v.auth.register), authC.register);
router.post('/auth/login', authLimiter, validate(v.auth.login), authC.login);
router.get('/auth/me', authenticate, authC.me);
router.patch('/auth/password', authenticate, validate(v.auth.changePassword), authC.changePassword);

// ── Public job board (optionalAuth adds applied/saved flags for candidates)
router.get('/jobs', optionalAuth, validate(v.job.jobQuery, 'query'), jobC.search);
router.get('/skills', jobC.skills);
router.get('/jobs/:id', optionalAuth, jobC.get);

// ── Notifications (all roles)
router.get('/notifications', authenticate, notifC.list);
router.get('/notifications/unread-count', authenticate, notifC.unreadCount);
router.patch('/notifications/read-all', authenticate, notifC.markAllRead);
router.patch('/notifications/:id/read', authenticate, notifC.markRead);
router.delete('/notifications/:id', authenticate, notifC.remove);

// ── Resume download (owner, receiving recruiter, admin — enforced in controller)
router.get('/resumes/:id/file', authenticate, candC.downloadResume);

// ── Candidate
const cand = [authenticate, authorize('CANDIDATE')];
router.get('/candidate/dashboard', ...cand, candC.dashboard);
router.get('/candidate/profile', ...cand, candC.getProfile);
router.put('/candidate/profile', ...cand, validate(v.cand.profile), candC.updateProfile);
router.put('/candidate/skills', ...cand, validate(v.cand.skills), candC.setSkills);
router.delete('/candidate/skills/:skillId', ...cand, candC.removeSkill);
router.get('/candidate/resumes', ...cand, candC.listResumes);
router.post('/candidate/resumes', ...cand, resumeUpload, candC.uploadResume);
router.post('/candidate/resumes/:id/reparse', ...cand, candC.reparseResume);
router.patch('/candidate/resumes/:id/primary', ...cand, candC.primaryResume);
router.delete('/candidate/resumes/:id', ...cand, candC.deleteResume);
router.post('/jobs/:id/apply', ...cand, validate(v.cand.apply), candC.apply);
router.get('/candidate/applications', ...cand, candC.listApplications);
router.get('/candidate/applications/:id', ...cand, candC.getApplication);
router.patch('/candidate/applications/:id/withdraw', ...cand, candC.withdraw);
router.get('/candidate/saved-jobs', ...cand, candC.listSaved);
router.post('/candidate/saved-jobs/:jobId', ...cand, candC.saveJob);
router.delete('/candidate/saved-jobs/:jobId', ...cand, candC.unsaveJob);

// ── Recruiter
const rec = [authenticate, authorize('RECRUITER')];
router.get('/recruiter/dashboard', ...rec, recC.dashboard);
router.get('/recruiter/analytics', ...rec, recC.analytics);
router.get('/recruiter/company', ...rec, recC.getCompany);
router.put('/recruiter/company', ...rec, validate(v.app.companyBody.extend({ jobTitle: require('zod').z.string().trim().max(80).optional(), phone: require('zod').z.string().trim().max(30).optional() })), recC.updateCompany);
router.get('/recruiter/jobs', ...rec, jobC.listMine);
router.post('/recruiter/jobs', ...rec, validate(v.job.jobBody), jobC.create);
router.get('/recruiter/jobs/:id', ...rec, jobC.getMine);
router.put('/recruiter/jobs/:id', ...rec, validate(v.job.jobUpdate), jobC.update);
router.patch('/recruiter/jobs/:id/status', ...rec, validate(v.job.jobStatus), jobC.setStatus);
router.delete('/recruiter/jobs/:id', ...rec, jobC.remove);
router.get('/recruiter/jobs/:id/applications', ...rec, validate(v.app.applicantQuery, 'query'), recC.listApplicants);
router.post('/recruiter/jobs/:id/rank', ...rec, recC.rankJob);
router.get('/recruiter/applications/:id', ...rec, recC.getApplication);
router.patch('/recruiter/applications/:id/status', ...rec, validate(v.app.status), recC.changeStatus);
router.post('/recruiter/applications/:id/rescore', ...rec, recC.rescoreApplication);
router.post('/recruiter/applications/:id/notes', ...rec, validate(v.app.note), recC.addNote);
router.post('/recruiter/applications/:id/interviews', ...rec, validate(v.app.interview), recC.scheduleInterview);
router.get('/recruiter/interviews', ...rec, recC.listInterviews);
router.patch('/recruiter/interviews/:id', ...rec, validate(v.app.interviewUpdate), recC.updateInterview);

// ── Admin
const adm = [authenticate, authorize('ADMIN')];
router.get('/admin/stats', ...adm, adminC.stats);
router.get('/admin/analytics', ...adm, adminC.analytics);
router.get('/admin/users', ...adm, validate(v.admin.listQuery, 'query'), adminC.users);
router.patch('/admin/users/:id/active', ...adm, validate(v.admin.activeBody), adminC.setUserActive);
router.get('/admin/jobs', ...adm, validate(v.admin.listQuery, 'query'), adminC.jobs);
router.patch('/admin/jobs/:id/flag', ...adm, validate(v.admin.flagBody), adminC.flagJob);
router.patch('/admin/jobs/:id/status', ...adm, validate(v.admin.jobStatusBody), adminC.setJobStatus);
router.delete('/admin/jobs/:id', ...adm, adminC.deleteJob);
router.get('/admin/applications', ...adm, validate(v.admin.listQuery, 'query'), adminC.applications);
router.get('/admin/companies', ...adm, validate(v.admin.listQuery, 'query'), adminC.companies);
router.patch('/admin/companies/:id/verify', ...adm, validate(v.admin.verifyBody), adminC.verifyCompany);
router.patch('/admin/companies/:id/active', ...adm, validate(v.admin.activeBody), adminC.setCompanyActive);

module.exports = router;

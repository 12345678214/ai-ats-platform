const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const matching = require('./matching.service');
const { notify } = require('./notification.service');
const { paginated } = require('../utils/pagination');

const STATUS_COPY = {
  REVIEWING: ['Application under review', 'is now being reviewed'],
  SHORTLISTED: ['You have been shortlisted', 'shortlisted you'],
  INTERVIEW: ['Interview stage', 'moved your application to the interview stage'],
  OFFER: ['You have an offer', 'extended an offer'],
  HIRED: ['Congratulations, you are hired', 'confirmed your hire'],
  REJECTED: ['Application update', 'decided not to move forward with your application'],
};

const candidateSummary = {
  select: {
    id: true, headline: true, location: true, yearsExperience: true,
    user: { select: { id: true, name: true, email: true } },
    skills: { select: { source: true, skill: { select: { name: true } } } },
  },
};

const matchSelect = {
  status: true, score: true, skillScore: true, experienceScore: true, educationScore: true, textScore: true,
  matchedSkills: true, partialSkills: true, missingSkills: true, extraSkills: true, summary: true, error: true, updatedAt: true,
};

const flattenCandidate = (c) => ({
  id: c.id, userId: c.user.id, name: c.user.name, email: c.user.email, headline: c.headline,
  location: c.location, yearsExperience: c.yearsExperience, skills: c.skills.map((s) => s.skill.name),
});

async function getCandidate(userId) {
  const c = await prisma.candidateProfile.findUnique({ where: { userId } });
  if (!c) throw ApiError.notFound('Candidate profile not found');
  return c;
}

async function apply(user, jobId, { resumeId, coverLetter }, { autoScore = true } = {}) {
  const candidate = await getCandidate(user.id);
  const job = await prisma.job.findUnique({ where: { id: jobId }, include: { company: true, recruiter: { select: { userId: true } } } });
  if (!job || job.status !== 'ACTIVE' || job.isFlagged || !job.company.isActive) throw ApiError.notFound('This job is not accepting applications');
  if (job.deadline && job.deadline < new Date()) throw ApiError.badRequest('The application deadline for this job has passed');

  const resume = resumeId
    ? await prisma.resume.findFirst({ where: { id: resumeId, candidateId: candidate.id } })
    : await prisma.resume.findFirst({ where: { candidateId: candidate.id }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }] });
  if (!resume) throw ApiError.badRequest('Upload a resume in your profile before applying');

  const existing = await prisma.application.findUnique({ where: { jobId_candidateId: { jobId, candidateId: candidate.id } } });
  if (existing && existing.status !== 'WITHDRAWN') throw ApiError.conflict('You have already applied to this job');

  const application = await prisma.$transaction(async (tx) => {
    const app = existing
      ? await tx.application.update({ where: { id: existing.id }, data: { status: 'APPLIED', resumeId: resume.id, coverLetter, appliedAt: new Date() } })
      : await tx.application.create({ data: { jobId, candidateId: candidate.id, resumeId: resume.id, coverLetter } });
    await tx.applicationStatusHistory.create({ data: { applicationId: app.id, fromStatus: existing ? 'WITHDRAWN' : null, toStatus: 'APPLIED', changedById: user.id } });
    await tx.matchResult.upsert({ where: { applicationId: app.id }, update: { status: 'PENDING', error: null }, create: { applicationId: app.id } });
    return app;
  });

  await notify(job.recruiter.userId, {
    type: 'APPLICATION_RECEIVED',
    title: 'New applicant',
    message: `${user.name} applied for ${job.title}.`,
    link: `/recruiter/jobs/${job.id}/applicants?application=${application.id}`,
  });

  // The resume is already parsed at upload time; scoring runs in the background so the
  // candidate gets an instant response. The recruiter sees the score as soon as it lands.
  if (autoScore) matching.computeForApplication(application.id).catch((e) => console.error('[match] background scoring failed', e.message));
  return application;
}

async function withdraw(user, applicationId) {
  const candidate = await getCandidate(user.id);
  const app = await prisma.application.findFirst({ where: { id: applicationId, candidateId: candidate.id } });
  if (!app) throw ApiError.notFound('Application not found');
  if (['WITHDRAWN', 'HIRED', 'REJECTED'].includes(app.status)) throw ApiError.badRequest(`This application is already ${app.status.toLowerCase()}`);
  await prisma.$transaction([
    prisma.application.update({ where: { id: app.id }, data: { status: 'WITHDRAWN' } }),
    prisma.applicationStatusHistory.create({ data: { applicationId: app.id, fromStatus: app.status, toStatus: 'WITHDRAWN', changedById: user.id } }),
  ]);
}

// ───────── Candidate-facing reads ─────────
async function listForCandidate(user, { status, page, limit }) {
  const candidate = await getCandidate(user.id);
  const where = { candidateId: candidate.id, ...(status ? { status } : {}) };
  const [rows, total] = await Promise.all([
    prisma.application.findMany({
      where, orderBy: { appliedAt: 'desc' }, skip: (page - 1) * limit, take: limit,
      include: {
        job: { select: { id: true, title: true, location: true, workMode: true, jobType: true, status: true, company: { select: { name: true, logoUrl: true } } } },
        interviews: { where: { status: 'SCHEDULED', scheduledAt: { gte: new Date() } }, orderBy: { scheduledAt: 'asc' }, take: 1 },
      },
    }),
    prisma.application.count({ where }),
  ]);
  return paginated(rows.map((r) => ({ ...r, nextInterview: r.interviews[0] || null, interviews: undefined })), total, { page, limit });
}

async function getForCandidate(user, id) {
  const candidate = await getCandidate(user.id);
  const app = await prisma.application.findFirst({
    where: { id, candidateId: candidate.id },
    include: {
      job: { select: { id: true, title: true, location: true, workMode: true, jobType: true, company: { select: { name: true } } } },
      resume: { select: { id: true, originalName: true } },
      history: { orderBy: { createdAt: 'asc' } },
      interviews: { orderBy: { scheduledAt: 'asc' } },
    },
  });
  if (!app) throw ApiError.notFound('Application not found');
  return app; // recruiter notes and AI scores are intentionally not exposed to candidates
}

// ───────── Recruiter-facing ─────────
async function assertJobOwner(recruiterUserId, jobId) {
  const job = await prisma.job.findFirst({ where: { id: jobId, recruiter: { userId: recruiterUserId } }, select: { id: true, title: true } });
  if (!job) throw ApiError.notFound('Job not found');
  return job;
}

async function listForJob(user, jobId, q) {
  await assertJobOwner(user.id, jobId);
  const and = [{ jobId }];
  if (q.status) and.push({ status: q.status });
  else and.push({ status: { not: 'WITHDRAWN' } });
  if (q.q) {
    and.push({
      OR: [
        { candidate: { user: { name: { contains: q.q, mode: 'insensitive' } } } },
        { candidate: { user: { email: { contains: q.q, mode: 'insensitive' } } } },
        { candidate: { headline: { contains: q.q, mode: 'insensitive' } } },
        { candidate: { location: { contains: q.q, mode: 'insensitive' } } },
      ],
    });
  }
  if (q.minScore != null) and.push({ match: { is: { score: { gte: q.minScore }, status: 'COMPLETED' } } });
  if (q.skill) and.push({ candidate: { skills: { some: { skill: { name: { equals: q.skill, mode: 'insensitive' } } } } } });
  const orderBy = {
    match: [{ match: { score: 'desc' } }, { appliedAt: 'desc' }],
    newest: [{ appliedAt: 'desc' }],
    oldest: [{ appliedAt: 'asc' }],
    name: [{ candidate: { user: { name: 'asc' } } }],
  }[q.sort];
  const where = { AND: and };

  const [rows, total, counts] = await Promise.all([
    prisma.application.findMany({
      where, orderBy, skip: (q.page - 1) * q.limit, take: q.limit,
      include: { candidate: candidateSummary, match: { select: matchSelect }, resume: { select: { id: true, originalName: true } }, _count: { select: { notes: true } } },
    }),
    prisma.application.count({ where }),
    prisma.application.groupBy({ by: ['status'], where: { jobId }, _count: { _all: true } }),
  ]);

  const items = rows.map(({ candidate, _count, ...a }) => ({ ...a, noteCount: _count.notes, candidate: flattenCandidate(candidate) }));
  const result = paginated(items, total, { page: q.page, limit: q.limit });
  result.statusCounts = Object.fromEntries(counts.map((c) => [c.status, c._count._all]));
  return result;
}

async function getForRecruiter(user, id) {
  const app = await prisma.application.findFirst({
    where: { id, job: { recruiter: { userId: user.id } } },
    include: {
      job: { select: { id: true, title: true, minExperience: true, skills: { include: { skill: true } } } },
      candidate: {
        include: {
          user: { select: { id: true, name: true, email: true, createdAt: true } },
          skills: { include: { skill: true } },
        },
      },
      resume: { select: { id: true, originalName: true, parseStatus: true, parsedData: true, createdAt: true } },
      match: { select: matchSelect },
      notes: { orderBy: { createdAt: 'desc' }, include: { author: { select: { name: true } } } },
      interviews: { orderBy: { scheduledAt: 'asc' } },
      history: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!app) throw ApiError.notFound('Application not found');
  const { candidate, job, ...rest } = app;
  return {
    ...rest,
    job: { id: job.id, title: job.title, minExperience: job.minExperience, skills: job.skills.map((s) => ({ name: s.skill.name, isRequired: s.isRequired })) },
    candidate: {
      id: candidate.id, name: candidate.user.name, email: candidate.user.email, headline: candidate.headline, phone: candidate.phone,
      location: candidate.location, summary: candidate.summary, yearsExperience: candidate.yearsExperience,
      education: candidate.education || [], experience: candidate.experience || [],
      linkedinUrl: candidate.linkedinUrl, githubUrl: candidate.githubUrl, portfolioUrl: candidate.portfolioUrl,
      skills: candidate.skills.map((s) => ({ name: s.skill.name, source: s.source })),
    },
  };
}

async function loadOwned(user, id) {
  const app = await prisma.application.findFirst({
    where: { id, job: { recruiter: { userId: user.id } } },
    include: { job: { select: { id: true, title: true, company: { select: { name: true } } } }, candidate: { select: { userId: true } } },
  });
  if (!app) throw ApiError.notFound('Application not found');
  return app;
}

async function changeStatus(user, id, status) {
  const app = await loadOwned(user, id);
  if (app.status === 'WITHDRAWN') throw ApiError.badRequest('The candidate withdrew this application');
  if (app.status === status) return app;
  const [updated] = await prisma.$transaction([
    prisma.application.update({ where: { id }, data: { status } }),
    prisma.applicationStatusHistory.create({ data: { applicationId: id, fromStatus: app.status, toStatus: status, changedById: user.id } }),
  ]);
  const copy = STATUS_COPY[status];
  if (copy) {
    await notify(app.candidate.userId, {
      type: 'STATUS_CHANGED',
      title: copy[0],
      message: `${app.job.company.name} ${copy[1]} for ${app.job.title}.`,
      link: `/candidate/applications`,
    });
  }
  return updated;
}

async function addNote(user, id, content) {
  await loadOwned(user, id);
  return prisma.recruiterNote.create({ data: { applicationId: id, authorId: user.id, content }, include: { author: { select: { name: true } } } });
}

async function scheduleInterview(user, id, body) {
  const app = await loadOwned(user, id);
  if (['WITHDRAWN', 'REJECTED', 'HIRED'].includes(app.status)) throw ApiError.badRequest(`Cannot schedule an interview for a ${app.status.toLowerCase()} application`);
  const interview = await prisma.interview.create({ data: { ...body, applicationId: id, scheduledById: user.id } });
  if (['APPLIED', 'REVIEWING', 'SHORTLISTED'].includes(app.status)) {
    await prisma.$transaction([
      prisma.application.update({ where: { id }, data: { status: 'INTERVIEW' } }),
      prisma.applicationStatusHistory.create({ data: { applicationId: id, fromStatus: app.status, toStatus: 'INTERVIEW', changedById: user.id } }),
    ]);
  }
  await notify(app.candidate.userId, {
    type: 'INTERVIEW_SCHEDULED',
    title: 'Interview scheduled',
    message: `${app.job.company.name} invited you to interview for ${app.job.title} on ${body.scheduledAt.toUTCString()}.`,
    link: '/candidate/applications',
  });
  return interview;
}

async function updateInterview(user, interviewId, body) {
  const interview = await prisma.interview.findFirst({
    where: { id: interviewId, application: { job: { recruiter: { userId: user.id } } } },
    include: { application: { include: { job: { select: { title: true, company: { select: { name: true } } } }, candidate: { select: { userId: true } } } } },
  });
  if (!interview) throw ApiError.notFound('Interview not found');
  const updated = await prisma.interview.update({ where: { id: interviewId }, data: body });
  const cancelled = body.status === 'CANCELLED';
  const rescheduled = body.scheduledAt && +new Date(body.scheduledAt) !== +interview.scheduledAt;
  if (cancelled || rescheduled) {
    await notify(interview.application.candidate.userId, {
      type: 'INTERVIEW_UPDATED',
      title: cancelled ? 'Interview cancelled' : 'Interview rescheduled',
      message: cancelled
        ? `${interview.application.job.company.name} cancelled your interview for ${interview.application.job.title}.`
        : `Your interview for ${interview.application.job.title} moved to ${new Date(body.scheduledAt).toUTCString()}.`,
      link: '/candidate/applications',
    });
  }
  return updated;
}

async function listInterviews(user, { upcomingOnly = false } = {}) {
  return prisma.interview.findMany({
    where: {
      application: { job: { recruiter: { userId: user.id } } },
      ...(upcomingOnly ? { status: 'SCHEDULED', scheduledAt: { gte: new Date() } } : {}),
    },
    orderBy: { scheduledAt: 'asc' },
    take: 100,
    include: { application: { select: { id: true, jobId: true, job: { select: { title: true } }, candidate: { select: { user: { select: { name: true, email: true } } } } } } },
  });
}

module.exports = {
  apply, withdraw, listForCandidate, getForCandidate, listForJob, getForRecruiter, changeStatus, addNote,
  scheduleInterview, updateInterview, listInterviews, assertJobOwner, getCandidate,
};

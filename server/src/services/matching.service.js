const prisma = require('../config/prisma');
const ai = require('./ai.service');
const { notify } = require('./notification.service');

const applicationForMatch = {
  job: { include: { skills: { include: { skill: true } } } },
  candidate: { include: { skills: { include: { skill: true } } } },
  resume: true,
};

function toPayload(app) {
  const edu = Array.isArray(app.candidate.education) ? app.candidate.education : [];
  return {
    job: {
      title: app.job.title,
      description: app.job.description,
      requirements: app.job.requirements || '',
      minExperience: app.job.minExperience,
      skills: app.job.skills.map((js) => ({ name: js.skill.name, required: js.isRequired })),
    },
    candidate: {
      resumeText: app.resume?.rawText || '',
      skills: app.candidate.skills.map((cs) => cs.skill.name),
      yearsExperience: app.candidate.yearsExperience || 0,
      education: edu.map((e) => [e.degree, e.field, e.institution].filter(Boolean).join(' ')),
      headline: app.candidate.headline || '',
    },
  };
}

function toRow(result) {
  return {
    status: 'COMPLETED',
    score: result.score,
    skillScore: result.breakdown.skills,
    experienceScore: result.breakdown.experience,
    educationScore: result.breakdown.education,
    textScore: result.breakdown.text,
    matchedSkills: result.matchedSkills,
    partialSkills: result.partialSkills || [],
    missingSkills: result.missingSkills,
    extraSkills: (result.extraSkills || []).slice(0, 25),
    summary: result.summary,
    modelVersion: result.modelVersion,
    error: null,
  };
}

async function saveFailure(applicationId, err) {
  return prisma.matchResult.upsert({
    where: { applicationId },
    update: { status: 'FAILED', error: err.message.slice(0, 300) },
    create: { applicationId, status: 'FAILED', error: err.message.slice(0, 300) },
  });
}

// Scores one application with the Python AI service and persists the result.
async function computeForApplication(applicationId, { announce = true } = {}) {
  const app = await prisma.application.findUnique({ where: { id: applicationId }, include: applicationForMatch });
  if (!app) return null;
  try {
    const result = await ai.match(toPayload(app));
    const row = toRow(result);
    const saved = await prisma.matchResult.upsert({ where: { applicationId }, update: row, create: { applicationId, ...row } });
    if (announce && result.score >= 75) {
      const recruiter = await prisma.recruiterProfile.findUnique({ where: { id: app.job.recruiterId }, select: { userId: true } });
      const cand = await prisma.user.findUnique({ where: { id: app.candidate.userId }, select: { name: true } });
      if (recruiter) {
        await notify(recruiter.userId, {
          type: 'MATCH_READY',
          title: 'Strong match found',
          message: `${cand?.name || 'A candidate'} scored ${Math.round(result.score)}% for ${app.job.title}.`,
          link: `/recruiter/jobs/${app.jobId}/applicants?application=${app.id}`,
        });
      }
    }
    return saved;
  } catch (err) {
    return saveFailure(applicationId, err);
  }
}

// Re-scores every open application for a job using one batch call to the AI service.
async function rankJob(jobId) {
  const apps = await prisma.application.findMany({
    where: { jobId, status: { not: 'WITHDRAWN' } },
    include: applicationForMatch,
  });
  if (!apps.length) return { scored: 0, failed: 0 };
  const payloads = apps.map(toPayload);
  try {
    const out = await ai.rank({ job: payloads[0].job, candidates: payloads.map((p, i) => ({ id: apps[i].id, ...p.candidate })) });
    let scored = 0;
    for (const r of out.results) {
      const row = toRow(r);
      await prisma.matchResult.upsert({ where: { applicationId: r.id }, update: row, create: { applicationId: r.id, ...row } });
      scored += 1;
    }
    return { scored, failed: apps.length - scored };
  } catch (err) {
    await Promise.all(apps.map((a) => saveFailure(a.id, err)));
    throw err;
  }
}

module.exports = { computeForApplication, rankJob };

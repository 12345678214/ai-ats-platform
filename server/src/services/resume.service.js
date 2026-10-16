const fs = require('fs');
const path = require('path');
const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const ai = require('./ai.service');
const { upsertSkills } = require('./skill.service');
const { RESUME_DIR, hasValidSignature } = require('../middleware/upload');

const removeFile = (storedName) => fs.promises.unlink(path.join(RESUME_DIR, storedName)).catch(() => {});

// Runs the Python parser against a stored resume and syncs the results onto the candidate profile.
async function parseAndSync(resume, candidate) {
  const filePath = path.join(RESUME_DIR, resume.storedName);
  try {
    const parsed = await ai.parseResume(filePath, resume.originalName);

    await prisma.resume.update({
      where: { id: resume.id },
      data: {
        rawText: parsed.text,
        parseStatus: 'PARSED',
        parseError: null,
        parsedData: {
          skills: parsed.skills,
          education: parsed.education,
          experience: parsed.experience,
          yearsExperience: parsed.yearsExperience,
          highestDegree: parsed.highestDegree,
          contact: parsed.contact,
          wordCount: parsed.wordCount,
        },
      },
    });

    // Skills extracted from the resume are added to the profile (manual skills are kept).
    const skills = await upsertSkills(parsed.skills || []);
    if (skills.length) {
      await prisma.candidateSkill.createMany({
        data: skills.map((s) => ({ candidateId: candidate.id, skillId: s.id, source: 'RESUME' })),
        skipDuplicates: true,
      });
    }

    // Only fill profile fields the candidate has not set themselves.
    const patch = {};
    if (!candidate.yearsExperience && parsed.yearsExperience > 0) patch.yearsExperience = parsed.yearsExperience;
    const hasEdu = Array.isArray(candidate.education) && candidate.education.length > 0;
    if (!hasEdu && parsed.education?.length) patch.education = parsed.education;
    const hasExp = Array.isArray(candidate.experience) && candidate.experience.length > 0;
    if (!hasExp && parsed.experience?.length) patch.experience = parsed.experience;
    if (!candidate.phone && parsed.contact?.phone) patch.phone = parsed.contact.phone;
    if (Object.keys(patch).length) await prisma.candidateProfile.update({ where: { id: candidate.id }, data: patch });
  } catch (err) {
    await prisma.resume.update({
      where: { id: resume.id },
      data: { parseStatus: 'FAILED', parseError: err.message.slice(0, 300) },
    });
  }
  return prisma.resume.findUnique({ where: { id: resume.id }, select: resumeSelect });
}

const resumeSelect = {
  id: true, originalName: true, mimeType: true, sizeBytes: true, parseStatus: true,
  parseError: true, isPrimary: true, createdAt: true, parsedData: true,
};

async function handleUpload(candidate, file) {
  if (!file) throw ApiError.badRequest('Attach a PDF or DOCX file in the "resume" field');
  const ext = path.extname(file.filename).toLowerCase();
  if (!hasValidSignature(file.path, ext)) {
    await removeFile(file.filename);
    throw ApiError.badRequest('That file does not look like a valid PDF or DOCX');
  }
  const existing = await prisma.resume.count({ where: { candidateId: candidate.id } });
  if (existing >= 10) {
    await removeFile(file.filename);
    throw ApiError.badRequest('You can keep up to 10 resumes. Delete one first.');
  }
  const resume = await prisma.resume.create({
    data: {
      candidateId: candidate.id,
      originalName: path.basename(file.originalname).slice(0, 200),
      storedName: file.filename,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      isPrimary: existing === 0,
    },
  });
  return parseAndSync(resume, candidate);
}

async function list(candidateId) {
  return prisma.resume.findMany({ where: { candidateId }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }], select: resumeSelect });
}

async function setPrimary(candidateId, resumeId) {
  const resume = await prisma.resume.findFirst({ where: { id: resumeId, candidateId } });
  if (!resume) throw ApiError.notFound('Resume not found');
  await prisma.$transaction([
    prisma.resume.updateMany({ where: { candidateId }, data: { isPrimary: false } }),
    prisma.resume.update({ where: { id: resumeId }, data: { isPrimary: true } }),
  ]);
}

async function remove(candidate, resumeId) {
  const resume = await prisma.resume.findFirst({ where: { id: resumeId, candidateId: candidate.id } });
  if (!resume) throw ApiError.notFound('Resume not found');
  await prisma.resume.delete({ where: { id: resumeId } });
  await removeFile(resume.storedName);
  if (resume.isPrimary) {
    const next = await prisma.resume.findFirst({ where: { candidateId: candidate.id }, orderBy: { createdAt: 'desc' } });
    if (next) await prisma.resume.update({ where: { id: next.id }, data: { isPrimary: true } });
  }
}

async function reparse(candidate, resumeId) {
  const resume = await prisma.resume.findFirst({ where: { id: resumeId, candidateId: candidate.id } });
  if (!resume) throw ApiError.notFound('Resume not found');
  return parseAndSync(resume, candidate);
}

module.exports = { handleUpload, list, setPrimary, remove, reparse, parseAndSync, resumeSelect };

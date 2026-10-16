const { z } = require('zod');

const STATUSES = ['APPLIED', 'REVIEWING', 'SHORTLISTED', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'];

const status = z.object({ status: z.enum(STATUSES) });
const note = z.object({ content: z.string().trim().min(1, 'Write a note first').max(2000) });

const interview = z.object({
  scheduledAt: z.coerce.date().refine((d) => d.getTime() > Date.now() - 60_000, 'Pick a time in the future'),
  durationMins: z.coerce.number().int().min(10).max(480).default(45),
  mode: z.enum(['VIDEO', 'PHONE', 'ONSITE']).default('VIDEO'),
  location: z.string().trim().max(300).optional(),
  notes: z.string().trim().max(1000).optional(),
});

const interviewUpdate = z.object({
  scheduledAt: z.coerce.date().optional(),
  durationMins: z.coerce.number().int().min(10).max(480).optional(),
  mode: z.enum(['VIDEO', 'PHONE', 'ONSITE']).optional(),
  location: z.string().trim().max(300).optional(),
  notes: z.string().trim().max(1000).optional(),
  status: z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED']).optional(),
});

const applicantQuery = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum([...STATUSES, 'WITHDRAWN']).optional(),
  minScore: z.coerce.number().min(0).max(100).optional(),
  skill: z.string().trim().max(60).optional(),
  sort: z.enum(['match', 'newest', 'oldest', 'name']).default('match'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const companyBody = z.object({
  name: z.string().trim().min(2).max(120),
  website: z.string().trim().max(200).optional(),
  industry: z.string().trim().max(80).optional(),
  size: z.string().trim().max(40).optional(),
  location: z.string().trim().max(120).optional(),
  description: z.string().trim().max(3000).optional(),
});

module.exports = { status, note, interview, interviewUpdate, applicantQuery, companyBody, STATUSES };

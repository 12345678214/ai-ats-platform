const { z } = require('zod');

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  role: z.enum(['CANDIDATE', 'RECRUITER', 'ADMIN']).optional(),
  status: z.string().trim().max(20).optional(),
  active: z.enum(['true', 'false']).optional(),
  flagged: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

const activeBody = z.object({ isActive: z.boolean() });
const flagBody = z.object({ isFlagged: z.boolean(), reason: z.string().trim().max(300).optional() });
const verifyBody = z.object({ isVerified: z.boolean() });
const jobStatusBody = z.object({ status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED']) });

module.exports = { listQuery, activeBody, flagBody, verifyBody, jobStatusBody };

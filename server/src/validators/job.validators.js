const { z } = require('zod');

const emptyToUndef = (v) => (v === '' || v === null ? undefined : v);
const optNum = (schema) => z.preprocess(emptyToUndef, schema.optional());

const skillInput = z.object({
  name: z.string().trim().min(1).max(60),
  isRequired: z.boolean().default(true),
});

const jobBody = z
  .object({
    title: z.string().trim().min(3, 'Title must be at least 3 characters').max(140),
    description: z.string().trim().min(30, 'Describe the role in at least 30 characters').max(12000),
    requirements: z.preprocess(emptyToUndef, z.string().trim().max(8000).optional()),
    location: z.string().trim().min(2, 'Enter a location').max(120),
    workMode: z.enum(['ONSITE', 'REMOTE', 'HYBRID']).default('ONSITE'),
    jobType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP']).default('FULL_TIME'),
    experienceLevel: z.enum(['ENTRY', 'MID', 'SENIOR', 'LEAD']).default('MID'),
    minExperience: z.coerce.number().min(0).max(40).default(0),
    salaryMin: optNum(z.coerce.number().int().min(0)),
    salaryMax: optNum(z.coerce.number().int().min(0)),
    currency: z.string().trim().length(3).toUpperCase().default('USD'),
    deadline: optNum(z.coerce.date()),
    status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED']).default('DRAFT'),
    skills: z.array(skillInput).max(40).optional(),
  })
  .refine((v) => v.salaryMin == null || v.salaryMax == null || v.salaryMax >= v.salaryMin, {
    path: ['salaryMax'],
    message: 'Maximum salary must be at least the minimum',
  });

const jobUpdate = jobBody.innerType().partial().extend({ status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED']).optional() });

const jobStatus = z.object({ status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED']) });

const jobQuery = z.object({
  q: z.string().trim().max(100).optional(),
  location: z.string().trim().max(100).optional(),
  workMode: z.enum(['ONSITE', 'REMOTE', 'HYBRID']).optional(),
  jobType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP']).optional(),
  experienceLevel: z.enum(['ENTRY', 'MID', 'SENIOR', 'LEAD']).optional(),
  skills: z.string().trim().max(300).optional(), // comma separated
  salaryMin: z.coerce.number().int().min(0).optional(),
  sort: z.enum(['newest', 'oldest', 'salary', 'title']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(9),
});

module.exports = { jobBody, jobUpdate, jobStatus, jobQuery };

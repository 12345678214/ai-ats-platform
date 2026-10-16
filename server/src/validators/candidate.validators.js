const { z } = require('zod');

const url = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === '' || /^https?:\/\//i.test(v), 'Must start with http:// or https://');

const profile = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  headline: z.string().trim().max(140).optional(),
  phone: z.string().trim().max(30).optional(),
  location: z.string().trim().max(100).optional(),
  summary: z.string().trim().max(2000).optional(),
  yearsExperience: z.coerce.number().min(0).max(60).optional(),
  linkedinUrl: url.optional(),
  githubUrl: url.optional(),
  portfolioUrl: url.optional(),
  openToWork: z.boolean().optional(),
  education: z
    .array(
      z.object({
        degree: z.string().trim().max(120),
        field: z.string().trim().max(120).optional().default(''),
        institution: z.string().trim().max(160).optional().default(''),
        year: z.string().trim().max(20).optional().default(''),
      }),
    )
    .max(10)
    .optional(),
  experience: z
    .array(
      z.object({
        title: z.string().trim().max(120),
        company: z.string().trim().max(120).optional().default(''),
        period: z.string().trim().max(60).optional().default(''),
        description: z.string().trim().max(1500).optional().default(''),
      }),
    )
    .max(15)
    .optional(),
});

const skills = z.object({ skills: z.array(z.string().trim().min(1).max(60)).max(60) });

const apply = z.object({
  resumeId: z.string().trim().min(1).optional(),
  coverLetter: z.string().trim().max(4000).optional(),
});

module.exports = { profile, skills, apply };

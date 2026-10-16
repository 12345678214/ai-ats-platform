const { z } = require('zod');

const password = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(72, 'Use at most 72 characters')
  .regex(/[A-Za-z]/, 'Include at least one letter')
  .regex(/[0-9]/, 'Include at least one number');

const register = z
  .object({
    name: z.string().trim().min(2, 'Enter your full name').max(80),
    email: z.string().trim().toLowerCase().email('Enter a valid email address'),
    password,
    role: z.enum(['CANDIDATE', 'RECRUITER']),
    companyName: z.string().trim().min(2).max(120).optional(),
  })
  .refine((v) => v.role !== 'RECRUITER' || !!v.companyName, {
    path: ['companyName'],
    message: 'Company name is required for recruiter accounts',
  });

const login = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

const changePassword = z.object({
  currentPassword: z.string().min(1, 'Enter your current password'),
  newPassword: password,
});

module.exports = { register, login, changePassword };

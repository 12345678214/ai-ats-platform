const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, isActive: u.isActive, createdAt: u.createdAt });
const signToken = (user) => jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });

async function register({ name, email, password, role, companyName }) {
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) throw ApiError.conflict('An account with this email already exists');
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({ data: { name, email, passwordHash, role } });
    if (role === 'CANDIDATE') {
      await tx.candidateProfile.create({ data: { userId: created.id } });
    } else {
      const company = await tx.company.create({ data: { name: companyName } });
      await tx.recruiterProfile.create({ data: { userId: created.id, companyId: company.id } });
    }
    return created;
  });
  return { user: publicUser(user), token: signToken(user) };
}

async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });
  // Same message for unknown email and wrong password to avoid account enumeration.
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) throw ApiError.unauthorized('Incorrect email or password');
  if (!user.isActive) throw ApiError.forbidden('This account has been deactivated. Contact support.');
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return { user: publicUser(user), token: signToken(user) };
}

async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) throw ApiError.badRequest('Current password is incorrect');
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(newPassword, 12) } });
}

module.exports = { register, login, changePassword, publicUser };

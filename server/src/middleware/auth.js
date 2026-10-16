const jwt = require('jsonwebtoken');
const env = require('../config/env');
const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const userSelect = { id: true, email: true, name: true, role: true, isActive: true };

async function resolveUser(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw ApiError.unauthorized('Your session has expired. Please sign in again.');
  }
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: userSelect });
  if (!user) throw ApiError.unauthorized('Account no longer exists');
  if (!user.isActive) throw ApiError.forbidden('This account has been deactivated. Contact support.');
  return user;
}

const authenticate = asyncHandler(async (req, _res, next) => {
  const user = await resolveUser(req);
  if (!user) throw ApiError.unauthorized();
  req.user = user;
  next();
});

// Attaches req.user when a valid token is present, but never rejects.
const optionalAuth = asyncHandler(async (req, _res, next) => {
  try {
    req.user = (await resolveUser(req)) || null;
  } catch {
    req.user = null;
  }
  next();
});

const authorize = (...roles) => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
  next();
};

module.exports = { authenticate, optionalAuth, authorize };

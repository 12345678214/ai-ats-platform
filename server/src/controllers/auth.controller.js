const prisma = require('../config/prisma');
const authService = require('../services/auth.service');
const asyncHandler = require('../utils/asyncHandler');

exports.register = asyncHandler(async (req, res) => res.status(201).json(await authService.register(req.body)));
exports.login = asyncHandler(async (req, res) => res.json(await authService.login(req.body)));
exports.me = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  res.json({ user: authService.publicUser(user) });
});
exports.changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(req.user.id, req.body);
  res.json({ message: 'Password updated' });
});

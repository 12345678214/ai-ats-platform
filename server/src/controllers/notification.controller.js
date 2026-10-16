const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { parsePagination, paginated } = require('../utils/pagination');

exports.list = asyncHandler(async (req, res) => {
  const p = parsePagination(req.query, { defaultLimit: 15 });
  const where = { userId: req.user.id, ...(req.query.unread === 'true' ? { isRead: false } : {}) };
  const [items, total, unread] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip: p.skip, take: p.limit }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: req.user.id, isRead: false } }),
  ]);
  res.json({ ...paginated(items, total, p), unread });
});
exports.unreadCount = asyncHandler(async (req, res) => {
  res.json({ unread: await prisma.notification.count({ where: { userId: req.user.id, isRead: false } }) });
});
exports.markRead = asyncHandler(async (req, res) => {
  const { count } = await prisma.notification.updateMany({ where: { id: req.params.id, userId: req.user.id }, data: { isRead: true } });
  if (!count) throw ApiError.notFound('Notification not found');
  res.json({ message: 'Marked as read' });
});
exports.markAllRead = asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.user.id, isRead: false }, data: { isRead: true } });
  res.json({ message: 'All notifications marked as read' });
});
exports.remove = asyncHandler(async (req, res) => {
  await prisma.notification.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
  res.status(204).end();
});

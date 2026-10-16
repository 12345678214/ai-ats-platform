const prisma = require('../config/prisma');

async function notify(userId, { type, title, message, link }) {
  try {
    return await prisma.notification.create({ data: { userId, type, title, message, link } });
  } catch (err) {
    // Notifications are best-effort and must never break the main action.
    console.warn('[notify] failed:', err.message);
    return null;
  }
}

module.exports = { notify };

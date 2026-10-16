const path = require('path');
require('dotenv').config();

for (const key of ['DATABASE_URL', 'JWT_SECRET']) {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
}
if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production');
}

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT) || 4000,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  CLIENT_URLS: (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((s) => s.trim()),
  AI_SERVICE_URL: process.env.AI_SERVICE_URL || 'http://localhost:8000',
  AI_SERVICE_KEY: process.env.AI_SERVICE_KEY || '',
  UPLOAD_DIR: path.resolve(process.env.UPLOAD_DIR || 'uploads'),
  MAX_UPLOAD_MB: Number(process.env.MAX_UPLOAD_MB) || 5,
};

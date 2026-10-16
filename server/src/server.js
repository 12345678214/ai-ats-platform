const app = require('./app');
const env = require('./config/env');
const prisma = require('./config/prisma');
const ai = require('./services/ai.service');

const server = app.listen(env.PORT, async () => {
  console.log(`ATS API listening on http://localhost:${env.PORT}/api`);
  const health = await ai.health();
  console.log(health.ok ? `AI service connected (${health.model})` : `Warning: ${health.error}. Resume parsing and scoring will fail until it is running.`);
});

const shutdown = async (signal) => {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};
['SIGINT', 'SIGTERM'].forEach((s) => process.on(s, () => shutdown(s)));

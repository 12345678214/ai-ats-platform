const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const env = require('./env');

// Single shared client. The pg driver adapter keeps the query engine in pure JS,
// so there are no native binaries to ship or download at deploy time.
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

module.exports = prisma;

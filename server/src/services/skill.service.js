const prisma = require('../config/prisma');
const { slugify } = require('../utils/slug');

// Resolves free-text skill names to Skill rows, creating missing ones.
// De-duplicates by slug so "Node.js", "node.js" and "NodeJS" variants collapse correctly
// when the AI service has already canonicalised them.
async function upsertSkills(items) {
  const unique = new Map();
  for (const item of items) {
    const name = (typeof item === 'string' ? item : item.name).trim();
    if (!name) continue;
    const slug = slugify(name);
    if (!slug || unique.has(slug)) continue;
    unique.set(slug, { name, slug, category: typeof item === 'string' ? null : item.category || null });
  }
  const skills = [];
  for (const { name, slug, category } of unique.values()) {
    const skill = await prisma.skill.upsert({
      where: { slug },
      update: {},
      create: { name, slug, category },
    });
    skills.push(skill);
  }
  return skills;
}

module.exports = { upsertSkills };

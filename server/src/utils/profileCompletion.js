// Weighted checklist used for the candidate "profile completion" meter.
function profileCompletion(profile, { skillCount = 0, resumeCount = 0 } = {}) {
  if (!profile) return { percent: 0, missing: [] };
  const hasList = (v) => Array.isArray(v) && v.length > 0;
  const checks = [
    ['Headline', 10, !!profile.headline],
    ['Phone', 5, !!profile.phone],
    ['Location', 10, !!profile.location],
    ['Summary', 10, !!(profile.summary && profile.summary.length >= 30)],
    ['At least 3 skills', 15, skillCount >= 3],
    ['Education', 10, hasList(profile.education)],
    ['Experience', 10, hasList(profile.experience) || profile.yearsExperience > 0],
    ['Resume upload', 20, resumeCount > 0],
    ['Profile link (LinkedIn, GitHub or portfolio)', 10, !!(profile.linkedinUrl || profile.githubUrl || profile.portfolioUrl)],
  ];
  const percent = checks.reduce((sum, [, w, ok]) => sum + (ok ? w : 0), 0);
  return { percent, missing: checks.filter(([, , ok]) => !ok).map(([label]) => label) };
}
module.exports = { profileCompletion };

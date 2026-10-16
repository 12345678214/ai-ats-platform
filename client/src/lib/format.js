export const STATUS_META = {
  APPLIED: { label: 'Applied', tone: 'sky' },
  REVIEWING: { label: 'In review', tone: 'violet' },
  SHORTLISTED: { label: 'Shortlisted', tone: 'brand' },
  INTERVIEW: { label: 'Interview', tone: 'amber' },
  OFFER: { label: 'Offer', tone: 'brand' },
  HIRED: { label: 'Hired', tone: 'brand' },
  REJECTED: { label: 'Rejected', tone: 'rose' },
  WITHDRAWN: { label: 'Withdrawn', tone: 'gray' },
  DRAFT: { label: 'Draft', tone: 'gray' },
  ACTIVE: { label: 'Active', tone: 'brand' },
  PAUSED: { label: 'Paused', tone: 'amber' },
  CLOSED: { label: 'Closed', tone: 'gray' },
  SCHEDULED: { label: 'Scheduled', tone: 'sky' },
  COMPLETED: { label: 'Completed', tone: 'brand' },
  CANCELLED: { label: 'Cancelled', tone: 'gray' },
};

export const PIPELINE = ['APPLIED', 'REVIEWING', 'SHORTLISTED', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'];

export const WORK_MODES = { ONSITE: 'On-site', REMOTE: 'Remote', HYBRID: 'Hybrid' };
export const JOB_TYPES = { FULL_TIME: 'Full-time', PART_TIME: 'Part-time', CONTRACT: 'Contract', INTERNSHIP: 'Internship' };
export const LEVELS = { ENTRY: 'Entry level', MID: 'Mid level', SENIOR: 'Senior', LEAD: 'Lead' };

export const enumOptions = (map) => Object.entries(map).map(([value, label]) => ({ value, label }));

export function scoreTone(score) {
  if (score == null) return { color: '#8a9b96', label: 'Pending', bg: '#ebf0ee' };
  if (score >= 75) return { color: '#0e7c66', label: 'Strong', bg: '#e5f4ef' };
  if (score >= 55) return { color: '#2f6aa3', label: 'Good', bg: '#e6eff8' };
  if (score >= 35) return { color: '#c98a12', label: 'Fair', bg: '#fcf3df' };
  return { color: '#c4453d', label: 'Low', bg: '#fbe9e7' };
}

export function formatDate(value, opts = { month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, opts);
}

export function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function timeAgo(value) {
  const diff = (Date.now() - new Date(value).getTime()) / 1000;
  if (diff < 60) return 'just now';
  const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [name, secs] of units) {
    if (diff >= secs) { const n = Math.floor(diff / secs); return `${n} ${name}${n > 1 ? 's' : ''} ago`; }
  }
  return 'just now';
}

export function formatSalary(job) {
  if (!job.salaryMin && !job.salaryMax) return null;
  const fmt = (n) => new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
  const cur = job.currency || 'USD';
  if (job.salaryMin && job.salaryMax) return `${cur} ${fmt(job.salaryMin)} – ${fmt(job.salaryMax)}`;
  return `${cur} ${fmt(job.salaryMin || job.salaryMax)}${job.salaryMin ? '+' : ''}`;
}

export const initials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');

export const toInputDateTime = (d) => {
  const date = new Date(d);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

export const homeFor = (role) => ({ CANDIDATE: '/candidate', RECRUITER: '/recruiter', ADMIN: '/admin' }[role] || '/');

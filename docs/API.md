# API reference

Base URL: `http://localhost:4000/api` · JSON in, JSON out · `Authorization: Bearer <JWT>` where marked.

**Errors** always look like:

```json
{ "error": { "message": "Please check the highlighted fields", "details": [{ "field": "password", "message": "Use at least 8 characters" }] } }
```

| Status | Meaning |
| --- | --- |
| 400 | Bad request (e.g. invalid file, business-rule violation) |
| 401 | Missing, invalid or expired token |
| 403 | Authenticated but not allowed (wrong role, deactivated account, not your resume) |
| 404 | Not found, **or not yours** (other recruiters' applications return 404, not 403) |
| 409 | Conflict (duplicate email, already applied, deleting a job that has applicants) |
| 413 | Upload larger than `MAX_UPLOAD_MB` |
| 422 | Validation failed, with per-field `details` |
| 429 | Rate limited |
| 503 | AI service unavailable (only on endpoints that require it) |

**Pagination** — list endpoints accept `page` and `limit` and return:

```json
{ "items": [], "pagination": { "page": 1, "limit": 10, "total": 42, "totalPages": 5 } }
```

---

## Health

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/health` | – | API status plus AI-service health |

## Auth

| Method | Path | Auth | Body / notes |
| --- | --- | --- | --- |
| POST | `/auth/register` | – | `{ name, email, password, role: "CANDIDATE"\|"RECRUITER", companyName? }` — `companyName` required for recruiters. Admin accounts cannot self-register. Returns `{ user, token }` (201). |
| POST | `/auth/login` | – | `{ email, password }` → `{ user, token }`. Same error for unknown email and wrong password. |
| GET | `/auth/me` | any | Current user |
| PATCH | `/auth/password` | any | `{ currentPassword, newPassword }` |

Passwords: 8–72 chars, at least one letter and one number (bcrypt, cost 12). Auth endpoints are rate limited.

## Public job board

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/jobs` | optional | Only ACTIVE, un-flagged jobs from active companies with an open deadline. Query: `q` (title, description, company, skill), `location`, `workMode`, `jobType`, `experienceLevel`, `salaryMin`, `skills` (comma separated), `sort` (`newest`\|`oldest`\|`salary`\|`title`), `page`, `limit` (≤50). With a candidate token each item includes `applicationStatus` and `isSaved`. |
| GET | `/jobs/:id` | optional | Increments `viewCount` for non-owners. Owners/admins can also see non-public jobs. |
| GET | `/skills?q=` | – | Skill autocomplete |

## Candidate (`role: CANDIDATE`)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/candidate/dashboard` | Stats, profile completion, recent applications, upcoming interviews, skill-overlap recommendations |
| GET / PUT | `/candidate/profile` | Fields: `name, headline, phone, location, summary, yearsExperience, linkedinUrl, githubUrl, portfolioUrl, openToWork, education[], experience[]`. Response includes `completion { percent, missing[] }`. |
| PUT | `/candidate/skills` | `{ skills: ["React", ...] }` replaces manually-added skills (resume-derived skills are kept) |
| DELETE | `/candidate/skills/:skillId` | |
| GET | `/candidate/resumes` | |
| POST | `/candidate/resumes` | `multipart/form-data`, field `resume` (PDF or DOCX, ≤5 MB). Validates extension, MIME type and magic bytes, stores under a random name, then parses it with the AI service. Parse failure does not lose the upload (`parseStatus: "FAILED"`). |
| POST | `/candidate/resumes/:id/reparse` | Retry parsing |
| PATCH | `/candidate/resumes/:id/primary` | |
| DELETE | `/candidate/resumes/:id` | |
| POST | `/jobs/:id/apply` | `{ resumeId?, coverLetter? }` — requires a resume; 409 if already applied. Creates the application, notifies the recruiter, and scores it in the background. |
| GET | `/candidate/applications` | `status`, `page`, `limit` |
| GET | `/candidate/applications/:id` | Status history and interviews. **Recruiter notes and AI scores are never returned to candidates.** |
| PATCH | `/candidate/applications/:id/withdraw` | |
| GET | `/candidate/saved-jobs` | |
| POST / DELETE | `/candidate/saved-jobs/:jobId` | |

## Recruiter (`role: RECRUITER`)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/recruiter/dashboard` | KPIs, pipeline counts, latest applicants, upcoming interviews |
| GET | `/recruiter/analytics?days=30` | Applications per day, hiring funnel, per-job views→applicants conversion, score distribution, most common missing skills |
| GET / PUT | `/recruiter/company` | Company profile (+ recruiter `jobTitle`, `phone`) |
| GET | `/recruiter/jobs` | `status`, `q`, `page`, `limit`; adds `applicantCount`, `shortlistedCount`, `avgMatchScore` |
| POST | `/recruiter/jobs` | Body: `title, description, requirements?, location, workMode, jobType, experienceLevel, minExperience, salaryMin?, salaryMax?, currency, deadline?, status, skills?: [{ name, isRequired }]`. If `skills` is omitted/empty, the AI service extracts them from the text. |
| GET / PUT | `/recruiter/jobs/:id` | |
| PATCH | `/recruiter/jobs/:id/status` | `{ status: DRAFT\|ACTIVE\|PAUSED\|CLOSED }` |
| DELETE | `/recruiter/jobs/:id` | 409 if the job has applicants (close it instead) |
| GET | `/recruiter/jobs/:id/applications` | Query: `q`, `status`, `minScore`, `skill`, `sort` (`match`\|`newest`\|`oldest`\|`name`), `page`, `limit` (≤100). Returns `statusCounts`. |
| POST | `/recruiter/jobs/:id/rank` | Re-run AI scoring for every applicant of the job in one batch |
| GET | `/recruiter/applications/:id` | Full candidate profile, match breakdown, notes, interviews, history |
| PATCH | `/recruiter/applications/:id/status` | `{ status }` — records history and notifies the candidate |
| POST | `/recruiter/applications/:id/rescore` | Re-score one applicant |
| POST | `/recruiter/applications/:id/notes` | `{ content }` |
| POST | `/recruiter/applications/:id/interviews` | `{ scheduledAt, durationMins, mode: VIDEO\|PHONE\|ONSITE, location?, notes? }` — moves the application to INTERVIEW and notifies the candidate |
| GET | `/recruiter/interviews?upcoming=true` | |
| PATCH | `/recruiter/interviews/:id` | Reschedule or set `status: COMPLETED\|CANCELLED` (candidate is notified of changes) |

## Resume files

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/resumes/:id/file` | Allowed for the owning candidate, a recruiter who received that resume with an application, or an admin. Served with `nosniff`. |

## Notifications (any role except admin UI)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/notifications` | `unread=true`, `page`, `limit`; response includes `unread` count |
| GET | `/notifications/unread-count` | |
| PATCH | `/notifications/:id/read`, `/notifications/read-all` | |
| DELETE | `/notifications/:id` | |

## Admin (`role: ADMIN`)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/admin/stats` | Totals, moderation counters, applications by status |
| GET | `/admin/analytics?days=30` | Daily users/jobs/applications, top skills, top companies |
| GET | `/admin/users` | `q`, `role`, `active`, `page`, `limit` |
| PATCH | `/admin/users/:id/active` | `{ isActive }`. Takes effect immediately, even for tokens already issued. Admins cannot be deactivated here, nor yourself. |
| GET | `/admin/jobs` | `q`, `status`, `flagged` |
| PATCH | `/admin/jobs/:id/flag` | `{ isFlagged, reason? }` — hides/restores the job and notifies the recruiter |
| PATCH | `/admin/jobs/:id/status` | |
| DELETE | `/admin/jobs/:id` | |
| GET | `/admin/applications` | `q`, `status` |
| GET | `/admin/companies` | `q`, `active` |
| PATCH | `/admin/companies/:id/verify` | `{ isVerified }` |
| PATCH | `/admin/companies/:id/active` | `{ isActive }` — disabling a company hides its jobs |

---

# AI service API (internal)

Base URL: `http://localhost:8000` · every endpoint except `/health` needs `X-Service-Key: $AI_SERVICE_KEY`.

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/health` | – | `{ status, model, skillsKnown }` |
| POST | `/parse-resume` | multipart `file` (PDF/DOCX) | `{ text, skills[], education[], experience[], yearsExperience, highestDegree, contact, sections[], wordCount }` |
| POST | `/extract-job-skills` | `{ title, description, requirements }` | `{ skills: [{ name, category, required }], minExperience }` |
| POST | `/match` | `{ job, candidate }` | `{ score, label, breakdown, weights, matchedSkills, partialSkills, missingSkills, extraSkills, candidateYears, summary, modelVersion }` |
| POST | `/rank` | `{ job, candidates: [{ id, ... }] }` | `{ results: [...match, id, rank] }` sorted best first |

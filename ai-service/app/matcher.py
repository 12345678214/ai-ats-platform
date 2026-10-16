"""Resume-to-job matching.

Final score (0-100) is a weighted blend of four independent signals:

    skills      60%   weighted coverage of the job's skills (required = 2x, preferred = 1x),
                      with credit for implied skills and partial credit for same-family skills
    experience  20%   candidate years vs. the job's minimum
    education   10%   candidate's highest degree vs. what the job text asks for
    text        10%   TF-IDF cosine similarity between the job posting and the resume

If a job lists no skills at all, the skill weight is redistributed so the score still means something.
"""
import re

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from . import parser, taxonomy

MODEL_VERSION = "skillmatch-1.0"
WEIGHTS = {"skills": 0.60, "experience": 0.20, "education": 0.10, "text": 0.10}
WEIGHTS_NO_SKILLS = {"skills": 0.0, "experience": 0.30, "education": 0.20, "text": 0.50}
PARTIAL_CREDIT = 0.4
PREFERRED_MARKERS = re.compile(r"(nice[\s-]to[\s-]have|preferred|bonus|good to have|a plus|desirable|optional)", re.IGNORECASE)


def label_for(score: float) -> str:
    return "Strong" if score >= 75 else "Good" if score >= 55 else "Fair" if score >= 35 else "Low"


# ───────────────────────── job side ─────────────────────────
def extract_job_skills(title: str = "", description: str = "", requirements: str = ""):
    """Finds skills in a job posting. Skills mentioned after a 'nice to have / preferred' marker are optional."""
    text = f"{title}\n{description}\n{requirements}"
    marker = PREFERRED_MARKERS.search(text)
    cut = marker.start() if marker else len(text)
    skills = []
    for skill, pos in sorted(taxonomy.find_skills(text), key=lambda x: x[1]):
        if skill.category == "Soft skills":
            continue
        skills.append({"name": skill.name, "category": skill.category, "required": pos < cut})
    return {"skills": skills, "minExperience": min_experience(text)}


def min_experience(text: str):
    ranges = re.findall(r"(\d{1,2})\s*(?:-|–|to)\s*\d{1,2}\+?\s*(?:years|yrs)", text, re.IGNORECASE)
    singles = re.findall(r"(\d{1,2})\+?\s*(?:years|yrs)", text, re.IGNORECASE)
    nums = [int(x) for x in ranges + singles if int(x) <= 30]
    return float(min(nums)) if nums else None


def required_degree_level(text: str) -> int:
    if re.search(r"ph\.?d|doctorate", text, re.IGNORECASE):
        return 4
    if re.search(r"master'?s?\b|m\.?tech|\bmba\b", text, re.IGNORECASE):
        return 3
    if re.search(r"bachelor'?s?\b|b\.?tech|b\.?sc|undergraduate|\bdegree\b|computer science", text, re.IGNORECASE):
        return 2
    return 0


# ───────────────────────── scoring pieces ─────────────────────────
def score_skills(job_skills, candidate_names):
    expanded = taxonomy.expand(candidate_names)
    families = {}
    for name in expanded:
        sk = taxonomy.BY_NAME.get(name)
        if sk and sk.family:
            families.setdefault(sk.family, []).append(name)
    lower_known = {n.lower() for n in expanded}

    total = earned = 0.0
    matched, partial, missing = [], [], []
    for js in job_skills:
        name = taxonomy.canonical(js["name"])
        weight = 2.0 if js.get("required", True) else 1.0
        total += weight
        if name in expanded or name.lower() in lower_known:
            earned += weight
            matched.append(name)
            continue
        sk = taxonomy.BY_NAME.get(name)
        mates = [m for m in families.get(sk.family, []) if m != name] if sk and sk.family else []
        if mates:
            earned += weight * PARTIAL_CREDIT
            partial.append(f"{name} (similar: {mates[0]})")
        else:
            missing.append(name)
    score = (earned / total * 100) if total else 0.0
    return score, matched, partial, missing


def score_experience(candidate_years: float, minimum: float) -> float:
    if not minimum or minimum <= 0:
        return 100.0
    return round(min(1.0, candidate_years / minimum) * 100, 1)


def score_education(candidate_level: int, required_level: int) -> float:
    if required_level == 0:
        return 100.0 if candidate_level >= 2 else 85.0 if candidate_level == 1 else 70.0
    if candidate_level >= required_level:
        return 100.0
    if candidate_level == required_level - 1 and candidate_level > 0:
        return 60.0
    return 30.0


def score_text(job_text: str, resume_text: str) -> float:
    if not job_text.strip() or not resume_text.strip():
        return 0.0
    try:
        vec = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), sublinear_tf=True)
        matrix = vec.fit_transform([job_text, resume_text])
        cos = float(cosine_similarity(matrix[0], matrix[1])[0][0])
    except ValueError:  # empty vocabulary
        return 0.0
    return round(min(100.0, cos * 220), 1)


# ───────────────────────── public API ─────────────────────────
def match(job: dict, candidate: dict) -> dict:
    job_text = " ".join([job.get("title", ""), job.get("description", ""), job.get("requirements", "")])
    resume_text = candidate.get("resumeText", "") or ""

    job_skills = job.get("skills") or []
    if not job_skills:
        job_skills = extract_job_skills(job.get("title", ""), job.get("description", ""), job.get("requirements", ""))["skills"]

    # Candidate skills = what they declared + what the resume text actually mentions.
    declared = [taxonomy.canonical(s) for s in candidate.get("skills", [])]
    from_resume = [s["name"] for s in parser.extract_skills(resume_text + "\n" + candidate.get("headline", ""))]
    candidate_names = list(dict.fromkeys(declared + from_resume))

    skill_score, matched, partial, missing = score_skills(job_skills, candidate_names)

    sections = parser.split_sections(resume_text) if resume_text else {}
    years = max(float(candidate.get("yearsExperience") or 0), parser.compute_years(sections, resume_text) if resume_text else 0)
    min_years = float(job.get("minExperience") or 0)
    exp_score = score_experience(years, min_years)

    cand_level = max([parser.degree_level(e) for e in candidate.get("education", [])] + [parser.degree_level(sections.get("education", ""))] + [0])
    req_level = required_degree_level(job_text)
    edu_score = score_education(cand_level, req_level)

    text_score = score_text(job_text, resume_text)

    weights = WEIGHTS if job_skills else WEIGHTS_NO_SKILLS
    final = round(
        weights["skills"] * skill_score + weights["experience"] * exp_score + weights["education"] * edu_score + weights["text"] * text_score,
        1,
    )

    job_names = {taxonomy.canonical(s["name"]) for s in job_skills}
    extra = [n for n in candidate_names if n not in job_names and n not in taxonomy.expand(job_names)]

    return {
        "score": final,
        "label": label_for(final),
        "breakdown": {"skills": round(skill_score, 1), "experience": exp_score, "education": edu_score, "text": text_score},
        "weights": weights,
        "matchedSkills": matched,
        "partialSkills": partial,
        "missingSkills": missing,
        "extraSkills": extra,
        "candidateYears": years,
        "summary": _summary(final, matched, partial, missing, job_skills, years, min_years, cand_level, req_level),
        "modelVersion": MODEL_VERSION,
    }


def _summary(score, matched, partial, missing, job_skills, years, min_years, cand_level, req_level) -> str:
    parts = [f"{label_for(score)} match ({score:.0f}%)."]
    if job_skills:
        parts.append(f"Covers {len(matched)} of {len(job_skills)} job skills" + (f" ({', '.join(matched[:4])}{'…' if len(matched) > 4 else ''})." if matched else "."))
    if partial:
        parts.append(f"Related experience for {len(partial)} more.")
    if missing:
        parts.append(f"Missing: {', '.join(missing[:4])}{'…' if len(missing) > 4 else ''}.")
    if min_years:
        verdict = "meets" if years >= min_years else "is below"
        parts.append(f"{years:g} yrs experience {verdict} the {min_years:g}-yr minimum.")
    if req_level and cand_level < req_level:
        parts.append(f"Degree level below the {parser.LEVEL_NAMES[req_level]} the posting asks for.")
    return " ".join(parts)


def rank(job: dict, candidates: list) -> list:
    results = []
    for c in candidates:
        r = match(job, c)
        r["id"] = c.get("id")
        results.append(r)
    results.sort(key=lambda r: r["score"], reverse=True)
    for i, r in enumerate(results, start=1):
        r["rank"] = i
    return results

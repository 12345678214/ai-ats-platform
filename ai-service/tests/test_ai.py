import io

import docx
import pytest
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from app import matcher, parser, taxonomy
from app.main import create_app

JOB = {
    "title": "Full Stack Developer",
    "description": "Build features with React, Node.js and PostgreSQL. Bachelor degree in computer science. Nice to have: Docker, AWS.",
    "requirements": "2+ years of experience with REST APIs.",
    "minExperience": 2,
    "skills": [
        {"name": "React", "required": True},
        {"name": "Node.js", "required": True},
        {"name": "PostgreSQL", "required": True},
        {"name": "Docker", "required": False},
    ],
}

STRONG = {
    "resumeText": "Full stack engineer. 4 years of experience building React and Node.js apps with PostgreSQL and Docker. Bachelor of Technology in Computer Science.",
    "skills": ["React", "Node.js", "PostgreSQL", "Docker"],
    "yearsExperience": 4,
    "education": ["Bachelor of Technology Computer Science"],
}
WEAK = {
    "resumeText": "Retail associate with customer service background and cash handling.",
    "skills": ["Excel"],
    "yearsExperience": 0,
    "education": [],
}


def test_taxonomy_aliases_and_ambiguity():
    names = {s.name for s, _ in taxonomy.find_skills("We use ReactJS, nodejs and Postgres. Go to market fast. I react quickly.")}
    assert {"React", "Node.js", "PostgreSQL"} <= names
    assert "Go" not in names  # plain English "Go" must not count as the language


def test_java_is_not_javascript():
    names = {s.name for s, _ in taxonomy.find_skills("Strong JavaScript developer")}
    assert "JavaScript" in names and "Java" not in names


def test_implied_skills():
    assert {"React", "JavaScript"} <= taxonomy.expand({"Next.js"})


def test_strong_beats_weak_and_is_explained():
    strong, weak = matcher.match(JOB, STRONG), matcher.match(JOB, WEAK)
    assert strong["score"] > 80 > 30 > weak["score"] or strong["score"] > weak["score"] + 40
    assert set(strong["matchedSkills"]) == {"React", "Node.js", "PostgreSQL", "Docker"}
    assert weak["missingSkills"] and "React" in weak["missingSkills"]
    assert 0 <= weak["score"] <= strong["score"] <= 100


def test_partial_credit_for_same_family():
    job = {"title": "DBA", "description": "x", "skills": [{"name": "PostgreSQL", "required": True}]}
    mysql = matcher.match(job, {"resumeText": "", "skills": ["MySQL"]})
    none = matcher.match(job, {"resumeText": "", "skills": ["React"]})
    assert mysql["breakdown"]["skills"] == pytest.approx(40.0)
    assert mysql["partialSkills"] and not none["partialSkills"]
    assert mysql["breakdown"]["skills"] > none["breakdown"]["skills"]


def test_experience_scales_linearly_below_minimum():
    assert matcher.score_experience(1, 2) == 50.0
    assert matcher.score_experience(5, 2) == 100.0
    assert matcher.score_experience(0, 0) == 100.0


def test_job_without_skills_falls_back_to_description_extraction():
    job = {"title": "Dev", "description": "You will write React and Node.js code."}
    out = matcher.match(job, {"resumeText": "React Node.js", "skills": []})
    assert "React" in out["matchedSkills"]


def test_extract_job_skills_marks_optional_and_experience():
    out = matcher.extract_job_skills(JOB["title"], JOB["description"], JOB["requirements"])
    by = {s["name"]: s["required"] for s in out["skills"]}
    assert by["React"] is True and by["Docker"] is False and by["AWS"] is False
    assert out["minExperience"] == 2.0


def test_rank_orders_descending():
    ranked = matcher.rank(JOB, [{"id": "w", **WEAK}, {"id": "s", **STRONG}])
    assert [r["id"] for r in ranked] == ["s", "w"] and ranked[0]["rank"] == 1


def _pdf(lines):
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    y = 800
    for line in lines:
        c.drawString(50, y, line)
        y -= 16
    c.save()
    return buf.getvalue()


RESUME_LINES = [
    "Jane Doe", "jane@example.com | +1 415 555 0100",
    "Summary", "Backend engineer with 3 years of experience.",
    "Experience", "Acme Corp Jan 2021 - Present", "Senior Developer",
    "Education", "Stanford University", "Master of Science in Computer Science 2018 - 2020",
    "Skills", "Python, Django, PostgreSQL, Docker, AWS",
]


def test_parse_pdf_end_to_end():
    out = parser.parse_resume(_pdf(RESUME_LINES), "jane.pdf")
    names = {s["name"] for s in out["skills"]}
    assert {"Python", "Django", "PostgreSQL", "Docker", "AWS"} <= names
    assert out["highestDegree"] == "Master's"
    assert out["yearsExperience"] >= 3
    assert out["contact"]["email"] == "jane@example.com"
    assert out["experience"] and out["experience"][0]["company"].startswith("Acme")


def test_parse_docx():
    d = docx.Document()
    for line in RESUME_LINES:
        d.add_paragraph(line)
    buf = io.BytesIO()
    d.save(buf)
    out = parser.parse_resume(buf.getvalue(), "jane.docx")
    assert "Django" in {s["name"] for s in out["skills"]}


def test_overlapping_jobs_not_double_counted():
    ranges = parser.date_ranges("Jan 2020 - Dec 2020\nJun 2020 - Dec 2021")
    assert parser.years_from_ranges(ranges) == 2.0


def test_api_auth_and_validation():
    app = create_app()
    app.config["TESTING"] = True
    client = app.test_client()
    assert client.get("/health").status_code == 200
    import app.main as m
    m.SERVICE_KEY = "secret"
    assert client.post("/match", json={}).status_code == 401
    ok = client.post("/match", json={"job": JOB, "candidate": STRONG}, headers={"X-Service-Key": "secret"})
    assert ok.status_code == 200 and ok.json["score"] > 70
    bad = client.post("/parse-resume", headers={"X-Service-Key": "secret"})
    assert bad.status_code == 400
    m.SERVICE_KEY = ""

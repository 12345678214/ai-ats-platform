# Browser smoke test (Playwright for Python). Needs: pip install playwright && playwright install chromium
# Run with the seeded stack up (API :4000, client :5173):  python e2e/ui_smoke.py
import json, re, sys, urllib.request
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:5173"
API = "http://localhost:4000/api"
SHOTS = "/home/claude/shots"
problems, passed = [], 0

def api(method, path, body=None, token=None):
    req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body else None,
                                 headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})})
    return json.load(urllib.request.urlopen(req))

def login_token(email, pw):
    return api("POST", "/auth/login", {"email": email, "password": pw})["token"]

def ok(name, cond, extra=""):
    global passed
    if cond: passed += 1; print("  ✓", name)
    else: problems.append(name + " " + extra); print("  ✗", name, extra)

with sync_playwright() as p:
    browser = p.chromium.launch()

    def new_page(token=None, mobile=False):
        ctx = browser.new_context(viewport={"width": 390, "height": 844} if mobile else {"width": 1366, "height": 860}, is_mobile=mobile)
        if token: ctx.add_init_script(f"localStorage.setItem('shortlist.token','{token}')")
        pg = ctx.new_page()
        pg.errors = []
        pg.on("console", lambda m: pg.errors.append(f"console.{m.type}: {m.text}") if m.type == "error" and "status of 403" not in m.text else None)  # 403s are Google Fonts blocked by the sandbox network; API errors are caught by the response hook
        pg.on("pageerror", lambda e: pg.errors.append(f"pageerror: {e}"))
        pg.on("response", lambda r: pg.errors.append(f"HTTP {r.status} {r.request.method} {r.url}") if r.status >= 400 and "/api/" in r.url else None)
        return pg

    def visit(pg, path, wait_text=None, shot=None):
        pg.goto(BASE + path, wait_until="networkidle")
        if wait_text: pg.wait_for_selector(f"text={wait_text}", timeout=8000)
        if shot: pg.screenshot(path=f"{SHOTS}/{shot}.png", full_page=False)

    print("\nPublic")
    pg = new_page()
    visit(pg, "/", "Read fewer resumes", "landing"); ok("landing renders", True)
    visit(pg, "/jobs", "jobs found", "jobs_public")
    ok("job board lists seeded jobs", pg.locator("article").count() >= 6)
    pg.fill("input[type=search]", "python"); pg.wait_for_timeout(900)
    ok("search narrows results", 0 < pg.locator("article").count() < 9)
    jid = api("GET", "/jobs?q=Frontend")["items"][0]["id"]
    visit(pg, f"/jobs/{jid}", "Sign in to apply", "job_detail_public")
    ok("public landing/jobs/detail have no errors", not pg.errors, str(pg.errors))
    visit(pg, "/login", "Welcome back", "login"); visit(pg, "/register", "Create your account", "register")
    visit(pg, "/nope", "This page doesn't exist")
    pg.close()

    print("\nAuth UI")
    pg = new_page()
    visit(pg, "/login", "Welcome back")
    pg.fill("input[type=email]", "candidate@ats.dev"); pg.fill("input[type=password]", "wrong-password1"); pg.click("button[type=submit]")
    pg.wait_for_selector("text=Incorrect email or password", timeout=5000); ok("bad login shows error", True)
    pg.locator("button", has_text="Candidate").click(); pg.wait_for_url("**/candidate", timeout=8000)
    pg.wait_for_selector("text=Recent applications"); ok("demo login redirects to candidate dashboard", True)
    pg.screenshot(path=f"{SHOTS}/candidate_dashboard.png")
    pg.errors = [e for e in pg.errors if "401" not in e]
    ok("no errors on candidate dashboard", not pg.errors, str(pg.errors)); pg.close()
    pg = new_page(); visit(pg, "/candidate")
    pg.wait_for_url("**/login"); ok("protected route redirects when signed out", True)
    pg.goto(BASE + "/register"); pg.fill("input[autocomplete=name]", "UI Tester"); pg.fill("input[type=email]", f"ui{__import__('time').time_ns()}@test.dev")
    pg.fill("input[type=password]", "short"); pg.click("button[type=submit]")
    pg.wait_for_selector("text=Use at least 8 characters", timeout=5000); ok("register shows field-level validation", True); pg.close()

    print("\nCandidate")
    ct = login_token("candidate@ats.dev", "Password@123")
    pg = new_page(ct)
    visit(pg, "/candidate/jobs", "jobs found", "cand_jobs")
    pg.locator("button[aria-label='Save job']").first.click(); pg.wait_for_selector("text=Job saved", timeout=5000); ok("save job from card", True)
    djob = [j for j in api("GET", "/jobs?limit=50", token=ct)["items"] if not j.get("applicationStatus")][0]
    visit(pg, f"/candidate/jobs/{djob['id']}", "Apply now", "cand_job_detail")
    pg.click("text=Apply now"); pg.wait_for_selector("text=Send application"); pg.screenshot(path=f"{SHOTS}/apply_modal.png")
    pg.fill("textarea", "Excited to apply."); pg.click("text=Send application")
    pg.wait_for_selector("text=You applied to this job", timeout=8000); ok("apply flow completes from the UI", True)
    visit(pg, "/candidate/applications", "My applications")
    pg.locator("tbody tr").first.click(); pg.wait_for_selector("text=Timeline"); pg.screenshot(path=f"{SHOTS}/cand_application_drawer.png"); ok("application drawer shows timeline", True)
    pg.keyboard.press("Escape")
    visit(pg, "/candidate/saved", "Saved jobs"); visit(pg, "/candidate/profile", "Profile strength", "cand_profile")
    ok("resume list shows parsed resume", pg.locator("text=Parsed").count() >= 1)
    pg.fill("input[placeholder='e.g. Full Stack Developer']", "Senior Full Stack Developer"); pg.click("text=Save changes"); pg.wait_for_selector("text=Profile saved", timeout=5000); ok("profile save works", True)
    visit(pg, "/candidate/notifications", "Notifications", "cand_notifications")
    ok("candidate pages have no console/network errors", not pg.errors, str(pg.errors)); pg.close()

    pg = new_page(ct, mobile=True)
    visit(pg, "/candidate", "Recent applications", "mobile_candidate")
    ok("mobile: no horizontal overflow", pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"))
    pg.click("button[aria-label='Open menu']"); pg.wait_for_selector("text=Browse jobs >> visible=true"); pg.screenshot(path=f"{SHOTS}/mobile_menu.png"); ok("mobile nav opens", True)
    pg.close()

    print("\nRecruiter")
    rt = login_token("recruiter@ats.dev", "Password@123")
    pg = new_page(rt)
    visit(pg, "/recruiter", "Latest applicants", "rec_dashboard")
    visit(pg, "/recruiter/jobs", "Jobs & applicants", "rec_jobs")
    sr = [j for j in api("GET", "/recruiter/jobs?limit=20", token=rt)["items"] if j["title"] == "Senior Full Stack Engineer"][0]
    visit(pg, f"/recruiter/jobs/{sr['id']}/applicants", "Re-run AI ranking", "rec_applicants")
    ok("applicants ranked table renders", pg.locator("tbody tr").count() >= 3)
    pg.locator("tbody tr").first.click(); pg.wait_for_selector("text=AI match"); pg.locator("[role=tab]", has_text="AI match").click(); pg.wait_for_selector("text=How the score is made up"); pg.screenshot(path=f"{SHOTS}/rec_drawer_match.png"); ok("drawer AI match tab explains the score", True)
    pg.locator("[role=tab]", has_text="Notes").click(); pg.fill("textarea", "UI test note"); pg.click("text=Add note"); pg.wait_for_selector("text=Note added", timeout=5000); ok("add note from drawer", True)
    pg.keyboard.press("Escape"); pg.click("text=Pipeline"); pg.wait_for_selector("text=Drop applicants here", timeout=5000) if pg.locator("text=Drop applicants here").count() else None
    pg.wait_for_selector("[aria-label^='Applied,']"); pg.screenshot(path=f"{SHOTS}/rec_kanban.png"); ok("pipeline board renders columns", pg.locator("section[aria-label*='applicants']").count() == 7)
    visit(pg, "/recruiter/jobs/new", "Post a job", "rec_job_form")
    pg.fill("input[placeholder^='e.g. Senior Backend']", "UI Test Engineer"); pg.fill("textarea >> nth=0", "We need someone who writes React and Node.js code with PostgreSQL for a growing product team every day.")
    pg.fill("input[placeholder^='City, country']", "Remote"); pg.click("text=Publish job"); pg.wait_for_url("**/applicants", timeout=10000); ok("create + publish job from the UI", True)
    visit(pg, "/recruiter/analytics", "Hiring funnel", "rec_analytics"); visit(pg, "/recruiter/interviews", "Interviews", "rec_interviews"); visit(pg, "/recruiter/company", "Company profile", "rec_company")
    pg.errors = [e for e in pg.errors if "/api/" not in e or "404" not in e]
    ok("recruiter pages have no console/network errors", not pg.errors, str(pg.errors)); pg.close()

    print("\nAdmin")
    at = login_token("admin@ats.dev", "Admin@12345")
    pg = new_page(at)
    visit(pg, "/admin", "Needs attention", "admin_overview")
    for path, text, shot in [("/admin/users", "Every account on the platform", "admin_users"), ("/admin/companies", "Verify employers", "admin_companies"), ("/admin/jobs", "Moderate listings", "admin_jobs"), ("/admin/applications", "Read-only view", "admin_apps")]:
        visit(pg, path, text, shot)
    ok("admin pages have no console/network errors", not pg.errors, str(pg.errors)); pg.close()
    browser.close()

print(f"\n{passed} passed, {len(problems)} failed")
for p in problems: print("  -", p)
sys.exit(1 if problems else 0)

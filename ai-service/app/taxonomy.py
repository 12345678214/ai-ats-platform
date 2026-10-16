"""Skill taxonomy used by both the resume parser and the matcher.

Each entry: (canonical name, category, aliases, implies, family)

* aliases   - spellings to look for in free text. A leading "=" makes the alias case-sensitive
              (used for words that are also common English, e.g. "React", "Spring").
* implies   - skills a person necessarily has if they list this one (Next.js -> React).
* family    - skills in the same family earn partial credit for each other (MySQL ~ PostgreSQL).
"""
import re

# fmt: off
_RAW = [
    # Languages
    ("Python", "Language", ["python", "python3"], [], "lang-script"),
    ("JavaScript", "Language", ["javascript", "ecmascript", "es6", "es2015", "js (es6"], [], "lang-script"),
    ("TypeScript", "Language", ["typescript"], ["JavaScript"], "lang-script"),
    ("Java", "Language", ["java", "core java", "java 8", "java 11", "java 17"], [], "lang-jvm"),
    ("Kotlin", "Language", ["kotlin"], [], "lang-jvm"),
    ("C++", "Language", ["c++", "cpp"], [], "lang-native"),
    ("C#", "Language", ["c#", "csharp", "c sharp"], [], "lang-native"),
    ("Go", "Language", ["golang", "go lang", "=Go language"], [], "lang-native"),
    ("Rust", "Language", ["=Rust"], [], "lang-native"),
    ("PHP", "Language", ["php"], [], "lang-script"),
    ("Ruby", "Language", ["=Ruby"], [], "lang-script"),
    ("Swift", "Language", ["=Swift"], [], "lang-mobile"),
    ("Scala", "Language", ["=Scala"], [], "lang-jvm"),
    ("R", "Language", ["r programming", "rstudio", "r language"], [], "lang-data"),
    ("Bash", "Language", ["bash", "shell scripting", "shell script"], [], "lang-script"),
    ("SQL", "Language", ["sql", "structured query language"], [], None),
    ("HTML5", "Frontend", ["html5", "html"], [], None),
    ("CSS3", "Frontend", ["css3", "css"], [], None),
    # Frontend
    ("React", "Frontend", ["react.js", "reactjs", "react js", "=React"], ["JavaScript"], "fe-framework"),
    ("Next.js", "Frontend", ["next.js", "nextjs", "next js"], ["React", "JavaScript"], "fe-framework"),
    ("Angular", "Frontend", ["angular", "angularjs", "angular.js"], ["TypeScript"], "fe-framework"),
    ("Vue.js", "Frontend", ["vue.js", "vuejs", "vue js", "=Vue"], ["JavaScript"], "fe-framework"),
    ("Nuxt.js", "Frontend", ["nuxt.js", "nuxtjs", "=Nuxt"], ["Vue.js", "JavaScript"], "fe-framework"),
    ("Svelte", "Frontend", ["svelte", "sveltekit"], ["JavaScript"], "fe-framework"),
    ("Redux", "Frontend", ["redux", "redux toolkit"], ["React"], "fe-state"),
    ("React Router", "Frontend", ["react router", "react-router"], ["React"], None),
    ("Tailwind CSS", "Frontend", ["tailwind css", "tailwindcss", "tailwind"], ["CSS3"], "css-framework"),
    ("Bootstrap", "Frontend", ["bootstrap"], ["CSS3"], "css-framework"),
    ("Material UI", "Frontend", ["material ui", "material-ui", "mui"], ["React"], "css-framework"),
    ("Sass", "Frontend", ["sass", "scss"], ["CSS3"], None),
    ("Responsive Design", "Frontend", ["responsive design", "responsive web design", "responsive ui"], [], None),
    ("Webpack", "Frontend", ["webpack"], [], "bundler"),
    ("Vite", "Frontend", ["vite"], [], "bundler"),
    ("jQuery", "Frontend", ["jquery"], ["JavaScript"], None),
    # Backend
    ("Node.js", "Backend", ["node.js", "nodejs", "node js", "=Node"], ["JavaScript"], "be-runtime"),
    ("Express.js", "Backend", ["express.js", "expressjs", "express js", "=Express"], ["Node.js", "JavaScript"], "be-node-fw"),
    ("NestJS", "Backend", ["nestjs", "nest.js"], ["Node.js", "TypeScript"], "be-node-fw"),
    ("Django", "Backend", ["django", "django rest framework", "drf"], ["Python"], "be-python-fw"),
    ("Flask", "Backend", ["flask"], ["Python"], "be-python-fw"),
    ("FastAPI", "Backend", ["fastapi"], ["Python"], "be-python-fw"),
    ("Spring Boot", "Backend", ["spring boot", "springboot", "=Spring"], ["Java"], "be-java-fw"),
    ("ASP.NET", "Backend", ["asp.net", ".net core", "dotnet", ".net framework", "=.NET"], ["C#"], "be-dotnet"),
    ("Laravel", "Backend", ["laravel"], ["PHP"], "be-php-fw"),
    ("REST APIs", "Backend", ["rest api", "rest apis", "restful api", "restful apis", "restful services", "restful", "rest services", "rest"], [], None),
    ("GraphQL", "Backend", ["graphql"], [], None),
    ("WebSockets", "Backend", ["websocket", "websockets", "socket.io"], [], None),
    ("Microservices", "Backend", ["microservice", "microservices"], [], None),
    ("JWT", "Backend", ["jwt", "json web token", "json web tokens", "jwt authentication"], [], None),
    ("OAuth", "Backend", ["oauth", "oauth2", "oauth 2.0"], [], None),
    ("RBAC", "Backend", ["rbac", "role-based access control", "role based access control"], [], None),
    ("Prisma", "Backend", ["prisma", "prisma orm"], [], "orm"),
    ("Sequelize", "Backend", ["sequelize"], [], "orm"),
    ("TypeORM", "Backend", ["typeorm"], ["TypeScript"], "orm"),
    ("Mongoose", "Backend", ["mongoose"], ["MongoDB"], "orm"),
    ("SQLAlchemy", "Backend", ["sqlalchemy"], ["Python", "SQL"], "orm"),
    ("Hibernate", "Backend", ["hibernate", "jpa"], ["Java", "SQL"], "orm"),
    # Databases
    ("PostgreSQL", "Database", ["postgresql", "postgres", "psql"], ["SQL"], "db-sql"),
    ("MySQL", "Database", ["mysql"], ["SQL"], "db-sql"),
    ("SQL Server", "Database", ["sql server", "mssql", "ms sql", "t-sql"], ["SQL"], "db-sql"),
    ("Oracle DB", "Database", ["oracle db", "oracle database", "pl/sql"], ["SQL"], "db-sql"),
    ("SQLite", "Database", ["sqlite"], ["SQL"], "db-sql"),
    ("MongoDB", "Database", ["mongodb", "mongo db", "=Mongo"], [], "db-nosql"),
    ("DynamoDB", "Database", ["dynamodb"], [], "db-nosql"),
    ("Cassandra", "Database", ["cassandra"], [], "db-nosql"),
    ("Redis", "Database", ["redis"], [], "db-cache"),
    ("Elasticsearch", "Database", ["elasticsearch", "elastic search", "opensearch"], [], None),
    ("Database Design", "Database", ["database design", "schema design", "database schema design", "data modeling", "data modelling", "normalization"], [], None),
    # Cloud / DevOps
    ("AWS", "Cloud", ["aws", "amazon web services", "ec2", "s3 bucket", "lambda"], [], "cloud"),
    ("Azure", "Cloud", ["azure", "microsoft azure"], [], "cloud"),
    ("GCP", "Cloud", ["gcp", "google cloud", "google cloud platform"], [], "cloud"),
    ("Docker", "DevOps", ["docker", "dockerfile", "docker compose", "docker-compose"], [], "containers"),
    ("Kubernetes", "DevOps", ["kubernetes", "k8s"], [], "containers"),
    ("Terraform", "DevOps", ["terraform"], [], "iac"),
    ("Ansible", "DevOps", ["ansible"], [], "iac"),
    ("CI/CD", "DevOps", ["ci/cd", "ci cd", "continuous integration", "continuous delivery", "continuous deployment"], [], None),
    ("GitHub Actions", "DevOps", ["github actions"], ["Git", "CI/CD"], "ci"),
    ("Jenkins", "DevOps", ["jenkins"], ["CI/CD"], "ci"),
    ("GitLab CI", "DevOps", ["gitlab ci", "gitlab-ci"], ["Git", "CI/CD"], "ci"),
    ("Linux", "DevOps", ["linux", "ubuntu server", "unix"], [], None),
    ("Nginx", "DevOps", ["nginx"], [], None),
    ("Git", "Tools", ["git", "github", "gitlab", "bitbucket", "version control"], [], None),
    ("Jira", "Tools", ["jira"], [], None),
    ("Postman", "Tools", ["postman"], [], None),
    ("Figma", "Tools", ["figma"], [], None),
    # Testing
    ("Jest", "Testing", ["jest"], ["JavaScript"], "test-js"),
    ("Mocha", "Testing", ["mocha", "chai"], ["JavaScript"], "test-js"),
    ("Cypress", "Testing", ["cypress"], ["JavaScript"], "test-e2e"),
    ("Playwright", "Testing", ["playwright"], [], "test-e2e"),
    ("Selenium", "Testing", ["selenium"], [], "test-e2e"),
    ("PyTest", "Testing", ["pytest", "unittest"], ["Python"], None),
    ("Unit Testing", "Testing", ["unit testing", "unit tests", "test-driven development", "tdd"], [], None),
    # Data / ML
    ("Pandas", "Data", ["pandas"], ["Python"], None),
    ("NumPy", "Data", ["numpy"], ["Python"], None),
    ("scikit-learn", "Data", ["scikit-learn", "scikit learn", "sklearn"], ["Python", "Machine Learning"], "ml-lib"),
    ("TensorFlow", "Data", ["tensorflow", "keras"], ["Python", "Machine Learning"], "ml-lib"),
    ("PyTorch", "Data", ["pytorch"], ["Python", "Machine Learning"], "ml-lib"),
    ("Machine Learning", "Data", ["machine learning", "ml models", "predictive modeling"], [], None),
    ("Deep Learning", "Data", ["deep learning", "neural network", "neural networks"], ["Machine Learning"], None),
    ("NLP", "Data", ["nlp", "natural language processing", "text mining"], [], None),
    ("Data Analysis", "Data", ["data analysis", "data analytics", "data analyst", "exploratory data analysis"], [], None),
    ("Data Visualization", "Data", ["data visualization", "data visualisation", "tableau", "power bi", "matplotlib"], [], None),
    ("Apache Spark", "Data", ["apache spark", "pyspark", "=Spark"], [], None),
    ("ETL", "Data", ["etl", "data pipelines", "data pipeline"], [], None),
    # Mobile
    ("React Native", "Mobile", ["react native", "react-native"], ["React", "JavaScript"], "mobile-cross"),
    ("Flutter", "Mobile", ["flutter", "dart"], [], "mobile-cross"),
    ("Android", "Mobile", ["android", "android development"], [], "mobile-native"),
    ("iOS", "Mobile", ["ios development", "ios", "swiftui"], [], "mobile-native"),
    # Practices / CS
    ("Data Structures & Algorithms", "Computer Science", ["data structures", "algorithms", "dsa", "data structures and algorithms", "data structures & algorithms"], [], None),
    ("Object-Oriented Programming", "Computer Science", ["object-oriented programming", "object oriented programming", "oop", "oops"], [], None),
    ("System Design", "Computer Science", ["system design", "distributed systems", "scalable systems", "high-level design"], [], None),
    ("Design Patterns", "Computer Science", ["design patterns"], [], None),
    ("Agile", "Practices", ["agile", "scrum", "kanban"], [], None),
    ("Code Review", "Practices", ["code review", "code reviews", "peer review"], [], None),
    ("API Design", "Practices", ["api design", "api integration", "api development", "third-party apis"], [], None),
    ("Problem Solving", "Soft skills", ["problem solving", "problem-solving", "analytical thinking"], [], None),
    ("Communication", "Soft skills", ["communication skills", "stakeholder communication", "written communication"], [], None),
    ("Leadership", "Soft skills", ["team leadership", "led a team", "mentoring", "mentored"], [], None),
    # Security
    ("Web Security", "Security", ["web security", "owasp", "application security", "secure coding"], [], None),
    ("Authentication", "Security", ["authentication", "authorization", "authorisation", "sso", "single sign-on"], [], None),
]
# fmt: on


class Skill:
    __slots__ = ("name", "category", "implies", "family", "patterns")

    def __init__(self, name, category, aliases, implies, family):
        self.name, self.category, self.implies, self.family = name, category, implies, family
        self.patterns = [_compile(a) for a in aliases]
        # The canonical name is also a pattern, unless it is short/ambiguous ("Go", "R") or the
        # skill already defines case-sensitive aliases for exactly that reason.
        if len(name) > 2 and not any(a.startswith("=") for a in aliases):
            self.patterns.append(_compile(name))


def _compile(alias: str):
    case_sensitive = alias.startswith("=")
    alias = alias[1:] if case_sensitive else alias
    body = re.escape(alias).replace(r"\ ", r"[\s\-]+")
    # No word characters (or the symbols that glue into tech names) directly around the match.
    pattern = rf"(?<![\w+#.]){body}(?![\w+#]|\.[A-Za-z])"
    return re.compile(pattern, 0 if case_sensitive else re.IGNORECASE)


SKILLS = [Skill(*row) for row in _RAW]
BY_NAME = {s.name: s for s in SKILLS}
BY_LOWER = {s.name.lower(): s for s in SKILLS}


def canonical(name: str) -> str:
    """Maps any known spelling to its canonical skill name; unknown names are returned trimmed."""
    name = (name or "").strip()
    if name.lower() in BY_LOWER:
        return BY_LOWER[name.lower()].name
    for skill in SKILLS:
        if any(p.fullmatch(name) for p in skill.patterns):
            return skill.name
    return name


def find_skills(text: str):
    """Returns [(Skill, first_match_position)] for every taxonomy skill mentioned in text."""
    found = []
    for skill in SKILLS:
        best = None
        for pat in skill.patterns:
            m = pat.search(text)
            if m and (best is None or m.start() < best):
                best = m.start()
        if best is not None:
            found.append((skill, best))
    return found


def expand(names):
    """Adds implied skills transitively: {'Next.js'} -> {'Next.js', 'React', 'JavaScript'}."""
    out, stack = set(), list(names)
    while stack:
        n = stack.pop()
        if n in out:
            continue
        out.add(n)
        sk = BY_NAME.get(n)
        if sk:
            stack.extend(sk.implies)
    return out

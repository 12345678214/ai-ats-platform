import hmac
import os

from dotenv import load_dotenv
from flask import Flask, jsonify, request

from . import matcher, parser, taxonomy

load_dotenv()
SERVICE_KEY = os.getenv("AI_SERVICE_KEY", "")
MAX_UPLOAD = 6 * 1024 * 1024


def create_app() -> Flask:
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD

    @app.before_request
    def check_key():
        if request.path == "/health" or not SERVICE_KEY:
            return None
        sent = request.headers.get("X-Service-Key", "")
        if not hmac.compare_digest(sent, SERVICE_KEY):
            return jsonify(error="Invalid service key"), 401
        return None

    @app.get("/health")
    def health():
        return jsonify(status="ok", model=matcher.MODEL_VERSION, skillsKnown=len(taxonomy.SKILLS))

    @app.post("/parse-resume")
    def parse_resume():
        file = request.files.get("file")
        if not file:
            return jsonify(error="Send the resume as multipart field 'file'"), 400
        try:
            return jsonify(parser.parse_resume(file.read(), file.filename or "resume"))
        except ValueError as exc:
            return jsonify(error=str(exc)), 422

    @app.post("/extract-job-skills")
    def extract_job_skills():
        body = request.get_json(silent=True) or {}
        if not (body.get("description") or body.get("title")):
            return jsonify(error="description or title is required"), 400
        return jsonify(matcher.extract_job_skills(body.get("title", ""), body.get("description", ""), body.get("requirements") or ""))

    @app.post("/match")
    def match():
        body = request.get_json(silent=True) or {}
        if "job" not in body or "candidate" not in body:
            return jsonify(error="Body must contain 'job' and 'candidate'"), 400
        return jsonify(matcher.match(body["job"], body["candidate"]))

    @app.post("/rank")
    def rank():
        body = request.get_json(silent=True) or {}
        if "job" not in body or not isinstance(body.get("candidates"), list):
            return jsonify(error="Body must contain 'job' and a 'candidates' list"), 400
        return jsonify(results=matcher.rank(body["job"], body["candidates"]))

    @app.errorhandler(413)
    def too_large(_):
        return jsonify(error="File too large"), 413

    @app.errorhandler(Exception)
    def unexpected(exc):
        app.logger.exception("Unhandled error")
        return jsonify(error="Internal error while processing the request"), 500

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "8000")))

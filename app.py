"""
Spidey Sense -- Flask arcade game app.

Run locally:
    python app.py

Deploy on PythonAnywhere:
    Point the WSGI file's `application` import at this module's `app` object,
    e.g.  from app import app as application
"""
import os
from flask import Flask


def _load_dotenv():
    """
    Tiny .env loader (KEY=VALUE per line) so GOOGLE_CLIENT_ID/SECRET etc. can
    live in a local, gitignored .env file instead of real env vars during
    development. On PythonAnywhere, set these as real environment variables
    in the Web tab instead -- see GOOGLE_LOGIN_SETUP.md.

    Must run before anything imports oauth.py, which reads these values from
    os.environ at import time.
    """
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if not os.path.exists(path):
        return
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())


_load_dotenv()

import db  # noqa: E402  (must come after _load_dotenv())
from routes.main import main_bp  # noqa: E402
from routes.games import games_bp  # noqa: E402
from routes.auth import auth_bp  # noqa: E402
from routes.scan import scan_bp  # noqa: E402
from routes.admin import admin_bp  # noqa: E402


def create_app():
    app = Flask(__name__)
    app.secret_key = os.environ.get("SPIDEY_SECRET_KEY", "dev-secret-change-me")

    db.init_app(app)
    with app.app_context():
        db.init_db()

    app.register_blueprint(main_bp)
    app.register_blueprint(games_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(scan_bp)
    app.register_blueprint(admin_bp)

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True, port=5000)

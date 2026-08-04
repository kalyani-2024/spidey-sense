"""
Standalone, no-login demo of Game 2 ("Villain Lockdown") for public sharing.

Deployed separately from the real event app (../app.py) on Vercel, so it
never touches Google OAuth, SQLite, or the anti-cheat session/token flow --
it just renders the real game template with dummy context. Gated by a
single shared password (HTTP Basic Auth) via the DEMO_PASSWORD env var.
"""
import functools
import os
import sys
from pathlib import Path

from flask import Blueprint, Flask, Response, redirect, render_template, request

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from games_config import GAME_INFO  # noqa: E402

app = Flask(__name__, template_folder=str(ROOT / "templates"))


def _password_ok(password):
    expected = os.environ.get("DEMO_PASSWORD")
    return bool(expected) and password == expected


def require_password(view):
    @functools.wraps(view)
    def wrapped(*args, **kwargs):
        auth = request.authorization
        if not auth or not _password_ok(auth.password):
            return Response(
                "Password required to view this demo.",
                401,
                {"WWW-Authenticate": 'Basic realm="Villain Lockdown demo"'},
            )
        return view(*args, **kwargs)
    return wrapped


@app.route("/")
def index():
    return redirect("/demo/game2")


# _bonus_banner.html (shared by every game template) always calls
# url_for('games.play_game', ...) even though bonus['state'] == 'locked'
# here hides the banner -- Jinja still needs the endpoint to exist to build
# the URL. This stub is never actually reachable in the demo.
games_bp = Blueprint("games", __name__)


@games_bp.route("/game/<game_id>")
def play_game(game_id):
    return redirect("/demo/game2")


app.register_blueprint(games_bp)


@app.route("/demo/game2")
@require_password
def demo_game2():
    return render_template(
        "games/game2_demo.html",
        game_id="2",
        game_info=GAME_INFO["2"],
        token="demo",
        progress={"completed": []},
        bonus={"state": "locked"},
        main_sequence=["1", "2", "3", "4"],
    )

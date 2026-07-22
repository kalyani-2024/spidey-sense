"""Home screen, suit-up, and post-run results. Timer start/stop lives in
routes/scan.py; the actual challenges live in routes/games.py."""
from flask import Blueprint, render_template, session, redirect, url_for

import models
from games_config import FINISH_STATE

main_bp = Blueprint("main", __name__)


def _current_player():
    player_id = session.get("player_id")
    if not player_id:
        return None
    return models.get_player(player_id)


def _resume_url(player):
    """
    Where a player belongs right now, given their server-side state. There is
    no standalone hub/dashboard screen -- like the prototype, every
    transition drops the player directly into their current game, the wait
    screen, the final QR, or results. Used both for "/" and as the shared
    landing spot every other route redirects an already-started player to.
    """
    if not player["start_time"]:
        return url_for("scan.scan_start_page")
    current = player["current_game"]
    if current == FINISH_STATE:
        return url_for("scan.scan_finish_page")
    if current == "done":
        return url_for("main.results")
    return url_for("games.play_game", game_id=current)


@main_bp.route("/")
def index():
    player = _current_player()
    if player:
        return redirect(_resume_url(player))
    return render_template("index.html")


@main_bp.route("/suitup")
def suitup():
    """Punchy 3-2-1 countdown-in shown once, right after the player scans
    the start QR and before their first challenge -- see routes/scan.py."""
    player = _current_player()
    if not player:
        return redirect(url_for("main.index"))
    if not player["start_time"]:
        return redirect(url_for("scan.scan_start_page"))
    return render_template("suitup.html", next_url=url_for("main.dashboard"))


@main_bp.route("/dashboard")
def dashboard():
    """No standalone hub screen -- immediately continues the player into
    wherever they actually are. Kept as a named endpoint (rather than
    inlined) because it's the shared "go to wherever this player belongs"
    target used by scan/games/auth after login, scans, and completions."""
    player = _current_player()
    if not player:
        return redirect(url_for("main.index"))
    return redirect(_resume_url(player))


@main_bp.route("/results")
def results():
    player = _current_player()
    if not player:
        return redirect(url_for("main.index"))

    if not player["end_time"]:
        return redirect(url_for("main.dashboard"))

    # Deliberately not passing elapsed/time (or bonus/progress detail) here
    # -- the finish screen matches the prototype exactly, and players never
    # see their time or ranking anyway; only admins do (see routes/admin.py).
    return render_template("results.html", player=player)

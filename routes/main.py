"""Home screen, dashboard, and post-run results. Timer start/stop lives in routes/scan.py."""
from flask import Blueprint, render_template, session, redirect, url_for

import models
from games_config import GAME_INFO, FINISH_STATE, MAIN_SEQUENCE, BONUS_ID

main_bp = Blueprint("main", __name__)


def _current_player():
    player_id = session.get("player_id")
    if not player_id:
        return None
    return models.get_player(player_id)


@main_bp.route("/")
def index():
    if _current_player():
        return redirect(url_for("main.dashboard"))
    return render_template("index.html")


@main_bp.route("/dashboard")
def dashboard():
    player = _current_player()
    if not player:
        return redirect(url_for("main.index"))

    if not player["start_time"]:
        return redirect(url_for("scan.scan_start_page"))

    progress = models.progress_summary(player)
    current = player["current_game"]
    bonus = models.bonus_status(player)

    if current == FINISH_STATE:
        next_url = url_for("scan.scan_finish_page")
        next_label = "Scan the FINAL stall QR"
    elif current == "done":
        next_url = url_for("main.results")
        next_label = "View results"
    else:
        next_url = url_for("games.play_game", game_id=current)
        next_label = "Continue challenge"

    return render_template(
        "dashboard.html",
        player=player,
        progress=progress,
        bonus=bonus,
        game_info=GAME_INFO,
        main_sequence=MAIN_SEQUENCE,
        bonus_id=BONUS_ID,
        next_url=next_url,
        next_label=next_label,
    )


@main_bp.route("/results")
def results():
    player = _current_player()
    if not player:
        return redirect(url_for("main.index"))

    if not player["end_time"]:
        return redirect(url_for("main.dashboard"))

    # Deliberately not passing elapsed/time here -- players never see their
    # time or ranking, only admins do (see routes/admin.py).
    progress = models.progress_summary(player)
    return render_template("results.html", player=player, progress=progress)

"""
Public, no-login demo route for sharing a single mini-game outside the real
event flow (no Google OAuth, no QR scan, no countdown, no player record).

Renders the actual game template unmodified so the demo always matches what
players see live; only the win behavior differs (see game2_demo.html).
"""
from flask import Blueprint, render_template

from games_config import GAME_INFO

demo_bp = Blueprint("demo", __name__)


@demo_bp.route("/demo/game2")
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

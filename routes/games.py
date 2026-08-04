"""Mini-game placeholder pages + completion endpoint."""
from flask import Blueprint, render_template, request, session, redirect, url_for, jsonify, flash

import models
from games_config import GAME_INFO, MAIN_SEQUENCE, BONUS_ID, FINISH_STATE

games_bp = Blueprint("games", __name__)

VALID_GAME_IDS = set(MAIN_SEQUENCE) | {BONUS_ID}


@games_bp.after_request
def _no_store(response):
    """
    Never let a challenge page sit in the browser's back/forward cache. The
    server already refuses to re-run a cleared game (see play_game and
    mark_game_complete), but without this the phone would happily re-paint
    the old page from cache when the player hits Back -- looking like the
    challenge is replayable even though nothing they did there would count.
    """
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


def _current_player():
    player_id = session.get("player_id")
    if not player_id:
        return None
    return models.get_player(player_id)


@games_bp.route("/game/<game_id>")
def play_game(game_id):
    """
    Loads the current mini-game -- or a waiting-room / not-available page
    if the server-side state says the player isn't allowed in yet.
    """
    if game_id not in VALID_GAME_IDS:
        flash("Unknown challenge.")
        return redirect(url_for("main.index"))

    player = _current_player()
    if not player:
        flash("Scan the stall QR code to begin your run!")
        return redirect(url_for("main.index"))

    progress = models.progress_summary(player)
    bonus = models.bonus_status(player)

    if game_id == BONUS_ID:
        if bonus["state"] == "completed":
            flash("You already cleared the bonus round!")
            return redirect(url_for("main.dashboard"))
        if bonus["state"] != "available":
            flash("The bonus round isn't here right now -- keep going, it can pop up anytime.")
            return redirect(url_for("main.dashboard"))

        # Landing here converts the short alert window into a full play window
        # -- see models.open_bonus(). Re-read the status so the page renders
        # with the extended deadline rather than the alert's few seconds.
        player = models.open_bonus(player["player_id"]) or player
        bonus = models.bonus_status(player)

        return render_template(
            "games/game_bonus.html",
            player=player,
            progress=progress,
            bonus=bonus,
            game_id=BONUS_ID,
            game_info=GAME_INFO[BONUS_ID],
            token=bonus["token"],
        )

    # A main-sequence game: only the player's actual current_game is
    # reachable, even by direct URL -- this is what stops skip-ahead cheating.
    if game_id != player["current_game"]:
        if player["current_game"] in (FINISH_STATE, "done"):
            flash("You've already cleared all the challenges!")
        else:
            flash("That's not your current challenge yet.")
        return redirect(url_for("main.dashboard"))

    status = models.game_status(player)
    if status["state"] == "waiting":
        return render_template(
            "waiting.html",
            player=player,
            progress=progress,
            bonus=bonus,
            game_id=game_id,
            game_info=GAME_INFO[game_id],
            unlocks_at=status["unlocks_at"],
        )

    return render_template(
        f"games/game{game_id}.html",
        player=player,
        progress=progress,
        bonus=bonus,
        game_id=game_id,
        game_info=GAME_INFO[game_id],
        token=status["token"],
    )


@games_bp.route("/complete-game", methods=["POST"])
def complete_game():
    """Called by a mini-game's JS once the player finishes the challenge."""
    player_id = session.get("player_id")
    if not player_id:
        return jsonify({"status": "error", "message": "No active session"}), 401

    payload = request.get_json(silent=True) or request.form
    game_id = payload.get("game_id")
    token = payload.get("token")

    if game_id not in VALID_GAME_IDS:
        return jsonify({"status": "error", "message": "Invalid game_id"}), 400

    result = models.mark_game_complete(player_id, game_id, token)
    if not result["ok"]:
        # Every rejection here is either a bug in a mini-game's JS or someone
        # poking the API directly -- neither should ever move the player
        # forward, so we just report the error and change nothing.
        return jsonify({"status": "error", "message": result["error"]}), 409

    player = result["player"]
    next_state = player["current_game"]
    if game_id == BONUS_ID:
        redirect_url = url_for("main.dashboard")
    elif next_state == FINISH_STATE:
        redirect_url = url_for("main.dashboard")
    else:
        redirect_url = url_for("games.play_game", game_id=next_state)

    return jsonify({
        "status": "ok",
        "next": next_state,
        "redirect": redirect_url,
        "progress": models.progress_summary(player),
    })

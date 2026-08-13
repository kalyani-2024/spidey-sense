"""
Player data access + game-progression rules.

Everything that decides "is this player allowed to do X right now" lives
here, server-side, using timestamps stored in the database -- never the
client's word for it. See mark_game_complete() for the anti-cheat checks.
"""
import random
import secrets
import string
import time

from db import get_db
from games_config import (
    MAIN_SEQUENCE, BONUS_ID, FINISH_STATE,
    BONUS_PLAY_SECONDS, BONUS_TIME_CREDIT_SECONDS,
)


def _generate_player_id(db):
    """Short, human-friendly id like SPD-4K7Q, guaranteed unique."""
    alphabet = string.ascii_uppercase + string.digits
    while True:
        candidate = "SPD-" + "".join(random.choices(alphabet, k=4))
        exists = db.execute(
            "SELECT 1 FROM players WHERE player_id = ?", (candidate,)
        ).fetchone()
        if not exists:
            return candidate


def _generate_token(prefix):
    """
    One-time completion token, e.g. 'GAME1-A7F92C'. Only ever handed to the
    player via the actual mini-game page they've unlocked, and the page must
    echo it back to /complete-game. secrets (not random) because this is the
    thing standing between "loaded the game" and "just guessed the game_id".
    """
    alphabet = string.ascii_uppercase + string.digits
    suffix = "".join(secrets.choice(alphabet) for _ in range(6))
    return f"{prefix.upper()}-{suffix}"


def get_or_create_player(google_email, google_name=None):
    """
    Called right after a successful Google login. Reuses the same row across
    logins/devices for the same Gmail account -- logging in again does NOT
    reset an in-progress or finished run. The timer does not start here; see
    begin_run().
    """
    db = get_db()
    row = db.execute(
        "SELECT * FROM players WHERE google_email = ?", (google_email,)
    ).fetchone()
    if row:
        return dict(row)

    player_id = _generate_player_id(db)
    now = time.time()
    db.execute(
        """INSERT INTO players
           (player_id, google_email, player_name, current_game, completed_games, created_at)
           VALUES (?, ?, ?, NULL, '', ?)""",
        (player_id, google_email, google_name, now),
    )
    db.commit()
    return get_player(player_id)


def begin_run(player_id):
    """
    Start the timer and drop the player straight into the first challenge --
    called only after the backend has validated a real scan of the first
    stall QR (see routes/scan.py). Safe to call more than once: a player
    re-scanning after a page reload doesn't restart their clock.
    """
    db = get_db()
    player = get_player(player_id)
    if player is None:
        return None
    if player["start_time"]:
        return player  # already started; don't reset

    now = time.time()
    game_token = _generate_token(f"game{MAIN_SEQUENCE[0]}")
    # The bonus token is minted up front but the round stays locked until
    # they tap JOIN ACM on the finish screen -- see unlock_bonus().
    bonus_token = _generate_token("bonus")

    db.execute(
        """UPDATE players
           SET start_time = ?, current_game = ?, game_unlocks_at = ?, game_token = ?,
               bonus_slot = NULL, bonus_unlock_at = NULL, bonus_expires_at = NULL,
               bonus_started_at = NULL, bonus_token = ?
           WHERE player_id = ?""",
        (now, MAIN_SEQUENCE[0], now, game_token, bonus_token, player_id),
    )
    db.commit()
    return get_player(player_id)


def get_player(player_id):
    db = get_db()
    row = db.execute(
        "SELECT * FROM players WHERE player_id = ?", (player_id,)
    ).fetchone()
    return dict(row) if row else None


def _completed_list(player):
    raw = player["completed_games"] or ""
    return [g for g in raw.split(",") if g]


def game_status(player, now=None):
    """
    Is the player's current main-sequence game playable? There is no
    countdown between challenges any more -- clearing one unlocks the next
    immediately -- so a live run is always either "ready" or finished.
    """
    now = now if now is not None else time.time()
    current = player["current_game"]

    if current is None:
        return {"state": "not_started"}

    if current in (FINISH_STATE, "done"):
        return {"state": current, "game_id": current}

    return {
        "state": "ready",
        "game_id": current,
        "token": player["game_token"],
    }


def bonus_status(player, now=None):
    """
    Where the bonus round is for this player: still locked behind the JOIN
    ACM button on the finish screen, unlocked and playable, or done/spent.
    """
    now = now if now is not None else time.time()

    if player["bonus_completed"]:
        return {"state": "completed"}

    unlock_at = player["bonus_unlock_at"]
    expires_at = player["bonus_expires_at"]
    started_at = player["bonus_started_at"]

    if unlock_at is None:
        # They haven't tapped JOIN ACM yet (or haven't finished their run) --
        # the round exists but nothing has revealed it to them.
        return {"state": "locked", "started": False}

    # A spent attempt is recorded by pushing bonus_expires_at into the past
    # (see forfeit_bonus) -- that's the only thing that closes the round
    # short of clearing it, since there's otherwise no deadline.
    if expires_at is not None and now > expires_at:
        return {"state": "expired", "started": bool(started_at)}

    return {"state": "available", "started": bool(started_at),
            "unlock_at": unlock_at, "expires_at": expires_at,
            "seconds_left": None if expires_at is None else round(expires_at - now),
            "token": player["bonus_token"]}


def unlock_bonus(player_id):
    """
    Reveal the bonus round. Called when a finished player taps JOIN ACM on
    the results screen -- that button is the only door to it. Safe to call
    repeatedly; tapping JOIN ACM again doesn't reopen a spent attempt.
    """
    player = get_player(player_id)
    if player is None or player["bonus_completed"]:
        return player
    # Only reachable from the finish screen, so the run must be over. This is
    # also what keeps the credit honest: their clock has already stopped, so
    # the bonus can't be used to pause a run.
    if not player["end_time"]:
        return player
    if player["bonus_unlock_at"] is not None:
        return player  # already revealed (possibly already spent)

    db = get_db()
    db.execute(
        "UPDATE players SET bonus_unlock_at = ?, bonus_expires_at = NULL WHERE player_id = ?",
        (time.time(), player_id),
    )
    db.commit()
    return get_player(player_id)


def open_bonus(player_id):
    """
    Called when the player actually lands on the bonus page. Records when
    they started so a play deadline can apply if BONUS_PLAY_SECONDS is ever
    set (None = no limit, the default).
    """
    player = get_player(player_id)
    if player is None or player["bonus_completed"]:
        return player

    now = time.time()
    if bonus_status(player, now)["state"] != "available":
        return player

    if player["bonus_started_at"]:
        return player  # already opened; don't restart the clock

    play_deadline = None if BONUS_PLAY_SECONDS is None else now + BONUS_PLAY_SECONDS
    db = get_db()
    db.execute(
        "UPDATE players SET bonus_started_at = ?, bonus_expires_at = ? WHERE player_id = ?",
        (now, play_deadline, player_id),
    )
    db.commit()
    return get_player(player_id)


def forfeit_bonus(player_id, token=None):
    """
    Record that the player played the bonus round and did NOT clear it.

    Clearing the bonus means clearing it outright (all bugs fixed / the
    "DEBUGGED!" ending); losing is a loss, not a pass. This closes their one
    attempt -- bonus_completed stays 0, so they get no golden B and no
    time credit, and the round can't be replayed.
    """
    player = get_player(player_id)
    if player is None or player["bonus_completed"]:
        return player

    now = time.time()
    status = bonus_status(player, now)
    if status["state"] != "available":
        return player
    if not token or token != status.get("token"):
        return player

    db = get_db()
    # Expiring it is what closes the attempt: bonus_status() then reports
    # "expired", the finish screen stops offering it, and /game/bonus stops
    # loading.
    db.execute(
        "UPDATE players SET bonus_expires_at = ? WHERE player_id = ?",
        (now - 1, player_id),
    )
    db.commit()
    return get_player(player_id)


def mark_game_complete(player_id, game_id, token=None):
    """
    Validate + record a game completion. This is the ONLY place completion
    is accepted, and it re-derives everything from server-side state/time --
    the client cannot skip a game, finish early, or replay the bonus by
    just changing what it sends.

    `token` must match the one-time token the server handed out on the
    actual game page (see game_status()/bonus_status()) -- this is what
    stops a bare `fetch('/complete-game', {game_id: 'x'})` from working
    without ever having loaded that game's page.

    Returns {"ok": True, "player": {...}} or {"ok": False, "error": "..."}
    """
    db = get_db()
    player = get_player(player_id)
    if player is None:
        return {"ok": False, "error": "Player not found"}

    now = time.time()

    if game_id == BONUS_ID:
        # The bonus is played AFTER the run, from behind the JOIN ACM button
        # on the finish screen -- so a stopped clock is a precondition here,
        # not a rejection. It only ever adjusts the score, never the run.
        if not player["end_time"]:
            return {"ok": False, "error": "Finish your run first"}

        status = bonus_status(player, now)
        if status["state"] != "available":
            return {"ok": False, "error": f"Bonus round is not available ({status['state']})"}

        if not token or token != status["token"]:
            return {"ok": False, "error": "Invalid or missing completion token"}

        completed = _completed_list(player)
        if BONUS_ID not in completed:
            completed.append(BONUS_ID)
        db.execute(
            "UPDATE players SET completed_games = ?, bonus_completed = 1 WHERE player_id = ?",
            (",".join(completed), player_id),
        )
        db.commit()
        return {"ok": True, "player": get_player(player_id)}

    if game_id not in MAIN_SEQUENCE:
        return {"ok": False, "error": "Unknown game_id"}

    if game_id != player["current_game"]:
        return {"ok": False, "error": "That is not your current challenge"}

    status = game_status(player, now)
    if status["state"] != "ready":
        return {"ok": False, "error": "This challenge hasn't unlocked yet"}

    if not token or token != status["token"]:
        return {"ok": False, "error": "Invalid or missing completion token"}

    completed = _completed_list(player)
    if game_id not in completed:
        completed.append(game_id)

    main_done = [g for g in completed if g in MAIN_SEQUENCE]
    if len(main_done) < len(MAIN_SEQUENCE):
        # No countdown: the next challenge is playable the instant this one
        # is cleared, and /complete-game hands the player straight into it.
        next_game = MAIN_SEQUENCE[len(main_done)]
        next_unlocks_at = now
        next_token = _generate_token(f"game{next_game}")
    else:
        next_game = FINISH_STATE
        next_unlocks_at = None
        next_token = None

    db.execute(
        """UPDATE players
           SET completed_games = ?, current_game = ?, game_unlocks_at = ?, game_token = ?
           WHERE player_id = ?""",
        (",".join(completed), next_game, next_unlocks_at, next_token, player_id),
    )
    db.commit()
    return {"ok": True, "player": get_player(player_id)}


def progress_summary(player):
    """Small dict used by the HUD/progress tracker in the templates."""
    completed = _completed_list(player)
    total_steps = len(MAIN_SEQUENCE) + 1  # +1 for the bonus round
    done_steps = len(completed)
    return {
        "completed": completed,
        "done_count": done_steps,
        "total_count": total_steps,
        "percent": round(min(done_steps / total_steps, 1.0) * 100),
        "bonus_done": BONUS_ID in completed,
    }


def end_game(player_id):
    db = get_db()
    player = get_player(player_id)
    if player is None:
        return None
    if not player["end_time"]:
        db.execute(
            "UPDATE players SET end_time = ?, current_game = 'done' WHERE player_id = ?",
            (time.time(), player_id),
        )
        db.commit()
        player = get_player(player_id)
    return player


def elapsed_seconds(player):
    start = player["start_time"]
    end = player["end_time"] or time.time()
    if not start:
        return 0
    return max(0, end - start)


def score_entry(elapsed, bonus_done):
    """
    Turn a finished run into the number the leaderboard ranks on: raw time,
    minus BONUS_TIME_CREDIT_SECONDS for anyone who cleared the bonus round.
    Fastest effective time wins -- one flat list, no separate brackets.
    """
    return max(0, elapsed - (BONUS_TIME_CREDIT_SECONDS if bonus_done else 0))


def admin_player_list():
    """
    Full roster for the admin dashboard -- finished runs first (fastest
    effective time on top, see score_entry), then in-progress runs, then
    accounts that haven't scanned QR #1 yet. Never exposed to players.
    """
    db = get_db()
    rows = [dict(r) for r in db.execute("SELECT * FROM players ORDER BY created_at ASC").fetchall()]

    finished, in_progress, not_started = [], [], []
    for r in rows:
        progress = progress_summary(r)
        bonus_done = bool(r["bonus_completed"])
        entry = {
            "player_id": r["player_id"],
            "player_name": r["player_name"] or r["player_id"],
            "google_email": r["google_email"],
            "start_time": r["start_time"],
            "end_time": r["end_time"],
            "current_game": r["current_game"],
            "progress": progress,
            "bonus_done": bonus_done,
        }
        if r["end_time"]:
            entry["elapsed"] = r["end_time"] - r["start_time"]
            entry["score"] = score_entry(entry["elapsed"], bonus_done)
            finished.append(entry)
        elif r["start_time"]:
            entry["elapsed"] = elapsed_seconds(r)
            in_progress.append(entry)
        else:
            not_started.append(entry)

    finished.sort(key=lambda e: e["score"])
    in_progress.sort(key=lambda e: -e["elapsed"])
    return {
        "finished": finished,
        "in_progress": in_progress,
        "not_started": not_started,
        "bonus_credit": BONUS_TIME_CREDIT_SECONDS,
    }

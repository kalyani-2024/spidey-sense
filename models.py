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
    WAIT_SECONDS, FIRST_GAME_WAIT_SECONDS,
    BONUS_SLOTS, BONUS_SLOT_LEAD_IN, BONUS_WINDOW_SECONDS, BONUS_PLAY_SECONDS,
    SCORING_MODE, BONUS_TIME_CREDIT_SECONDS,
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
    Start the timer: called only after the backend has validated a real scan
    of the first stall QR (see routes/scan.py). Safe to call more than once
    -- a player re-scanning after a page reload doesn't restart their clock.
    """
    db = get_db()
    player = get_player(player_id)
    if player is None:
        return None
    if player["start_time"]:
        return player  # already started; don't reset

    now = time.time()
    # No countdown before the very first game -- see FIRST_GAME_WAIT_SECONDS.
    game_unlocks_at = now + FIRST_GAME_WAIT_SECONDS
    game_token = _generate_token(f"game{MAIN_SEQUENCE[0]}")
    # Which countdown will host the bonus alert. The actual firing time isn't
    # known yet -- it's set once the player reaches that slot, in
    # _schedule_bonus_for_slot(), because it depends on when they get there.
    bonus_slot = random.choice(BONUS_SLOTS) if BONUS_SLOTS else None
    bonus_token = _generate_token("bonus")

    db.execute(
        """UPDATE players
           SET start_time = ?, current_game = ?, game_unlocks_at = ?, game_token = ?,
               bonus_slot = ?, bonus_unlock_at = NULL, bonus_expires_at = NULL,
               bonus_started_at = NULL, bonus_token = ?
           WHERE player_id = ?""",
        (now, MAIN_SEQUENCE[0], game_unlocks_at, game_token,
         bonus_slot, bonus_token, player_id),
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
    """Is the player's current main-sequence game counting down, or playable?"""
    now = now if now is not None else time.time()
    current = player["current_game"]

    if current is None:
        return {"state": "not_started"}

    if current in (FINISH_STATE, "done"):
        return {"state": current, "game_id": current}

    unlocks_at = player["game_unlocks_at"] or 0
    if now < unlocks_at:
        return {
            "state": "waiting",
            "game_id": current,
            "unlocks_at": unlocks_at,
            "seconds_left": round(unlocks_at - now),
        }
    return {
        "state": "ready",
        "game_id": current,
        "unlocks_at": unlocks_at,
        "token": player["game_token"],
    }


def _bonus_fire_time(countdown_start, countdown_length):
    """
    Pick the moment inside a countdown when the bonus alert pops. Kept well
    clear of both ends of the wait so the alert never appears the instant the
    wait screen loads, and never gets cut short by the next game unlocking.
    """
    latest = countdown_length - BONUS_WINDOW_SECONDS
    earliest = min(BONUS_SLOT_LEAD_IN, max(latest, 0))
    if latest <= earliest:
        return countdown_start + earliest
    return countdown_start + random.uniform(earliest, latest)


def _schedule_bonus_for_slot(player, next_game, countdown_start, countdown_length):
    """
    If `next_game` is this player's drawn bonus slot, work out when the alert
    fires during the countdown that's about to start. Returns
    (bonus_unlock_at, bonus_expires_at), or (None, None) to leave it unset.
    """
    if player["bonus_completed"] or not player["bonus_slot"]:
        return None, None
    if next_game != player["bonus_slot"]:
        return None, None
    unlock_at = _bonus_fire_time(countdown_start, countdown_length)
    return unlock_at, unlock_at + BONUS_WINDOW_SECONDS


def bonus_status(player, now=None):
    """
    Where the bonus round is for this player: not yet scheduled, counting
    down to its alert, on screen right now, being played, missed, or done.
    """
    now = now if now is not None else time.time()

    if player["bonus_completed"]:
        return {"state": "completed"}

    unlock_at = player["bonus_unlock_at"]
    expires_at = player["bonus_expires_at"]
    started_at = player["bonus_started_at"]

    if unlock_at is None:
        # Either the slot hasn't been reached yet (bonus still to come), or
        # this is a legacy row from before slot scheduling existed.
        if player["bonus_slot"]:
            return {"state": "pending", "started": False}
        return {"state": "expired", "started": False}

    if started_at:
        # They answered the alert in time, so the alert's deadline has done
        # its job and stops applying -- from here they solve it in their own
        # time (BONUS_PLAY_SECONDS). `started` is also what stops the
        # full-screen alert re-appearing over someone mid-bonus-game.
        if expires_at is not None and now > expires_at:
            return {"state": "expired", "started": True}
        return {"state": "available", "started": True,
                "unlock_at": unlock_at, "expires_at": expires_at,
                "seconds_left": None if expires_at is None else round(expires_at - now),
                "token": player["bonus_token"]}

    if now < unlock_at:
        return {"state": "locked", "started": False,
                "unlock_at": unlock_at, "expires_at": expires_at}
    if now <= expires_at:
        return {"state": "available", "started": False,
                "unlock_at": unlock_at, "expires_at": expires_at,
                "seconds_left": round(expires_at - now), "token": player["bonus_token"]}
    return {"state": "expired", "started": False}


def open_bonus(player_id):
    """
    Called when the player actually lands on the bonus page. The alert window
    (BONUS_WINDOW_SECONDS) is only how long they have to *respond* -- getting
    here means they made it, so the alert's deadline is replaced by the play
    window (BONUS_PLAY_SECONDS, None for no limit).
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
    "DEBUGGED!" ending); running out of time is a loss, not a pass. This
    closes their one attempt -- bonus_completed stays 0, so they get no
    golden B and no leaderboard credit, and the round can't be replayed.
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
    # "expired", the alert never comes back, and /game/bonus stops loading.
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
        # With no play deadline, an opened-but-unfinished bonus would other-
        # wise stay completable forever -- including after the player scanned
        # the finish QR, which would re-rank a run that was already over.
        if player["end_time"]:
            return {"ok": False, "error": "Your run is already finished"}

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
        next_game = MAIN_SEQUENCE[len(main_done)]
        next_unlocks_at = now + WAIT_SECONDS
        next_token = _generate_token(f"game{next_game}")
        # If the countdown that's about to start is this player's bonus slot,
        # this is where the alert gets its firing time.
        bonus_unlock_at, bonus_expires_at = _schedule_bonus_for_slot(
            player, next_game, now, WAIT_SECONDS
        )
    else:
        next_game = FINISH_STATE
        next_unlocks_at = None
        next_token = None
        bonus_unlock_at, bonus_expires_at = None, None

    if bonus_unlock_at is not None:
        db.execute(
            """UPDATE players
               SET completed_games = ?, current_game = ?, game_unlocks_at = ?, game_token = ?,
                   bonus_unlock_at = ?, bonus_expires_at = ?
               WHERE player_id = ?""",
            (",".join(completed), next_game, next_unlocks_at, next_token,
             bonus_unlock_at, bonus_expires_at, player_id),
        )
    else:
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
    Turn a finished run into the numbers the leaderboard ranks on. See
    SCORING_MODE in games_config.py for what the two modes mean.

    Returns (sort_key, effective_seconds). `sort_key` is a tuple so
    "bonus_first" can rank on two levels at once; `effective_seconds` is what
    the dashboard actually prints as the player's score.
    """
    if SCORING_MODE == "time_credit":
        effective = max(0, elapsed - (BONUS_TIME_CREDIT_SECONDS if bonus_done else 0))
        return (effective,), effective
    # "bonus_first" (default): every bonus-clearer outranks every player who
    # skipped or missed it, and raw time only breaks ties inside each group.
    return (0 if bonus_done else 1, elapsed), elapsed


def admin_player_list():
    """
    Full roster for the admin dashboard -- finished runs first (best score on
    top, see score_entry), then in-progress runs, then accounts that haven't
    scanned QR #1 yet. Never exposed to players; only /admin renders this.
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
            entry["sort_key"], entry["score"] = score_entry(entry["elapsed"], bonus_done)
            finished.append(entry)
        elif r["start_time"]:
            entry["elapsed"] = elapsed_seconds(r)
            in_progress.append(entry)
        else:
            not_started.append(entry)

    finished.sort(key=lambda e: e["sort_key"])
    in_progress.sort(key=lambda e: -e["elapsed"])
    return {
        "finished": finished,
        "in_progress": in_progress,
        "not_started": not_started,
        "scoring_mode": SCORING_MODE,
        "bonus_credit": BONUS_TIME_CREDIT_SECONDS,
    }

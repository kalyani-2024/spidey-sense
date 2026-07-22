"""
Central place that describes the mini-game lineup and pacing rules.

Adding a new mini-game later means:
  1. Drop a template in templates/games/game5.html (for example)
  2. Add its id to MAIN_SEQUENCE below
  3. Add a title/description entry to GAME_INFO

Nothing else in the routing/scoring/anti-cheat logic needs to change.
"""

# Order the 4 "on-server" mini-games are played in.
MAIN_SEQUENCE = ["1", "2", "3", "4"]

# Special, non-sequential game that can drop in at a random point.
BONUS_ID = "bonus"

GAME_INFO = {
    "1": {"title": "Web Shooter Reflex",   "number": "I"},
    "2": {"title": "Villain Lockdown",     "number": "II"},
    "3": {"title": "Rooftop Runner",       "number": "III"},
    "4": {"title": "Final Takedown",       "number": "IV"},
    "bonus": {"title": "Bonus Web Strike", "number": "BONUS"},
}

# Logical state meaning "all mini-games done, go scan the final stall QR".
FINISH_STATE = "finish"

# --- Pacing rules ------------------------------------------------------

# How long the countdown is before EACH game (including the very first one,
# right after scanning QR #1) becomes playable. Each player's countdown runs
# off their own start_time / completion time, so it's per-user, not global.
WAIT_SECONDS = 180  # 3 minutes

# NOTE: there is deliberately no minimum-play-time floor here. Winners are
# ranked by total elapsed time, so a legitimately fast click is the whole
# point -- anti-cheat instead relies on the per-game completion token (see
# mark_game_complete in models.py), which still requires actually loading
# the unlocked game page to get the token.

# The bonus round can appear anywhere in this window after the run starts...
BONUS_EARLIEST_OFFSET = 90    # never before 1.5 min in
BONUS_LATEST_OFFSET = 780     # never after 13 min in
# ...and once it appears, it only stays available for this long before
# it's gone for good.
BONUS_WINDOW_SECONDS = 60     # 1 minute

# --- Physical QR codes -------------------------------------------------
#
# These two printed stickers at the stall must encode EXACTLY these strings
# (not URLs -- the scanning happens inside our own /scan pages using the
# phone's camera, so the QR content is just a shared-secret string that the
# backend checks). Change these to whatever you actually print, and keep
# them out of anywhere a player could casually see them (i.e. never put
# them in a template or a JS file that ships to the browser).
START_QR_SECRET = "SPIDEY-SENSE-START-2026"
FINISH_QR_SECRET = "SPIDEY-SENSE-FINISH-2026"

# Flip to True for the real event. While False, /scan/start and /scan/finish
# skip the camera + secret check entirely and just show a "TAP TO CONTINUE"
# button instead -- lets you run through the whole flow on a laptop with no
# camera and no printed QR codes.
QR_SCAN_REQUIRED = False

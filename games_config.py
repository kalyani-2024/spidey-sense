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

# title/number head the shared page shell; `blurb` is the one-line "what am I
# meant to do here" that sits under the title, ABOVE the game container. Each
# mini-game's own markup should not repeat any of these three -- the shell
# already renders them (see templates/games/game_base.html).
GAME_INFO = {
    "1": {"title": "Hang-Spider", "number": "I",
          "blurb": "A villain scrambled the city's mainframe. Sling a web at one letter "
                   "at a time to crack the codeword. Five misses and it's lights out."},
    "2": {"title": "404 Hunt", "number": "II",
          "blurb": "The Bugle buried the story. Dig through the archive and find the "
                   "case number they didn't want you to see."},
    "3": {"title": "Memory Match", "number": "III",
          "blurb": "Match every logo to its name. Clear a web layer to reveal the next."},
    "4": {"title": "Tech Connections", "number": "IV",
          "blurb": "Sixteen tiles, four hidden groups. Find what connects them."},
    "bonus": {"title": "Code Ninja", "number": "BONUS",
              "blurb": "Slice fast. Stay clean. Go!"},
}

# Logical state meaning "all mini-games done, go scan the final stall QR".
FINISH_STATE = "finish"

# --- Pacing rules ------------------------------------------------------

# How long the countdown is between games. Each player's countdown runs off
# their own completion time, so it's per-user, not global.
WAIT_SECONDS = 180  # 3 minutes

# The countdown before the FIRST game only. Set to 0 so scanning QR #1 drops
# the player straight into Challenge I with no waiting-room screen -- there
# is nothing to wait for yet at that point, it just felt like dead air.
FIRST_GAME_WAIT_SECONDS = 0

# NOTE: there is deliberately no minimum-play-time floor here. Winners are
# ranked by total elapsed time, so a legitimately fast click is the whole
# point -- anti-cheat instead relies on the per-game completion token (see
# mark_game_complete in models.py), which still requires actually loading
# the unlocked game page to get the token.

# --- Bonus round scheduling --------------------------------------------
#
# The bonus is scheduled per-slot rather than at a fixed offset from the
# run's start: a slot is "the countdown that runs before game N", and the
# alert fires at a random moment inside whichever slot the player drew.
# Doing it this way (instead of "X seconds after start") is what guarantees
# the bonus can never land at the very beginning or the very end of a run,
# no matter how fast or slow that particular player is.
#
# With FIRST_GAME_WAIT_SECONDS = 0 the available countdowns are the ones
# before games 2, 3 and 4. Game 2's is excluded as "the very beginning",
# leaving the middle of the run and the approach to the finish. There is
# deliberately no slot after game 4 -- that would be "the very end".
BONUS_SLOTS = ["3", "4"]

# Guard rails inside the chosen countdown, so the alert never fires in the
# first moments of the wait screen and always leaves the player the full
# response window before the countdown ends.
BONUS_SLOT_LEAD_IN = 20       # earliest the alert can fire into the countdown

# How long the "SPIDEY-SENSE!!" alert stays on screen for the player to tap.
# Miss it and the bonus is gone for good -- it never blocks the main run.
BONUS_WINDOW_SECONDS = 10     # 10 seconds to respond

# Once the player DOES tap through to the bonus page, how long they get to
# actually play it. None = no limit: the 10s above is purely a window to
# respond to the alert, and having responded they solve it in their own
# time. Their overall run clock is still running, so dawdling already costs
# them on the leaderboard -- a second deadline here would just risk yanking
# the puzzle away mid-solve.
BONUS_PLAY_SECONDS = None

# --- Scoring / ranking -------------------------------------------------
#
# How the admin leaderboard ranks finished runs. The intended winner is
# "fastest player who ALSO cleared the bonus", so the default puts every
# bonus-clearer above every non-clearer and breaks ties on raw time.
#
#   "bonus_first"  -- cleared the bonus? you outrank everyone who didn't.
#                     Within each group, fastest elapsed time wins.
#   "time_credit"  -- one flat leaderboard; clearing the bonus subtracts
#                     BONUS_TIME_CREDIT_SECONDS from your effective time,
#                     so a fast non-clearer can still beat a slow clearer.
SCORING_MODE = "bonus_first"

# Only used when SCORING_MODE == "time_credit".
BONUS_TIME_CREDIT_SECONDS = 60

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

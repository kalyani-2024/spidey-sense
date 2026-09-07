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
#
# There is deliberately no countdown anywhere in a run. Clearing a challenge
# hands the player straight to the next one, and scanning QR #1 drops them
# straight into Challenge I. The run is one unbroken stretch of play, so the
# only thing the clock measures is how fast they actually solve things.
#
# There is also no minimum-play-time floor. Winners are ranked on total
# elapsed time, so a legitimately fast clear is the whole point -- anti-cheat
# instead relies on the per-game completion token (see mark_game_complete in
# models.py), which still requires actually loading that game's page.

# --- Bonus round -------------------------------------------------------
#
# The bonus round is the reward for tapping JOIN ACM on the finish screen:
# it doesn't exist anywhere in the run itself, and it only becomes reachable
# once the player has scanned the final QR and hit that button (see
# models.unlock_bonus / routes/main.py). Because their clock has already
# stopped by then, playing it costs them nothing -- clearing it takes
# BONUS_TIME_CREDIT_SECONDS off their leaderboard time.
#
# Tapping JOIN ACM does NOT open the membership portal straight away: it
# drops the player into the bonus round first, and the portal is what they
# land on once that attempt is over (cleared or not). This is the only URL
# the portal is referenced from -- results.html and routes/games.py both
# read it from here.
MEMBERSHIP_PORTAL_URL = "https://portal.acmbpdc.org/?next=%2Fmembership"

# How long the surprise bonus alert holds the screen after that tap before
# it gives up and continues to the portal on its own. Short enough to feel
# like an ambush, long enough to read and hit CLAIM IT.
BONUS_ALERT_SECONDS = 10

# How long they get to actually play it once they open it. None = no limit:
# their run is already over, so a deadline here would only risk yanking the
# puzzle away mid-solve for no gain.
BONUS_PLAY_SECONDS = None

# --- Scoring / ranking -------------------------------------------------
#
# One flat leaderboard, ranked on time, fastest first. Clearing the bonus
# round subtracts BONUS_TIME_CREDIT_SECONDS from a player's effective time,
# so a fast player who skipped it can still beat a slow player who cleared
# it -- the bonus is a bounty on the clock, not a separate bracket.
BONUS_TIME_CREDIT_SECONDS = 30

# --- Physical QR codes -------------------------------------------------
#
# These two printed stickers at the stall must encode EXACTLY these strings
# (not URLs -- the scanning happens inside our own /scan pages using the
# phone's camera, so the QR content is just a shared-secret string that the
# backend checks). Change these to whatever you actually print, and keep
# them out of anywhere a player could casually see them (i.e. never put
# them in a template or a JS file that ships to the browser).
START_QR_SECRET = "SPX-7QK4-START-M2A9"
FINISH_QR_SECRET = "SPX-7QK4-END-V6R3"

# Flip to True for the real event. While False, /scan/start and /scan/finish
# skip the camera + secret check entirely and just show a "TAP TO CONTINUE"
# button instead -- lets you run through the whole flow on a laptop with no
# camera and no printed QR codes.
QR_SCAN_REQUIRED = True

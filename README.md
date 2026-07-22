# Spidey Sense -- Arcade Stall Game

Flask + Jinja2 + vanilla JS + SQLite. No React/Vite/Node -- deploys straight
to PythonAnywhere as a plain Python web app.

## What this is

A timed, 6-QR arcade run for a university stall event:

1. Player signs in with Google (`/`).
2. Player scans the first physical QR sticker at the stall (in-app camera
   scan) -- this starts their timer.
3. Four mini-games in a fixed order, each preceded by a 3-minute countdown.
4. A bonus round can interrupt at a random point during any countdown
   (a full-screen "ALERT" -- tap it to play the bonus challenge). Missing it
   just means no bonus; it never blocks the main sequence.
5. Once all four are done, the player scans the second physical QR sticker,
   which stops their timer.
6. Players never see their own time or a leaderboard. Only event staff can,
   via `/admin` (Google-login gated, allowlisted emails only).

## Run locally

```
pip install -r requirements.txt
python app.py
```

Visit http://127.0.0.1:5000

You'll need Google OAuth credentials for login to work -- see
`GOOGLE_LOGIN_SETUP.md` if present, or ask whoever set up the Google Cloud
project. Put them in a local `.env` file (never committed):

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
SPIDEY_SECRET_KEY=some-random-string
```

While `QR_SCAN_REQUIRED = False` in `games_config.py`, the two QR-scan pages
show a "TAP TO CONTINUE" button instead of requiring a camera + real
printed QR code -- useful for testing the whole flow on a laptop. **Flip it
to `True` before the actual event.**

## Project layout

```
app.py                    Flask app factory / entrypoint, loads .env
db.py                     SQLite connection + schema init/migration
models.py                 Player state machine: countdowns, tokens, bonus
                           scheduling, anti-cheat validation
games_config.py           Single source of truth for the mini-game lineup,
                           pacing (countdown length, bonus window), and the
                           two QR secret strings
oauth.py                  Minimal Google OAuth2 client (no extra deps)
admin_config.py           Allowlist of admin Gmail addresses
schema.sql                players table definition

routes/main.py             /, /dashboard, /results
routes/auth.py             /login/google, /login/google/callback, /logout
routes/scan.py              /scan/start, /scan/finish (QR camera pages)
routes/games.py             /game/<id>, /complete-game
routes/admin.py              /admin (staff-only leaderboard)

templates/                 Jinja2 pages (base.html is the shared shell)
templates/games/            One template per mini-game -- see below
static/css/style.css        Comic/arcade theme (Bangers + Barlow fonts)
static/js/spiderweb.js      Animated canvas web background
static/js/game.js           POSTs to /complete-game, handles the token
static/js/qr_scan.js        Camera-based QR decoding (jsQR)
static/js/bonus_watcher.js  Shows/hides the full-screen bonus alert
```

## Anti-cheat, briefly

Every completion is validated server-side (`models.mark_game_complete`):
the game must be the player's actual current challenge, its countdown must
have genuinely finished, and the request must include a one-time token that
only exists in the HTML of that specific unlocked game page. None of this
is visible to or editable by mini-game code -- you never touch it.

---

## For mini-game developers

See **[MINI_GAME_DEVELOPERS.md](MINI_GAME_DEVELOPERS.md)** -- file
ownership, allowed frameworks, the `completeGame()` contract, and the git
workflow for submitting a game. Server setup and deployment (below) are
handled separately; mini-game devs don't need any of it.

---

## Admin dashboard

`/admin` shows the live leaderboard (finished runs, ranked by time) to
staff only. Access is controlled by `admin_config.py` -- add the Gmail
address of anyone who should be able to see it there before the event.

## Deploying on PythonAnywhere

1. Upload/clone this folder into your PythonAnywhere account.
2. Create a virtualenv, `pip install -r requirements.txt` inside it.
3. In the Web tab, set the working directory to this folder and point the
   WSGI file at:
   ```python
   import sys
   path = '/home/<youruser>/spidey_sense'
   if path not in sys.path:
       sys.path.append(path)
   from app import app as application
   ```
4. In the Web tab's **Environment variables** section, set real values for
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `SPIDEY_SECRET_KEY` (do
   not upload your local `.env` file there).
5. Add the deployed callback URL
   (`https://<youruser>.pythonanywhere.com/login/google/callback`) to the
   Google Cloud OAuth client's authorized redirect URIs.
6. Flip `QR_SCAN_REQUIRED = True` in `games_config.py` and set
   `START_QR_SECRET` / `FINISH_QR_SECRET` to whatever you actually print on
   the two stall QR codes.
7. The SQLite file (`spidey_sense.db`) is created automatically on first
   request/reload -- no manual migration step needed. Wipe it with
   `DELETE FROM players;` (or just delete the file and restart) right
   before the event starts so there's no leftover test data.

## A note on the current placeholder art

`static/img/spider-glow.png` and `static/img/spidey-wait-backdrop.png` are
sourced from existing Spider-Man game/promo art, used here as short-lived
placeholder art for an internal, non-commercial university event. Swap
these for original artwork before reusing this codebase anywhere more
public or longer-lived.

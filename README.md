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

You each own **one game**, and your changes are isolated to a handful of
files -- you cannot break anyone else's game or the app shell by mistake if
you stay inside your own folder.

### Where your code goes

| Game | Template (your markup) | Your JS | Your images/audio |
|---|---|---|---|
| Game 1 | `templates/games/game1.html` | `static/js/game1.js` | `static/games/game1/` |
| Game 2 | `templates/games/game2.html` | `static/js/game2.js` | `static/games/game2/` |
| Game 3 | `templates/games/game3.html` | `static/js/game3.js` | `static/games/game3/` |
| Game 4 | `templates/games/game4.html` | `static/js/game4.js` | `static/games/game4/` |
| Bonus  | `templates/games/game_bonus.html` | `static/js/game_bonus.js` | `static/games/game_bonus/` |

Each template already extends the shared shell (`games/game_base.html`) --
just replace the contents of the `game_content` block with your game's
markup/canvas. Don't touch `game_base.html` or any file outside your row
above.

### Frameworks / tech you can use

- **Plain HTML5 + CSS3 + vanilla JavaScript** -- this is the expected
  default, zero setup needed.
- **Canvas or SVG** for graphics/animation.
- A small, dependency-free JS library, **pasted directly into your own
  `static/js/game<N>.js`** (or an extra file next to it) -- not installed
  via npm.

### Not allowed

- **No React, Vue, Angular, Svelte, or anything needing a build step.**
  This app is plain Flask + Jinja2 -- there is no bundler in the pipeline.
- **No Node/npm/Vite/Webpack.** Nothing that needs `npm install` to produce
  the files you commit.
- **No external CDNs** (Google Fonts, unpkg, jsDelivr, etc.) for your game
  specifically. The site already loads its fonts; your game's own assets
  should be local files in your `static/games/game<N>/` folder so the whole
  app keeps working with no internet dependency at the venue.
- **No calling your own backend or database.** Your game runs entirely in
  the browser. The only server contact is the one call described below.

### The one integration rule

When the player wins, call:

```js
completeGame('1');   // or '2', '3', '4', 'bonus' -- your game's id
```

That's it. Token handling, session, anti-cheat, and redirecting to the next
screen are all automatic (`static/js/game.js`, already loaded on your page
-- don't call `/complete-game` yourself). Do not use `document.title`,
`window.location`, or a `<meta refresh>` to navigate away when the player
finishes -- always go through `completeGame()`.

### Design constraints

- Challenge must be **completable in 30-60 seconds**.
- Must work on a **phone browser held in one hand** -- touch input,
  portrait screen, no keyboard-only controls, no hover-dependent UI.
- Match the visual style already in `static/css/style.css` where it makes
  sense (dark background, `Bangers` for headlines, red/gold accents) so it
  doesn't look like a different app was pasted in -- but this is a nice-to
  -have, not a blocker.

### Where to push your code

1. Clone the repo, then make your own branch off `main`:
   ```
   git checkout -b game/<n>-<short-name>       # e.g. game/1-web-shooter
   ```
2. Work only inside your row of the table above.
3. Test locally (`python app.py`, with `QR_SCAN_REQUIRED = False` so you
   can skip straight past the QR steps) -- play your game start to finish
   and confirm `completeGame()` actually advances you to the next screen.
4. Push your branch and open a pull request into `main`:
   ```
   git push -u origin game/<n>-<short-name>
   ```
5. Tag the project lead for review before merging. Please don't merge your
   own PR directly into `main` -- someone should click through the full run
   once with your game in place before it goes live.

If anything about the contract above (the `completeGame()` call, the
countdown timing, what state you can/can't rely on) seems like it won't
work for your specific game idea, flag it to the project lead rather than
working around it -- the timing and anti-cheat logic is shared
infrastructure all five games depend on.

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

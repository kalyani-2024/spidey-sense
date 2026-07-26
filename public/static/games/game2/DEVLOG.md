# Game 2 — "Villain Lockdown" · Development Log

The story of how Challenge II went from a 10-second click-through to a
un-brute-forceable ~60-second hidden-404 hunt. Four versions, one afternoon.

> Note: v1–v3 were iterated by overwriting the same two files
> (`templates/games/game2.html`, `static/js/game2.js`), so they don't each have
> their own commit — this log is the record of the versions. The repo holds the
> final **v4**.

---

## v0 — the starting point
"The Daily Bugle — Find the Buried Page." A fake newspaper with big signposted
buttons (`See the Evidence →`, `Open the Archive →`, a glowing **MISSING** row).
The intended path was ~4 obvious taps. **Solvable in ~10 seconds** — no challenge.

## v1 — Web-swing reflex prototype (scrapped)
First pivot: a genuinely *hard* arcade game. A one-tap HTML5-canvas **web-swing**
— Spider-Man auto-falls under gravity, tap to web-zip up; grab 3 Daily-Bugle
code-scraps, dodge Green-Goblin pumpkin-bombs and forged scraps, then enter the
recovered code on a vault keypad to reach the buried 404.

- Built the full canvas engine (parallax NYC skyline, particles, spider-sense
  slow-mo, non-fatal hits so the stall queue never jams).
- Ran an **adversarial review workflow** over it and fixed everything confirmed:
  a self-healing win handoff (retry on flaky network), real parallax scroll, a
  reduced-motion strobe, a short-screen clip, a class-vs-id paint bug.
- **Scrapped** because the venue wanted a *website* you navigate, not a reflex
  game. (The self-healing `win()` and the 404 payoff carried forward.)

## v2 — Daily Bugle 404 clue-hunt
Back to a browsable Bugle site (a DOM router — `window.location` is never
touched), but a real hunt this time: read the front-page clue → find a case
number in the **Corrections** → spot the matching **redacted** row in the Archive
→ 404. Randomized case number + row position so neighbours can't share answers.
A per-page spider-sense hint kept it from dead-ending.

## v3 — Living newspaper + the Goblin
Made it *fun*, not just functional:

- **Randomized clue location** — the case number now hides in a spot that rotates
  each play (Corrections box / photo caption / a reader comment / a classified
  ad), and the Home mission text adapts to point there. Fresh on every replay.
- **Living newspaper** — a scrolling breaking-news ticker, fake ads
  (Oscorp, F.E.A.S.T., Parker Photography, Ravencroft), reader comments. The
  ads/comments double as the clue's hiding spots.
- **The Green Goblin** — a heckler pop-up + taunts on wrong guesses.
- **Juice** — the URL types into the omnibox, page-turn transitions, hover-lift,
  and a masthead easter egg (tap 3× → JJJ yells *"PARKER!! MY PICTURES!"*).

## v4 — Un-brute-forceable (shipped)
Playtesting exposed the real flaw: with the buried page as a clickable archive
row, you could **spam the ~4 retracted "Pull" buttons** and hit it by luck —
solved in 10s again, clue ignored.

The fix leans into what a 404 actually *is* — a page nothing links to:

- The buried file is now **unlisted**. No row reaches it.
- The only way in is the **morgue file lookup**: type the exact case number
  (`F-####`, one of 10,000) and hit PULL. Guessing is infeasible.
- The number is **embedded in prose** (not a glowing box), so finding it takes
  real reading; every visible row is a decoy whose number does nothing.
- Wrong guesses shake + "no match"; three wrong → the Goblin heckles you.

Result: you genuinely have to **read the clue and enter the number** — no
scroll-and-spam. Tuned to ~60s, never dead-ends (the spider-sense hint escalates
if you stall). See `SOLVING_GUIDE.md`.

---

### Constraints held throughout
Only `templates/games/game2.html` + `static/js/game2.js` were ever touched — no
shared code (`games_config.py`, `game.js`, `game_base.html`) changed. 100%
asset-free (CSS + inline SVG), all selectors scoped `.g2-`/`#g2-`, and winning is
a single `completeGame('2')` call.

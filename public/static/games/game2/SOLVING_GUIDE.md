# Game 2 — "Villain Lockdown" · Solving Guide & Tips

*The Daily Bugle "Bury Job" — a ~60-second hidden-404 hunt.*
**Spoilers below.** This is for organizers/stall staff (to help stuck players) and devs.

---

## The premise
The Green Goblin scrubbed J. Jonah Jameson's exclusive Spider-Man photo off the
Bugle website. The player browses the fake Bugle site and has to dig up the
buried story — which lives at a hidden **404 page**. Reaching it and tapping
**CASE CLOSED** completes the challenge.

## Why it can't be brute-forced
The buried file is **unlisted** — nothing on the site links to it (that's what
makes it a 404). The **only** way in is to know its exact **case number**
(`F-####`) and type it into the Archive's **morgue file lookup**. There are
10,000 possible numbers, so guessing/spam-clicking gets you nowhere. You *must*
find the number.

## The solution (3 hops, ~60s)
1. **Home** — read the "FROM THE EDITOR'S DESK" box. It says the file was pulled
   to the morgue and is opened by case number, and it **points at where the
   number is hiding this play**.
2. **Find the case number.** Its location **rotates every play** (see below).
   It's written into normal prose, e.g. *"...catalogue no. F-4471..."* — read to
   spot it.
3. **Archive → Morgue file lookup.** Type the 4 digits into the `F-[____]` field
   and hit **PULL**. The buried page (the 404) loads → **CASE CLOSED**.

## Where the case number hides (rotates each play)
The Home mission text always tells you which one it is this round:

| Spot | Where to look |
|------|----------------|
| **Corrections** | Opinion page → the *Corrections & Retractions* box |
| **Photo caption** | Home → small print under the front-page photo |
| **Reader comment** | City page → *Letters & Comments* (a `@morgue_intern` post) |
| **Classified ad** | News page → a *"LOST: one press file"* ad |

Every **visible Archive row is a decoy** — its case number does nothing.
Clicking a retracted row just says *"No Link. No Button."* The real number never
appears on any row; it's only in the clue.

## Tips for players
- **Read the Editor's Desk box first** — it tells you exactly which section the
  number is in.
- The number is **in a sentence**, not a big label. Scan for `F-` + 4 digits.
- **Don't spam the list** — retracted rows are dead ends. Use the **lookup**.
- Stuck? Wait a few seconds — your **spider-sense** (a pulsing red highlight +
  caption) points you to the next step. It escalates the longer you stall, so
  nobody gets truly stuck.

## Fun bits (for organizers)
- **The Green Goblin** heckles you with a pop-up the first time you open the
  Archive, and taunts you after **3 wrong** lookup guesses.
- **Easter egg:** tap the **Daily Bugle masthead 3× fast** → JJJ yells
  *"PARKER!! WHERE ARE MY PICTURES?!"*.
- A scrolling **breaking-news ticker**, fake ads, and reader comments make the
  site feel alive (and the ads/comments double as clue hiding-spots).

## Difficulty dials (for devs — `static/js/game2.js`)
- `HINT_DELAY` (default 16000ms): how long a player can stall on a page before
  the spider-sense hint fires. Archive lookup hint is longer (24000ms).
- The clue's visibility: `.g2-case` styling in `templates/games/game2.html`
  (currently subtle monospace + dotted underline). Make it louder/quieter to
  ease/raise difficulty.
- `clueSpot` pool in `buildPuzzle()`: the rotating hiding spots.

Everything is asset-free (CSS + inline SVG), scoped under `.g2-`, and winning is
a single `completeGame('2')` call — no shared files are touched.

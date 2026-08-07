# Game 2 — "Villain Lockdown" · Solving Guide & Tips

*The Daily Bugle "Bury Job" — a ~2-4 minute hidden-404 hunt.*
**Spoilers below.** This is for organizers/stall staff (to help stuck players)
and devs. For the full mechanics writeup (every carrier, every decoy, the
"why") see `README.md` in this same folder — this is the quick-reference
version.

---

## The premise

The Green Goblin scrubbed J. Jonah Jameson's exclusive Spider-Man photo off
the Bugle website. The player browses the fake Bugle site and has to dig up
the buried story — which lives at a hidden **404 page**. Reaching it
completes the challenge automatically — a **CASE CLOSED** stamp animates in
and hands off to the next challenge, no extra tap needed.

## Why it can't be brute-forced

The buried file is **unlisted** — nothing on the site links to it (that's
what makes it a 404). The **only** way in is to know its exact **case
number** (`F-####`) and type it into the Archive's **morgue file lookup**.
10,000 possible numbers, so guessing/spam-clicking gets you nowhere.

## The twist: the number is torn in half

The case number is never written in full anywhere. It's split into a
**first-two-digits** half and a **last-two-digits** half, each hidden by its
own carrier, picked fresh every play from a pool of five:

| Carrier | Type | Where | How |
|---------|------|-------|-----|
| Corrections | text | Opinion page | read the Corrections box |
| City comment | text | City page | read the `@morgue_intern` comment |
| Classified ad | text | News page | read the "LOST" ad |
| Front-page photo | **hold** | Home page | press & hold ~0.65s to "develop" it |
| Redacted bar | **hold** | Archive page | press & hold a `[RETRACTED]` bar ~0.42s |

Every play uses exactly **one text carrier + one interactive carrier** (never
two of the same kind), and which half (first vs. last) goes to which is also
randomized. Home's mission text riddles at both spots without naming either
section.

**Both interactive carriers always react to a hold, every play** — the photo
always develops into *something* (real digits or a joke), and every
`[RETRACTED]` bar always peels open into *something* (a real fragment on
exactly one bar, or a flavor word on the rest). So trying either is never a
giveaway for whether it's real this round.

**Decoys:** the two text carriers NOT chosen always show an unrelated 2-digit
"ref" number in unrelated prose (a lost dog, a noise complaint, a hot-dog
contest) — same look as a real fragment, so spotting a number proves nothing
on its own.

## The solution, step by step

1. **Home** — read "FROM THE EDITOR'S DESK." It riddles at where *both*
   halves are hiding this play (never names sections).
2. **Try holding the front-page photo.** See what it develops into.
3. **Read Opinion / City / News.** One has a real half in a sentence; the
   other two are decoys.
4. **In the Archive, try holding a few `[RETRACTED]` bars** if you're still
   missing a half.
5. Once both halves are found, type the full number into the **morgue file
   lookup** and hit **PULL** → the 404 loads → **CASE CLOSED** fires automatically.

A **case-tag strip** at the top (hidden until the first half is found) shows
progress: `F-2?--` → `F-2703`. The win screen recaps both sources on a small
corkboard instead of more text.

## Tips for players
- **Read the Editor's Desk box first** — it's the only place that points at
  both hiding spots.
- A quick tap does nothing on purpose. **Hold things down** for under a
  second — that's what "develops" or "declassifies" something.
- Watch the case-tag strip once you've found a half — it tells you exactly
  what's still missing.
- Don't spam the lookup — it's 1 of 10,000, and every visible row is a real
  but wrong file (not a "no match" waste).
- Stuck? **Spider-sense** (pulsing highlight + caption at the bottom)
  escalates the longer you stall on whichever half is still missing, and
  eventually names the mechanic outright. Nobody gets truly stuck.

## Fun bits (for organizers)
- **The Green Goblin** heckles you the first time you open the Archive, and
  taunts you again after **3 wrong** lookup guesses.
- **Easter egg:** tap the **Daily Bugle masthead 3× fast** → JJJ yells
  *"PARKER!! WHERE ARE MY PICTURES?!"*.
- The **breaking-news ticker** reacts live (wrong guess, decoy opened,
  Goblin appearance, a fragment found, the match) with fresh fake headlines.
- Small synthesized SFX (no audio files) mark most of the above, plus a mute
  toggle in the browser chrome bar.

## Difficulty dials (for devs — `static/js/game2.js`)
- `HINT_DELAY_1/2` (80s/150s), `ARCHIVE_HINT_DELAY_1/2` (95s/165s),
  `STALL_SAFETY_DELAY` (180s, absolute ceiling regardless of navigation) —
  how the two-tier hint escalates for whichever half is still missing.
- `REDACT_HOLD_MS`/`PHOTO_HOLD_MS` (420ms/650ms) — how long a hold needs to
  be. `REDACT_RESEAL_MS`/`PHOTO_RESEAL_MS` (1500ms/1600ms) — how long a
  reveal stays up before resealing.
- `CARRIER_INFO` — the five carriers' riddle/hint text and target selectors.
  The `["corrections","comment","ad"]` / `["photo","redact"]` pools in
  `buildPuzzle()` decide which carriers can be picked from which side.

Everything is asset-free (CSS + inline SVG), scoped under `.g2-`/`#g2-`, and
winning is a single `completeGame('2')` call — no shared files are touched.

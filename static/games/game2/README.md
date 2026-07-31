# Game 2 — "Villain Lockdown" · The Daily Bugle "Bury Job"

*A ~2-4 minute hidden-404 hunt inside a fake, living Daily Bugle website.*

**Spoilers below.** This file explains the full mechanic, every hiding spot,
and tips for anyone stuck or running the stall (organizers/staff) or working
on the code (devs). For a shorter "just tell me how to solve it" version see
`SOLVING_GUIDE.md` in this same folder — this README is the fuller reference.

---

## The premise

The Green Goblin scrubbed J. Jonah Jameson's exclusive Spider-Man photo off
the Bugle website. The player browses the fake Bugle site (Home, News, City,
Opinion, Archive) and has to dig up the buried story, which lives at a hidden
**404 page**. Reaching it and tapping **CASE CLOSED** completes the challenge.

## Why it can't be brute-forced

The buried file is genuinely **unlisted** — nothing on the site links to it
(that's what makes it a 404). The **only** way in is to know its exact
**case number** (`F-####`) and type it into the Archive's **morgue file
lookup**. There are 10,000 possible numbers, so guessing/spam-clicking gets
you nowhere. Every visible Archive row also opens to its *own* real (but
wrong) file if you type its number, so a wrong guess never feels like a wall
— it just isn't the answer.

## The core mechanic: the number is torn in half

This is the important twist. The case number is **not** written anywhere in
full. It's split into two halves:

- the **first two digits**
- the **last two digits**

Each half is hidden by its own, independent **carrier**, and the carriers are
chosen fresh every single play from a pool of five — see the table below.
Exactly **one text carrier** and **one interactive carrier** are used each
round (never two of the same kind), and which one gets the first half vs. the
last half is also randomized. That means:

- It's never purely "read one paragraph and you're done" (the old version's
  flaw — the case number used to sometimes sit in plain text on the very
  first page load, solvable in well under a minute).
- It's never purely "hunt-and-peck with no anchor" either, since one half is
  always a readable clue.
- The exact shape of the hunt (which two carriers, which order) is different
  every play, so players comparing notes can't just repeat each other's exact
  steps.

As each half is found, a **case-tag strip** appears at the top of the screen
(hidden until the first half surfaces) and fills in: `F-2?--` → `F-2703`.
Finding the second half also triggers a distinct "match" sound + ticker
headline — a small "the pieces just clicked" payoff before the player even
opens the Archive to submit. The **win screen** recaps both sources on a
small corkboard (icon + digits + label for each half, feeding into the full
matched number), so the "how you cracked it" moment is a visual, not another
paragraph to read.

## The five possible carriers (pool: pick one text + one interactive)

| Type | Carrier | Where | How it's found |
|------|---------|-------|-----------------|
| Text | **Corrections** | Opinion page → *Corrections & Retractions* box | Read it — the half is printed in prose |
| Text | **City comment** | City page → *Letters & Comments*, a `@morgue_intern` post | Read it |
| Text | **Classified ad** | News page → a *"LOST: one press file"* ad | Read it |
| Interactive | **The front-page photo** | Home page, the ruined "Exclusive Photo" box | **Press and hold** it (~0.65s) like coaxing an old Polaroid — it "develops" and reveals what's underneath |
| Interactive | **A redacted archive bar** | Archive page, inside one of the `[RETRACTED]` rows | **Press and hold** one of the black bars (~0.42s) to "declassify" it — one specific bar (out of ~13-17 across the row list) secretly hides the digits instead of a flavor word |

Home's mission text always riddles at *both* hiding spots that round (never
names the section outright), so the player has to connect each riddle to a
page/action themselves.

### Why the interactive carriers matter
Both interactive carriers are **always live**, every single play, regardless
of whether they're this round's real carrier:
- Holding the photo down **always** does something — either the real digits
  ("barely legible" over the ruined negative) or a joke (Aunt May's meatloaf
  recipe, a blurry pigeon, a parking ticket…) if photo isn't the carrier this
  round.
- Every `[RETRACTED]` bar in the Archive **always** peels open on a hold to
  reveal *something* (a flavor word like MENACE, GOBLIN, THE SUIT…) — except
  when redact is this round's carrier, exactly one specific bar hides the
  real digits instead, indistinguishable by appearance from the rest.

So trying either interaction is never itself a "tell" for whether it's real
this round — the only way to know is to try it and see what comes back. This
is deliberate: it turns "read the page" into "poke at things and see what
reacts," without making any single hold action a giveaway.

### Decoys (so a number sighting is never proof)
- The **two text carriers not chosen** this round always carry an unrelated,
  same-looking 2-digit "ref" number in a clearly unrelated context (a lost
  dog's reward, a neighbor's noise complaint, a hot-dog contest correction).
  Same visual styling as a real fragment, so spotting *a* number proves
  nothing — you have to know it's tied to the Spider-Man scoop specifically.
- Every visible **Archive row** (both normal and `[RETRACTED]`) has its own
  real, filed case number that opens to a harmless dead-end page if typed
  into the lookup — never the buried file, but also never a "no match" waste
  of a guess (it's a genuine, if boring, file).

## Solving it, step by step

1. **Home.** Read "FROM THE EDITOR'S DESK" — it riddles at where the first
   half hides and where the last half hides (never naming sections).
2. **Try holding the front-page photo down.** Maybe it's live this round,
   maybe it's a joke — either way, now you know.
3. **Read Opinion, City, and News.** One of them (whichever the riddle
   pointed at) has a real half embedded in a sentence; the others have
   unrelated 2-digit decoys.
4. **In the Archive, try holding a few `[RETRACTED]` bars down** if neither
   of the above gave you both halves yet — one specific bar per play may hide
   the rest.
5. Once you have **both halves**, type the full 4-digit number into the
   **morgue file lookup** and hit **PULL**. The buried page (the 404) loads →
   **CASE CLOSED**.

## Tips for players

- **Read the Editor's Desk box first** — it's the only place that riddles at
  *both* hiding spots for that play.
- Try holding things down. A quick tap does nothing on purpose — a
  deliberate hold (under a second) is what "develops" a photo or
  "declassifies" a redacted bar.
- Watch the **case-tag strip** near the top once you've found a half — it
  shows exactly which digits you have and which are still missing (`--`).
- Don't spam the lookup with random numbers — every visible row is a dead
  end, and the number is 1 of 10,000. Find both halves first.
- Stuck? Your **spider-sense** (a pulsing red/gold highlight + caption at the
  bottom) escalates the longer you stall on whichever half is still missing,
  eventually naming the exact mechanic outright. Nobody gets truly stuck.

## Fun bits

- **The Green Goblin** heckles you with a pop-up the first time you open the
  Archive, and taunts you again after **3 wrong** lookup guesses.
- **Easter egg:** tap the **Daily Bugle masthead 3× fast** → JJJ yells
  *"PARKER!! WHERE ARE MY PICTURES?!"*.
- A scrolling **breaking-news ticker** reacts live to what you do (a wrong
  guess, a decoy file opened, a Goblin appearance, a fragment found, both
  fragments matching) with a fresh fake headline each time.
- Small synthesized sound cues (no audio files) mark a wrong guess, a decoy
  open, a Goblin appearance, each fragment found, the match, reaching the
  404, and the final win — with a mute toggle in the browser chrome bar.

## Difficulty dials (for devs — `static/js/game2.js`)

- `HINT_DELAY_1` / `HINT_DELAY_2` (80s / 150s) and `ARCHIVE_HINT_DELAY_1/2`
  (95s / 165s): how long before the two-tier spider-sense hint escalates for
  whichever half is still missing. `STALL_SAFETY_DELAY` (180s) is the
  absolute ceiling regardless of navigation.
- `REDACT_HOLD_MS` (420ms) / `PHOTO_HOLD_MS` (650ms): how long a deliberate
  hold needs to be before it "gives." `REDACT_RESEAL_MS` (1500ms) /
  `PHOTO_RESEAL_MS` (1600ms): how long the reveal stays visible before
  resealing.
- `CARRIER_INFO` in `buildPuzzle()`'s module scope: the five carriers' riddle
  text, hint text, and target selectors — add a sixth carrier here (plus a
  corresponding pool array in `buildPuzzle()`) to widen the rotation further.
- The `["corrections", "comment", "ad"]` / `["photo", "redact"]` pools in
  `buildPuzzle()`: which carriers can be picked from which pool.

Everything is asset-free (CSS + inline SVG), scoped under `.g2-`/`#g2-`, and
winning is a single `completeGame('2')` call — no shared files are touched.
Drop any local images/audio for this game in this folder if you add them
later, and reference them with
`url_for('static', filename='games/game2/<file>')` — never an external CDN.

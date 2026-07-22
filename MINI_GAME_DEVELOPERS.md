# Building a mini-game for Spidey Sense

You each own **one game**, and your changes are isolated to a handful of
files -- you cannot break anyone else's game or the app shell by mistake if
you stay inside your own folder. The main server and its deployment are
handled separately -- you don't need to touch or worry about either.

## Where your code goes

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

## Frameworks / tech you can use

- **Plain HTML5 + CSS3 + vanilla JavaScript** -- this is the expected
  default, zero setup needed.
- **Canvas or SVG** for graphics/animation.
- A small, dependency-free JS library, **pasted directly into your own
  `static/js/game<N>.js`** (or an extra file next to it) -- not installed
  via npm.

## Not allowed

- **No React, Vue, Angular, Svelte, or anything needing a build step.**
  The app is plain Flask + Jinja2 -- there is no bundler in the pipeline.
- **No Node/npm/Vite/Webpack.** Nothing that needs `npm install` to produce
  the files you commit.
- **No external CDNs** (Google Fonts, unpkg, jsDelivr, etc.) for your game
  specifically. The site already loads its fonts; your game's own assets
  should be local files in your `static/games/game<N>/` folder so the whole
  app keeps working with no internet dependency at the venue.
- **No calling your own backend or database.** Your game runs entirely in
  the browser. The only server contact is the one call described below.

## The one integration rule

When the player wins, call:

```js
completeGame('1');   // or '2', '3', '4', 'bonus' -- your game's id
```

That's it. Token handling, session, anti-cheat, and redirecting to the next
screen are all automatic (`static/js/game.js`, already loaded on your page
-- don't call `/complete-game` yourself). Do not use `document.title`,
`window.location`, or a `<meta refresh>` to navigate away when the player
finishes -- always go through `completeGame()`.

## Design constraints

- Challenge must be **completable in 30-60 seconds**.
- Must work on a **phone browser held in one hand** -- touch input,
  portrait screen, no keyboard-only controls, no hover-dependent UI.
- Match the visual style already in `static/css/style.css` where it makes
  sense (dark background, `Bangers` for headlines, red/gold accents) so it
  doesn't look like a different app was pasted in -- but this is a nice-to
  -have, not a blocker.

## Where to push your code

1. Clone the repo, then make your own branch off `main`:
   ```
   git checkout -b game/<n>-<short-name>       # e.g. game/1-web-shooter
   ```
2. Work only inside your row of the table above.
3. Test locally (`python app.py`) -- play your game start to finish and
   confirm `completeGame()` actually advances you to the next screen. (Ask
   the project lead to confirm `QR_SCAN_REQUIRED` is off in your local
   `games_config.py` so you can skip straight past the QR steps while
   testing.)
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

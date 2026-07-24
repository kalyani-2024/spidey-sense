/*
 * MINI-GAME #4: Spider-Sense Connections
 * -----------------------------
 * Loaded only on /game/4 (see templates/games/game4.html).
 * Call completeGame('4') when the player finishes. See static/js/game1.js
 * for the full set of notes -- the contract is identical for every game.
 *
 * Tech-themed NYT Connections clone. Vanilla JS, no build step, no
 * external dependencies (sounds are synthesized with Web Audio API --
 * no binary assets to ship).
 *
 * Modules (namespaced objects, one file, clear separation):
 *   Utils            - small pure helpers
 *   AudioMgr         - synthesized SFX via Web Audio API
 *   Haptics          - vibration wrapper
 *   StateStore       - persists puzzle/progress to localStorage so a
 *                      reload resumes the same puzzle instead of rolling
 *                      a new one
 *   PuzzleLoader     - fetches + validates the puzzle bank, picks one
 *   Validation       - guess-checking logic (exact / one-away)
 *   PuzzleEngine     - game state machine (selection, mistakes, solved groups)
 *   AnimationMgr     - timing helpers for tile / banner animations
 *   Renderer         - all DOM creation & updates
 *   InputMgr         - touch/click wiring
 *   Game             - wires everything together, owns the completeGame() call
 */

(function () {
  "use strict";

  /* ---------------------------------------------------------
     UTILS
  --------------------------------------------------------- */
  const Utils = {
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    pickRandom(arr) {
      return arr[Math.floor(Math.random() * arr.length)];
    },
    sameSet(a, b) {
      if (a.length !== b.length) return false;
      const sa = [...a].sort();
      const sb = [...b].sort();
      return sa.every((v, i) => v === sb[i]);
    },
    clamp(n, lo, hi) {
      return Math.max(lo, Math.min(hi, n));
    }
  };

  /* ---------------------------------------------------------
     AUDIO MANAGER
     Every effect is synthesized on the fly with the Web Audio
     API -- zero binary assets to ship, zero network requests,
     works completely offline at the venue.
  --------------------------------------------------------- */
  const AudioMgr = (function () {
    let ctx = null;
    let unlocked = false;

    function ensureCtx() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      }
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    }

    function unlock() {
      if (unlocked) return;
      const c = ensureCtx();
      if (c) unlocked = true;
    }

    function tone({ freq = 440, dur = 0.12, type = "sine", gain = 0.18, glideTo = null, delay = 0 }) {
      const c = ensureCtx();
      if (!c) return;
      const t0 = c.currentTime + delay;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g).connect(c.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    }

    function noiseBurst({ dur = 0.15, gain = 0.16, delay = 0, filterFreq = 1200 }) {
      const c = ensureCtx();
      if (!c) return;
      const t0 = c.currentTime + delay;
      const bufferSize = Math.floor(c.sampleRate * dur);
      const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource();
      src.buffer = buffer;
      const filt = c.createBiquadFilter();
      filt.type = "bandpass";
      filt.frequency.value = filterFreq;
      const g = c.createGain();
      g.gain.setValueAtTime(gain, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(filt).connect(g).connect(c.destination);
      src.start(t0);
      src.stop(t0 + dur + 0.02);
    }

    return {
      unlock,
      select() { tone({ freq: 720, dur: 0.07, type: "triangle", gain: 0.16 }); },
      deselect() { tone({ freq: 380, dur: 0.05, type: "square", gain: 0.08 }); },
      shuffle() {
        noiseBurst({ dur: 0.28, gain: 0.12, filterFreq: 2200 });
        tone({ freq: 900, dur: 0.2, type: "sine", gain: 0.05, glideTo: 300 });
      },
      wrong() {
        tone({ freq: 180, dur: 0.22, type: "sawtooth", gain: 0.2, glideTo: 90 });
        noiseBurst({ dur: 0.12, gain: 0.08, filterFreq: 500 });
      },
      alreadyGuessed() {
        tone({ freq: 300, dur: 0.09, type: "square", gain: 0.1 });
      },
      oneAway() {
        tone({ freq: 660, dur: 0.1, type: "sine", gain: 0.15 });
        tone({ freq: 660, dur: 0.14, type: "sine", gain: 0.15, delay: 0.14 });
      },
      correct(comboIndex = 0) {
        const base = 520 + comboIndex * 40;
        [0, 0.09, 0.18].forEach((d, i) => {
          tone({ freq: base + i * 160, dur: 0.16, type: "sine", gain: 0.16, delay: d });
        });
      },
      victory() {
        const notes = [523, 659, 784, 1047];
        notes.forEach((f, i) => tone({ freq: f, dur: 0.22, type: "triangle", gain: 0.18, delay: i * 0.12 }));
      }
    };
  })();

  const Haptics = {
    wrong() { if (navigator.vibrate) navigator.vibrate(80); },
    correct() { if (navigator.vibrate) navigator.vibrate(30); }
  };

  /* ---------------------------------------------------------
     STATE STORE
     Persists the in-progress puzzle to localStorage so a page
     reload (or someone leaving the tab and coming back) resumes
     exactly where the player left off, instead of handing out a
     brand new random puzzle every time the page loads. Purely a
     frontend UX nicety -- the backend never sees or trusts this;
     completeGame() still goes through the same server validation
     it always did.
  --------------------------------------------------------- */
  const StateStore = {
    KEY: "spidey_game4_state_v1",
    save(state) {
      try {
        localStorage.setItem(this.KEY, JSON.stringify(state));
      } catch (e) {
        /* storage unavailable (private mode, quota, etc) -- fail silently,
           game still works, it just won't survive a reload */
      }
    },
    load() {
      try {
        const raw = localStorage.getItem(this.KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },
    clear() {
      try {
        localStorage.removeItem(this.KEY);
      } catch (e) {
        /* no-op */
      }
    }
  };

  /* ---------------------------------------------------------
     PUZZLE LOADER
  --------------------------------------------------------- */
  const PuzzleLoader = {
    async load(url) {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load puzzle bank (" + res.status + ")");
      const data = await res.json();
      const bank = Array.isArray(data.puzzles) ? data.puzzles : [];
      const valid = bank.filter(this.isValid);
      if (!valid.length) throw new Error("Puzzle bank has no valid puzzles");
      return valid;
    },
    // Tries the real (untracked, deployed-only) puzzle bank first, falls
    // back to the small committed example bank so the game still runs for
    // anyone who clones the repo without the real file. See README note in
    // static/games/game4/README.md.
    async loadWithFallback(primaryUrl, fallbackUrl) {
      try {
        return await this.load(primaryUrl);
      } catch (err) {
        console.warn("[game4] puzzles.json not found or invalid, using example bank for local dev:", err.message);
        if (!fallbackUrl) throw err;
        return await this.load(fallbackUrl);
      }
    },
    isValid(puzzle) {
      if (!puzzle || !Array.isArray(puzzle.groups) || puzzle.groups.length !== 4) return false;
      const seen = new Set();
      const diffs = new Set();
      for (const g of puzzle.groups) {
        if (!g.name || !Array.isArray(g.words) || g.words.length !== 4) return false;
        if (!["easy", "medium", "hard", "expert"].includes(g.difficulty)) return false;
        diffs.add(g.difficulty);
        for (const w of g.words) {
          const key = String(w).toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
        }
      }
      return diffs.size === 4;
    },
    pickOne(bank) {
      return Utils.pickRandom(bank);
    }
  };

  /* ---------------------------------------------------------
     VALIDATION
  --------------------------------------------------------- */
  const Validation = {
    // Returns { result: "correct"|"oneAway"|"wrong", group? }
    check(selectedWords, groups) {
      for (const group of groups) {
        const overlap = selectedWords.filter((w) => group.words.includes(w)).length;
        if (overlap === 4) return { result: "correct", group };
        if (overlap === 3) return { result: "oneAway" };
      }
      return { result: "wrong" };
    }
  };

  /* ---------------------------------------------------------
     PUZZLE ENGINE (state machine)
  --------------------------------------------------------- */
  function PuzzleEngine(puzzle) {
    this.puzzle = puzzle;
    this.groups = puzzle.groups;
    this.solved = [];              // array of group objects, in solve order
    this.remaining = Utils.shuffle(
      puzzle.groups.flatMap((g) => g.words.map((w) => ({ word: w, group: g })))
    );
    this.selected = [];             // array of word strings currently tapped
    this.mistakesLeft = 4;
    this.triedGuesses = new Set(); // signatures of past incorrect guesses (for "Already Guessed")
  }

  // Order-independent, case-insensitive fingerprint for a set of 4 words,
  // used to recognize a repeated incorrect guess.
  PuzzleEngine.prototype.guessSignature = function (words) {
    return words.map((w) => String(w).toLowerCase()).sort().join("|");
  };

  PuzzleEngine.prototype.hasAlreadyTried = function (words) {
    return this.triedGuesses.has(this.guessSignature(words));
  };

  PuzzleEngine.prototype.toggleWord = function (word) {
    const idx = this.selected.indexOf(word);
    if (idx >= 0) {
      this.selected.splice(idx, 1);
      return "deselected";
    }
    if (this.selected.length >= 4) return "full";
    this.selected.push(word);
    return "selected";
  };

  PuzzleEngine.prototype.clearSelection = function () {
    this.selected = [];
  };

  PuzzleEngine.prototype.canSubmit = function () {
    return this.selected.length === 4;
  };

  PuzzleEngine.prototype.submit = function () {
    const outcome = Validation.check(this.selected, this.groups);
    if (outcome.result === "correct") {
      this.solved.push(outcome.group);
      this.remaining = this.remaining.filter((tile) => !outcome.group.words.includes(tile.word));
      this.selected = [];
    } else {
      // Both "wrong" and "oneAway" are incorrect guesses -- per the spec,
      // ANY incorrect guess costs a life, not just a total miss.
      this.triedGuesses.add(this.guessSignature(this.selected));
      this.mistakesLeft = Math.max(0, this.mistakesLeft - 1);
    }
    return outcome;
  };

  PuzzleEngine.prototype.isWon = function () {
    return this.solved.length === 4;
  };

  PuzzleEngine.prototype.isLost = function () {
    return this.mistakesLeft <= 0 && !this.isWon();
  };

  // Rebuilds an engine from a persisted state blob (see StateStore above),
  // used to resume the exact same puzzle/progress after a page reload.
  PuzzleEngine.fromSavedState = function (saved, bank) {
    const puzzle = bank.find((p) => p.id === saved.puzzleId);
    if (!puzzle) return null;

    const engine = new PuzzleEngine(puzzle);
    engine.mistakesLeft = Utils.clamp(saved.mistakesLeft, 0, 4);

    engine.solved = (Array.isArray(saved.solvedGroupNames) ? saved.solvedGroupNames : [])
      .map((name) => puzzle.groups.find((g) => g.name === name))
      .filter(Boolean);

    const solvedWords = new Set(engine.solved.flatMap((g) => g.words));
    const wordToGroup = new Map(puzzle.groups.flatMap((g) => g.words.map((w) => [w, g])));
    const savedRemaining = Array.isArray(saved.remainingWords) ? saved.remainingWords : [];
    let remaining = savedRemaining
      .filter((w) => !solvedWords.has(w) && wordToGroup.has(w))
      .map((w) => ({ word: w, group: wordToGroup.get(w) }));

    // Safety net: if the saved remaining-word list is missing or corrupt,
    // rebuild it from the puzzle definition instead of trusting storage blindly.
    const expectedCount = 16 - solvedWords.size;
    if (remaining.length !== expectedCount) {
      remaining = puzzle.groups
        .flatMap((g) => g.words.map((w) => ({ word: w, group: g })))
        .filter((t) => !solvedWords.has(t.word));
    }
    engine.remaining = remaining;

    engine.triedGuesses = new Set(Array.isArray(saved.triedGuesses) ? saved.triedGuesses : []);
    engine.selected = [];
    return engine;
  };

  PuzzleEngine.prototype.shuffleRemaining = function () {
    this.remaining = Utils.shuffle(this.remaining);
  };

  /* ---------------------------------------------------------
     ANIMATION MANAGER
     Thin helpers around timing / class toggling so Renderer
     stays declarative.
  --------------------------------------------------------- */
  const AnimationMgr = {
    wait(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    },
    async pulseClass(el, className, ms) {
      el.classList.add(className);
      await this.wait(ms);
      el.classList.remove(className);
    }
  };

  /* ---------------------------------------------------------
     RENDERER
  --------------------------------------------------------- */
  const DIFF_LABEL = { easy: "Easy", medium: "Medium", hard: "Hard", expert: "Expert" };

  function Renderer(root) {
    this.root = root;
    this.$board = root.querySelector("[data-board]");
    this.$solved = root.querySelector("[data-solved]");
    this.$mistakes = root.querySelector("[data-mistakes]");
    this.$submitBtn = root.querySelector("[data-submit]");
    this.$shuffleBtn = root.querySelector("[data-shuffle]");
    this.$clearBtn = root.querySelector("[data-clear]");
    // FIX: these two live OUTSIDE [data-game4-root] in game4.html (they're
    // position:fixed overlays, siblings of .c4-shell, not children of it).
    // root.querySelector("[data-toast]") was always returning null, so
    // every call to renderer.toast() -- i.e. every single guess, correct
    // or not -- threw a TypeError trying to set .textContent on null. That
    // exception, not a race condition, is what was freezing the game.
    this.$toast = document.querySelector("[data-toast]");
    this.$winOverlay = document.querySelector("[data-win-overlay]");
    this.tileEls = new Map(); // word -> element
  }

  Renderer.prototype.renderMistakes = function (mistakesLeft) {
    this.$mistakes.innerHTML = "";
    for (let i = 0; i < 4; i++) {
      const dot = document.createElement("span");
      dot.className = "c4-pip" + (i < mistakesLeft ? " is-alive" : " is-lost");
      this.$mistakes.appendChild(dot);
    }
  };

  Renderer.prototype.renderSolvedBanner = function (group, index) {
    const row = document.createElement("div");
    row.className = "c4-solved-row diff-" + group.difficulty;
    row.style.setProperty("--stagger", index + "");
    row.innerHTML =
      '<div class="c4-solved-name">' + escapeHtml(group.name) + "</div>" +
      '<div class="c4-solved-words">' + group.words.map(escapeHtml).join(" &middot; ") + "</div>";
    this.$solved.appendChild(row);
    requestAnimationFrame(() => row.classList.add("is-in"));
  };

  Renderer.prototype.clearSolved = function () {
    this.$solved.innerHTML = "";
  };

  Renderer.prototype.renderBoard = function (tiles, selectedWords) {
    this.$board.innerHTML = "";
    this.tileEls.clear();
    tiles.forEach((tile) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "c4-tile";
      btn.dataset.word = tile.word;
      btn.textContent = tile.word;
      if (selectedWords.includes(tile.word)) btn.classList.add("is-selected");
      this.$board.appendChild(btn);
      this.tileEls.set(tile.word, btn);
    });
  };

  Renderer.prototype.setSelected = function (word, isSelected) {
    const el = this.tileEls.get(word);
    if (el) el.classList.toggle("is-selected", isSelected);
  };

  Renderer.prototype.setSubmitEnabled = function (enabled) {
    this.$submitBtn.disabled = !enabled;
  };

  Renderer.prototype.shakeSelected = function (words) {
    words.forEach((w) => {
      const el = this.tileEls.get(w);
      if (el) AnimationMgr.pulseClass(el, "is-shaking", 420);
    });
  };

  Renderer.prototype.popCorrect = function (words) {
    words.forEach((w) => {
      const el = this.tileEls.get(w);
      if (el) el.classList.add("is-correct-flash");
    });
  };

  Renderer.prototype.removeTiles = function (words) {
    words.forEach((w) => {
      const el = this.tileEls.get(w);
      if (el) {
        el.classList.add("is-leaving");
      }
    });
  };

  Renderer.prototype.toast = function (message, ms) {
    this.$toast.textContent = message;
    this.$toast.classList.add("is-visible");
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.$toast.classList.remove("is-visible");
    }, ms || 1400);
  };

  Renderer.prototype.showWin = function () {
    this.$winOverlay.classList.add("is-visible");
  };

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  /* ---------------------------------------------------------
     INPUT MANAGER
  --------------------------------------------------------- */
  function InputMgr(root, handlers) {
    root.querySelector("[data-board]").addEventListener("click", (e) => {
      const btn = e.target.closest(".c4-tile");
      if (!btn || btn.classList.contains("is-leaving")) return;
      handlers.onTileTap(btn.dataset.word);
    });
    root.querySelector("[data-submit]").addEventListener("click", () => handlers.onSubmit());
    root.querySelector("[data-shuffle]").addEventListener("click", () => handlers.onShuffle());
    root.querySelector("[data-clear]").addEventListener("click", () => handlers.onClear());
    // Unlock audio on first interaction anywhere in the game (mobile autoplay policies).
    root.addEventListener("pointerdown", () => AudioMgr.unlock(), { once: true });
  }

  /* ---------------------------------------------------------
     GAME CONTROLLER
  --------------------------------------------------------- */
  const Game = {
    async init(rootSelector, puzzleUrl, fallbackUrl) {
      const root = document.querySelector(rootSelector);
      if (!root) return;
      const renderer = new Renderer(root);

      let bank;
      try {
        bank = await PuzzleLoader.loadWithFallback(puzzleUrl, fallbackUrl);
      } catch (err) {
        root.querySelector("[data-board]").innerHTML =
          '<p class="c4-error">Web signal lost -- could not load today\u2019s puzzle. Refresh to try again.</p>';
        console.error(err);
        return;
      }

      // FIX: resume the same puzzle + progress across a reload instead of
      // silently handing out a brand new one every time the page loads.
      // Only trust a saved state that represents an in-progress game (not
      // already won or already lost -- either of those should never have
      // been left in storage, but this guards against a stale blob).
      let engine = null;
      const saved = StateStore.load();
      if (
        saved &&
        typeof saved.mistakesLeft === "number" &&
        saved.mistakesLeft > 0 &&
        Array.isArray(saved.solvedGroupNames) &&
        saved.solvedGroupNames.length < 4
      ) {
        engine = PuzzleEngine.fromSavedState(saved, bank);
      }
      if (!engine) {
        engine = new PuzzleEngine(PuzzleLoader.pickOne(bank));
      }

      let locked = false; // true while an animation/resolution is in flight

      // FIX: write the current puzzle id / progress to localStorage so a
      // reload picks this back up via PuzzleEngine.fromSavedState above.
      function persist() {
        StateStore.save({
          puzzleId: engine.puzzle.id,
          mistakesLeft: engine.mistakesLeft,
          solvedGroupNames: engine.solved.map((g) => g.name),
          remainingWords: engine.remaining.map((t) => t.word),
          triedGuesses: Array.from(engine.triedGuesses)
        });
      }

      // Picks a new puzzle (avoiding an immediate repeat when the bank has
      // more than one option) and redraws the whole board from scratch.
      // Used both at first load and whenever a player runs out of guesses.
      function startNewPuzzle(excludePuzzle) {
        let next = PuzzleLoader.pickOne(bank);
        if (bank.length > 1 && excludePuzzle) {
          let guard = 0;
          while (next.id === excludePuzzle.id && guard < 10) {
            next = PuzzleLoader.pickOne(bank);
            guard++;
          }
        }
        engine = new PuzzleEngine(next);
        draw();
        persist(); // FIX: so a reload right after losing keeps this new
                   // puzzle instead of rolling yet another random one
      }

      function draw() {
        renderer.clearSolved();
        engine.solved.forEach((g, i) => renderer.renderSolvedBanner(g, i));
        renderer.renderBoard(engine.remaining, engine.selected);
        renderer.setSubmitEnabled(engine.canSubmit());
        renderer.renderMistakes(engine.mistakesLeft);
      }

      draw();
      persist(); // FIX: cover the very first load too, so an immediate
                 // refresh before any guess still resumes the same puzzle

      const handlers = {
        onTileTap(word) {
          if (locked) return;
          const already = engine.selected.includes(word);
          const outcome = engine.toggleWord(word);
          if (outcome === "full") return; // 4 already picked, ignore extra taps
          renderer.setSelected(word, !already);
          renderer.setSubmitEnabled(engine.canSubmit());
          if (already) AudioMgr.deselect(); else AudioMgr.select();
        },

        onClear() {
          if (locked) return;
          engine.selected.forEach((w) => renderer.setSelected(w, false));
          engine.clearSelection();
          renderer.setSubmitEnabled(false);
          AudioMgr.deselect();
        },

        onShuffle() {
          if (locked) return;
          engine.shuffleRemaining();
          renderer.renderBoard(engine.remaining, engine.selected);
          AudioMgr.shuffle();
        },

        async onSubmit() {
          if (locked || !engine.canSubmit()) return;
          locked = true;
          // FIX: everything below runs inside try/finally now. If ANYTHING
          // throws partway through (a bad DOM reference, a storage error,
          // anything), `locked` still gets reset in `finally`, so the game
          // can never permanently freeze and force a reload. Previously an
          // uncaught error here would leave `locked` stuck at true forever
          // -- every handler (tile tap, Clear, Shuffle, Submit) starts with
          // `if (locked) return;`, so that alone explains "everything stops
          // responding."
          try {
            const attempted = engine.selected.slice();

            // Recognize a repeated incorrect guess before touching any
            // state -- no life lost, board untouched, just tell the player.
            if (engine.hasAlreadyTried(attempted)) {
              AudioMgr.alreadyGuessed();
              renderer.toast("Already Guessed");
              renderer.shakeSelected(attempted);
              await AnimationMgr.wait(380);
              return;
            }

            const outcome = engine.submit();

            if (outcome.result === "correct") {
              AudioMgr.correct(engine.solved.length - 1);
              Haptics.correct();
              renderer.popCorrect(attempted);
              await AnimationMgr.wait(260);
              renderer.removeTiles(attempted);
              await AnimationMgr.wait(240);
              renderer.renderSolvedBanner(outcome.group, engine.solved.length - 1);
              renderer.renderBoard(engine.remaining, engine.selected);
              renderer.setSubmitEnabled(false);

              if (engine.isWon()) {
                AudioMgr.victory();
                renderer.toast("Web fully mapped!", 1200);
                StateStore.clear(); // don't leave a "won" game sitting in storage
                await AnimationMgr.wait(900);
                renderer.showWin();
                await AnimationMgr.wait(700);
                if (window.completeGame) window.completeGame("4");
                return;
              }
              persist(); // keep reloads on the same puzzle/progress
            } else {
              // "wrong" and "oneAway" share identical bookkeeping.
              if (outcome.result === "oneAway") {
                AudioMgr.oneAway();
                renderer.toast("One Away!");
              } else {
                AudioMgr.wrong();
                Haptics.wrong();
                renderer.toast("Not quite -- try again.");
              }
              renderer.shakeSelected(attempted);
              await AnimationMgr.wait(420);
              engine.clearSelection();
              renderer.setSubmitEnabled(false);
              renderer.renderMistakes(engine.mistakesLeft);
              renderer.renderBoard(engine.remaining, engine.selected);

              if (engine.isLost()) {
                renderer.toast("Web integrity depleted -- reweaving a new web...", 1700);
                const justFailed = engine.puzzle;
                await AnimationMgr.wait(1000);
                startNewPuzzle(justFailed);
              } else {
                persist(); // mistakes/tried-guesses survive a reload too
              }
            }
          } catch (err) {
            // Surface it in the console instead of silently freezing --
            // if this ever fires, the message tells us exactly what broke.
            console.error("[game4] onSubmit failed:", err);
            renderer.toast("Something glitched -- try again.");
          } finally {
            locked = false;
          }
        }
      };

      new InputMgr(root, handlers);
    }
  };

  window.Game4 = Game;

  // Self-initializing: the template only needs to load this script
  // (via {% block game_scripts %}) with no extra inline JS. The puzzle
  // bank URL is read from a data attribute so Jinja's url_for() output
  // lives in the template, not hardcoded here.
  function boot() {
    const root = document.querySelector("[data-game4-root]");
    if (!root) return;
    // FIX: if this script runs more than once against the same DOM (e.g.
    // the app navigates to this screen without a full page reload), a
    // second Game.init() would attach a second, independent set of click
    // handlers -- each with its own separate `locked` flag and its own
    // separate `engine` -- to the SAME board element. The two instances
    // then fight over the same DOM, which looks exactly like "the game
    // half-processes a guess and then freezes." Make init idempotent.
    if (root.dataset.game4Initialized === "true") return;
    root.dataset.game4Initialized = "true";
    const puzzleUrl = root.dataset.puzzleUrl;
    const fallbackUrl = root.dataset.puzzleFallbackUrl;
    Game.init("[data-game4-root]", puzzleUrl, fallbackUrl);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
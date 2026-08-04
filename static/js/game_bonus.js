/*
 * BONUS ROUND: Code Ninja
 * ------------------------------
 * Loaded only on /game/bonus (see templates/games/game_bonus.html).
 *
 * Swipe across falling code chips, git-diff style: red "-" chips are bad
 * code, slice those. Green "+" chips are already clean -- leave them,
 * slicing one docks time instead of scoring. Reach the target before the
 * clock runs out, or just ride the clock down -- either way the round
 * ends by calling completeGame('bonus') (see static/js/game.js, already
 * loaded on this page).
 *
 * Runs entirely client-side: no backend calls, no assets outside this
 * file, no build step. Canvas + pointer events + a couple of synthesized
 * Web Audio blips -- no audio files, no CDNs.
 */
(function () {
  "use strict";

  var GAME_ID = "bonus";
  var ROUND_SECONDS = 45;
  var TARGET_BUGS = 14;
  var GOOD_PENALTY_SECONDS = 3;
  var DANGER_THRESHOLD = 10;

  var SPAWN_MS_START = [380, 620];
  var SPAWN_MS_END = [230, 420];
  var FALL_SPEED_START = [95, 140];
  var FALL_SPEED_END = [150, 230];
  var GOOD_CHANCE = 0.32;

  var BAD_CODE_SNIPPETS = [
    "NaN++", "== null", "while(1)", "undefined", "eval()",
    "goto;", "0=='0'", "TODO", "delete x", "any any",
  ];
  var GOOD_CODE_SNIPPETS = [
    "return true", "LGTM", "clean()", "passed", "O(1)",
    "git push", "const x=1", "fixed!", "tests ok",
  ];

  var canvas = document.getElementById("ninja-canvas");
  var startOverlay = document.getElementById("ninja-start-overlay");
  var startBtn = document.getElementById("ninja-start-btn");
  var endOverlay = document.getElementById("ninja-end-overlay");
  var endHeadline = document.getElementById("ninja-end-headline");
  var endCopy = document.getElementById("ninja-end-copy");
  var endStats = document.getElementById("ninja-end-stats");
  var scoreEl = document.getElementById("ninja-score");
  var targetEl = document.getElementById("ninja-target");
  var timeEl = document.getElementById("ninja-time");
  var timeItemEl = document.getElementById("ninja-time-item");

  if (!canvas) return;

  targetEl.textContent = String(TARGET_BUGS);
  timeEl.textContent = String(ROUND_SECONDS);

  var ctx = canvas.getContext("2d");
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var cssWidth = 0;
  var cssHeight = 0;

  function resizeCanvas() {
    var rect = canvas.getBoundingClientRect();
    cssWidth = rect.width;
    cssHeight = rect.height;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  // ---------- tiny synthesized SFX (no files, no CDN) ----------
  var audioCtx = null;
  function beep(freq, dur, type, gainPeak) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = type || "square";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(gainPeak || 0.12, audioCtx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + dur);
    } catch (e) { /* audio unavailable -- game still works fine */ }
  }
  function sfxGoodSlice() { beep(720, 0.09, "square", 0.1); beep(1080, 0.07, "square", 0.06); }
  function sfxBadSlice() { beep(160, 0.16, "sawtooth", 0.12); }
  function sfxWin(flawless) {
    var notes = flawless ? [660, 880, 1100, 1320, 1660] : [660, 880, 1100, 1320];
    notes.forEach(function (f, i) {
      window.setTimeout(function () { beep(f, 0.12, "square", 0.09); }, i * 70);
    });
  }

  function lerpColor(c1, c2, t) {
    return [
      Math.round(c1[0] + (c2[0] - c1[0]) * t),
      Math.round(c1[1] + (c2[1] - c1[1]) * t),
      Math.round(c1[2] + (c2[2] - c1[2]) * t),
    ];
  }
  var GOLD_RGB = [255, 204, 51];
  var MOLTEN_RGB = [255, 70, 40];

  var running = false;
  var score = 0;
  var timeLeft = ROUND_SECONDS;
  var streak = 0;
  var bestStreak = 0;
  var misses = 0;
  var inDanger = false;
  var items = [];
  var particles = [];
  var floaters = [];
  var bgGlyphs = [];
  var trail = [];
  var lastPointer = null;
  var rafId = null;
  var timerId = null;
  var spawnTimeoutId = null;
  var shake = 0;
  var flash = 0;
  var flashColor = "255,204,51";
  var hitStop = 0;
  var watchdogId = null;
  var completed = false;

  function rand(min, max) { return min + Math.random() * (max - min); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function initBgGlyphs() {
    bgGlyphs = [];
    var chars = "01{}();=<>/*";
    var cols = Math.max(6, Math.floor(cssWidth / 34));
    for (var i = 0; i < cols; i++) {
      bgGlyphs.push({
        x: (i + 0.5) * (cssWidth / cols) + rand(-6, 6),
        y: rand(-cssHeight, 0),
        vy: rand(26, 52),
        ch: chars[Math.floor(Math.random() * chars.length)],
        flip: rand(1.5, 3.5),
        t: 0,
      });
    }
  }

  function difficultyT() { return 1 - Math.max(0, timeLeft) / ROUND_SECONDS; }

  function spawnItem() {
    if (!running) return;
    var t = difficultyT();
    var isGood = Math.random() < GOOD_CHANCE;
    var isGolden = !isGood && Math.random() < 0.12; // rare bonus bad-code chip, worth double
    var speedRange = [lerp(FALL_SPEED_START[0], FALL_SPEED_END[0], t), lerp(FALL_SPEED_START[1], FALL_SPEED_END[1], t)];
    items.push({
      x: rand(cssWidth * 0.15, cssWidth * 0.85),
      y: -30,
      vy: rand(speedRange[0], speedRange[1]),
      r: 30,
      type: isGood ? "good" : "bad",
      golden: isGolden,
      text: isGood ? pick(GOOD_CODE_SNIPPETS) : pick(BAD_CODE_SNIPPETS),
      rot: rand(-0.1, 0.1),
      vrot: rand(-0.4, 0.4),
      sliced: false,
      sliceT: 0,
      pulseSeed: rand(0, Math.PI * 2),
    });
    var spawnRange = [lerp(SPAWN_MS_START[0], SPAWN_MS_END[0], t), lerp(SPAWN_MS_START[1], SPAWN_MS_END[1], t)];
    spawnTimeoutId = window.setTimeout(spawnItem, rand(spawnRange[0], spawnRange[1]));
  }

  function pointFromEvent(evt) {
    var rect = canvas.getBoundingClientRect();
    var clientX = evt.clientX;
    var clientY = evt.clientY;
    if (evt.touches && evt.touches.length) {
      clientX = evt.touches[0].clientX;
      clientY = evt.touches[0].clientY;
    }
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function distToSegment(p, a, b) {
    var abx = b.x - a.x;
    var aby = b.y - a.y;
    var lenSq = abx * abx + aby * aby;
    var t = lenSq > 0 ? ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq : 0;
    t = Math.max(0, Math.min(1, t));
    var cx = a.x + abx * t;
    var cy = a.y + aby * t;
    var dx = p.x - cx;
    var dy = p.y - cy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function trySlice(prevPt, curPt) {
    var hitThisMove = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.sliced) continue;
      var d = prevPt ? distToSegment({ x: it.x, y: it.y }, prevPt, curPt) : Math.hypot(curPt.x - it.x, curPt.y - it.y);
      if (d <= it.r + 14) {
        sliceItem(it);
        if (it.type === "bad") hitThisMove.push(it);
      }
    }
    if (hitThisMove.length >= 3) {
      spawnFloater(curPt.x, curPt.y - 20, "TRIPLE SLICE!", "#ff5528", true);
    } else if (hitThisMove.length === 2) {
      spawnFloater(curPt.x, curPt.y - 20, "DOUBLE SLICE!", "#ffcc33", true);
    }
  }

  function spawnShards(x, y, color, n) {
    for (var i = 0; i < n; i++) {
      var ang = rand(0, Math.PI * 2);
      var spd = rand(90, 260);
      particles.push({
        x: x, y: y,
        vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
        life: rand(0.28, 0.5), age: 0,
        color: color, len: rand(6, 14), width: rand(1.5, 2.5),
      });
    }
  }

  function spawnFloater(x, y, text, color, big) {
    floaters.push({ x: x, y: y, text: text, color: color, age: 0, life: big ? 0.9 : 0.7, big: !!big });
  }

  function sliceItem(it) {
    it.sliced = true;
    it.sliceT = 0;

    if (it.type === "bad") {
      streak++;
      bestStreak = Math.max(bestStreak, streak);
      var gain = it.golden ? 2 : 1;
      score += gain;
      scoreEl.textContent = String(score);
      if (it.golden) {
        spawnShards(it.x, it.y, "255,204,51", 20);
        spawnFloater(it.x, it.y, "+2 BONUS!", "#ffcc33", true);
        beep(1320, 0.1, "square", 0.1);
        flash = 0.6; flashColor = "255,204,51"; hitStop = 0.07;
      } else {
        spawnShards(it.x, it.y, "255,107,99", 12);
        spawnFloater(it.x, it.y, "+1", "#ffcc33");
        sfxGoodSlice();
        flash = Math.max(flash, 0.35);
        flashColor = "255,204,51";
        hitStop = Math.max(hitStop, 0.045);
      }
      if (streak === 4) spawnFloater(it.x, it.y - 26, "NICE!", "#ffcc33", true);
      if (streak === 8) {
        spawnFloater(it.x, it.y - 26, "ON FIRE!", "#ff5528", true);
        flash = 0.55; flashColor = "255,90,40"; hitStop = 0.09;
      }
      if (score >= TARGET_BUGS) { endRound(true); return; }
    } else {
      streak = 0;
      misses++;
      timeLeft = Math.max(0, timeLeft - GOOD_PENALTY_SECONDS);
      timeEl.textContent = String(Math.ceil(timeLeft));
      spawnShards(it.x, it.y, "127,224,143", 9);
      spawnFloater(it.x, it.y, "-3s", "#7fe08f");
      sfxBadSlice();
      shake = 1;
      flash = 0.4;
      flashColor = "232,35,28";
      hitStop = 0.05;
    }
  }

  function onPointerDown(evt) {
    if (!running) return;
    evt.preventDefault();
    lastPointer = pointFromEvent(evt);
    trail.push({ x: lastPointer.x, y: lastPointer.y, t: performance.now() });
  }
  function onPointerMove(evt) {
    if (!running || !lastPointer) return;
    evt.preventDefault();
    var pt = pointFromEvent(evt);
    trySlice(lastPointer, pt);
    trail.push({ x: pt.x, y: pt.y, t: performance.now() });
    if (trail.length > 18) trail.shift();
    lastPointer = pt;
  }
  function onPointerUp() { lastPointer = null; }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("touchstart", onPointerDown, { passive: false });
  canvas.addEventListener("touchmove", onPointerMove, { passive: false });
  canvas.addEventListener("touchend", onPointerUp);

  function drawBackground(dt) {
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    var dangerT = inDanger ? Math.min(1, (DANGER_THRESHOLD - timeLeft) / DANGER_THRESHOLD) : 0;

    var grad = ctx.createLinearGradient(0, 0, 0, cssHeight);
    grad.addColorStop(0, dangerT > 0 ? "rgb(" + Math.round(lerp(10, 40, dangerT)) + "," + Math.round(lerp(13, 6, dangerT)) + "," + Math.round(lerp(28, 10, dangerT)) + ")" : "#0a0d1c");
    grad.addColorStop(1, "#05060f");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    ctx.strokeStyle = dangerT > 0 ? "rgba(232, 35, 28, " + (0.05 + dangerT * 0.05) + ")" : "rgba(127, 224, 143, 0.05)";
    ctx.lineWidth = 1;
    var step = 28;
    for (var gx = 0; gx < cssWidth; gx += step) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, cssHeight); ctx.stroke(); }
    for (var gy = 0; gy < cssHeight; gy += step) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(cssWidth, gy); ctx.stroke(); }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    var rainSpeedMul = 1 + dangerT * 0.8;
    for (var i = 0; i < bgGlyphs.length; i++) {
      var g = bgGlyphs[i];
      g.y += g.vy * rainSpeedMul * dt;
      g.t += dt;
      if (g.t > g.flip) { g.t = 0; g.ch = "01{}();=<>/*"[Math.floor(Math.random() * 12)]; }
      if (g.y > cssHeight + 10) g.y = -10;
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = dangerT > 0.4 ? "#ff8a7a" : "#7fe08f";
      ctx.font = "12px 'Courier New', monospace";
      ctx.fillText(g.ch, g.x, g.y);
    }
    ctx.globalAlpha = 1;

    var vg = ctx.createRadialGradient(
      cssWidth / 2, cssHeight / 2, Math.min(cssWidth, cssHeight) * 0.25,
      cssWidth / 2, cssHeight / 2, Math.max(cssWidth, cssHeight) * 0.72
    );
    var vignetteColor = dangerT > 0 ? "0,0,0" : "0,0,0";
    vg.addColorStop(0, "rgba(" + vignetteColor + ",0)");
    vg.addColorStop(1, dangerT > 0 ? "rgba(60,0,0," + (0.45 + dangerT * 0.25) + ")" : "rgba(0,0,0,0.55)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    if (flash > 0) {
      ctx.fillStyle = "rgba(" + flashColor + "," + (flash * 0.3) + ")";
      ctx.fillRect(0, 0, cssWidth, cssHeight);
      flash = Math.max(0, flash - dt * 4.5);
    }
  }

  function drawScanlines() {
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = "#000";
    for (var y = 0; y < cssHeight; y += 3) { ctx.fillRect(0, y, cssWidth, 1); }
    ctx.globalAlpha = 1;
  }

  function drawCursor() {
    if (!running || !lastPointer) return;
    ctx.save();
    ctx.translate(lastPointer.x, lastPointer.y);
    ctx.strokeStyle = "rgba(255, 204, 51, 0.85)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-9, 0); ctx.lineTo(-3, 0);
    ctx.moveTo(3, 0); ctx.lineTo(9, 0);
    ctx.moveTo(0, -9); ctx.lineTo(0, -3);
    ctx.moveTo(0, 3); ctx.lineTo(0, 9);
    ctx.stroke();
    ctx.restore();
  }

  function trailColorForStreak() {
    var t = Math.min(1, streak / 8);
    var rgb = lerpColor(GOLD_RGB, MOLTEN_RGB, t);
    return rgb.join(",");
  }

  function drawTrail() {
    if (trail.length < 2) return;
    var now = performance.now();
    var col = trailColorForStreak();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (var i = 1; i < trail.length; i++) {
      var a = trail[i - 1];
      var b = trail[i];
      var age = (now - b.t) / 220;
      if (age > 1) continue;
      var alpha = 1 - age;

      ctx.shadowColor = "rgba(" + col + ", 0.9)";
      ctx.shadowBlur = items.length > 10 ? 0 : 9;
      ctx.strokeStyle = "rgba(" + col + ", " + (alpha * 0.55) + ")";
      ctx.lineWidth = 9 * alpha + 2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255, 255, 255, " + alpha + ")";
      ctx.lineWidth = 2.5 * alpha + 0.5;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.shadowBlur = 0;
    trail = trail.filter(function (p) { return now - p.t < 260; });
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawChip(it, now) {
    var isBad = it.type === "bad";
    var sign = isBad ? "-" : "+";
    ctx.font = "bold 13px 'Courier New', monospace";
    var padX = 10;
    var gutterW = 16;
    var textW = ctx.measureText(it.text).width;
    var w = textW + padX * 2 + gutterW;
    var h = 30;
    var pulse = 0.5 + 0.5 * Math.sin(now / 260 + it.pulseSeed);
    var glowAlpha = 0.4 + pulse * 0.35;
    var glow = it.golden ? "rgba(255,204,51," + glowAlpha + ")" : isBad ? "rgba(232,35,28," + glowAlpha + ")" : "rgba(56,214,107," + glowAlpha + ")";
    var fill = it.golden ? "rgba(58,42,4,0.94)" : isBad ? "rgba(50,6,6,0.94)" : "rgba(5,42,20,0.94)";
    var border = it.golden ? "#ffcc33" : isBad ? "#e8231c" : "#38d66b";
    var textColor = it.golden ? "#ffe6a1" : isBad ? "#ff6b63" : "#7fe08f";

    // Perf guard: skip the (expensive) glow once the board gets busy, so
    // low-end phones don't chug during the frantic late-round moments.
    var busy = items.length > 10;
    ctx.shadowColor = glow;
    ctx.shadowBlur = busy ? 0 : 5 + pulse * 4;
    ctx.fillStyle = fill;
    ctx.strokeStyle = border;
    ctx.lineWidth = 1.5;
    roundRect(-w / 2, -h / 2, w, h, 5);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();

    ctx.fillStyle = border;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(-w / 2, -h / 2, gutterW - 4, h);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#05060f";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 14px 'Courier New', monospace";
    ctx.fillText(sign, -w / 2 + (gutterW - 4) / 2, 1);

    ctx.fillStyle = textColor;
    ctx.font = "bold 13px 'Courier New', monospace";
    ctx.fillText(it.text, gutterW / 2, 1);
  }

  function drawItems(dt, now) {
    for (var i = items.length - 1; i >= 0; i--) {
      var it = items[i];
      if (it.sliced) {
        it.sliceT += dt;
        if (it.sliceT > 0.3) { items.splice(i, 1); continue; }
      } else {
        it.y += it.vy * dt;
        it.rot += it.vrot * dt;
        if (it.y - it.r > cssHeight) { items.splice(i, 1); continue; }
      }

      ctx.save();
      ctx.translate(it.x, it.y);
      var scale = it.sliced ? 1 + it.sliceT * 1.8 : 1;
      var alpha = it.sliced ? Math.max(0, 1 - it.sliceT / 0.3) : 1;
      ctx.globalAlpha = alpha;
      ctx.rotate(it.rot);
      ctx.scale(scale, scale);
      drawChip(it, now);
      ctx.restore();
    }
  }

  function drawParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.age += dt;
      if (p.age >= p.life) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94; p.vy *= 0.94;
      var a = 1 - p.age / p.life;
      var ang = Math.atan2(p.vy, p.vx);
      var ex = p.x - Math.cos(ang) * p.len;
      var ey = p.y - Math.sin(ang) * p.len;
      ctx.strokeStyle = "rgba(" + p.color + "," + a + ")";
      ctx.lineWidth = p.width;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }
  }

  function drawFloaters(dt) {
    for (var i = floaters.length - 1; i >= 0; i--) {
      var f = floaters[i];
      f.age += dt;
      if (f.age >= f.life) { floaters.splice(i, 1); continue; }
      var t = f.age / f.life;
      var pop = t < 0.15 ? (t / 0.15) : 1;
      ctx.globalAlpha = 1 - Math.max(0, (t - 0.55) / 0.45);
      ctx.fillStyle = f.color;
      var baseSize = f.big ? 20 : 15;
      ctx.font = "bold " + Math.round(baseSize * (0.7 + 0.3 * pop)) + "px 'Courier New', monospace";
      ctx.textAlign = "center";
      ctx.fillText(f.text, f.x, f.y - t * 36);
      ctx.globalAlpha = 1;
    }
  }

  var lastFrame = null;
  function frame(ts) {
    if (!running) return;
    try {
      frameInner(ts);
    } catch (e) {
      console.error("Code Ninja: frame error, failing safe", e);
      endRound(score >= TARGET_BUGS);
      return;
    }
    rafId = requestAnimationFrame(frame);
  }
  function frameInner(ts) {
    if (lastFrame == null) lastFrame = ts;
    var rawDt = Math.min(0.05, (ts - lastFrame) / 1000);
    lastFrame = ts;

    if (hitStop > 0) {
      hitStop = Math.max(0, hitStop - rawDt);
    }
    var dt = hitStop > 0 ? 0 : rawDt;

    var wasDanger = inDanger;
    inDanger = timeLeft <= DANGER_THRESHOLD && timeLeft > 0;
    if (inDanger !== wasDanger) {
      timeItemEl.classList.toggle("ninja-danger", inDanger);
    }

    ctx.save();
    if (shake > 0) {
      var mag = shake * 6;
      ctx.translate(rand(-mag, mag), rand(-mag, mag));
      shake = Math.max(0, shake - rawDt * 5);
    }
    drawBackground(dt);
    drawItems(dt, ts);
    drawParticles(dt);
    drawFloaters(dt);
    drawTrail();
    drawCursor();
    drawScanlines();
    ctx.restore();
  }

  function tickTimer() {
    if (!running) return;
    timeLeft -= 1;
    if (timeLeft <= 0) {
      timeLeft = 0;
      timeEl.textContent = "0";
      endRound(score >= TARGET_BUGS);
      return;
    }
    timeEl.textContent = String(Math.ceil(timeLeft));
  }

  function startRound() {
    try {
      startRoundInner();
    } catch (e) {
      console.error("Code Ninja: failed to start, failing safe", e);
      completed = true;
      // Fail safe = don't strand them, NOT don't grant the bonus. Since the
      // bonus now decides leaderboard rank, handing it out for free because
      // our canvas blew up would outrank players who actually earned it.
      try { forfeitBonus(); } catch (e2) {}
    }
  }
  function startRoundInner() {
    try { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}

    startOverlay.classList.add("ninja-hidden");
    running = true;
    score = 0;
    streak = 0;
    bestStreak = 0;
    misses = 0;
    inDanger = false;
    timeItemEl.classList.remove("ninja-danger");
    timeLeft = ROUND_SECONDS;
    items = [];
    particles = [];
    floaters = [];
    trail = [];
    scoreEl.textContent = "0";
    timeEl.textContent = String(ROUND_SECONDS);
    lastFrame = null;

    resizeCanvas();
    initBgGlyphs();
    spawnTimeoutId = window.setTimeout(spawnItem, 250);
    timerId = window.setInterval(tickTimer, 1000);
    rafId = requestAnimationFrame(frame);

    // Safety net: if the round is still "running" well past when it
    // should have ended (a bug, a stalled interval, anything), force it
    // to complete rather than leaving the player stuck on this screen.
    window.clearTimeout(watchdogId);
    watchdogId = window.setTimeout(function () {
      if (running) {
        console.error("Code Ninja: watchdog fired, round overran -- forcing completion");
        endRound(score >= TARGET_BUGS);
      }
    }, (ROUND_SECONDS + 22) * 1000);
  }

  function endRound(cleared) {
    if (completed) return;
    completed = true;
    running = false;
    window.clearInterval(timerId);
    window.clearTimeout(spawnTimeoutId);
    window.clearTimeout(watchdogId);
    if (rafId) cancelAnimationFrame(rafId);
    try { timeItemEl.classList.remove("ninja-danger"); } catch (e) {}

    var flawless = cleared && misses === 0;
    try {
      endHeadline.textContent = flawless ? "FLAWLESS!" : cleared ? "DEBUGGED!" : "TIME'S UP!";
      endCopy.textContent = flawless
        ? "Zero mistakes. Absolute unit."
        : cleared
          ? "Code's clean. Nice reflexes, ninja."
          : "Didn't squash them all -- the bonus got away.";
      endStats.textContent =
        "bugs_fixed: " + score + "/" + TARGET_BUGS +
        "  |  best_streak: " + bestStreak +
        "  |  misses: " + misses;
      endOverlay.classList.remove("ninja-hidden");
      if (cleared) sfxWin(flawless);
    } catch (e) {
      console.error("Code Ninja: error rendering end screen (non-fatal)", e);
    }

    // The bonus only counts if it was actually CLEARED -- all TARGET_BUGS
    // squashed, i.e. the "DEBUGGED!"/"FLAWLESS!" ending. Running out of
    // time is a loss: forfeitBonus() closes the attempt with no credit, so
    // no golden B and no leaderboard benefit. Either way the player is
    // handed back to their main run; a lost bonus never blocks it.
    //
    // Pause first so the end screen and stats line are readable. (This used
    // to wait 12s, long enough that the round looked frozen.)
    window.setTimeout(function () {
      try {
        if (cleared) completeGame(GAME_ID);
        else forfeitBonus();
      } catch (e) { console.error("Code Ninja: handoff threw", e); }
    }, GAME_HANDOFF_MS);
  }

  startBtn.addEventListener("click", startRound);
})();

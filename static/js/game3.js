/*
 * MINI-GAME #3: Web of Memory (Spider-Man Memory Match)
 * -------------------------------------------------------
 * Loaded only on /game/3 (see templates/games/game3.html).
 *
 * Two "web layers", each a 3x3 grid: 4 logo/name pairs (8 cards) plus one
 * free "SPIDEY-SENSE" card in the center that's already matched and just
 * sits there for flavor. Clear all 4 pairs in a layer -- they pop off the
 * board -- then the next layer's grid loads in. No timer -- take as long
 * as you need. Clear both layers to win.
 *
 * All art lives in static/games/game3/ (logos) and static/img/ (spidey art).
 */
(function () {
  "use strict";

  var ASSET_BASE = "/static/games/game3/";
  var CARD_BACK = ASSET_BASE + "card-back.svg";
  var SPIDEY_ICON = "/static/img/spider-glow.png";

  // Each layer draws 4 random pairs out of a 6-item pool every round, so
  // replays don't always show the same board. Layer 2's pool is the more
  // "advanced" tool stack -- same 3x3 grid, just a harder set of logos.
  var LAYER_POOLS = [
    [
      { id: "js", name: "JavaScript", logo: "logo-javascript.svg" },
      { id: "python", name: "Python", logo: "logo-python.svg" },
      { id: "react", name: "React", logo: "logo-react.svg" },
      { id: "html5", name: "HTML5", logo: "logo-html5.svg" },
      { id: "css3", name: "CSS3", logo: "logo-css3.svg" },
      { id: "git", name: "Git", logo: "logo-git.svg" }
    ],
    [
      { id: "docker", name: "Docker", logo: "logo-docker.svg" },
      { id: "postgresql", name: "PostgreSQL", logo: "logo-postgresql.svg" },
      { id: "kubernetes", name: "Kubernetes", logo: "logo-kubernetes.svg" },
      { id: "vscode", name: "VS Code", logo: "logo-vscode.svg" },
      { id: "figma", name: "Figma", logo: "logo-figma.svg" },
      { id: "pytorch", name: "PyTorch", logo: "logo-pytorch.svg" }
    ]
  ];

  var boardEl = document.getElementById("mm-board");
  var layerValueEl = document.getElementById("mm-layer-value");
  var pairsValueEl = document.getElementById("mm-pairs-value");
  var bannerEl = document.getElementById("mm-layer-banner");
  var hintEl = document.getElementById("mm-hint");
  var endOverlayEl = document.getElementById("mm-end-overlay");

  if (!boardEl) return;

  var currentLayerIndex = 0;
  var flippedCards = [];
  var lockBoard = false;
  var pairsRemaining = 0;
  var gameOver = false;

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function buildFreeCardEl() {
    var wrap = document.createElement("div");
    wrap.className = "mm-card is-free is-logo";

    var inner = document.createElement("div");
    inner.className = "mm-card-inner";

    var front = document.createElement("div");
    front.className = "mm-card-face mm-card-front";
    var img = document.createElement("img");
    img.src = SPIDEY_ICON;
    img.alt = "Spidey-Sense";
    var label = document.createElement("div");
    label.className = "mm-card-name";
    label.textContent = "SPIDEY-SENSE";
    front.appendChild(img);
    front.appendChild(label);

    inner.appendChild(front);
    wrap.appendChild(inner);
    return wrap;
  }

  function buildCardEl(card) {
    var wrap = document.createElement("div");
    wrap.className = "mm-card" + (card.kind === "logo" ? " is-logo" : "");
    wrap.dataset.pairId = card.pairId;
    wrap.dataset.kind = card.kind;

    var inner = document.createElement("div");
    inner.className = "mm-card-inner";

    var back = document.createElement("div");
    back.className = "mm-card-face mm-card-back";
    var backImg = document.createElement("img");
    backImg.src = CARD_BACK;
    backImg.alt = "";
    back.appendChild(backImg);

    var front = document.createElement("div");
    front.className = "mm-card-face mm-card-front";
    if (card.kind === "logo") {
      var img = document.createElement("img");
      img.src = ASSET_BASE + card.logo;
      img.alt = card.name;
      front.appendChild(img);
    } else {
      var label = document.createElement("div");
      label.className = "mm-card-name";
      label.textContent = card.name;
      front.appendChild(label);
    }

    inner.appendChild(back);
    inner.appendChild(front);
    wrap.appendChild(inner);

    wrap.addEventListener("click", function () {
      onCardTap(wrap);
    });

    return wrap;
  }

  function renderLayer(layerIndex) {
    var entries = shuffle(LAYER_POOLS[layerIndex].slice()).slice(0, 4);
    pairsRemaining = entries.length;
    flippedCards = [];
    lockBoard = false;

    var cards = [];
    entries.forEach(function (entry) {
      cards.push({ pairId: entry.id, kind: "logo", logo: entry.logo, name: entry.name });
      cards.push({ pairId: entry.id, kind: "name", name: entry.name });
    });
    shuffle(cards);

    // 3x3 grid: 8 shuffled match cards with one free spidey card fixed
    // in the center slot (index 4).
    boardEl.innerHTML = "";
    var cardIdx = 0;
    for (var slot = 0; slot < 9; slot++) {
      if (slot === 4) {
        boardEl.appendChild(buildFreeCardEl());
      } else {
        boardEl.appendChild(buildCardEl(cards[cardIdx]));
        cardIdx++;
      }
    }

    layerValueEl.textContent = (layerIndex + 1) + "/" + LAYER_POOLS.length;
    pairsValueEl.textContent = String(pairsRemaining);
  }

  function onCardTap(cardEl) {
    if (gameOver) return;
    if (lockBoard) return;
    if (cardEl.classList.contains("is-flipped")) return;
    if (cardEl.classList.contains("is-matched")) return;
    if (flippedCards.indexOf(cardEl) !== -1) return;

    cardEl.classList.add("is-flipped");
    flippedCards.push(cardEl);

    if (flippedCards.length === 2) {
      lockBoard = true;
      checkMatch();
    }
  }

  function checkMatch() {
    var a = flippedCards[0];
    var b = flippedCards[1];
    var isMatch = a.dataset.pairId === b.dataset.pairId && a.dataset.kind !== b.dataset.kind;

    if (isMatch) {
      setTimeout(function () {
        if (gameOver) return;
        a.classList.add("is-matched");
        b.classList.add("is-matched");
        flippedCards = [];
        lockBoard = false;
        pairsRemaining -= 1;
        pairsValueEl.textContent = String(pairsRemaining);

        if (pairsRemaining <= 0) {
          setTimeout(advanceLayer, 550);
        }
      }, 320);
    } else {
      a.classList.add("is-wrong");
      b.classList.add("is-wrong");
      setTimeout(function () {
        if (gameOver) return;
        a.classList.remove("is-flipped", "is-wrong");
        b.classList.remove("is-flipped", "is-wrong");
        flippedCards = [];
        lockBoard = false;
      }, 700);
    }
  }

  function showBanner(text, callback) {
    bannerEl.innerHTML = '<div class="mm-layer-banner-text">' + text + "</div>";
    bannerEl.classList.add("is-active");
    setTimeout(function () {
      bannerEl.classList.remove("is-active");
      bannerEl.innerHTML = "";
      if (callback) callback();
    }, 900);
  }

  function advanceLayer() {
    if (gameOver) return;
    currentLayerIndex += 1;
    if (currentLayerIndex >= LAYER_POOLS.length) {
      hintEl.textContent = "Web fully mapped! Securing the network...";
      showBanner("LAYER CLEARED!", function () {
        onWin();
      });
      return;
    }
    showBanner("LAYER CLEARED!", function () {
      renderLayer(currentLayerIndex);
    });
  }

  function showEndOverlay(kind, title, sub) {
    endOverlayEl.className = "mm-end-overlay is-active is-" + kind;
    endOverlayEl.innerHTML =
      '<div class="mm-end-card">' +
        '<div class="mm-end-title">' + title + '</div>' +
        '<p class="mm-end-sub">' + sub + '</p>' +
      '</div>';
  }

  function onWin() {
    if (gameOver) return;
    gameOver = true;
    lockBoard = true;
    // No "swing again" button here: clearing both layers finishes the
    // challenge, so the only thing that should follow is the handoff to
    // the next one. Without this completeGame() call the run dead-ended
    // here and Game 4 was unreachable.
    showEndOverlay(
      "win",
      "WEB SECURED!",
      "Both layers mapped. Queens sleeps easy tonight, wall-crawler."
    );
    setTimeout(function () { completeGame("3"); }, GAME_HANDOFF_MS);
  }

  function resetGame() {
    gameOver = false;
    currentLayerIndex = 0;
    endOverlayEl.classList.remove("is-active", "is-win", "is-loss");
    endOverlayEl.innerHTML = "";
    hintEl.textContent = "Tap two cards to flip them \u2014 find every logo's matching name.";
    renderLayer(currentLayerIndex);
  }

  resetGame();
})();
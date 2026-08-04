/*
 * Shared glue between any mini-game and the backend.
 *
 * Mini-game developers: call `completeGame(gameId)` whenever the player
 * finishes your challenge (e.g. on a win condition, or a timeout you
 * consider a "pass"). You do not need to touch this file.
 *
 * Under the hood this also sends the one-time completion token the server
 * embedded in #game-viewport's data-token attribute -- that's what proves
 * to the backend that this request actually came from the unlocked game
 * page, not a hand-crafted call to /complete-game. You never need to read
 * or generate this token yourself.
 *
 * There is deliberately no "mark this complete" button on the page: the
 * only way past a challenge is winning it.
 */

/* How long the shared "CLEARED!" card sits on screen before the next
 * screen replaces it. Your game does NOT need its own pause before
 * calling completeGame() -- this is that pause, and every game gets the
 * same one. */
var CLEARED_MESSAGE_MS = 2600;

function showClearedOverlay(message) {
  var overlay = document.getElementById("cleared-overlay");
  if (!overlay) return false;
  var sub = document.getElementById("cleared-sub");
  if (sub && message) sub.textContent = message;
  overlay.classList.add("is-visible");
  overlay.setAttribute("aria-hidden", "false");
  return true;
}

function completeGame(gameId, options) {
  options = options || {};

  var viewport = document.getElementById("game-viewport");
  var token = viewport ? viewport.dataset.token : null;

  fetch("/complete-game", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ game_id: gameId, token: token }),
  })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data.status === "ok" && data.redirect) {
        // Hold on a "CLEARED!" card for a beat instead of yanking the
        // player straight into the next countdown the instant they win.
        var shown = showClearedOverlay(options.message);
        window.setTimeout(function () {
          window.location.href = data.redirect;
        }, shown ? CLEARED_MESSAGE_MS : 0);
      } else {
        alert(data.message || "Something went wrong -- try again.");
      }
    })
    .catch(function () {
      alert("Network error -- check your connection and try again.");
    });
}

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
 *
 * Note there is no shared "you cleared it!" screen here -- every game
 * already ends on its own win message. Show yours, hold it long enough to
 * read (see GAME_HANDOFF_MS below), then call completeGame().
 */

/* Suggested pause between a game's own win message appearing and its
 * completeGame() call: long enough to read and register, short enough not
 * to feel like the page has hung. Games import this rather than each
 * picking their own number, so the whole run has one rhythm. */
var GAME_HANDOFF_MS = 2400;

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
        window.location.href = data.redirect;
      } else {
        alert(data.message || "Something went wrong -- try again.");
      }
    })
    .catch(function () {
      alert("Network error -- check your connection and try again.");
    });
}

/*
 * Bonus round only: the player finished it but did NOT clear it. Only an
 * outright clear counts as having done the bonus, so this closes their
 * attempt with no credit and returns them to the main run. Never call this
 * for a main-sequence game -- those are cleared or still in progress,
 * there's no "lost" state.
 */
function forfeitBonus() {
  var viewport = document.getElementById("game-viewport");
  var token = viewport ? viewport.dataset.token : null;

  function goBack(url) { window.location.href = url || "/dashboard"; }

  fetch("/forfeit-bonus", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: token }),
  })
    .then(function (res) { return res.json(); })
    .then(function (data) { goBack(data && data.redirect); })
    // Even if the call fails, don't strand them on a finished bonus screen.
    .catch(function () { goBack("/dashboard"); });
}

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
 * The default "MARK CHALLENGE COMPLETE" button (present until a real
 * mini-game replaces game_controls) just calls this directly.
 */
function completeGame(gameId) {
  var btn = document.getElementById("complete-btn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "LOADING NEXT CHALLENGE...";
  }

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
        if (btn) {
          btn.disabled = false;
          btn.textContent = "MARK CHALLENGE COMPLETE";
        }
      }
    })
    .catch(function () {
      alert("Network error -- check your connection and try again.");
      if (btn) {
        btn.disabled = false;
        btn.textContent = "MARK CHALLENGE COMPLETE";
      }
    });
}

document.addEventListener("DOMContentLoaded", function () {
  var btn = document.getElementById("complete-btn");
  var viewport = document.getElementById("game-viewport");
  if (btn && viewport) {
    btn.addEventListener("click", function () {
      completeGame(viewport.dataset.gameId);
    });
  }
});

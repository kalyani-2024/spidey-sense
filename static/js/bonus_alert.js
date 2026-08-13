/*
 * The surprise bonus alert on the finish screen.
 *
 * Tapping JOIN ACM doesn't go to the membership portal right away: this
 * ambushes the player with a full-screen SPIDEY-SENSE alert first. Claiming
 * it follows the button's own /join-acm link, which unlocks the bonus round
 * server-side and drops them into it (the portal comes after, once that
 * attempt closes -- see routes/games.py).
 *
 * Letting the countdown run out continues to the portal, i.e. exactly what
 * they tapped for. The bonus is a surprise on top of the sign-up, so
 * ignoring it can cost them the round but never the sign-up.
 *
 * If this file never runs, the JOIN ACM link still points at /join-acm and
 * the whole flow happens server-side without the alert.
 */
(function () {
  var join = document.getElementById("join-acm");
  var alertEl = document.getElementById("bonus-alert");
  var timerEl = document.getElementById("bonus-alert-timer");
  var cta = document.getElementById("bonus-alert-cta");
  if (!join || !alertEl || !cta) return;

  var seconds = parseInt(alertEl.dataset.seconds, 10);
  if (!seconds || seconds < 1) seconds = 10;
  var portal = alertEl.dataset.portal;

  var countdown = null;
  var claimed = false;

  function paint(left) {
    if (timerEl) timerEl.textContent = "CLOSING IN " + left + "s";
  }

  function stop() {
    if (countdown) { clearInterval(countdown); countdown = null; }
  }

  join.addEventListener("click", function (e) {
    // Everything past here is the alert; the link's own href is the
    // no-JS path and must not fire underneath it.
    e.preventDefault();
    if (alertEl.classList.contains("bonus-banner-visible")) return;

    alertEl.classList.add("bonus-banner-visible");
    var left = seconds;
    paint(left);

    countdown = setInterval(function () {
      left -= 1;
      if (left > 0) { paint(left); return; }
      stop();
      // Out of time: on to the portal, which is where this tap was
      // always headed.
      if (!claimed) window.location.href = portal;
    }, 1000);
  });

  // Claiming navigates via the CTA's own href (/join-acm) -- this only
  // stops the countdown from yanking the portal in mid-navigation.
  cta.addEventListener("click", function () {
    claimed = true;
    stop();
  });
})();

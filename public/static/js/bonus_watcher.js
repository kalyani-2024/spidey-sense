/*
 * Watches the #bonus-banner element (rendered by templates/_bonus_banner.html)
 * and reveals/hides it live, without a page reload, as the bonus round's
 * unlock/expiry timestamps come and go. The server is still the source of
 * truth -- this is only presentation. If someone reloads the page after the
 * bonus unlocked, the server-rendered state already has it visible anyway.
 */
(function () {
  var banner = document.getElementById("bonus-banner");
  if (!banner) return;

  var state = banner.dataset.state;
  var unlockAt = parseFloat(banner.dataset.unlockAt);
  var expiresAt = parseFloat(banner.dataset.expiresAt);
  var timerEl = document.getElementById("bonus-banner-timer");

  function show() {
    banner.classList.add("bonus-banner-visible");
  }
  function hide() {
    banner.classList.remove("bonus-banner-visible");
  }

  function updateCountdown() {
    if (!expiresAt) return;
    var remaining = Math.max(0, expiresAt - Date.now() / 1000);
    if (remaining <= 0) {
      hide();
      return;
    }
    var m = Math.floor(remaining / 60).toString().padStart(2, "0");
    var s = Math.floor(remaining % 60).toString().padStart(2, "0");
    if (timerEl) timerEl.textContent = "(" + m + ":" + s + ")";
  }

  if (state === "available") {
    show();
    updateCountdown();
    setInterval(updateCountdown, 1000);
  } else if (state === "locked" && unlockAt) {
    var msUntilUnlock = unlockAt * 1000 - Date.now();
    if (msUntilUnlock > 0 && msUntilUnlock < 30 * 60 * 1000) {
      setTimeout(function () {
        show();
        updateCountdown();
        setInterval(updateCountdown, 1000);
      }, msUntilUnlock);
    }
  }
})();

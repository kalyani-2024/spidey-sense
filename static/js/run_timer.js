/*
 * Drives the "YOUR TIME" clock in templates/_run_timer.html.
 *
 * Counts up from the elapsed value the server rendered into the element,
 * using the browser only to measure the time SINCE page load. That way a
 * phone with a wrong system clock still shows the same number the admin
 * leaderboard will rank the player on -- we never trust the device's idea
 * of the current time, only its stopwatch.
 */
(function () {
  var el = document.getElementById("run-timer");
  if (!el) return;

  var valueEl = document.getElementById("run-timer-value");
  var baseSeconds = parseFloat(el.dataset.elapsed) || 0;
  var running = el.dataset.running === "1";
  var loadedAt = Date.now();

  function format(total) {
    total = Math.max(0, Math.floor(total));
    var h = Math.floor(total / 3600);
    var m = Math.floor((total % 3600) / 60);
    var s = total % 60;
    if (h > 0) {
      return h + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
    }
    return m + ":" + String(s).padStart(2, "0");
  }

  function tick() {
    var extra = running ? (Date.now() - loadedAt) / 1000 : 0;
    valueEl.textContent = format(baseSeconds + extra);
  }

  tick();
  if (running) setInterval(tick, 1000);
})();

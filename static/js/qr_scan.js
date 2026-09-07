/*
 * Camera-based QR scanner for the two physical stall QR codes. Decodes
 * frames locally with jsQR (client-side only), but the decoded text is
 * never trusted on its own -- it's POSTed to the server (SPIDEY_SCAN_SUBMIT_URL,
 * set inline by scan.html) which is the only thing that actually validates
 * it and starts/stops the timer.
 *
 * Everything in the frame loop is wrapped in try/catch and the next frame is
 * always queued: one thrown frame (a camera that hands back a zero-sized
 * buffer mid-rotation, say) used to kill the loop for good, leaving a live
 * preview that would never again decode anything -- which looks exactly like
 * "the scanner doesn't work" with nothing on screen to say so.
 */
(function () {
  var video = document.getElementById("scan-video");
  var statusEl = document.getElementById("scan-status");
  var submitUrl = window.SPIDEY_SCAN_SUBMIT_URL;
  if (!video || !submitUrl) return;

  var canvas = document.createElement("canvas");
  var ctx = canvas.getContext("2d", { willReadFrequently: true });
  var busy = false; // true while we're waiting on the server after a decode
  var stream = null;
  var frames = 0; // frames actually handed to jsQR, for the nudge below
  var lastError = "";
  var lastSeen = "";

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(function (t) { t.stop(); });
      stream = null;
    }
  }

  function submitCode(code) {
    busy = true;
    setStatus("Checking QR code...");
    fetch(submitUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code }),
    })
      .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
      .then(function (result) {
        if (result.ok && result.data.status === "ok") {
          stopCamera();
          setStatus("Got it! Loading...");
          window.location.href = result.data.redirect;
          return;
        }
        setStatus((result.data && result.data.message) || "Wrong QR code -- try again.");
        busy = false;
      })
      .catch(function () {
        setStatus("Connection hiccup -- try again.");
        busy = false;
      });
  }

  // Decoding a full 1280x720 frame every tick is what made this crawl on a
  // phone: jsQR is pure JS, so cost scales with pixel count, and each frame
  // took long enough that the camera had moved on by the time it finished.
  // We decode a downscaled square instead -- the same region the round
  // preview shows, since the video is object-fit:cover in a square box.
  var DECODE_SIZE = 400;   // px square actually handed to jsQR
  var MIN_FRAME_MS = 60;   // ~16fps ceiling, leaves the phone room to focus
  var lastRun = 0;
  var wideTurn = 0;

  function decode(sx, sy, sw, sh, size, invert) {
    canvas.width = size;
    canvas.height = size;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, size, size);
    var d = ctx.getImageData(0, 0, size, size);
    return window.jsQR(d.data, d.width, d.height, { inversionAttempts: invert });
  }

  function scanFrame(now) {
    if (busy) return;
    // videoWidth stays 0 until the camera has really handed over a frame;
    // drawing that is what throws.
    if (!video.videoWidth || !video.videoHeight) return;
    if (now - lastRun < MIN_FRAME_MS) return;
    lastRun = now;

    var vw = video.videoWidth;
    var vh = video.videoHeight;
    var side = Math.min(vw, vh);
    var code = decode((vw - side) / 2, (vh - side) / 2, side, side,
                      DECODE_SIZE, "dontInvert");

    // Every fourth miss, take one pass over the whole frame instead. Costs
    // little at this size and catches a code sitting outside the square the
    // preview shows, or printed light-on-dark.
    wideTurn += 1;
    if (!code && wideTurn % 4 === 0) {
      code = decode(0, 0, vw, vh, DECODE_SIZE, "attemptBoth");
    }

    frames += 1;
    // The advice that matters is the margin, not the size: a code pressed
    // right up to the edges has no quiet zone left and will not decode.
    if (frames === 120) {
      setStatus("Move back a little -- keep white space all around the code.");
    }

    if (code && code.data) {
      lastSeen = code.data;
      submitCode(code.data);
    }
  }

  function tick(now) {
    if (!stream) return;
    try {
      scanFrame(now || 0);
    } catch (e) {
      // Never let one bad frame end the loop -- just try the next one.
      lastError = (e && e.message) || String(e);
    }
    requestAnimationFrame(tick);
  }

  if (typeof window.jsQR !== "function") {
    setStatus("Scanner failed to load. Reload the page.");
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setStatus("Your browser can't access the camera. Try a different browser.");
    return;
  }

  // A bigger frame is what makes a printed code readable from a normal
  // arm's length -- the default a phone hands back is often 640x480, which
  // only decodes if the QR nearly fills the screen.
  navigator.mediaDevices
    .getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    })
    .then(function (s) {
      stream = s;
      video.srcObject = stream;
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      video.setAttribute("autoplay", "");
      video.muted = true;
      var played = video.play();
      if (played && played.catch) {
        played.catch(function () {
          setStatus("Tap the video to start the camera.");
          video.addEventListener("click", function () { video.play(); });
        });
      }
      requestAnimationFrame(tick);
    })
    .catch(function (e) {
      lastError = (e && e.name) || String(e);
      setStatus("Camera access denied. Allow camera access and reload the page.");
    });

  /*
   * Diagnostics, off unless the URL carries ?debug=1. A scanner that just
   * "doesn't detect" gives you nothing to go on from the stall floor: this
   * says whether the library loaded, what resolution the camera actually
   * handed over, whether frames are still being scanned, and what the last
   * decode was. Nothing here is secret -- it only ever shows what the phone
   * itself is looking at.
   */
  if (window.location.search.indexOf("debug=1") !== -1) {
    var box = document.createElement("div");
    box.style.cssText =
      "position:fixed;left:0;right:0;bottom:0;z-index:9999;padding:8px 10px;" +
      "background:rgba(0,0,0,0.85);color:#0f0;font:11px/1.5 monospace;" +
      "white-space:pre-wrap;word-break:break-all;text-align:left";
    document.body.appendChild(box);
    setInterval(function () {
      var t = stream && stream.getVideoTracks ? stream.getVideoTracks()[0] : null;
      var st = t && t.getSettings ? t.getSettings() : {};
      box.textContent = [
        "jsQR loaded : " + (typeof window.jsQR === "function"),
        "stream      : " + (!!stream) + (t ? " (" + t.readyState + ")" : ""),
        "camera      : " + (st.width || "?") + "x" + (st.height || "?") + " " + (st.facingMode || "?"),
        "video       : " + video.videoWidth + "x" + video.videoHeight +
          " ready=" + video.readyState + " paused=" + video.paused,
        "frames sent : " + frames + " (decode " + DECODE_SIZE + "px)",
        "last decode : " + (lastSeen || "(nothing yet)"),
        "last error  : " + (lastError || "none")
      ].join("\n");
    }, 400);
  }
})();

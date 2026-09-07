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

  function scanFrame() {
    if (busy) return;
    // videoWidth stays 0 until the camera has really handed over a frame;
    // drawing that is what throws.
    if (!video.videoWidth || !video.videoHeight) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    var code = window.jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "attemptBoth",
    });

    frames += 1;
    // A stall QR held at arm's length under bad light can take a few
    // seconds; say so rather than sitting on "Point your camera...".
    if (frames === 150) {
      setStatus("Still looking -- fill the frame with the code and hold steady.");
    }

    if (code && code.data) submitCode(code.data);
  }

  function tick() {
    if (!stream) return;
    try {
      scanFrame();
    } catch (e) {
      // Never let one bad frame end the loop -- just try the next one.
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
      var played = video.play();
      if (played && played.catch) {
        played.catch(function () {
          setStatus("Tap the video to start the camera.");
          video.addEventListener("click", function () { video.play(); });
        });
      }
      requestAnimationFrame(tick);
    })
    .catch(function () {
      setStatus("Camera access denied. Allow camera access and reload the page.");
    });
})();

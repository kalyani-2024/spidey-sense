/*
 * Camera-based QR scanner for the two physical stall QR codes. Decodes
 * frames locally with jsQR (client-side only), but the decoded text is
 * never trusted on its own -- it's POSTed to the server (SPIDEY_SCAN_SUBMIT_URL,
 * set inline by scan.html) which is the only thing that actually validates
 * it and starts/stops the timer.
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

  function setStatus(text) {
    statusEl.textContent = text;
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

  function tick() {
    if (!stream) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA && !busy) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      var code = window.jsQR(imageData.data, imageData.width, imageData.height);
      if (code && code.data) {
        submitCode(code.data);
      }
    }
    requestAnimationFrame(tick);
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setStatus("Your browser can't access the camera. Try a different browser.");
    return;
  }

  navigator.mediaDevices
    .getUserMedia({ video: { facingMode: "environment" } })
    .then(function (s) {
      stream = s;
      video.srcObject = stream;
      video.play();
      requestAnimationFrame(tick);
    })
    .catch(function () {
      setStatus("Camera access denied. Allow camera access and reload the page.");
    });
})();

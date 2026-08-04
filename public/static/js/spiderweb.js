/*
 * Animated spider-web background, drawn on a full-screen <canvas>.
 * Pure procedural vanilla JS -- no images, no libraries. Full 360-degree
 * radial web centered on the screen so it covers edge-to-edge in every
 * direction (not just fanning out from the top).
 */
(function () {
  var canvas = document.getElementById("web-bg");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");

  var width, height, centerX, centerY;
  var strands = 14;
  var rings = 8;

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    centerX = width * 0.5;
    centerY = height * 0.42;
  }
  window.addEventListener("resize", resize);
  resize();

  function maxRadius() {
    // Reach past the furthest corner so the web fills the whole screen.
    return Math.sqrt(width * width + height * height) * 0.75;
  }

  function draw(time) {
    ctx.clearRect(0, 0, width, height);

    var glow = (Math.sin(time / 1600) + 1) / 2; // 0..1 slow pulse
    var radius = maxRadius();

    ctx.strokeStyle = "rgba(255, 30, 30, " + (0.26 + glow * 0.18) + ")";
    ctx.lineWidth = 1.6;

    // Radial strands, full circle
    var strandEnds = [];
    for (var i = 0; i < strands; i++) {
      var a = (Math.PI * 2 * i) / strands;
      var x = centerX + Math.cos(a) * radius;
      var y = centerY + Math.sin(a) * radius;
      strandEnds.push({ x: x, y: y, a: a });

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    // Concentric rings connecting the strands (classic web rings), closed loop
    for (var r = 1; r <= rings; r++) {
      var frac = r / rings;
      ctx.beginPath();
      for (var j = 0; j <= strandEnds.length; j++) {
        var s = strandEnds[j % strandEnds.length];
        var px = centerX + (s.x - centerX) * frac;
        var py = centerY + (s.y - centerY) * frac;
        if (j === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // A little "web-slinger" dot that travels one strand, for motion cues
    var travel = (time / 2600) % 1;
    var strandIndex = Math.floor((time / 2600 / 3) % strandEnds.length);
    var target = strandEnds[strandIndex];
    var dotX = centerX + (target.x - centerX) * travel;
    var dotY = centerY + (target.y - centerY) * travel;
    ctx.beginPath();
    ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 204, 51, " + (0.5 + glow * 0.4) + ")";
    ctx.fill();

    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
})();

/*
 * Stylized QR-code placeholder, ported 1:1 from the design prototype's
 * `get qr()` generator. Not a real scannable code -- real camera-based QR
 * scanning is deferred; this just fills the frame with a QR-shaped SVG so
 * the "tap the QR to advance" flow matches the prototype exactly for now.
 */
(function () {
  function generateQrDataUri() {
    var N = 25, m = 8, pad = m * 2, size = N * m + pad * 2;
    var rects = [];
    function dark(x, y) { rects.push('<rect x="' + (pad + x * m) + '" y="' + (pad + y * m) + '" width="' + m + '" height="' + m + '"/>'); }
    function finder(ox, oy) {
      for (var y = 0; y < 7; y++) {
        for (var x = 0; x < 7; x++) {
          var b = x === 0 || x === 6 || y === 0 || y === 6;
          var c = x >= 2 && x <= 4 && y >= 2 && y <= 4;
          if (b || c) dark(ox + x, oy + y);
        }
      }
    }
    finder(0, 0); finder(N - 7, 0); finder(0, N - 7);

    var s = 987654321;
    function rnd() { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }

    for (var y2 = 0; y2 < N; y2++) {
      for (var x2 = 0; x2 < N; x2++) {
        var inF = (x2 < 8 && y2 < 8) || (x2 > N - 9 && y2 < 8) || (x2 < 8 && y2 > N - 9);
        if (inF) continue;
        if (rnd() > 0.53) dark(x2, y2);
      }
    }

    var svg = "<svg xmlns='http://www.w3.org/2000/svg' width='" + size + "' height='" + size +
      "' viewBox='0 0 " + size + " " + size + "'><rect width='100%' height='100%' fill='#fff'/>" +
      "<g fill='#0b0e1a'>" + rects.join('') + "</g></svg>";
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  document.querySelectorAll('.scan-qr-image').forEach(function (el) {
    el.style.backgroundImage = "url(\"" + generateQrDataUri() + "\")";
  });
})();

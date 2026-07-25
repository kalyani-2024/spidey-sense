# Game 2 assets

"The Daily Bugle — Find the Buried Page" (a 404 hunt).

This game is intentionally **asset-free**: the Bugle masthead, the newsprint
look, and the upside-down Spider-Man on the 404 page are all built with CSS +
inline SVG (see `templates/games/game2.html` and `static/js/game2.js`), so the
whole thing works offline at the venue with zero binary dependencies.

Drop any local images/audio for this game here if you add them later, and
reference them with `url_for('static', filename='games/game2/<file>')` — never
an external CDN.

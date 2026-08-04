/*
 * Keeps a player from backing out of a challenge they've already cleared.
 *
 * The server is the real gate -- routes/games.py redirects any request for a
 * game that isn't the player's current one, and models.mark_game_complete()
 * would reject the completion anyway. This file only stops the *browser* from
 * making it look otherwise: without it, a Back gesture re-paints the previous
 * challenge from cache, and a player can sit there replaying a puzzle whose
 * result the server will never accept.
 *
 * Reads window.SPIDEY_RESUME_URL (set by the page that includes this) --
 * that endpoint asks the server where this player actually belongs right now
 * and bounces them there.
 */
(function () {
  var resumeUrl = window.SPIDEY_RESUME_URL || "/dashboard";

  // A sentinel history entry, so the first Back press has somewhere to land
  // that is still this page rather than the previous challenge.
  history.pushState(null, "", location.href);

  window.addEventListener("popstate", function () {
    history.pushState(null, "", location.href);
    // Re-resolve server-side instead of just staying put: if their run moved
    // on in another tab, this lands them on the right screen either way.
    window.location.replace(resumeUrl);
  });

  // Safari/Firefox can still restore a page from the back/forward cache even
  // with no-store; a restored page is by definition stale, so re-fetch it.
  window.addEventListener("pageshow", function (e) {
    if (e.persisted) window.location.reload();
  });
})();

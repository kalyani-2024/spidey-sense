"""Google sign-in for players and admins (shared flow, different intent)."""
from flask import Blueprint, redirect, url_for, session, request, flash

import models
import oauth
from admin_config import ADMIN_EMAILS

auth_bp = Blueprint("auth", __name__)


def _redirect_uri():
    # url_for(..., _external=True) respects X-Forwarded-Proto/Host, so this
    # comes out correct behind PythonAnywhere's reverse proxy too.
    return url_for("auth.google_callback", _external=True)


@auth_bp.route("/login/google")
def google_login():
    intent = "admin" if request.args.get("intent") == "admin" else "player"

    if not oauth.is_configured():
        flash("Google sign-in isn't configured yet -- see GOOGLE_LOGIN_SETUP.md.")
        return redirect(url_for("main.index"))

    state = oauth.new_state(intent)
    session["oauth_state"] = state
    return redirect(oauth.build_auth_url(_redirect_uri(), state))


@auth_bp.route("/login/google/callback")
def google_callback():
    error = request.args.get("error")
    if error:
        flash("Google sign-in was cancelled.")
        return redirect(url_for("main.index"))

    state = request.args.get("state")
    if not state or state != session.pop("oauth_state", None):
        flash("Sign-in session expired -- please try again.")
        return redirect(url_for("main.index"))

    intent = oauth.parse_state_intent(state)
    code = request.args.get("code")
    if not code or not intent:
        flash("Sign-in failed -- please try again.")
        return redirect(url_for("main.index"))

    try:
        access_token = oauth.exchange_code(code, _redirect_uri())
        userinfo = oauth.get_userinfo(access_token)
    except Exception:
        flash("Couldn't verify your Google account -- please try again.")
        return redirect(url_for("main.index"))

    email = userinfo["email"]
    if not email:
        flash("Your Google account didn't share an email address.")
        return redirect(url_for("main.index"))

    # An admin email is never a player, no matter which button they clicked
    # to sign in with -- this keeps admin accounts out of the QR-scan flow
    # even if someone uses the regular player "Sign in with Google" button.
    if email in ADMIN_EMAILS:
        session.pop("player_id", None)
        session["admin_email"] = email
        return redirect(url_for("admin.dashboard"))

    if intent == "admin":
        flash("That Google account isn't on the admin list.")
        return redirect(url_for("main.index"))

    session.pop("admin_email", None)
    player = models.get_or_create_player(email, userinfo["name"])
    session["player_id"] = player["player_id"]
    return redirect(url_for("main.dashboard"))


@auth_bp.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("main.index"))

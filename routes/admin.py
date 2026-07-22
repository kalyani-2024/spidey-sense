"""Admin dashboard -- times and rankings, visible only to allowlisted Gmail accounts."""
from flask import Blueprint, render_template, session, redirect, url_for

import models
from admin_config import ADMIN_EMAILS

admin_bp = Blueprint("admin", __name__)


def _is_admin():
    return session.get("admin_email") in ADMIN_EMAILS


@admin_bp.route("/admin")
def dashboard():
    if not _is_admin():
        return redirect(url_for("admin.login"))
    roster = models.admin_player_list()
    return render_template("admin/dashboard.html", roster=roster, admin_email=session.get("admin_email"))


@admin_bp.route("/admin/login")
def login():
    if _is_admin():
        return redirect(url_for("admin.dashboard"))
    return render_template("admin/login.html")


@admin_bp.route("/admin/logout")
def logout():
    session.pop("admin_email", None)
    return redirect(url_for("admin.login"))

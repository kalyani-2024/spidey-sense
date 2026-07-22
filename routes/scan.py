"""
In-app camera QR scanning for the two physical stall QR codes (start + the
final one). The scanning itself happens client-side (static/js/qr_scan.js,
via the phone's camera), but the decoded text is only ever trusted once the
server checks it against the real secret -- see mark_start_scan /
mark_finish_scan below.

While games_config.QR_SCAN_REQUIRED is False, these pages skip the camera
and secret check entirely (dev/testing mode) -- see that flag's comment.
"""
from flask import Blueprint, render_template, request, session, redirect, url_for, jsonify, flash

import models
from games_config import FINISH_STATE, START_QR_SECRET, FINISH_QR_SECRET, QR_SCAN_REQUIRED

scan_bp = Blueprint("scan", __name__)


def _current_player():
    player_id = session.get("player_id")
    if not player_id:
        return None
    return models.get_player(player_id)


@scan_bp.route("/scan/start")
def scan_start_page():
    player = _current_player()
    if not player:
        flash("Sign in with Google first.")
        return redirect(url_for("main.index"))
    if player["start_time"]:
        return redirect(url_for("main.dashboard"))
    return render_template("scan.html", mode="start", dev_mode=not QR_SCAN_REQUIRED,
                           eyebrow="STALL CHALLENGE",
                           heading="SCAN THE QR TO GET STARTED",
                           subcopy="Timer starts the instant you scan.",
                           submit_url=url_for("scan.mark_start_scan"))


@scan_bp.route("/scan/start", methods=["POST"])
def mark_start_scan():
    player = _current_player()
    if not player:
        return jsonify({"status": "error", "message": "Sign in first"}), 401

    if QR_SCAN_REQUIRED:
        code = (request.get_json(silent=True) or {}).get("code", "")
        if code != START_QR_SECRET:
            return jsonify({"status": "error", "message": "That's not the right QR code"}), 409

    models.begin_run(player["player_id"])
    return jsonify({"status": "ok", "redirect": url_for("main.dashboard")})


@scan_bp.route("/scan/finish")
def scan_finish_page():
    player = _current_player()
    if not player:
        flash("Sign in with Google first.")
        return redirect(url_for("main.index"))
    if player["current_game"] not in (FINISH_STATE, "done"):
        flash("Finish all 4 challenges before scanning the final QR!")
        return redirect(url_for("main.dashboard"))
    if player["current_game"] == "done":
        return redirect(url_for("main.results"))
    return render_template("scan.html", mode="finish", dev_mode=not QR_SCAN_REQUIRED,
                           eyebrow="FINAL STRETCH",
                           heading="RUSH BACK NOW",
                           subcopy="Fastest total time wins.",
                           submit_url=url_for("scan.mark_finish_scan"))


@scan_bp.route("/scan/finish", methods=["POST"])
def mark_finish_scan():
    player = _current_player()
    if not player:
        return jsonify({"status": "error", "message": "Sign in first"}), 401

    if player["current_game"] not in (FINISH_STATE, "done"):
        return jsonify({"status": "error", "message": "You haven't finished all challenges yet"}), 409

    if QR_SCAN_REQUIRED:
        code = (request.get_json(silent=True) or {}).get("code", "")
        if code != FINISH_QR_SECRET:
            return jsonify({"status": "error", "message": "That's not the right QR code"}), 409

    models.end_game(player["player_id"])
    return jsonify({"status": "ok", "redirect": url_for("main.results")})

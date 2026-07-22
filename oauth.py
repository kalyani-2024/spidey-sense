"""
Minimal Google OAuth2 (Authorization Code flow) helper -- no extra
dependencies beyond `requests`. See GOOGLE_LOGIN_SETUP.md for how to create
the Client ID/Secret this reads from the environment.
"""
import os
import secrets
import urllib.parse

import requests

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")


def is_configured():
    return bool(CLIENT_ID and CLIENT_SECRET)


def new_state(intent):
    """
    `intent` is 'player' or 'admin' -- packed into the OAuth `state` param
    (along with a CSRF nonce) so the callback knows which flow to resume
    without needing a second round trip.
    """
    nonce = secrets.token_urlsafe(16)
    return f"{intent}:{nonce}"


def parse_state_intent(state):
    if not state or ":" not in state:
        return None
    intent = state.split(":", 1)[0]
    return intent if intent in ("player", "admin") else None


def build_auth_url(redirect_uri, state):
    params = {
        "client_id": CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "prompt": "select_account",
    }
    return AUTH_URL + "?" + urllib.parse.urlencode(params)


def exchange_code(code, redirect_uri):
    resp = requests.post(TOKEN_URL, data={
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": redirect_uri,
    }, timeout=10)
    resp.raise_for_status()
    return resp.json()["access_token"]


def get_userinfo(access_token):
    resp = requests.get(
        USERINFO_URL,
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    return {"email": data.get("email"), "name": data.get("name") or data.get("email")}

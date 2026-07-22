"""SQLite connection helpers for Spidey Sense."""
import sqlite3
import os
from flask import g

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "spidey_sense.db")
SCHEMA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "schema.sql")

# Columns that must exist on `players`, added here as the schema evolved.
# init_db() adds any that are missing so a dev DB from an earlier version
# of this app doesn't need to be deleted by hand.
_REQUIRED_COLUMNS = {
    "google_email": "TEXT",
    "game_unlocks_at": "REAL",
    "game_token": "TEXT",
    "bonus_unlock_at": "REAL",
    "bonus_expires_at": "REAL",
    "bonus_completed": "INTEGER DEFAULT 0",
    "bonus_token": "TEXT",
}


def get_db():
    """Return a per-request SQLite connection (rows behave like dicts)."""
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


def close_db(e=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    """Create the table if missing, and migrate in any newer columns."""
    conn = sqlite3.connect(DB_PATH)
    with open(SCHEMA_PATH) as f:
        conn.executescript(f.read())

    existing = {row[1] for row in conn.execute("PRAGMA table_info(players)")}
    for column, col_type in _REQUIRED_COLUMNS.items():
        if column not in existing:
            conn.execute(f"ALTER TABLE players ADD COLUMN {column} {col_type}")

    conn.commit()
    conn.close()


def init_app(app):
    app.teardown_appcontext(close_db)

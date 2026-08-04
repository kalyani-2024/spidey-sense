-- Spidey Sense arcade game database schema

CREATE TABLE IF NOT EXISTS players (
    player_id         TEXT PRIMARY KEY,
    google_email      TEXT UNIQUE,  -- identity comes from Google login, not a typed name
    player_name       TEXT,
    start_time        REAL,   -- set only once the player scans the first stall QR
    end_time          REAL,
    current_game      TEXT,   -- NULL until the run begins (see start_time)
    completed_games   TEXT DEFAULT '',
    game_unlocks_at   REAL,   -- when current_game stops being a countdown and becomes playable
    game_token        TEXT,   -- one-time token the current game's page must echo back to complete it
    bonus_slot        TEXT,   -- which game's countdown hosts the bonus alert (see BONUS_SLOTS)
    bonus_unlock_at   REAL,   -- when the alert fires; NULL until the slot is reached
    bonus_expires_at  REAL,   -- alert deadline, then extended to the play deadline once opened
    bonus_started_at  REAL,   -- when the player tapped through to the bonus page
    bonus_completed   INTEGER DEFAULT 0,
    bonus_token       TEXT,   -- one-time token the bonus round's page must echo back to complete it
    created_at        REAL
);

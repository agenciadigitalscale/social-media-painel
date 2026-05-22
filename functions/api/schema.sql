CREATE TABLE IF NOT EXISTS items (
  id      INTEGER PRIMARY KEY,
  status  INTEGER NOT NULL DEFAULT 0,
  link    TEXT    NOT NULL DEFAULT '',
  caption TEXT    NOT NULL DEFAULT '',
  notes   TEXT    NOT NULL DEFAULT '',
  updated TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app_data (
  key     TEXT PRIMARY KEY,
  value   TEXT NOT NULL DEFAULT '{}',
  updated TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_passwords (
  role       TEXT    PRIMARY KEY,
  hash       TEXT    NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT 0
);

-- ── Instagram Scheduling ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ig_tokens (
  client_name  TEXT PRIMARY KEY,
  ig_user_id   TEXT NOT NULL,
  access_token TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  updated      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ig_scheduled (
  id           TEXT PRIMARY KEY,
  client_name  TEXT NOT NULL,
  item_id      INTEGER NOT NULL,
  scheduled_at TEXT NOT NULL,
  image_url    TEXT NOT NULL,
  caption      TEXT NOT NULL DEFAULT '',
  media_type   TEXT NOT NULL DEFAULT 'IMAGE',
  status       TEXT NOT NULL DEFAULT 'pending',   -- pending | published | failed | cancelled
  error        TEXT,
  published_at TEXT,
  created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

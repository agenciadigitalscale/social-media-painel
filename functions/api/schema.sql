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

-- ── Drive Monitor ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drive_folders (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  client_name     TEXT    NOT NULL UNIQUE,
  folder_id       TEXT    NOT NULL,
  is_active       INTEGER NOT NULL DEFAULT 1,
  last_scanned_at INTEGER,
  page_token      TEXT,
  created_at      INTEGER DEFAULT (unixepoch()),
  updated_at      INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS drive_videos (
  drive_file_id   TEXT    PRIMARY KEY,
  client_name     TEXT    NOT NULL,
  filename        TEXT    NOT NULL,
  file_size_bytes INTEGER,
  thumbnail_url   TEXT,
  detected_at     INTEGER DEFAULT (unixepoch()),
  linked_item_id  INTEGER,
  status          TEXT    NOT NULL DEFAULT 'inbox',
  approval_token  TEXT    UNIQUE,
  created_at      INTEGER DEFAULT (unixepoch()),
  updated_at      INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_dv_client ON drive_videos(client_name);
CREATE INDEX IF NOT EXISTS idx_dv_status  ON drive_videos(status);

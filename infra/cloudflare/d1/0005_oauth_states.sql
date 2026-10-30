PRAGMA foreign_keys = ON;

CREATE TABLE oauth_states (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  connector_key TEXT NOT NULL,
  return_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE INDEX idx_oauth_states_expires ON oauth_states(expires_at);

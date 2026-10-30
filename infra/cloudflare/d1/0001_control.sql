PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE orgs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan_slug TEXT NOT NULL DEFAULT 'starter',
  status TEXT NOT NULL DEFAULT 'pending',
  creem_customer_id TEXT,
  creem_subscription_id TEXT,
  period_start TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE memberships (
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner',
  PRIMARY KEY (org_id, user_id)
);

CREATE TABLE bots (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  system_prompt TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE bot_allowed_origins (
  bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  origin TEXT NOT NULL,
  PRIMARY KEY (bot_id, origin)
);

CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  bot_id TEXT REFERENCES bots(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('publishable', 'secret')),
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  label TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT
);

CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);

CREATE TABLE usage_counters (
  org_id TEXT PRIMARY KEY REFERENCES orgs(id) ON DELETE CASCADE,
  period_start TEXT NOT NULL,
  ai_credits_used INTEGER NOT NULL DEFAULT 0,
  messages_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  visitor_id TEXT,
  phase TEXT NOT NULL DEFAULT 'automated',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  r2_key TEXT,
  url TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE ingest_jobs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (org_id, idempotency_key)
);

CREATE TABLE idempotency_keys (
  key TEXT NOT NULL,
  org_id TEXT NOT NULL,
  response_hash TEXT,
  status_code INTEGER,
  body TEXT,
  expires_at TEXT NOT NULL,
  PRIMARY KEY (org_id, key)
);

CREATE TABLE pending_payments (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  creem_checkout_id TEXT NOT NULL UNIQUE,
  plan_slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id TEXT,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  meta_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE human_queue (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

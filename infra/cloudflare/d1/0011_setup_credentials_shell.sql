PRAGMA foreign_keys = ON;

-- Solicitudes de credenciales del Agente Setup (modal en panel, sin pegar en chat).
CREATE TABLE bot_setup_credential_requests (
  id TEXT PRIMARY KEY,
  bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT '',
  apply_kind TEXT NOT NULL CHECK (apply_kind IN ('connector', 'openapi', 'http_tool')),
  apply_json TEXT NOT NULL,
  fields_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'fulfilled', 'cancelled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  fulfilled_at TEXT
);

CREATE INDEX idx_setup_cred_bot_status ON bot_setup_credential_requests(bot_id, status);

-- Cola Enterprise (Business): trabajos shell/computer; worker dedicado puede consumirlos.
CREATE TABLE org_enterprise_shell_jobs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  bot_id TEXT REFERENCES bots(id) ON DELETE SET NULL,
  created_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'done', 'failed', 'cancelled')),
  summary TEXT NOT NULL,
  instructions_md TEXT NOT NULL DEFAULT '',
  result_text TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_shell_jobs_org ON org_enterprise_shell_jobs(org_id, status);

-- Ops: errores, turnos visitante (latencia/créditos), consultas desde panel ops.

CREATE TABLE ops_signal_events (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  severity TEXT NOT NULL CHECK (severity IN ('error', 'warn', 'info')),
  category TEXT NOT NULL,
  code TEXT NOT NULL,
  org_id TEXT REFERENCES orgs(id) ON DELETE SET NULL,
  bot_id TEXT,
  conversation_id TEXT,
  request_id TEXT,
  duration_ms INTEGER,
  credits INTEGER,
  summary TEXT NOT NULL DEFAULT '',
  detail_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_ops_signal_created ON ops_signal_events (created_at DESC);
CREATE INDEX idx_ops_signal_org_created ON ops_signal_events (org_id, created_at DESC);
CREATE INDEX idx_ops_signal_severity_created ON ops_signal_events (severity, created_at DESC);
CREATE INDEX idx_ops_signal_category_created ON ops_signal_events (category, created_at DESC);

CREATE TABLE ops_visitor_turns (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  bot_id TEXT,
  duration_ms INTEGER NOT NULL,
  credits_metered INTEGER NOT NULL,
  llm_rounds INTEGER NOT NULL DEFAULT 1,
  degraded INTEGER NOT NULL DEFAULT 0,
  error_code TEXT
);

CREATE INDEX idx_ops_turns_created ON ops_visitor_turns (created_at DESC);
CREATE INDEX idx_ops_turns_org_created ON ops_visitor_turns (org_id, created_at DESC);

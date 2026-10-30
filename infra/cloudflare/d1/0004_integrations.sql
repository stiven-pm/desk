PRAGMA foreign_keys = ON;

CREATE TABLE bot_openapi_configs (
  id TEXT PRIMARY KEY,
  bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  base_url TEXT NOT NULL,
  spec_json TEXT NOT NULL,
  auth_type TEXT NOT NULL DEFAULT 'none' CHECK (auth_type IN ('none', 'bearer', 'header')),
  auth_header_name TEXT,
  auth_secret_enc TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_bot_openapi_bot ON bot_openapi_configs(bot_id);

CREATE TABLE bot_http_tools (
  id TEXT PRIMARY KEY,
  bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  method TEXT NOT NULL DEFAULT 'GET',
  path TEXT NOT NULL,
  base_url TEXT NOT NULL DEFAULT '',
  auth_type TEXT NOT NULL DEFAULT 'none',
  auth_header_name TEXT,
  auth_secret_enc TEXT,
  parameters_json TEXT NOT NULL DEFAULT '[]',
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'openapi')),
  openapi_config_id TEXT REFERENCES bot_openapi_configs(id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (bot_id, name)
);

CREATE INDEX idx_bot_http_tools_bot ON bot_http_tools(bot_id);

CREATE TABLE bot_mcp_servers (
  id TEXT PRIMARY KEY,
  bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  server_url TEXT NOT NULL,
  headers_enc TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (bot_id, name)
);

CREATE TABLE bot_connectors (
  id TEXT PRIMARY KEY,
  bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  connector_key TEXT NOT NULL,
  config_enc TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'idle',
  last_error TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (bot_id, connector_key)
);

CREATE TABLE org_event_webhooks (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret_enc TEXT,
  events_json TEXT NOT NULL DEFAULT '["conversation.handoff"]',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_org_webhooks_org ON org_event_webhooks(org_id);

PRAGMA foreign_keys = ON;

CREATE TABLE bot_mcp_tool_catalog (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL REFERENCES bot_mcp_servers(id) ON DELETE CASCADE,
  bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  description_short TEXT NOT NULL DEFAULT '',
  input_schema_json TEXT NOT NULL DEFAULT '{}',
  synced_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (server_id, tool_name)
);

CREATE INDEX idx_mcp_catalog_bot ON bot_mcp_tool_catalog(bot_id);
CREATE INDEX idx_mcp_catalog_server ON bot_mcp_tool_catalog(server_id);

CREATE TABLE bot_setup_sessions (
  bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  rolling_summary TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (bot_id, user_id)
);

CREATE TABLE setup_agent_audit (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  bot_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_setup_audit_bot ON setup_agent_audit(bot_id, created_at);

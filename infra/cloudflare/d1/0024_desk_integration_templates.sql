CREATE TABLE IF NOT EXISTS integration_definitions (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('payment', 'commerce', 'api', 'other')),
  description TEXT,
  fields_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS org_integration_instances (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  definition_id TEXT NOT NULL REFERENCES integration_definitions(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'connected', 'error')),
  values_enc TEXT,
  last_error TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (org_id, definition_id)
);

CREATE INDEX IF NOT EXISTS idx_org_integration_instances_org
  ON org_integration_instances(org_id);

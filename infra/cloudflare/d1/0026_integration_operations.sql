ALTER TABLE integration_definitions ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE integration_definitions ADD COLUMN connector_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE integration_definitions ADD COLUMN payment_profile_json TEXT;
ALTER TABLE integration_definitions ADD COLUMN test_operation_id TEXT;

ALTER TABLE org_integration_instances ADD COLUMN pinned_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE org_integration_instances ADD COLUMN operation_overrides_json TEXT;

CREATE TABLE IF NOT EXISTS integration_operations (
  id TEXT PRIMARY KEY,
  definition_id TEXT NOT NULL REFERENCES integration_definitions(id) ON DELETE CASCADE,
  definition_version INTEGER NOT NULL DEFAULT 1,
  capability TEXT NOT NULL,
  slug TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'GET',
  path_template TEXT NOT NULL,
  body_template TEXT,
  query_template_json TEXT NOT NULL DEFAULT '{}',
  response_map_json TEXT NOT NULL DEFAULT '{}',
  expose_to_ai INTEGER NOT NULL DEFAULT 0,
  side_effect TEXT NOT NULL DEFAULT 'read' CHECK (side_effect IN ('read', 'write')),
  test_args_json TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (definition_id, definition_version, slug)
);

CREATE INDEX IF NOT EXISTS idx_integration_operations_def
  ON integration_operations(definition_id, definition_version);

CREATE TABLE IF NOT EXISTS integration_logs (
  id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL REFERENCES org_integration_instances(id) ON DELETE CASCADE,
  capability TEXT NOT NULL,
  status_code INTEGER,
  ok INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  error_code TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_integration_logs_instance
  ON integration_logs(instance_id, created_at);

CREATE TABLE IF NOT EXISTS org_payment_providers (
  org_id TEXT PRIMARY KEY REFERENCES orgs(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('wompi', 'bold', 'mercadopago')),
  status TEXT NOT NULL DEFAULT 'pending_setup'
    CHECK (status IN ('pending_setup', 'active', 'error')),
  credentials_enc TEXT,
  last_verified_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_org_payment_providers_status
  ON org_payment_providers(status);

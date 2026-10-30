PRAGMA foreign_keys = OFF;

CREATE TABLE org_payment_providers_new (
  org_id TEXT PRIMARY KEY REFERENCES orgs(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('wompi', 'bold', 'mercadopago', 'generic')),
  status TEXT NOT NULL DEFAULT 'pending_setup'
    CHECK (status IN ('pending_setup', 'active', 'error')),
  credentials_enc TEXT,
  last_verified_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO org_payment_providers_new
SELECT * FROM org_payment_providers;

DROP TABLE org_payment_providers;

ALTER TABLE org_payment_providers_new RENAME TO org_payment_providers;

CREATE INDEX IF NOT EXISTS idx_org_payment_providers_status
  ON org_payment_providers(status);

PRAGMA foreign_keys = ON;

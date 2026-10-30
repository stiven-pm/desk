ALTER TABLE org_commerce_config ADD COLUMN payment_webhook_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_commerce_webhook_token
  ON org_commerce_config(payment_webhook_token)
  WHERE payment_webhook_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS commerce_payment_webhook_events (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  external_event_id TEXT NOT NULL,
  order_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(org_id, provider, external_event_id)
);

CREATE INDEX IF NOT EXISTS idx_commerce_payment_webhook_events_org
  ON commerce_payment_webhook_events(org_id, created_at DESC);

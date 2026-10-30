PRAGMA foreign_keys = ON;

ALTER TABLE usage_counters ADD COLUMN setup_credits_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE usage_counters ADD COLUMN rag_meter_credits INTEGER NOT NULL DEFAULT 0;

CREATE TABLE org_wallets (
  org_id TEXT PRIMARY KEY REFERENCES orgs(id) ON DELETE CASCADE,
  balance_credits INTEGER NOT NULL DEFAULT 0,
  lifetime_purchased_credits INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE wallet_ledger (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  delta_credits INTEGER NOT NULL,
  kind TEXT NOT NULL,
  usd_cents INTEGER,
  meta_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_wallet_ledger_org ON wallet_ledger(org_id, created_at);

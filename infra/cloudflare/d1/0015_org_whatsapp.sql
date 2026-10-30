PRAGMA foreign_keys = ON;

CREATE TABLE org_whatsapp_accounts (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  waba_id TEXT NOT NULL,
  phone_number_id TEXT NOT NULL,
  display_phone_number TEXT,
  access_token_enc TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'error')),
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (org_id, bot_id),
  UNIQUE (phone_number_id)
);

CREATE INDEX idx_org_whatsapp_org ON org_whatsapp_accounts(org_id);

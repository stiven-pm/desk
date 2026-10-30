PRAGMA foreign_keys = ON;

ALTER TABLE org_whatsapp_accounts
  ADD COLUMN provider TEXT NOT NULL DEFAULT 'meta'
  CHECK (provider IN ('meta', 'wasapflow'));

PRAGMA foreign_keys = ON;

ALTER TABLE org_whatsapp_accounts ADD COLUMN channel_mode TEXT NOT NULL DEFAULT 'ai_on_whatsapp'
  CHECK (channel_mode IN ('ai_on_whatsapp', 'redirect_web'));

ALTER TABLE org_whatsapp_accounts ADD COLUMN redirect_message TEXT;

ALTER TABLE org_whatsapp_accounts ADD COLUMN welcome_message TEXT;

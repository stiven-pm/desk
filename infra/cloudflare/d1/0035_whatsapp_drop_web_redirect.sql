-- WhatsApp-only: remove web redirect mode columns.
UPDATE org_whatsapp_accounts SET channel_mode = 'ai_on_whatsapp' WHERE channel_mode = 'redirect_web';

ALTER TABLE org_whatsapp_accounts DROP COLUMN redirect_message;
ALTER TABLE org_whatsapp_accounts DROP COLUMN channel_mode;

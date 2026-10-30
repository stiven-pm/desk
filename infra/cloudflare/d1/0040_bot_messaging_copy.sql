ALTER TABLE bots ADD COLUMN welcome_message TEXT;
ALTER TABLE bots ADD COLUMN closing_message TEXT;
ALTER TABLE bots ADD COLUMN idle_reply_message TEXT;

UPDATE bots
SET
  welcome_message = COALESCE(
    welcome_message,
    (SELECT w.welcome_message FROM org_whatsapp_accounts w WHERE w.bot_id = bots.id LIMIT 1)
  ),
  closing_message = COALESCE(
    closing_message,
    (SELECT w.closing_message FROM org_whatsapp_accounts w WHERE w.bot_id = bots.id LIMIT 1)
  ),
  idle_reply_message = COALESCE(
    idle_reply_message,
    (SELECT w.idle_reply_message FROM org_whatsapp_accounts w WHERE w.bot_id = bots.id LIMIT 1)
  );

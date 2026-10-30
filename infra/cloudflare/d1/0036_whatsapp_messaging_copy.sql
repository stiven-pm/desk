-- Mensajes de sesión (texto libre en ventana 24h; no son plantillas Meta).
ALTER TABLE org_whatsapp_accounts ADD COLUMN closing_message TEXT;
ALTER TABLE org_whatsapp_accounts ADD COLUMN idle_reply_message TEXT;

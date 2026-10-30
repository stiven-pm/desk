-- Remove legacy WhatsApp integration tables (product is web-only).
DROP TABLE IF EXISTS whatsapp_inbound_dedup;
DROP TABLE IF EXISTS org_whatsapp_accounts;

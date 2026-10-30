-- Allowlist opcional de claves en payload de commerce.intent (JSON array de strings).
ALTER TABLE orgs ADD COLUMN commerce_payload_keys_json TEXT;

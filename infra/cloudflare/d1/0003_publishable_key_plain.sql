-- Publishable API keys are public by design; store plaintext for embed + hosted chat.
ALTER TABLE api_keys ADD COLUMN token_plain TEXT;

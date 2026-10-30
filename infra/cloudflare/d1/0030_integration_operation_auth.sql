-- Auth per operation (declarative); connector auth is default via inherit.
ALTER TABLE integration_operations ADD COLUMN auth_mode TEXT NOT NULL DEFAULT 'inherit';
ALTER TABLE integration_operations ADD COLUMN auth_field_key TEXT;

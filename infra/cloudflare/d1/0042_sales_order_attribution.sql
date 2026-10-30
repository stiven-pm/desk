ALTER TABLE sales_orders ADD COLUMN source_channel TEXT NOT NULL DEFAULT 'web';
ALTER TABLE sales_orders ADD COLUMN linked_store_conversation_id TEXT;
ALTER TABLE sales_orders ADD COLUMN cart_fingerprint TEXT;

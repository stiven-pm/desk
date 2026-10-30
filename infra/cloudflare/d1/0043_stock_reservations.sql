CREATE TABLE IF NOT EXISTS stock_reservations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_stock_reservations_lookup
  ON stock_reservations (org_id, product_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_stock_reservations_conversation
  ON stock_reservations (org_id, conversation_id);

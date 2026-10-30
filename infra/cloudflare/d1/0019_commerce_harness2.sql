CREATE TABLE IF NOT EXISTS sales_orders (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_fulfillment',
  buyer_type TEXT,
  buyer_json TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  lines_json TEXT NOT NULL,
  summary TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sales_orders_org ON sales_orders(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_orders_conv ON sales_orders(conversation_id);

CREATE TABLE IF NOT EXISTS payment_attempts (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  order_id TEXT REFERENCES sales_orders(id) ON DELETE SET NULL,
  conversation_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  checkout_url TEXT,
  provider TEXT,
  external_ref TEXT,
  return_payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payment_attempts_conv ON payment_attempts(conversation_id);

CREATE TABLE IF NOT EXISTS org_commerce_config (
  org_id TEXT PRIMARY KEY REFERENCES orgs(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'order_only',
  manifest_json TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS commerce_events (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  bot_id TEXT,
  conversation_id TEXT,
  name TEXT NOT NULL,
  meta_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_commerce_events_org ON commerce_events(org_id, created_at DESC);

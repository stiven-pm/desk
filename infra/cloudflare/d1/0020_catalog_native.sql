CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'COP',
  image_url TEXT,
  stock_qty INTEGER,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_products_org_status ON products(org_id, status);

CREATE TABLE IF NOT EXISTS product_variants (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  name TEXT,
  price_cents INTEGER,
  stock_qty INTEGER,
  attributes_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (org_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id);

CREATE TABLE IF NOT EXISTS catalog_import_drafts (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  bot_id TEXT REFERENCES bots(id) ON DELETE SET NULL,
  source_id TEXT,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_review',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_catalog_import_drafts_org ON catalog_import_drafts(org_id, created_at DESC);

ALTER TABLE sales_orders ADD COLUMN public_ref TEXT;
ALTER TABLE sales_orders ADD COLUMN payment_evidence_r2_key TEXT;
ALTER TABLE sales_orders ADD COLUMN payment_evidence_meta_json TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_orders_public_ref ON sales_orders(public_ref) WHERE public_ref IS NOT NULL;

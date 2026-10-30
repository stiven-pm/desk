ALTER TABLE products ADD COLUMN category TEXT;
ALTER TABLE products ADD COLUMN featured INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_products_org_category
  ON products(org_id, status, category)
  WHERE category IS NOT NULL AND trim(category) != '';

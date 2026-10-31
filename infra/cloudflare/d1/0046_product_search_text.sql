ALTER TABLE products ADD COLUMN search_text TEXT NOT NULL DEFAULT '';

-- Índice de listado publicado (browse); LIKE %token% no usa índice pero acota por org/status.
CREATE INDEX IF NOT EXISTS idx_products_org_status_featured
  ON products(org_id, status, featured DESC, updated_at DESC);

-- Backfill de search_text: ejecutar una vez tras aplicar migración:
--   npx tsx scripts/backfill-product-search-text.ts --local
--   npx tsx scripts/backfill-product-search-text.ts --remote

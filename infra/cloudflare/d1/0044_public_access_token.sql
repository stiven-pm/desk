ALTER TABLE sales_orders ADD COLUMN public_access_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_orders_public_access_token
  ON sales_orders(public_access_token)
  WHERE public_access_token IS NOT NULL;

UPDATE sales_orders
SET public_access_token = lower(hex(randomblob(16)))
WHERE public_access_token IS NULL;

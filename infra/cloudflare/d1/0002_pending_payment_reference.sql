-- Creem correlates checkouts via request_id (see flatbase creem.ts).
ALTER TABLE pending_payments ADD COLUMN reference TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_payments_reference ON pending_payments(reference);

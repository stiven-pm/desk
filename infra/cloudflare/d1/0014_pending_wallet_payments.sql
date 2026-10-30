PRAGMA foreign_keys = ON;

ALTER TABLE pending_payments ADD COLUMN payment_kind TEXT NOT NULL DEFAULT 'subscription';
ALTER TABLE pending_payments ADD COLUMN wallet_pack TEXT;

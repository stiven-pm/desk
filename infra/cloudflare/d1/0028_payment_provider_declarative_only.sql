-- Pago solo por plantilla Ops (provider declarative).
DELETE FROM org_payment_providers WHERE provider != 'declarative';

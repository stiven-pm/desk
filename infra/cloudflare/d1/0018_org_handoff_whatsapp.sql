PRAGMA foreign_keys = ON;

-- Número WhatsApp del negocio (dueño Desk) para escalado humano; no es dato del visitante.
ALTER TABLE orgs ADD COLUMN handoff_dial_code TEXT;
ALTER TABLE orgs ADD COLUMN handoff_phone TEXT;

PRAGMA foreign_keys = ON;

ALTER TABLE conversations ADD COLUMN visitor_dial_code TEXT;
ALTER TABLE conversations ADD COLUMN visitor_phone TEXT;

ALTER TABLE human_queue ADD COLUMN summary TEXT;

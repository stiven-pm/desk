ALTER TABLE orgs ADD COLUMN deletion_scheduled_at TEXT;

ALTER TABLE users ADD COLUMN pending_email TEXT;

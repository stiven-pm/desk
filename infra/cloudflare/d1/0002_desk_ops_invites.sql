CREATE TABLE platform_admins (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE member_invites (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'agent', 'developer', 'viewer')),
  token_hash TEXT NOT NULL UNIQUE,
  invited_by_user_id TEXT REFERENCES users(id),
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_member_invites_email ON member_invites(email);
CREATE INDEX idx_member_invites_org ON member_invites(org_id);

ALTER TABLE sources ADD COLUMN title TEXT;
ALTER TABLE sources ADD COLUMN description TEXT;
ALTER TABLE sources ADD COLUMN document_filename TEXT;

UPDATE sources SET title = name WHERE title IS NULL;

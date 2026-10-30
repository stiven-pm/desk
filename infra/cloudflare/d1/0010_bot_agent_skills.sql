PRAGMA foreign_keys = ON;

-- Procedimientos aprendidos / definidos por el agente Setup (estilo Skill Workshop).
CREATE TABLE bot_skills (
  id TEXT PRIMARY KEY,
  bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  body_md TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (bot_id, slug)
);

CREATE INDEX idx_bot_skills_bot_status ON bot_skills(bot_id, status);

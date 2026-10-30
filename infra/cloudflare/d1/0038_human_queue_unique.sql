PRAGMA foreign_keys = ON;

-- Una fila por conversación (antes cada handoff creaba otro id).
DELETE FROM human_queue
WHERE rowid NOT IN (
  SELECT MIN(rowid) FROM human_queue GROUP BY org_id, conversation_id
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_human_queue_org_conversation
  ON human_queue(org_id, conversation_id);

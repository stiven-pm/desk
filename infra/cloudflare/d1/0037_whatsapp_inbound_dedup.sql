-- Evita procesar dos veces el mismo message_id de Meta/WasapFlow.
CREATE TABLE IF NOT EXISTS wa_inbound_dedup (
  message_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Una conversación activa por visitante (evita carreras al crear hilos en ráfaga).
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_active_visitor
  ON conversations(org_id, bot_id, visitor_id)
  WHERE phase != 'closed' AND visitor_id IS NOT NULL;

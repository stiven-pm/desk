"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { actionErrorLines } from "@/lib/api-error";

type InboxItem = {
  id: string;
  conversation_id: string;
  status: string;
  created_at: string;
  summary: string | null;
  phase: string;
  visitor_id: string | null;
  display_contact?: string;
};

type ThreadMessage = { role: string; text: string };

export function DeskInboxPanel() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [phase, setPhase] = useState<string>("");
  const [contactLabel, setContactLabel] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInbox = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ items: InboxItem[] }>("/v1/admin/inbox");
      setItems(res.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadThread = useCallback(async (conversationId: string) => {
    setError(null);
    try {
      const res = await api<{
        conversation: {
          customerPhone: string | null;
          displayContact?: string;
          phase: string;
        };
        phase: string;
        messages: ThreadMessage[];
      }>(`/v1/admin/inbox/${encodeURIComponent(conversationId)}`);
      setMessages(res.messages ?? []);
      setPhase(res.phase ?? res.conversation?.phase ?? "");
      setContactLabel(
        res.conversation?.displayContact ??
          res.conversation?.customerPhone ??
          null,
      );
    } catch (e) {
      setError(actionErrorLines(e).message);
      setMessages([]);
    }
  }, []);

  useEffect(() => {
    void loadInbox();
    const t = window.setInterval(() => void loadInbox(), 30_000);
    return () => window.clearInterval(t);
  }, [loadInbox]);

  useEffect(() => {
    if (!selectedId) return;
    void loadThread(selectedId);
    const t = window.setInterval(() => void loadThread(selectedId), 12_000);
    return () => window.clearInterval(t);
  }, [selectedId, loadThread]);

  async function dismissWithoutReply() {
    if (!selectedId) return;
    setDismissing(true);
    setError(null);
    try {
      await api(`/v1/admin/inbox/${encodeURIComponent(selectedId)}/dismiss`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setSelectedId(null);
      setMessages([]);
      await loadInbox();
    } catch (e) {
      setError(actionErrorLines(e).message);
    } finally {
      setDismissing(false);
    }
  }

  async function sendReply() {
    if (!selectedId || !reply.trim()) return;
    setSending(true);
    setError(null);
    try {
      await api(`/v1/admin/inbox/${encodeURIComponent(selectedId)}/reply`, {
        method: "POST",
        body: JSON.stringify({ text: reply.trim() }),
      });
      setReply("");
      await loadThread(selectedId);
      await loadInbox();
    } catch (e) {
      setError(actionErrorLines(e).message);
    } finally {
      setSending(false);
    }
  }

  function listLabel(
    item: Pick<InboxItem, "display_contact" | "visitor_id" | "conversation_id">,
  ): string {
    if (item.display_contact?.trim()) return item.display_contact;
    if (item.visitor_id?.startsWith("wa:")) return `+${item.visitor_id.slice(3)}`;
    return `Chat ${item.conversation_id.slice(0, 8)}`;
  }

  function phaseLabel(raw: string): string {
    if (raw === "needs_human") return "Pendiente";
    if (raw === "human_active") return "En curso";
    return raw;
  }

  function inboxPreview(summary: string | null): string {
    if (!summary?.trim()) return "Pidió un asesor";
    const short = summary.replace(/\s+/g, " ").trim();
    return short.length > 72 ? `${short.slice(0, 69)}…` : short;
  }

  const visibleItems = items.filter(
    (item, index, all) =>
      all.findIndex((x) => x.conversation_id === item.conversation_id) === index,
  );

  return (
    <section className="flex min-h-[min(720px,calc(100vh-8rem))] flex-1 flex-col rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)]">
      <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(220px,320px)_1fr]">
        <div className="min-h-[10rem] overflow-y-auto border-b border-[var(--border)] md:max-h-none md:border-b-0 md:border-r">
          {loading ? (
            <p className="p-3 text-xs text-[var(--muted)]">Cargando…</p>
          ) : visibleItems.length === 0 ? (
            <p className="p-3 text-sm text-[var(--muted)]">Nadie esperando asesor.</p>
          ) : (
            <ul>
              {visibleItems.map((item) => {
                const active = selectedId === item.conversation_id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(item.conversation_id)}
                      className={[
                        "w-full px-3 py-2.5 text-left text-xs border-b border-[var(--border)] last:border-0",
                        active ? "bg-[var(--muted-bg)]" : "hover:bg-[var(--muted-bg)]/60",
                      ].join(" ")}
                    >
                      <span className="font-medium block truncate">
                        {listLabel(item)}
                      </span>
                      <span className="text-[var(--muted)] line-clamp-1">
                        {inboxPreview(item.summary)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex min-h-0 flex-col p-4">
          {!selectedId ? (
            <p className="flex flex-1 items-center justify-center text-sm text-[var(--muted)]">
              Elige un chat.
            </p>
          ) : (
            <>
              <p className="mb-2 shrink-0 text-sm text-[var(--muted)]">
                {contactLabel ||
                  (selectedId
                    ? listLabel(
                        visibleItems.find((i) => i.conversation_id === selectedId) ?? {
                          conversation_id: selectedId,
                          visitor_id: null,
                        },
                      )
                    : "")}
                {phase ? ` · ${phaseLabel(phase)}` : ""}
              </p>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--muted-bg)]/30 p-3 text-sm">
                {messages.length === 0 ? (
                  <p className="text-[var(--muted)]">Sin mensajes cargados.</p>
                ) : (
                  messages.map((m, i) => (
                    <div
                      key={i}
                      className={
                        m.role === "user"
                          ? "ml-auto max-w-[90%] rounded-md bg-[var(--card)] px-2 py-1 border border-[var(--border)]"
                          : "mr-auto max-w-[90%] rounded-md px-2 py-1 bg-[var(--card)]"
                      }
                    >
                      <span className="text-[10px] text-[var(--muted)] uppercase">
                        {m.role === "user"
                          ? "Visitante"
                          : m.role === "human"
                            ? "Tú"
                            : "IA"}
                      </span>
                      <p className="whitespace-pre-wrap">{m.text}</p>
                    </div>
                  ))
                )}
              </div>
              {error ? (
                <p className="mt-2 text-xs text-red-600">{error}</p>
              ) : null}
              <div className="mt-3 flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  disabled={dismissing || sending}
                  onClick={() => void dismissWithoutReply()}
                  className="shrink-0 rounded-md border border-[var(--border)] px-2 py-1.5 text-xs text-[var(--muted)] hover:bg-[var(--muted-bg)] disabled:opacity-50"
                >
                  Cerrar
                </button>
                <input
                  type="text"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Escribe al cliente…"
                  className="min-w-0 flex-1 rounded-md border border-[var(--border)] px-2 py-1.5 text-sm"
                  disabled={sending}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendReply();
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={sending || !reply.trim()}
                  onClick={() => void sendReply()}
                  className="shrink-0 rounded-md bg-[var(--foreground)] px-3 py-1.5 text-xs font-medium text-[var(--background)] disabled:opacity-50"
                >
                  Enviar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

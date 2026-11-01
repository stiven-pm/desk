"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { actionErrorLines } from "@/lib/api-error";
import { InboxThreadBubble } from "@/components/inbox-chat-message";

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
    return `Visitante ${item.conversation_id.slice(0, 8)}`;
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

  const headerTitle =
    contactLabel ||
    (selectedId
      ? listLabel(
          visibleItems.find((i) => i.conversation_id === selectedId) ?? {
            conversation_id: selectedId,
            visitor_id: null,
          },
        )
      : "");

  return (
    <section className="flex h-[min(720px,calc(100vh-8rem))] min-h-[480px] flex-1 flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white">
      <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(220px,300px)_1fr]">
        <aside className="flex min-h-0 flex-col border-b border-[var(--border)] md:border-b-0 md:border-r">
          <div className="shrink-0 border-b border-[var(--border)] px-3 py-2.5 text-sm font-semibold text-[#2f3941]">
            Bandeja
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
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
                          "w-full border-b border-[var(--border)] px-3 py-2.5 text-left text-xs last:border-0",
                          active ? "bg-[#edf0f2]" : "hover:bg-[#f8f9f9]",
                        ].join(" ")}
                      >
                        <span className="block truncate font-medium">
                          {listLabel(item)}
                        </span>
                        <span className="line-clamp-1 text-[var(--muted)]">
                          {inboxPreview(item.summary)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        <div className="flex min-h-0 flex-col bg-white">
          {!selectedId ? (
            <p className="flex flex-1 items-center justify-center text-sm text-[var(--muted)]">
              Elige un chat.
            </p>
          ) : (
            <>
              <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[#d8dcde] bg-white px-4 py-3">
                <h2 className="min-w-0 truncate text-base font-semibold text-[#2f3941]">
                  {headerTitle}
                </h2>
                {phase ? (
                  <span className="shrink-0 text-xs text-[#68737d]">
                    {phaseLabel(phase)}
                  </span>
                ) : null}
              </header>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-white p-4">
                {messages.length === 0 ? (
                  <p className="text-sm text-[#68737d]">Sin mensajes cargados.</p>
                ) : (
                  messages.map((m, i) => (
                    <InboxThreadBubble key={i} role={m.role} text={m.text} />
                  ))
                )}
              </div>

              <footer className="shrink-0 border-t border-[#d8dcde] bg-white p-3">
                {error ? (
                  <p className="mb-2 text-xs text-red-600">{error}</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={dismissing || sending}
                    onClick={() => void dismissWithoutReply()}
                    className="shrink-0 rounded-md border border-[#d8dcde] px-2.5 py-2 text-xs text-[#68737d] hover:bg-[#f8f9f9] disabled:opacity-50"
                  >
                    Cerrar
                  </button>
                  <input
                    type="text"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Escribe al cliente…"
                    className="min-w-0 flex-1 rounded-md border border-[#d8dcde] px-3 py-2 text-sm"
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
                    className="shrink-0 rounded-md bg-[#2f3941] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    Enviar
                  </button>
                </div>
              </footer>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

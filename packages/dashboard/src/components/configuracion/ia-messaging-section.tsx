"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { fetchPrimaryBot } from "@/lib/primary-bot";
import { actionErrorLines } from "@/lib/api-error";

export function ConfiguracionIaMessagingSection() {
  const [botId, setBotId] = useState<string | null>(null);
  const [welcome, setWelcome] = useState("");
  const [closing, setClosing] = useState("");
  const [idleReply, setIdleReply] = useState("");
  const [savingCopy, setSavingCopy] = useState(false);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [copyErr, setCopyErr] = useState<string | null>(null);

  const loadMessaging = useCallback(async (id: string) => {
    const res = await api<{
      bot: {
        welcomeMessage?: string | null;
        closingMessage?: string | null;
        idleReplyMessage?: string | null;
      };
    }>(`/v1/admin/bots/${encodeURIComponent(id)}`);
    setWelcome(res.bot.welcomeMessage ?? "");
    setClosing(res.bot.closingMessage ?? "");
    setIdleReply(res.bot.idleReplyMessage ?? "");
  }, []);

  useEffect(() => {
    void fetchPrimaryBot().then((b) => {
      setBotId(b?.id ?? null);
      if (b?.id) void loadMessaging(b.id);
    });
  }, [loadMessaging]);

  async function saveMessagingCopy() {
    if (!botId) return;
    setSavingCopy(true);
    setCopyErr(null);
    setCopyMsg(null);
    try {
      await api(`/v1/admin/bots/${encodeURIComponent(botId)}`, {
        method: "PATCH",
        body: JSON.stringify({
          welcomeMessage: welcome.trim() || null,
          closingMessage: closing.trim() || null,
          idleReplyMessage: idleReply.trim() || null,
        }),
      });
      setCopyMsg("Guardado.");
    } catch (e) {
      setCopyErr(actionErrorLines(e).message);
    } finally {
      setSavingCopy(false);
    }
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-5">
      <h2 className="text-sm font-semibold">Mensajes automáticos</h2>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Saludo, cierre e inactividad en el chat web.
      </p>
      <div className="mt-4 space-y-3">
        <label className="block text-xs">
          Saludo
          <textarea
            className="mt-1 w-full rounded-md border border-[var(--border)] px-2 py-1.5 text-sm"
            rows={2}
            value={welcome}
            onChange={(e) => setWelcome(e.target.value)}
            placeholder="¡Hola! ¿En qué te ayudo?"
            disabled={!botId}
          />
        </label>
        <label className="block text-xs">
          Despedida
          <textarea
            className="mt-1 w-full rounded-md border border-[var(--border)] px-2 py-1.5 text-sm"
            rows={2}
            value={closing}
            onChange={(e) => setClosing(e.target.value)}
            placeholder="Gracias por escribirnos."
            disabled={!botId}
          />
        </label>
        <label className="block text-xs">
          Si no responden
          <textarea
            className="mt-1 w-full rounded-md border border-[var(--border)] px-2 py-1.5 text-sm"
            rows={2}
            value={idleReply}
            onChange={(e) => setIdleReply(e.target.value)}
            placeholder="¿Sigues ahí?"
            disabled={!botId}
          />
        </label>
        {copyErr && <p className="text-xs text-red-600">{copyErr}</p>}
        {copyMsg && <p className="text-xs text-green-700">{copyMsg}</p>}
        <button
          type="button"
          disabled={!botId || savingCopy}
          onClick={() => void saveMessagingCopy()}
          className="rounded-md bg-[var(--primary)] px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
        >
          {savingCopy ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </section>
  );
}

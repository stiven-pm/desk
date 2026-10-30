"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type BotDetail = {
  bot: {
    id: string;
    name: string;
    model: string;
    systemPrompt: string;
  };
};

export default function BotSettingsPage() {
  const params = useParams();
  const botId = String(params.botId ?? "");
  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login";
      return;
    }
    api<BotDetail>(`/v1/admin/bots/${botId}`, { token })
      .then((d) => {
        setName(d.bot.name);
        setSystemPrompt(d.bot.systemPrompt);
      })
      .catch(() => {
        window.location.href = "/dashboard";
      });
  }, [botId]);

  async function save() {
    const token = localStorage.getItem("token");
    if (!token) return;
    setError(null);
    setSaved(false);
    try {
      await api(`/v1/admin/bots/${botId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ name, systemPrompt }),
      });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/dashboard" className="text-sm text-[var(--primary)]">
        ← Resumen
      </Link>
      <h1 className="mt-4 text-xl font-semibold">Configurar asistente</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Personalidad e instrucciones para el chat web y la tienda. URLs y mensajes automáticos en{" "}
        <Link
          href="/dashboard/configuracion?tab=web"
          className="underline underline-offset-2"
        >
          Configuración · Web
        </Link>
        .
      </p>

      <section className="mt-8 space-y-4 rounded-xl border border-[var(--border)] p-6 text-sm">
        <label className="block">
          Nombre
          <input
            className="mt-1 w-full rounded-md border px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block">
          Instrucciones (actitud, idioma, límites)
          <textarea
            className="mt-1 min-h-[160px] w-full rounded-md border px-3 py-2 font-mono text-xs"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="Nombre/persona, tono (cercano/pro), qué vendes, qué no prometes, cuándo pasar a humano…"
          />
        </label>
        {error && <p className="text-red-600">{error}</p>}
        {saved && <p className="text-green-700">Guardado.</p>}
        <button
          type="button"
          onClick={() => void save()}
          className="rounded-md bg-[var(--primary)] px-4 py-2 text-[var(--primary-foreground)]"
        >
          Guardar
        </button>
      </section>
    </main>
  );
}

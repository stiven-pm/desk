"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

type HttpTool = {
  id: string;
  name: string;
  base_url: string | null;
  enabled: number;
};

export function SimpleConnectionsPanel({ botId }: { botId: string | null }) {
  const [label, setLabel] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [tools, setTools] = useState<HttpTool[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!botId) return;
    const s = await api<{ httpTools: HttpTool[] }>(
      `/v1/admin/integrations/summary?botId=${encodeURIComponent(botId)}`,
    );
    setTools(s.httpTools ?? []);
  }, [botId]);

  useEffect(() => {
    void load().catch(() => undefined);
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!botId) return;
    const base = siteUrl.trim();
    const token = secret.trim();
    if (!label.trim() || !base || !token) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const url = base.endsWith("/") ? base : `${base}/`;
      const curl = `curl -X GET '${url}' -H 'Authorization: Bearer ${token.replace(/'/g, "")}'`;
      await api(`/v1/admin/bots/${botId}/http-tools/import-curl`, {
        method: "POST",
        body: JSON.stringify({
          name: label.trim().slice(0, 40),
          description: `Conexión: ${label.trim()}`,
          curl,
        }),
      });
      setLabel("");
      setSiteUrl("");
      setSecret("");
      setOk("Conexión guardada. La clave quedó cifrada en el servidor.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!botId) return;
    setBusy(true);
    try {
      await api(`/v1/admin/bots/${botId}/http-tools/${id}`, { method: "DELETE" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!botId) return null;

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => void save(e)}
        className="space-y-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-4"
      >
        <p className="text-sm font-medium">Agregar sistema</p>
        <p className="text-xs text-[var(--muted)]">
          Pon la dirección web de tu sistema y la clave que te dieron. No subas esto
          como PDF en el catálogo: aquí va cifrado y el chat no lo muestra al público.
        </p>
        <input
          className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          placeholder="Nombre (ej. Mi tienda)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <input
          className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          placeholder="Dirección web (https://…)"
          value={siteUrl}
          onChange={(e) => setSiteUrl(e.target.value)}
          inputMode="url"
        />
        <input
          type="password"
          className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          placeholder="Clave o token"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-[var(--foreground)] px-4 py-2 text-sm text-[var(--background)] disabled:opacity-50"
        >
          {busy ? "Guardando…" : "Guardar"}
        </button>
        {ok && <p className="text-xs text-green-700">{ok}</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </form>

      {tools.length > 0 && (
        <ul className="space-y-2 text-sm">
          {tools.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-2 rounded-md border border-[var(--border)] px-3 py-2"
            >
              <span>
                {t.name}
                {t.base_url ? (
                  <span className="block text-xs text-[var(--muted)]">{t.base_url}</span>
                ) : null}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => void remove(t.id)}
                className="text-xs text-[var(--muted)] hover:text-red-600"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

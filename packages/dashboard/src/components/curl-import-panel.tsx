"use client";

import { useState } from "react";
import { api } from "@/lib/api";

export function CurlImportPanel({ botId }: { botId: string | null }) {
  const [curl, setCurl] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function importCurl(e: React.FormEvent) {
    e.preventDefault();
    if (!botId || !curl.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await api<{
        name: string;
        baseUrl: string;
        path: string;
        authStored: boolean;
      }>(`/v1/admin/bots/${botId}/http-tools/import-curl`, {
        method: "POST",
        body: JSON.stringify({
          curl: curl.trim(),
          description: description.trim() || undefined,
        }),
      });
      setResult(
        `Listo: herramienta «${res.name}» → ${res.baseUrl}${res.path}${
          res.authStored ? " (token guardado cifrado)" : ""
        }`,
      );
      setCurl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo importar");
    } finally {
      setBusy(false);
    }
  }

  if (!botId) return null;

  return (
    <form
      onSubmit={(e) => void importCurl(e)}
      className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-4"
    >
      <p className="text-sm font-medium">Pegar cURL de tu API</p>
      <p className="mt-0.5 text-xs text-[var(--muted)]">
        Copia el ejemplo de la documentación (Shopify, WooCommerce, API propia). El
        token se guarda cifrado y el asistente solo ve el nombre de la herramienta.
      </p>
      <textarea
        className="mt-3 w-full min-h-[100px] rounded-md border border-[var(--border)] px-3 py-2 font-mono text-xs"
        placeholder={`curl -X GET 'https://api.ejemplo.com/v1/productos' -H 'Authorization: Bearer ...'`}
        value={curl}
        onChange={(e) => setCurl(e.target.value)}
      />
      <input
        className="mt-2 w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
        placeholder="Descripción para el asistente (opcional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <button
        type="submit"
        disabled={busy || !curl.trim()}
        className="mt-3 text-sm text-[var(--primary)] underline-offset-2 hover:underline disabled:opacity-50"
      >
        {busy ? "Importando…" : "Importar conexión"}
      </button>
      {result && <p className="mt-2 text-xs text-green-700">{result}</p>}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </form>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

type DraftSummary = {
  id: string;
  status: string;
  itemCount: number;
  sourceFilename: string | null;
};

type DraftDetail = {
  id: string;
  payload: {
    items: Array<{ name: string; priceCents: number; confidence: string }>;
    warnings?: string[];
  };
};

export function CatalogImportPanel() {
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [selected, setSelected] = useState<DraftDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const d = await api<{ drafts: DraftSummary[] }>("/v1/admin/catalog-imports");
    setDrafts(d.drafts);
  }, []);

  useEffect(() => {
    void load().catch(() => {});
  }, [load]);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("currency", "COP");
      const res = await api<{ id: string }>("/v1/admin/catalog-imports/pdf", {
        method: "POST",
        body: fd,
      });
      await load();
      const detail = await api<DraftDetail>(`/v1/admin/catalog-imports/${res.id}`);
      setSelected(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al importar");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  async function publish(id: string) {
    setBusy(true);
    try {
      await api(`/v1/admin/catalog-imports/${id}/publish`, { method: "POST" });
      setSelected(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo publicar");
    } finally {
      setBusy(false);
    }
  }

  async function openDraft(id: string) {
    const detail = await api<DraftDetail>(`/v1/admin/catalog-imports/${id}`);
    setSelected(detail);
  }

  return (
    <section className="rounded-[var(--radius-md)] border border-[var(--border)] p-4">
      <h2 className="text-sm font-medium">Importar catálogo (PDF)</h2>
      <p className="mt-0.5 text-xs text-[var(--muted)]">
        Extraemos líneas con precio; revisa el borrador antes de crear productos en
        estado draft.
      </p>
      <label className="mt-3 inline-block cursor-pointer text-sm text-[var(--primary)] hover:underline">
        {busy ? "Procesando…" : "Subir PDF"}
        <input
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          disabled={busy}
          onChange={(e) => void onUpload(e)}
        />
      </label>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {drafts.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs">
          {drafts.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                className="text-left hover:underline"
                onClick={() => void openDraft(d.id)}
              >
                {d.sourceFilename ?? "PDF"} — {d.itemCount} ítems ({d.status})
              </button>
            </li>
          ))}
        </ul>
      )}
      {selected && (
        <div className="mt-4 border-t border-[var(--border)] pt-3">
          <p className="text-xs font-medium">Vista previa</p>
          {selected.payload.warnings?.map((w) => (
            <p key={w} className="text-xs text-amber-700">{w}</p>
          ))}
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs">
            {selected.payload.items.slice(0, 40).map((it, i) => (
              <li key={i}>
                {it.name} — {(it.priceCents / 100).toLocaleString("es-CO")} COP
                {it.confidence === "low" ? " (?)" : ""}
              </li>
            ))}
          </ul>
          {selected.payload.items.length > 40 && (
            <p className="text-xs text-[var(--muted)]">… y más ítems</p>
          )}
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy}
              className="text-sm font-medium text-[var(--primary)] hover:underline disabled:opacity-50"
              onClick={() => void publish(selected.id)}
            >
              Crear productos (draft)
            </button>
            <Link href="/dashboard/products" className="text-sm text-[var(--muted)] hover:underline">
              Ir al catálogo
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}

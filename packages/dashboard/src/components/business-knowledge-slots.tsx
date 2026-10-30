"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  KnowledgeFileSlot,
  type KnowledgeFileStatus,
} from "@/components/knowledge-file-slot";
import { api } from "@/lib/api";
import { useNativeInventory } from "@/lib/use-native-inventory";

/** Documentos legacy indexados en RAG; ya no se pueden subir desde el panel. */
export const LEGACY_CREDENTIALS_DOCUMENT_TITLE = "Conexiones y credenciales";

type Doc = {
  id: string;
  title: string;
  document_filename: string;
  status: string;
  error_message?: string | null;
};

export const CATALOG_SLOT_TITLE = "Catálogo";
const LEGACY_CATALOG_TITLE = "Catálogo (referencia)";

const SLOTS = [
  {
    key: "catalogo",
    title: CATALOG_SLOT_TITLE,
    hint: "PDF con productos y precios para que el asistente responda y venda.",
  },
  {
    key: "politicas",
    title: "Políticas",
    hint: "Devoluciones, garantía, envíos.",
  },
  {
    key: "faqs",
    title: "Preguntas frecuentes",
    hint: "Horarios, pagos, tiempos de entrega.",
  },
] as const;

const ACCEPT = ".pdf,.doc,.docx,.txt,.md,.csv,.json";

function docStatus(doc: Doc | undefined, uploading: boolean): KnowledgeFileStatus {
  if (!doc) return uploading ? "indexing" : "empty";
  if (doc.status === "failed") return "failed";
  if (doc.status === "ready") return "ready";
  if (uploading) return "indexing";
  return "indexing";
}

export function BusinessKnowledgeSlots({
  botId,
  nested = false,
}: {
  botId: string | null;
  nested?: boolean;
}) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [extraNote, setExtraNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [reindexBusy, setReindexBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { enabled: nativeCatalog } = useNativeInventory();

  const load = useCallback(async () => {
    if (!botId) return;
    const d = await api<{ documents: Doc[] }>(
      `/v1/admin/documents?botId=${encodeURIComponent(botId)}`,
    );
    setDocs(d.documents);
  }, [botId]);

  useEffect(() => {
    void load();
  }, [load]);

  const legacyCredentialsDoc = docs.find(
    (d) => d.title === LEGACY_CREDENTIALS_DOCUMENT_TITLE,
  );

  useEffect(() => {
    if (!botId || !legacyCredentialsDoc) return;
    void api(`/v1/admin/documents/${legacyCredentialsDoc.id}`, {
      method: "DELETE",
    }).then(() => load());
  }, [botId, legacyCredentialsDoc?.id, load]);

  useEffect(() => {
    const pending = docs.some((d) => d.status !== "ready");
    if (!pending) return;
    const t = setInterval(() => void load(), 4000);
    return () => clearInterval(t);
  }, [docs, load]);

  function docForSlot(slotTitle: string): Doc | undefined {
    if (slotTitle === CATALOG_SLOT_TITLE) {
      return docs.find(
        (d) =>
          d.title === CATALOG_SLOT_TITLE || d.title === LEGACY_CATALOG_TITLE,
      );
    }
    return docs.find((d) => d.title === slotTitle);
  }

  async function uploadSlot(slotTitle: string, file: File, description: string) {
    if (!botId) return;
    setBusy(slotTitle);
    setError(null);
    const fd = new FormData();
    fd.set("botId", botId);
    fd.set("title", slotTitle);
    fd.set("description", description);
    fd.set("file", file);
    try {
      const existing = docForSlot(slotTitle);
      if (existing) {
        await api(`/v1/admin/documents/${existing.id}`, { method: "DELETE" });
      }
      await api("/v1/admin/documents", { method: "POST", body: fd });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir");
    } finally {
      setBusy(null);
    }
  }

  async function reindexAll() {
    if (!botId) return;
    setReindexBusy(true);
    setError(null);
    try {
      await api("/v1/admin/documents/reindex-bot", {
        method: "POST",
        body: JSON.stringify({ botId }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo reindexar");
    } finally {
      setReindexBusy(false);
    }
  }

  async function deleteSlot(slotTitle: string) {
    const existing = docForSlot(slotTitle);
    if (!existing) return;
    setBusy(slotTitle);
    setError(null);
    try {
      await api(`/v1/admin/documents/${existing.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar");
    } finally {
      setBusy(null);
    }
  }

  async function uploadExtra(file: File) {
    if (!botId) return;
    setBusy("extra");
    setError(null);
    const title = extraNote.trim() || "Material adicional";
    const fd = new FormData();
    fd.set("botId", botId);
    fd.set("title", title);
    fd.set("description", extraNote.trim());
    fd.set("file", file);
    try {
      await api("/v1/admin/documents", { method: "POST", body: fd });
      setExtraNote("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir");
    } finally {
      setBusy(null);
    }
  }

  if (!botId) return null;

  const content = (
    <>
      {!nested && (
        <div>
          <h2 className="text-sm font-medium">Archivos para el asistente</h2>
        </div>
      )}

      {docs.length > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={reindexBusy || !!busy}
            onClick={() => void reindexAll()}
            className="text-xs text-[var(--primary)] underline-offset-2 hover:underline disabled:opacity-50"
          >
            {reindexBusy ? "Reindexando…" : "Reindexar todos los documentos"}
          </button>
        </div>
      )}

      <ul className={nested ? "space-y-3" : "space-y-3"}>
        {SLOTS.map((slot) => {
          const doc = docForSlot(slot.title);
          const uploading = busy === slot.title;
          const catalogHint =
            slot.key === "catalogo" && nativeCatalog
              ? "Los productos del chat (precio, foto, stock) están en la tabla Catálogo. Opcional: PDF extra de referencia."
              : slot.hint;
          return (
            <li
              key={slot.key}
              className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-3"
            >
              <p className="font-medium text-sm">{slot.title}</p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">{catalogHint}</p>
              {slot.key === "catalogo" && nativeCatalog && (
                <p className="mt-1 text-xs">
                  <Link
                    href="/dashboard/products"
                    className="font-medium text-[var(--primary)] hover:underline"
                  >
                    Ir al catálogo (productos del chat)
                  </Link>
                </p>
              )}
              {slot.key === "catalogo" && !nativeCatalog && (
                <p className="mt-1 text-xs">
                  <Link
                    href="/dashboard/products"
                    className="text-[var(--primary)] hover:underline"
                  >
                    Editar precios en tabla (opcional)
                  </Link>
                </p>
              )}
              <KnowledgeFileSlot
                accept={ACCEPT}
                disabled={uploading}
                fileName={doc?.document_filename ?? null}
                status={docStatus(doc, uploading)}
                onFile={(f) => void uploadSlot(slot.title, f, slot.hint)}
                onDelete={doc ? () => void deleteSlot(slot.title) : undefined}
              />
              {doc?.status === "failed" && doc.error_message && (
                <p className="mt-1 text-xs text-red-600">{doc.error_message}</p>
              )}
            </li>
          );
        })}
      </ul>

      <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] p-3">
        <p className="text-sm font-medium">Otro archivo</p>
        <input
          className="mt-1.5 w-full rounded-md border border-[var(--border)] px-2 py-1.5 text-sm"
          placeholder="Nombre o tema (opcional)"
          value={extraNote}
          onChange={(e) => setExtraNote(e.target.value)}
        />
        <KnowledgeFileSlot
          accept={ACCEPT}
          disabled={busy === "extra"}
          status={busy === "extra" ? "indexing" : "empty"}
          onFile={(f) => void uploadExtra(f)}
        />
      </div>

      {error && (
        <p className="text-xs text-red-600" role="alert">{error}</p>
      )}
    </>
  );

  if (nested) return content;

  return <section className="mt-8 space-y-4">{content}</section>;
}

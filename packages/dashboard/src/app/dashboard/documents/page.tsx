"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { fetchPrimaryBot } from "@/lib/primary-bot";
import { ConfirmDialog } from "@/components/confirm-dialog";

type Doc = {
  id: string;
  title: string;
  description: string;
  document_filename: string;
  status: string;
  updated_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  ready: "Listo",
  indexing: "Indexando",
  failed: "Error",
};

export default function DocumentsPage() {
  const [botId, setBotId] = useState("");
  const [docs, setDocs] = useState<Doc[]>([]);
  const [filter, setFilter] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const loadDocs = useCallback(async (id: string) => {
    const d = await api<{ documents: Doc[] }>(
      `/v1/admin/documents?botId=${encodeURIComponent(id)}`,
    );
    setDocs(d.documents);
  }, []);

  useEffect(() => {
    if (!localStorage.getItem("token")) {
      window.location.href = "/login";
      return;
    }
    void fetchPrimaryBot().then((b) => {
      if (!b) return;
      setBotId(b.id);
      return loadDocs(b.id);
    });
  }, [loadDocs]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.document_filename.toLowerCase().includes(q),
    );
  }, [docs, filter]);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !botId) return;
    const finalTitle = title.trim() || file.name.replace(/\.[^.]+$/, "");
    setError(null);
    const fd = new FormData();
    fd.set("botId", botId);
    fd.set("title", finalTitle);
    fd.set("description", description);
    fd.set("file", file);
    try {
      await api("/v1/admin/documents", { method: "POST", body: fd });
      setTitle("");
      setDescription("");
      setFile(null);
      setShowForm(false);
      await loadDocs(botId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir");
    }
  }

  async function removeDoc(id: string) {
    setError(null);
    await api(`/v1/admin/documents/${id}`, { method: "DELETE" });
    await loadDocs(botId);
  }

  async function saveEdit(id: string) {
    await api(`/v1/admin/documents/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: editTitle.trim(),
        description: editDescription.trim(),
      }),
    });
    setEditingId(null);
    await loadDocs(botId);
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Conocimiento</h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--muted)]">
            PDFs y textos para respuestas con contexto. Integraciones en{" "}
            <Link
              href="/dashboard/configuracion?tab=integraciones"
              className="underline underline-offset-2"
            >
              Integraciones
            </Link>
            ; canales en{" "}
            <Link
              href="/dashboard/configuracion?tab=web"
              className="underline underline-offset-2"
            >
              Canales
            </Link>
            .
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-[var(--primary)] px-3 py-2 text-sm text-[var(--primary-foreground)]"
        >
          {showForm ? "Cerrar" : "Subir documento"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={upload}
          className="mt-4 grid gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:grid-cols-2"
        >
          <label className="block text-xs text-[var(--muted)] sm:col-span-2">
            Archivo
            <input
              className="mt-1 block w-full text-sm"
              type="file"
              accept=".pdf,.txt,.md,.doc,.docx"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                if (f && !title.trim()) {
                  setTitle(f.name.replace(/\.[^.]+$/, ""));
                }
              }}
              required
            />
          </label>
          <label className="block text-xs text-[var(--muted)]">
            Título
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="block text-xs text-[var(--muted)]">
            Descripción
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm text-white sm:col-span-2 sm:w-fit"
          >
            Indexar
          </button>
          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
        </form>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Buscar por título o archivo…"
          className="min-w-[200px] flex-1 rounded-md border px-3 py-2 text-sm"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <span className="text-xs text-[var(--muted)]">
          {filtered.length} / {docs.length}
        </span>
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border border-[var(--border)]">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-[var(--muted-bg)]/40 text-xs text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2 font-medium">Documento</th>
              <th className="hidden px-3 py-2 font-medium sm:table-cell">Estado</th>
              <th className="px-3 py-2 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-8 text-center text-[var(--muted)]">
                  Sin documentos. Sube políticas, FAQs o catálogos.
                </td>
              </tr>
            )}
            {filtered.map((d) =>
              editingId === d.id ? (
                <tr key={d.id} className="bg-[var(--muted-bg)]/20">
                  <td colSpan={3} className="px-3 py-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        className="rounded-md border px-2 py-1.5 text-sm"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                      />
                      <input
                        className="rounded-md border px-2 py-1.5 text-sm sm:col-span-2"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Descripción"
                      />
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        className="text-xs underline"
                        onClick={() => void saveEdit(d.id)}
                      >
                        Guardar
                      </button>
                      <button
                        type="button"
                        className="text-xs text-[var(--muted)]"
                        onClick={() => setEditingId(null)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={d.id} className="hover:bg-[var(--muted-bg)]/20">
                  <td className="px-3 py-2.5">
                    <div className="font-medium">{d.title || "Sin título"}</div>
                    {d.description && (
                      <div className="line-clamp-1 text-xs text-[var(--muted)]">
                        {d.description}
                      </div>
                    )}
                    <div className="text-xs text-[var(--muted)]">{d.document_filename}</div>
                  </td>
                  <td className="hidden px-3 py-2.5 text-xs text-[var(--muted)] sm:table-cell">
                    {STATUS_LABEL[d.status] ?? d.status}
                    <div>{d.updated_at}</div>
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs">
                    <button
                      type="button"
                      className="underline underline-offset-2"
                      onClick={() => {
                        setEditingId(d.id);
                        setEditTitle(d.title);
                        setEditDescription(d.description);
                      }}
                    >
                      Editar
                    </button>
                    <span className="mx-1 text-[var(--border)]">·</span>
                    <button
                      type="button"
                      className="text-red-700 underline underline-offset-2"
                      onClick={() => setDeleteDocId(d.id)}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={deleteDocId !== null}
        message="¿Eliminar este documento del conocimiento?"
        confirmLabel="Eliminar"
        destructive
        busy={deleteBusy}
        onCancel={() => {
          if (!deleteBusy) setDeleteDocId(null);
        }}
        onConfirm={() => {
          if (!deleteDocId) return;
          void (async () => {
            setDeleteBusy(true);
            try {
              await removeDoc(deleteDocId);
              setDeleteDocId(null);
            } catch (err) {
              setError(err instanceof Error ? err.message : "No se pudo eliminar");
            } finally {
              setDeleteBusy(false);
            }
          })();
        }}
      />
    </main>
  );
}

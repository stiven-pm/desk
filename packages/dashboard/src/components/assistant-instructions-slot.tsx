"use client";

import { useEffect, useState } from "react";
import {
  KnowledgeFileSlot,
  type KnowledgeFileStatus,
} from "@/components/knowledge-file-slot";
import { api } from "@/lib/api";
import { fetchPrimaryBot } from "@/lib/primary-bot";

const MAX_CHARS = 16_000;

export function AssistantInstructionsSlot() {
  const [botId, setBotId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchPrimaryBot().then((b) => {
      if (!b) return;
      setBotId(b.id);
      return api<{ bot: { systemPrompt: string } }>(`/v1/admin/bots/${b.id}`).then((d) => {
        if (d.bot.systemPrompt?.trim()) {
          setFileName("instrucciones.md");
        }
      });
    });
  }, []);

  async function onFile(file: File) {
    if (!botId) return;
    setBusy(true);
    setError(null);
    try {
      const text = await file.text();
      const trimmed = text.trim();
      if (!trimmed) {
        setError("El archivo está vacío.");
        return;
      }
      if (trimmed.length > MAX_CHARS) {
        setError(`Máximo ${MAX_CHARS.toLocaleString("es")} caracteres.`);
        return;
      }
      await api(`/v1/admin/bots/${botId}`, {
        method: "PATCH",
        body: JSON.stringify({ systemPrompt: trimmed }),
      });
      setFileName(file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!botId) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/v1/admin/bots/${botId}`, {
        method: "PATCH",
        body: JSON.stringify({ systemPrompt: "" }),
      });
      setFileName(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar");
    } finally {
      setBusy(false);
    }
  }

  const status: KnowledgeFileStatus = busy
    ? "indexing"
    : fileName
      ? "ready"
      : "empty";

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-3">
      <p className="font-medium text-sm">Personalidad e instrucciones</p>
      <p className="mt-0.5 text-xs text-[var(--muted)]">Archivo .txt o .md</p>
      <KnowledgeFileSlot
        accept=".txt,.md"
        disabled={busy}
        fileName={fileName}
        status={status}
        onFile={(f) => void onFile(f)}
        onDelete={fileName ? () => void onDelete() : undefined}
      />
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}

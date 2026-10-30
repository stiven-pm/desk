"use client";

import { useState } from "react";
import { api } from "@/lib/api";

export type PendingCredentialRequest = {
  id: string;
  title: string;
  purpose: string;
  fields: Array<{
    key: string;
    label: string;
    type: "text" | "password" | "url";
    required?: boolean;
  }>;
};

export function SetupCredentialModal({
  botId,
  request,
  onClose,
  onFulfilled,
}: {
  botId: string;
  request: PendingCredentialRequest;
  onClose: () => void;
  onFulfilled: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await api(`/v1/admin/bots/${botId}/setup-credentials/${request.id}/fulfill`, {
        method: "POST",
        body: JSON.stringify({ values }),
      });
      onFulfilled();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-labelledby="cred-modal-title"
    >
      <div className="w-full max-w-md rounded-lg border bg-[var(--background)] p-5 shadow-lg">
        <h2 id="cred-modal-title" className="text-lg font-semibold">
          {request.title}
        </h2>
        {request.purpose && (
          <p className="mt-2 text-sm text-[var(--muted)]">{request.purpose}</p>
        )}
        <p className="mt-2 text-xs text-[var(--muted)]">
          Solo tu empresa ve esto. Guardamos los datos de forma segura; no los pegues en el chat.
        </p>
        <div className="mt-4 space-y-3">
          {request.fields.map((f) => (
            <label key={f.key} className="block text-sm">
              <span className="font-medium">{f.label}</span>
              <input
                type={f.type === "password" ? "password" : "text"}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                autoComplete="off"
                required={f.required !== false}
                value={values[f.key] ?? ""}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [f.key]: e.target.value }))
                }
              />
            </label>
          ))}
        </div>
        {error && (
          <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="rounded-md bg-[var(--foreground)] px-3 py-2 text-sm text-[var(--background)] disabled:opacity-50"
            onClick={() => void submit()}
            disabled={saving}
          >
            Guardar y conectar
          </button>
        </div>
      </div>
    </div>
  );
}

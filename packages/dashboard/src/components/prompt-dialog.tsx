"use client";

import { useEffect, useState } from "react";

type Props = {
  open: boolean;
  title?: string;
  label?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: (value: string) => void;
  onCancel: () => void;
};

export function PromptDialog({
  open,
  title = "Escribir",
  label,
  placeholder = "",
  confirmLabel = "Guardar",
  cancelLabel = "Cancelar",
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  const [value, setValue] = useState("");

  useEffect(() => {
    if (open) setValue("");
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="prompt-dialog-title"
    >
      <div className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--card)] p-5 shadow-lg">
        <h2 id="prompt-dialog-title" className="text-base font-semibold">
          {title}
        </h2>
        {label ? (
          <label className="mt-3 block text-sm text-[var(--muted)]">{label}</label>
        ) : null}
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="mt-2 w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          autoFocus
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === "Enter" && value.trim()) {
              e.preventDefault();
              onConfirm(value.trim());
            }
          }}
        />
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy || !value.trim()}
            onClick={() => onConfirm(value.trim())}
            className="rounded-md bg-[var(--foreground)] px-3 py-1.5 text-sm text-[var(--background)] disabled:opacity-50"
          >
            {busy ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

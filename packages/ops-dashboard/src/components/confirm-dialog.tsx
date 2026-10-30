"use client";

type Props = {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title = "Confirmar",
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  busy = false,
  destructive = false,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-md rounded-lg border border-[var(--ops-border)] bg-white p-5 shadow-lg">
        <h2 id="confirm-dialog-title" className="text-base font-semibold">
          {title}
        </h2>
        <p className="mt-2 text-sm text-[var(--ops-muted)]">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-md border border-[var(--ops-border)] px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={[
              "rounded-md px-3 py-1.5 text-sm text-white disabled:opacity-50",
              destructive ? "bg-red-700 hover:bg-red-800" : "",
            ].join(" ")}
            style={destructive ? undefined : { background: "var(--ops-accent)" }}
          >
            {busy ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

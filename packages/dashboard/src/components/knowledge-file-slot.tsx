"use client";

import { useRef, useState } from "react";

export type KnowledgeFileStatus = "empty" | "indexing" | "ready" | "failed";

function StatusBadge({ status }: { status: KnowledgeFileStatus }) {
  const cfg =
    status === "ready"
      ? { dot: "bg-green-500", label: "listo" }
      : status === "indexing"
        ? { dot: "bg-yellow-500", label: "indexando" }
        : status === "failed"
          ? { dot: "bg-red-500", label: "error" }
          : { dot: "bg-red-500", label: "sin archivo" };
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-[var(--muted)]">
      <span className={`size-2 rounded-full ${cfg.dot}`} aria-hidden />
      {cfg.label}
    </span>
  );
}

type Props = {
  accept?: string;
  disabled?: boolean;
  fileName?: string | null;
  status: KnowledgeFileStatus;
  onFile: (file: File) => void;
  onDelete?: () => void;
};

export function KnowledgeFileSlot({
  accept,
  disabled,
  fileName,
  status,
  onFile,
  onDelete,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  function pick(file: File | undefined) {
    if (!file || disabled) return;
    onFile(file);
  }

  const rowClass = `mt-2 flex min-h-[2.25rem] items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm transition-colors ${
    drag
      ? "border-[var(--primary)] bg-[var(--primary)]/5"
      : "border-[var(--border)] bg-[var(--muted-bg)]/20"
  } ${disabled ? "opacity-50" : ""}`;

  return (
    <div
      className={rowClass}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        pick(e.dataTransfer.files?.[0]);
      }}
    >
      {fileName ? (
        <>
          <span className="min-w-0 flex-1 truncate font-medium" title={fileName}>
            {fileName}
          </span>
          {onDelete && (
            <button
              type="button"
              disabled={disabled}
              className="shrink-0 text-xs text-red-700 underline-offset-2 hover:underline disabled:opacity-50"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              Eliminar
            </button>
          )}
          <button
            type="button"
            disabled={disabled}
            className="shrink-0 text-xs text-[var(--primary)] underline-offset-2 hover:underline disabled:opacity-50"
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
          >
            Cambiar
          </button>
        </>
      ) : (
        <button
          type="button"
          disabled={disabled}
          className="min-w-0 flex-1 text-left text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-50"
          onClick={() => inputRef.current?.click()}
        >
          Subir archivo
        </button>
      )}
      <StatusBadge status={status} />
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        disabled={disabled}
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

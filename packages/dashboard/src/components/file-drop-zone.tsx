"use client";

import { useRef, useState } from "react";

type Props = {
  accept?: string;
  disabled?: boolean;
  label: string;
  hint?: string;
  onFile: (file: File) => void;
};

export function FileDropZone({ accept, disabled, label, hint, onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  function pick(file: File | undefined) {
    if (!file || disabled) return;
    onFile(file);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
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
      onClick={() => inputRef.current?.click()}
      className={`mt-3 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors ${
        drag
          ? "border-[var(--primary)] bg-[var(--primary)]/5"
          : "border-[var(--border)] hover:border-[var(--primary)]/40 hover:bg-[var(--muted-bg)]/30"
      } ${disabled ? "pointer-events-none opacity-50" : ""}`}
    >
      <span className="text-2xl leading-none text-[var(--muted)]" aria-hidden>+</span>
      <p className="mt-2 text-sm font-medium">{label}</p>
      {hint && <p className="mt-1 max-w-sm text-xs text-[var(--muted)]">{hint}</p>}
      <p className="mt-2 text-[10px] text-[var(--muted)]">PDF, Word o texto · clic o arrastrar</p>
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

"use client";

import { useState } from "react";

export function CopyField({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-[var(--muted)]">{label}</span>
        <button
          type="button"
          onClick={() => void copy()}
          className="text-xs text-[var(--accent)] underline underline-offset-2"
        >
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <p
        className={`mt-1 break-all rounded-md border border-[var(--border)] bg-[var(--muted-bg)]/30 px-3 py-2 text-xs ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

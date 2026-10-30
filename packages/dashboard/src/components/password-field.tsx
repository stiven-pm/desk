"use client";

import { useState } from "react";

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  minLength?: number;
  className?: string;
  disabled?: boolean;
};

export function PasswordField({
  id,
  value,
  onChange,
  placeholder,
  autoComplete,
  minLength,
  className = "",
  disabled,
}: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        minLength={minLength}
        disabled={disabled}
        className={className}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        tabIndex={-1}
      >
        {visible ? "Ocultar" : "Ver"}
      </button>
    </div>
  );
}

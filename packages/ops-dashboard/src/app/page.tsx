"use client";

import { useState } from "react";
import { opsApi } from "@/lib/api";
import { humanizeApiError } from "@/lib/errors";

export default function OpsLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const data = await opsApi<{ token: string }>("/v1/ops/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem("ops_token", data.token);
      window.location.href = "/metrics";
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : humanizeApiError("request_failed"),
      );
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--ops-surface)] p-6">
      <div className="w-full max-w-sm">
        <p className="text-sm font-semibold tracking-tight">Desk · ops</p>
        <form
          onSubmit={submit}
          className="mt-6 space-y-4 rounded-[var(--ops-radius)] border border-[var(--ops-border)] bg-white p-6"
        >
          <label className="block text-sm font-medium">
            Email
            <input
              type="email"
              autoComplete="username"
              className="mt-1.5 w-full rounded-[var(--ops-radius)] border border-[var(--ops-border)] px-3 py-2 font-normal"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm font-medium">
            Contraseña
            <input
              type="password"
              autoComplete="current-password"
              className="mt-1.5 w-full rounded-[var(--ops-radius)] border border-[var(--ops-border)] px-3 py-2 font-normal"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && (
            <p className="text-sm text-[oklch(0.45_0.15_25)]" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="w-full rounded-[var(--ops-radius)] py-2.5 text-sm font-medium text-[var(--ops-ink)]"
            style={{ background: "var(--ops-accent)" }}
          >
            Entrar
          </button>
        </form>
      </div>
    </main>
  );
}

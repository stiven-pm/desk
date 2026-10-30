"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PasswordField } from "@/components/password-field";

export default function AcceptInvitePage() {
  const [info, setInfo] = useState<{
    email: string;
    orgName: string;
    role: string;
  } | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const token =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("token")
      : null;

  useEffect(() => {
    if (!token) return;
    api<{ email: string; orgName: string; role: string }>(
      `/v1/public/invites/${encodeURIComponent(token)}`,
    )
      .then(setInfo)
      .catch((e) => setError(e.message));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    try {
      const data = await api<{ token: string }>(
        `/v1/public/invites/${encodeURIComponent(token)}/accept`,
        { method: "POST", body: JSON.stringify({ password }) },
      );
      localStorage.setItem("token", data.token);
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed");
    }
  }

  if (!token) {
    return <p className="p-8">Enlace de invitación inválido.</p>;
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-xl font-semibold">Unirte a Desk</h1>
      {info && (
        <p className="mt-2 text-sm opacity-70">
          {info.orgName} — {info.email} ({info.role})
        </p>
      )}
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-sm">
          Define tu contraseña
          <PasswordField
            value={password}
            onChange={setPassword}
            minLength={10}
            className="mt-1 w-full rounded-md border px-3 py-2 pr-16"
            autoComplete="new-password"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="w-full rounded-md bg-[var(--primary)] py-2 text-white">
          Activar cuenta
        </button>
      </form>
    </main>
  );
}

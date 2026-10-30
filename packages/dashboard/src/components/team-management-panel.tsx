"use client";

import { useEffect, useState } from "react";
import { ALL_MEMBER_CAPABILITIES, type MemberCapability } from "@chatbot/domain";
import { api } from "@/lib/api";
import { humanizeApiError } from "@/lib/errors";

const CAP_LABELS: Record<MemberCapability, string> = {
  billing: "Facturación y planes",
  team: "Invitar y ver equipo",
  knowledge: "Instrucciones y documentos de la IA",
  integrations: "Integraciones",
  inbox: "Bandeja (atender clientes)",
  analytics: "Métricas (solo lectura)",
};

const PRESET_HELP: Record<string, string> = {
  admin: "Todo el panel (como dueño salvo transferir la org).",
  developer: "IA + integraciones. Sin facturación ni invitar.",
  agent: "Solo la bandeja de conversaciones. No ve configuración, integraciones ni equipo.",
  viewer: "Solo lectura de métricas.",
};

const ACTION_LABELS: Record<string, string> = {
  "auth.login": "Inicio de sesión",
  human_reply: "Respuesta humana en la bandeja",
  human_dismiss: "Cierre de cola sin mensaje",
};

type InviteMode = "preset" | "custom";

export function TeamManagementPanel({ embedded }: { embedded?: boolean }) {
  const [members, setMembers] = useState<
    {
      id: string;
      email: string;
      role: string;
      capabilities_json?: string | null;
    }[]
  >([]);
  const [pending, setPending] = useState<
    { id: string; email: string; role: string }[]
  >([]);
  const [seats, setSeats] = useState<{ used: number; max: number } | null>(
    null,
  );
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<InviteMode>("preset");
  const [preset, setPreset] = useState("agent");
  const [caps, setCaps] = useState<MemberCapability[]>(["inbox"]);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activity, setActivity] = useState<
    {
      id: number;
      action: string;
      created_at: string;
      actor_email: string | null;
    }[]
  >([]);

  function load() {
    api<{
      members: {
        id: string;
        email: string;
        role: string;
        capabilities_json?: string | null;
      }[];
      pendingInvites: { id: string; email: string; role: string }[];
      seats: { used: number; max: number };
    }>("/v1/admin/members").then((d) => {
      setMembers(d.members);
      setPending(d.pendingInvites);
      setSeats(d.seats);
    });
    api<{ items: typeof activity }>("/v1/admin/activity-log?limit=40")
      .then((d) => setActivity(d.items ?? []))
      .catch(() => setActivity([]));
  }

  useEffect(() => {
    load();
  }, []);

  function toggleCap(cap: MemberCapability) {
    setCaps((prev) =>
      prev.includes(cap) ? prev.filter((c) => c !== cap) : [...prev, cap],
    );
  }

  function formatAccess(m: {
    role: string;
    capabilities_json?: string | null;
  }): string {
    if (m.role === "owner") return "Dueño";
    if (m.role === "admin") return "Administrador";
    if (m.role === "agent") return "Agente (bandeja)";
    if (m.role !== "member" && m.role in PRESET_HELP) return m.role;
    try {
      const parsed = JSON.parse(m.capabilities_json ?? "[]") as string[];
      if (!parsed.length) return "Personalizado";
      return parsed.map((c) => CAP_LABELS[c as MemberCapability] ?? c).join(", ");
    } catch {
      return m.role;
    }
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const body =
        mode === "preset"
          ? { email, role: preset }
          : { email, capabilities: caps };
      const data = await api<{ inviteUrl: string }>("/v1/admin/members/invite", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setInviteUrl(data.inviteUrl);
      setEmail("");
      load();
    } catch (err) {
      const code =
        err instanceof Error && "code" in err
          ? String((err as { code?: string }).code)
          : undefined;
      setError(
        err instanceof Error
          ? humanizeApiError(code) || err.message
          : "No se pudo invitar",
      );
    }
  }

  const seatsFull = seats !== null && seats.used >= seats.max;

  return (
    <div className={embedded ? "" : "mx-auto max-w-3xl px-6 py-8"}>
      {!embedded ? <h1 className="text-lg font-semibold">Equipo</h1> : null}
      <p className={`text-sm text-[var(--muted)] ${embedded ? "mt-0" : "mt-2"}`}>
        Cada persona tiene su correo y contraseña. Los <strong>agentes</strong> solo entran a la{" "}
        <strong>Bandeja</strong>; no pueden abrir configuración, integraciones ni facturación
        (tampoco por URL).
      </p>
      {seats ? (
        <p className="mt-2 text-sm text-[var(--muted)]">
          Asientos: <strong>{seats.used}</strong> / {seats.max}
          {seatsFull ? " — sube de plan o cancela invitaciones pendientes." : ""}
        </p>
      ) : null}

      <form
        onSubmit={invite}
        className="mt-6 space-y-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
      >
        <input
          type="email"
          className="w-full rounded-md border px-3 py-2 text-sm"
          placeholder="colega@empresa.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={seatsFull}
        />
        <div className="flex flex-wrap gap-3 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="mode"
              checked={mode === "preset"}
              onChange={() => setMode("preset")}
            />
            Perfil (recomendado)
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="mode"
              checked={mode === "custom"}
              onChange={() => setMode("custom")}
            />
            Permisos a medida
          </label>
        </div>
        {mode === "preset" ? (
          <div>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
            >
              <option value="agent">Agente (bandeja)</option>
              <option value="admin">Administrador</option>
              <option value="developer">Técnico (IA + integraciones)</option>
              <option value="viewer">Solo métricas</option>
            </select>
            <p className="mt-1 text-xs text-[var(--muted)]">{PRESET_HELP[preset]}</p>
          </div>
        ) : (
          <ul className="space-y-2 text-sm">
            {ALL_MEMBER_CAPABILITIES.map((cap) => (
              <li key={cap}>
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={caps.includes(cap)}
                    onChange={() => toggleCap(cap)}
                  />
                  <span className="font-medium">{CAP_LABELS[cap]}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <button
          type="submit"
          disabled={seatsFull || (mode === "custom" && caps.length === 0)}
          className="rounded-md bg-[var(--foreground)] px-4 py-2 text-sm text-[var(--background)] disabled:opacity-50"
        >
          Enviar invitación
        </button>
      </form>
      {inviteUrl ? (
        <p className="mt-2 break-all text-xs text-[var(--muted)]">Enlace: {inviteUrl}</p>
      ) : null}
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      <h2 className="mt-8 text-sm font-medium">Personas con acceso</h2>
      <ul className="mt-2 divide-y rounded-md border text-sm">
        {members.map((m) => (
          <li
            key={m.id}
            className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:justify-between"
          >
            <span>{m.email}</span>
            <span className="text-[var(--muted)]">{formatAccess(m)}</span>
          </li>
        ))}
      </ul>

      {pending.length > 0 ? (
        <>
          <h2 className="mt-6 text-sm font-medium">Invitaciones pendientes</h2>
          <ul className="mt-2 space-y-1 text-sm text-[var(--muted)]">
            {pending.map((p) => (
              <li key={p.id}>
                {p.email} — {formatAccess(p)}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <h2 className="mt-8 text-sm font-medium">Registro de actividad</h2>
      <ul className="mt-2 divide-y rounded-md border text-xs">
        {activity.length === 0 ? (
          <li className="px-3 py-2 text-[var(--muted)]">Sin eventos aún.</li>
        ) : (
          activity.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:justify-between"
            >
              <span>
                {ACTION_LABELS[row.action] ?? row.action}
                {row.actor_email ? ` · ${row.actor_email}` : ""}
              </span>
              <span className="text-[var(--muted)]">{row.created_at}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { MarketingShell } from "@/components/marketing-shell";
import { api } from "@/lib/api";
import { safeNextPath } from "@/lib/safe-next";
import { PasswordField } from "@/components/password-field";

const MAGIC_HINT =
  "Te enviamos un enlace de un solo uso. Ábrelo en este navegador y entras.";
const MAGIC_SENT =
  "Si la cuenta existe, revisa tu correo (y spam) y abre el enlace.";

type OrgPick = { id: string; name: string; role: string };

function finishWithToken(
  router: ReturnType<typeof useRouter>,
  searchParams: ReturnType<typeof useSearchParams>,
  token: string,
) {
  localStorage.setItem("token", token);
  router.replace(safeNextPath(searchParams.get("next"), "/dashboard"));
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<OrgPick[] | null>(null);
  const [orgId, setOrgId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [magicHint, setMagicHint] = useState(MAGIC_HINT);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"password" | "magic">("password");
  const submitting = useRef(false);
  const magicHandled = useRef(false);
  const [pendingMagic, setPendingMagic] = useState<string | null>(null);

  async function consumeMagic(token: string, pickedOrgId?: string) {
    const data = await api<{ token?: string; needOrgPick?: boolean; orgs?: OrgPick[] }>(
      "/v1/admin/auth/magic-consume",
      {
        method: "POST",
        body: JSON.stringify({ token, orgId: pickedOrgId || undefined }),
      },
    );
    if (data.needOrgPick && data.orgs) {
      setPendingMagic(token);
      setOrgs(data.orgs);
      setBanner("Elige la empresa para continuar.");
      return;
    }
    if (data.token) {
      setPendingMagic(null);
      finishWithToken(router, searchParams, data.token);
    }
  }

  useEffect(() => {
    const magic = searchParams.get("magic");
    if (!magic || magicHandled.current) return;
    magicHandled.current = true;
    setLoading(true);
    setError(null);
    void consumeMagic(magic)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Enlace inválido o caducado.");
      })
      .finally(() => setLoading(false));
  }, [router, searchParams]);

  async function submitMagicOrgPick(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingMagic || !orgId || submitting.current || loading) return;
    submitting.current = true;
    setLoading(true);
    setError(null);
    try {
      await consumeMagic(pendingMagic, orgId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar el acceso");
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

  async function applyLoginResult(data: {
    token?: string;
    needOrgPick?: boolean;
    orgs?: OrgPick[];
  }) {
    if (data.needOrgPick && data.orgs) {
      setOrgs(data.orgs);
      return;
    }
    if (data.token) {
      finishWithToken(router, searchParams, data.token);
    }
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current || loading) return;
    submitting.current = true;
    setLoading(true);
    setError(null);
    setBanner(null);
    try {
      const data = await api<{
        token?: string;
        needOrgPick?: boolean;
        orgs?: OrgPick[];
        requires_otp?: boolean;
        challenge_id?: string;
        message?: string;
      }>("/v1/admin/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          orgId: orgId || undefined,
        }),
      });
      if (data.requires_otp && data.challenge_id) {
        setChallengeId(data.challenge_id);
        setBanner(data.message ?? "Revisa tu correo: te enviamos un código.");
        return;
      }
      await applyLoginResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión");
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

  async function submitOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!challengeId || submitting.current || loading) return;
    submitting.current = true;
    setLoading(true);
    setError(null);
    try {
      const data = await api<{
        token?: string;
        needOrgPick?: boolean;
        orgs?: OrgPick[];
      }>("/v1/admin/auth/login/verify-otp", {
        method: "POST",
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          challenge_id: challengeId,
          code: otp,
          orgId: orgId || undefined,
        }),
      });
      await applyLoginResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código inválido");
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

  async function submitMagic(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current || loading) return;
    submitting.current = true;
    setLoading(true);
    setError(null);
    try {
      await api<{ ok: boolean }>("/v1/admin/auth/magic-link", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setMagicHint(MAGIC_SENT);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el enlace");
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

  const orgPicker = orgs && (
    <label className="block text-sm">
      Empresa
      <select
        className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2"
        value={orgId}
        onChange={(e) => setOrgId(e.target.value)}
        required
      >
        <option value="">Selecciona…</option>
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name} ({o.role})
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-semibold">Entrar a Desk</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Panel de administración.{" "}
        <Link href="/register" className="text-[var(--primary)] underline">
          Crear cuenta
        </Link>
      </p>

      <div className="mt-8 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-6">
        {banner && (
          <p className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800">
            {banner}
          </p>
        )}

        <div className="mb-4 flex gap-2 text-sm">
          <button
            type="button"
            className={
              mode === "password" ? "font-medium text-[var(--accent)]" : "text-[var(--muted)]"
            }
            onClick={() => {
              setMode("password");
              setChallengeId(null);
              setOtp("");
              setError(null);
              setMagicHint(MAGIC_HINT);
            }}
          >
            Contraseña
          </button>
          <span className="text-[var(--border)]">|</span>
          <button
            type="button"
            className={
              mode === "magic" ? "font-medium text-[var(--accent)]" : "text-[var(--muted)]"
            }
            onClick={() => {
              setMode("magic");
              setChallengeId(null);
              setOtp("");
              setError(null);
              setBanner(null);
              setMagicHint(MAGIC_HINT);
            }}
          >
            Magic link
          </button>
        </div>

        {pendingMagic && orgs ? (
          <form onSubmit={(e) => void submitMagicOrgPick(e)} className="space-y-4">
            {orgPicker}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading || !orgId}
              className="w-full rounded-[var(--radius-sm)] bg-[var(--accent)] py-2.5 text-sm font-medium text-[var(--accent-foreground)] disabled:opacity-60"
            >
              {loading ? "Entrando…" : "Continuar"}
            </button>
          </form>
        ) : mode === "password" && challengeId ? (
          <form onSubmit={(e) => void submitOtp(e)} className="space-y-4">
            <p className="text-sm text-[var(--muted)]">
              Código enviado a <strong className="text-[var(--foreground)]">{email}</strong>
            </p>
            {orgPicker}
            <label className="block text-sm">
              Código del correo
              <input
                autoComplete="one-time-code"
                className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2 font-mono uppercase tracking-widest"
                value={otp}
                onChange={(e) =>
                  setOtp(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))
                }
                required
                disabled={loading}
              />
            </label>
            <p className="text-xs text-[var(--muted)]">Caduca en 10 minutos.</p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading || otp.length < 8}
              className="w-full rounded-[var(--radius-sm)] bg-[var(--accent)] py-2.5 text-sm font-medium text-[var(--accent-foreground)] disabled:opacity-60"
            >
              {loading ? "Verificando…" : "Confirmar e entrar"}
            </button>
            <button
              type="button"
              className="w-full text-sm text-[var(--muted)] underline"
              disabled={loading}
              onClick={() => {
                setChallengeId(null);
                setOtp("");
                setBanner(null);
                setError(null);
              }}
            >
              Volver
            </button>
          </form>
        ) : mode === "password" ? (
          <form onSubmit={(e) => void submitPassword(e)} className="space-y-4">
            {orgPicker}
            <label className="block text-sm">
              Email
              <input
                type="email"
                className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={loading}
              />
            </label>
            <label className="block text-sm">
              Contraseña
              <PasswordField
                value={password}
                onChange={setPassword}
                className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2 pr-16"
                autoComplete="current-password"
                disabled={loading}
              />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-[var(--radius-sm)] bg-[var(--accent)] py-2.5 text-sm font-medium text-[var(--accent-foreground)] disabled:opacity-60"
            >
              {loading ? "Entrando…" : "Continuar"}
            </button>
          </form>
        ) : (
          <form onSubmit={(e) => void submitMagic(e)} className="space-y-4">
            <label className="block text-sm">
              Email
              <input
                type="email"
                className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={loading}
              />
            </label>
            <p className="text-xs text-[var(--muted)]">{magicHint}</p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-[var(--radius-sm)] bg-[var(--accent)] py-2.5 text-sm font-medium text-[var(--accent-foreground)] disabled:opacity-60"
            >
              {loading ? "Enviando…" : "Enviar magic link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <MarketingShell>
      <Suspense
        fallback={
          <p className="p-16 text-center text-sm text-[var(--muted)]">Cargando…</p>
        }
      >
        <LoginForm />
      </Suspense>
    </MarketingShell>
  );
}

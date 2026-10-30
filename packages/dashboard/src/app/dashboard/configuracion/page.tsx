"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ConfiguracionIaMessagingSection } from "@/components/configuracion/ia-messaging-section";
import { ConfiguracionWebChatSection } from "@/components/configuracion/web-chat-section";
import { api } from "@/lib/api";
import { ApiHttpError } from "@/lib/api-error";
import { clearSession } from "@/lib/auth-session";
import { humanizeApiError } from "@/lib/errors";
import { PasswordField } from "@/components/password-field";
import { AssistantInstructionsSlot } from "@/components/assistant-instructions-slot";
import { BusinessKnowledgeSlots } from "@/components/business-knowledge-slots";
import { TeamManagementPanel } from "@/components/team-management-panel";
import { fetchPrimaryBot } from "@/lib/primary-bot";
import { useMemberAccess } from "@/lib/member-access-context";
import {
  canManageTeam,
  canOpenAccountSettings,
  canOpenIaSettings,
  canOpenIntegrations,
} from "@/lib/member-access-ui";
import { ConfiguracionIntegracionesSection } from "@/components/configuracion/integraciones-section";

type Account = {
  user: { email: string; pendingEmail: string | null };
  org: {
    name: string;
    slug: string;
    deletionScheduledAt: string | null;
  } | null;
  deletionGraceDays: number;
};

function formatError(e: unknown): string {
  if (e instanceof ApiHttpError) {
    return e.message.trim() || humanizeApiError(e.code);
  }
  if (e instanceof Error) return e.message;
  return humanizeApiError("request_failed");
}

type ConfigTab = "cuenta" | "web" | "integraciones" | "ia" | "equipo";

function resolveConfigTab(raw: string | null): ConfigTab {
  if (raw === "whatsapp") return "web";
  if (
    raw === "web" ||
    raw === "integraciones" ||
    raw === "ia" ||
    raw === "equipo"
  ) {
    return raw;
  }
  return "cuenta";
}

export default function ConfiguracionPage() {
  const member = useMemberAccess();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = resolveConfigTab(searchParams.get("tab"));
  const [botId, setBotId] = useState<string | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [orgName, setOrgName] = useState("");
  const [pwdCurrent, setPwdCurrent] = useState("");
  const [pwdNew, setPwdNew] = useState("");
  const [emailNew, setEmailNew] = useState("");
  const [emailPwd, setEmailPwd] = useState("");
  const [emailChallenge, setEmailChallenge] = useState<string | null>(null);
  const [emailCode, setEmailCode] = useState("");
  const [deletePwd, setDeletePwd] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const load = useCallback(async () => {
    const d = await api<Account>("/v1/admin/account");
    setAccount(d);
    setOrgName(d.org?.name ?? "");
  }, []);

  useEffect(() => {
    void load().catch(() => setError("No pudimos cargar tu cuenta."));
  }, [load]);

  useEffect(() => {
    void fetchPrimaryBot().then((b) => setBotId(b?.id ?? null));
  }, []);

  useEffect(() => {
    if (tab === "cuenta" && !canOpenAccountSettings(member)) {
      router.replace(
        canManageTeam(member)
          ? "/dashboard/configuracion?tab=equipo"
          : canOpenIaSettings(member)
            ? "/dashboard/configuracion?tab=ia"
            : "/dashboard/panel",
      );
    }
    if (searchParams.get("tab") === "whatsapp") {
      router.replace("/dashboard/configuracion?tab=web");
    }
    if (tab === "equipo" && !canManageTeam(member)) {
      router.replace("/dashboard/configuracion");
    }
    if (tab === "ia" && !canOpenIaSettings(member)) {
      router.replace("/dashboard/configuracion");
    }
    if (tab === "web" && !canOpenAccountSettings(member)) {
      router.replace("/dashboard/configuracion");
    }
    if (
      tab === "integraciones" &&
      !canOpenIntegrations(member) &&
      !canOpenAccountSettings(member)
    ) {
      router.replace("/dashboard/configuracion");
    }
  }, [tab, member, router, searchParams]);

  async function saveOrgName() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api("/v1/admin/account/org", {
        method: "PATCH",
        body: JSON.stringify({ name: orgName.trim() }),
      });
      setMessage("Nombre actualizado.");
      await load();
    } catch (e) {
      setError(formatError(e));
    } finally {
      setBusy(false);
    }
  }

  async function changePassword() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api("/v1/admin/account/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: pwdCurrent,
          newPassword: pwdNew,
        }),
      });
      setPwdCurrent("");
      setPwdNew("");
      setMessage("Contraseña actualizada.");
    } catch (e) {
      setError(formatError(e));
    } finally {
      setBusy(false);
    }
  }

  async function startEmailChange() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const d = await api<{ challengeId: string; message: string }>(
        "/v1/admin/account/change-email",
        {
          method: "POST",
          body: JSON.stringify({
            newEmail: emailNew.trim(),
            currentPassword: emailPwd,
          }),
        },
      );
      setEmailChallenge(d.challengeId);
      setMessage(d.message);
    } catch (e) {
      setError(formatError(e));
    } finally {
      setBusy(false);
    }
  }

  async function verifyEmailChange() {
    setBusy(true);
    setError(null);
    try {
      await api("/v1/admin/account/change-email/verify", {
        method: "POST",
        body: JSON.stringify({
          challengeId: emailChallenge,
          code: emailCode.trim(),
        }),
      });
      setEmailChallenge(null);
      setEmailCode("");
      setEmailNew("");
      setEmailPwd("");
      setMessage("Correo actualizado.");
      await load();
    } catch (e) {
      setError(formatError(e));
    } finally {
      setBusy(false);
    }
  }

  async function scheduleDeletion() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api("/v1/admin/account/delete", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: deletePwd,
          confirmPhrase: deleteConfirm,
        }),
      });
      clearSession();
      router.replace("/login?logout=1");
    } catch (e) {
      setError(formatError(e));
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "w-full rounded-md border border-[var(--border)] bg-[var(--background)] py-2 pl-3 pr-16 text-sm";

  return (
    <main
      className={
        tab === "cuenta"
          ? "mx-auto max-w-lg px-4 py-8 sm:px-6"
          : "mx-auto max-w-3xl px-4 py-8 sm:px-6"
      }
    >
      <p className="text-sm text-[var(--muted)]">
        Cuenta, tienda y chat web, integraciones, IA y equipo.
      </p>

      <div className="mt-6 flex flex-wrap gap-1 border-b border-[var(--border)]">
        {canOpenAccountSettings(member) ? (
          <>
            <Link
              href="/dashboard/configuracion"
              className={[
                "px-3 py-2 text-sm font-medium -mb-px border-b-2",
                tab === "cuenta"
                  ? "border-[var(--foreground)] text-[var(--foreground)]"
                  : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]",
              ].join(" ")}
            >
              Cuenta
            </Link>
            <Link
              href="/dashboard/configuracion?tab=web"
              className={[
                "px-3 py-2 text-sm font-medium -mb-px border-b-2",
                tab === "web"
                  ? "border-[var(--foreground)] text-[var(--foreground)]"
                  : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]",
              ].join(" ")}
            >
              Web
            </Link>
          </>
        ) : null}
        {(canOpenIntegrations(member) ||
          canOpenAccountSettings(member)) && (
          <Link
            href="/dashboard/configuracion?tab=integraciones"
            className={[
              "px-3 py-2 text-sm font-medium -mb-px border-b-2",
              tab === "integraciones"
                ? "border-[var(--foreground)] text-[var(--foreground)]"
                : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]",
            ].join(" ")}
          >
            Integraciones
          </Link>
        )}
        {canOpenIaSettings(member) ? (
          <Link
            href="/dashboard/configuracion?tab=ia"
            className={[
              "px-3 py-2 text-sm font-medium -mb-px border-b-2",
              tab === "ia"
                ? "border-[var(--foreground)] text-[var(--foreground)]"
                : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]",
            ].join(" ")}
          >
            IA
          </Link>
        ) : null}
        {canManageTeam(member) ? (
          <Link
            href="/dashboard/configuracion?tab=equipo"
            className={[
              "px-3 py-2 text-sm font-medium -mb-px border-b-2",
              tab === "equipo"
                ? "border-[var(--foreground)] text-[var(--foreground)]"
                : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]",
            ].join(" ")}
          >
            Equipo
          </Link>
        ) : null}
      </div>

      {error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {message}
        </p>
      ) : null}

      {tab === "web" ? <ConfiguracionWebChatSection /> : null}

      {tab === "integraciones" ? <ConfiguracionIntegracionesSection /> : null}

      {tab === "ia" ? (
        <div className="mt-8 space-y-4">
          <ConfiguracionIaMessagingSection />
          <AssistantInstructionsSlot />
          <BusinessKnowledgeSlots botId={botId} nested />
        </div>
      ) : null}

      {tab === "equipo" ? (
        <div className="mt-4">
          <TeamManagementPanel embedded />
        </div>
      ) : null}

      {tab === "cuenta" ? (
      <>
      <section className="mt-8 space-y-3">
        <h2 className="text-sm font-semibold">Empresa</h2>
        <label className="block text-xs text-[var(--muted)]">Nombre visible</label>
        <input
          type="text"
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          disabled={busy}
        />
        <button
          type="button"
          disabled={busy || orgName.trim().length < 2}
          onClick={() => void saveOrgName()}
          className="rounded-md bg-[var(--foreground)] px-4 py-2 text-sm text-[var(--background)] disabled:opacity-50"
        >
          Guardar nombre
        </button>
      </section>

      <section className="mt-10 space-y-3 border-t border-[var(--border)] pt-8">
        <h2 className="text-sm font-semibold">Correo</h2>
        <p className="text-sm text-[var(--muted)]">
          Actual: {account?.user.email ?? "—"}
          {account?.user.pendingEmail
            ? ` · Pendiente: ${account.user.pendingEmail}`
            : ""}
        </p>
        <input
          type="email"
          placeholder="Nuevo correo"
          value={emailNew}
          onChange={(e) => setEmailNew(e.target.value)}
          className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          disabled={busy || Boolean(emailChallenge)}
        />
        <PasswordField
          value={emailPwd}
          onChange={setEmailPwd}
          placeholder="Contraseña actual"
          autoComplete="current-password"
          className={inputClass}
          disabled={busy || Boolean(emailChallenge)}
        />
        {!emailChallenge ? (
          <button
            type="button"
            disabled={busy || !emailNew.trim()}
            onClick={() => void startEmailChange()}
            className="rounded-md border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-50"
          >
            Enviar código al nuevo correo
          </button>
        ) : (
          <>
            <input
              type="text"
              placeholder="Código del correo"
              value={emailCode}
              onChange={(e) => setEmailCode(e.target.value)}
              className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              disabled={busy}
            />
            <button
              type="button"
              disabled={busy || !emailCode.trim()}
              onClick={() => void verifyEmailChange()}
              className="rounded-md bg-[var(--foreground)] px-4 py-2 text-sm text-[var(--background)] disabled:opacity-50"
            >
              Confirmar correo
            </button>
          </>
        )}
      </section>

      <section className="mt-10 space-y-3 border-t border-[var(--border)] pt-8">
        <h2 className="text-sm font-semibold">Contraseña</h2>
        <PasswordField
          value={pwdCurrent}
          onChange={setPwdCurrent}
          placeholder="Contraseña actual"
          autoComplete="current-password"
          className={inputClass}
          disabled={busy}
        />
        <PasswordField
          value={pwdNew}
          onChange={setPwdNew}
          placeholder="Nueva contraseña (mín. 10 caracteres)"
          autoComplete="new-password"
          minLength={10}
          className={inputClass}
          disabled={busy}
        />
        <button
          type="button"
          disabled={busy || pwdNew.length < 10}
          onClick={() => void changePassword()}
          className="rounded-md border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-50"
        >
          Cambiar contraseña
        </button>
      </section>

      <section className="mt-10 space-y-3 border-t border-[var(--border)] pt-8">
        <h2 className="text-sm font-semibold text-red-800">Eliminar cuenta</h2>
        <p className="text-sm text-[var(--muted)]">
          Se eliminará tu espacio de trabajo y datos asociados tras{" "}
          {account?.deletionGraceDays ?? 3} días. Durante ese periodo no podrás
          iniciar sesión. Solo el dueño puede solicitarlo.
        </p>
        <PasswordField
          value={deletePwd}
          onChange={setDeletePwd}
          placeholder="Contraseña actual"
          autoComplete="current-password"
          className={inputClass}
          disabled={busy}
        />
        <input
          type="text"
          placeholder='Escribe ELIMINAR para confirmar'
          value={deleteConfirm}
          onChange={(e) => setDeleteConfirm(e.target.value)}
          className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          disabled={busy}
        />
        <button
          type="button"
          disabled={busy || deleteConfirm !== "ELIMINAR"}
          onClick={() => void scheduleDeletion()}
          className="rounded-md bg-red-700 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Programar eliminación
        </button>
      </section>
      </>
      ) : null}
    </main>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ApiHttpError } from "@/lib/api-error";
import { humanizeApiError } from "@/lib/errors";
import { PasswordField } from "@/components/password-field";

type FieldDef = {
  key: string;
  label: string;
  secret: boolean;
  required: boolean;
  placeholder?: string;
};

type Integration = {
  instanceId: string;
  status: string;
  lastError: string | null;
  paymentWebhook?: { incomingUrl: string };
  definition: {
    name: string;
    kind: string;
    description: string | null;
    fields: FieldDef[];
  };
  fieldState: Record<string, { set: boolean; masked?: string }>;
};

const STATUS: Record<string, string> = {
  pending: "Falta completar",
  connected: "Conectada",
  error: "Revisar",
};

function formatApiError(e: unknown): string {
  if (e instanceof ApiHttpError) {
    return e.message.trim() || humanizeApiError(e.code);
  }
  if (e instanceof Error) return e.message;
  return humanizeApiError("request_failed");
}

function credentialsComplete(item: Integration): boolean {
  return item.definition.fields.every((f) => {
    if (!f.required) return true;
    return Boolean(item.fieldState[f.key]?.set);
  });
}

function requiredFieldsSatisfied(
  item: Integration,
  draft: Record<string, string> | undefined,
  editing: boolean,
): boolean {
  return item.definition.fields.every((f) => {
    if (!f.required) return true;
    if (draft?.[f.key]?.trim()) return true;
    if (!editing && item.fieldState[f.key]?.set) return true;
    return false;
  });
}

function hasDraftChanges(draft: Record<string, string> | undefined): boolean {
  if (!draft) return false;
  return Object.values(draft).some((v) => v.trim().length > 0);
}

function webhookSecretFieldLabel(item: Integration): string | null {
  const hit = item.definition.fields.find(
    (f) =>
      /secret|webhook|evento/i.test(f.label) ||
      /eventsSecret|webhookSecret|events_secret/i.test(f.key),
  );
  return hit?.label ?? null;
}

function PaymentWebhookUrlBlock({
  item,
  url,
  loadFailed,
}: {
  item: Integration;
  url: string | null;
  loadFailed: boolean;
}) {
  const [copied, setCopied] = useState(false);
  if (item.definition.kind !== "payment") return null;

  const secretLabel = webhookSecretFieldLabel(item);

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--background)] p-3">
      <p className="text-xs font-medium">URL de eventos</p>
      {url ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="text"
            readOnly
            value={url}
            className="min-w-0 flex-1 rounded-md border border-[var(--border)] px-2 py-1.5 font-mono text-[11px]"
            onFocus={(e) => e.target.select()}
          />
          <button
            type="button"
            onClick={() => void copy()}
            className="shrink-0 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs"
          >
            {copied ? "Copiado" : "Copiar"}
          </button>
        </div>
      ) : loadFailed ? (
        <p className="mt-2 text-xs text-red-600">
          No pudimos cargar la URL. Recarga la página; si sigue igual, avisa a
          soporte.
        </p>
      ) : (
        <p className="mt-2 text-xs text-[var(--muted)]">Generando URL…</p>
      )}
    </div>
  );
}

function defaultEditing(
  item: Integration,
  explicit: Record<string, boolean>,
): boolean {
  if (explicit[item.instanceId] !== undefined) {
    return explicit[item.instanceId];
  }
  return !credentialsComplete(item);
}

export function DeskIntegrationsPanel() {
  const [items, setItems] = useState<Integration[]>([]);
  const [orgPaymentWebhookUrl, setOrgPaymentWebhookUrl] = useState<
    string | null
  >(null);
  const [paymentWebhookLoadFailed, setPaymentWebhookLoadFailed] =
    useState(false);
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>(
    {},
  );
  const [editingById, setEditingById] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    const d = await api<{ integrations: Integration[] }>(
      "/v1/admin/desk-integrations",
    );
    setItems(d.integrations);

    const hasPayment = d.integrations.some(
      (i) => i.definition.kind === "payment",
    );
    if (!hasPayment) {
      setOrgPaymentWebhookUrl(null);
      setPaymentWebhookLoadFailed(false);
      return;
    }

    const fromList = d.integrations.find(
      (i) => i.paymentWebhook?.incomingUrl,
    )?.paymentWebhook?.incomingUrl;
    if (fromList) {
      setOrgPaymentWebhookUrl(fromList);
      setPaymentWebhookLoadFailed(false);
      return;
    }

    setPaymentWebhookLoadFailed(false);
    try {
      const wh = await api<{ urls: { declarative: string } }>(
        "/v1/admin/commerce-payment-webhooks",
      );
      setOrgPaymentWebhookUrl(wh.urls.declarative);
    } catch {
      setOrgPaymentWebhookUrl(null);
      setPaymentWebhookLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    void load().catch(() => undefined);
  }, [load]);

  function setField(instanceId: string, key: string, value: string) {
    setError(null);
    setSuccess(null);
    setDrafts((prev) => ({
      ...prev,
      [instanceId]: { ...prev[instanceId], [key]: value },
    }));
  }

  function startEdit(instanceId: string) {
    setError(null);
    setSuccess(null);
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[instanceId];
      return next;
    });
    setEditingById((prev) => ({ ...prev, [instanceId]: true }));
  }

  function cancelEdit(instanceId: string) {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[instanceId];
      return next;
    });
    setEditingById((prev) => ({ ...prev, [instanceId]: false }));
  }

  async function save(instanceId: string, item: Integration) {
    setBusy(instanceId);
    setError(null);
    setSuccess(null);
    const editing = defaultEditing(item, editingById);
    try {
      const values = drafts[instanceId] ?? {};
      if (!requiredFieldsSatisfied(item, values, editing)) {
        setError("Completa los campos obligatorios antes de guardar.");
        return;
      }
      await api(`/v1/admin/desk-integrations/${instanceId}`, {
        method: "PUT",
        body: JSON.stringify({ values }),
      });
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[instanceId];
        return next;
      });
      setEditingById((prev) => ({ ...prev, [instanceId]: false }));
      await load();
      setSuccess("Credenciales guardadas.");
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(null);
    }
  }

  async function activate(instanceId: string, item: Integration) {
    setError(null);
    setSuccess(null);
    const editing = defaultEditing(item, editingById);
    if (editing && hasDraftChanges(drafts[instanceId])) {
      setError("Guarda o cancela los cambios antes de probar la conexión.");
      return;
    }
    if (!requiredFieldsSatisfied(item, drafts[instanceId], false)) {
      setError("Completa y guarda las credenciales antes de activar.");
      return;
    }
    setBusy(instanceId);
    try {
      if (item.status === "pending" && !credentialsComplete(item)) {
        const values = drafts[instanceId] ?? {};
        await api(`/v1/admin/desk-integrations/${instanceId}`, {
          method: "PUT",
          body: JSON.stringify({ values }),
        });
        setDrafts((prev) => {
          const next = { ...prev };
          delete next[instanceId];
          return next;
        });
        setEditingById((prev) => ({ ...prev, [instanceId]: false }));
      }
      await api(`/v1/admin/desk-integrations/${instanceId}/activate`, {
        method: "POST",
      });
      await load();
      setSuccess("Integración conectada y verificada.");
    } catch (e) {
      setError(formatApiError(e));
      await load().catch(() => undefined);
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-[var(--border)] p-6 text-sm text-[var(--muted)]">
        Aún no se han habilitado integraciones para tu cuenta. Cuando estén listas,
        aparecerán aquí para que completes los datos de tu negocio.
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {items.map((item) => {
        const draft = drafts[item.instanceId];
        const editing = defaultEditing(item, editingById);
        const canTest =
          !editing && requiredFieldsSatisfied(item, draft, false);
        return (
          <li
            key={item.instanceId}
            className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-medium">{item.definition.name}</h2>
              <span className="text-xs text-[var(--muted)]">
                {STATUS[item.status] ?? item.status}
              </span>
            </div>
            {item.definition.description && (
              <p className="mt-1 text-xs text-[var(--muted)]">
                {item.definition.description}
              </p>
            )}
            {item.lastError && (
              <p className="mt-2 text-xs text-red-600">{item.lastError}</p>
            )}

            <PaymentWebhookUrlBlock
              item={item}
              url={
                item.paymentWebhook?.incomingUrl ?? orgPaymentWebhookUrl
              }
              loadFailed={paymentWebhookLoadFailed}
            />

            {editing ? (
              <div className="mt-4 space-y-2">
                {item.definition.fields.map((f) => {
                  const stored = item.fieldState[f.key]?.set;
                  const placeholder =
                    f.placeholder ??
                    (stored && f.secret
                      ? "Dejar vacío para mantener el valor actual"
                      : stored
                        ? "Dejar vacío para mantener"
                        : "");
                  return (
                    <div key={f.key}>
                      <label className="text-xs font-medium">{f.label}</label>
                      {f.secret ? (
                        <PasswordField
                          value={draft?.[f.key] ?? ""}
                          onChange={(v) => setField(item.instanceId, f.key, v)}
                          placeholder={placeholder}
                          className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2 pr-16 text-sm"
                        />
                      ) : (
                        <input
                          type="text"
                          className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                          placeholder={placeholder}
                          value={draft?.[f.key] ?? ""}
                          onChange={(e) =>
                            setField(item.instanceId, f.key, e.target.value)
                          }
                          autoComplete="off"
                        />
                      )}
                    </div>
                  );
                })}
                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={busy === item.instanceId}
                    onClick={() => void save(item.instanceId, item)}
                    className="rounded-md bg-[var(--foreground)] px-4 py-2 text-xs text-[var(--background)] disabled:opacity-50"
                  >
                    Guardar
                  </button>
                  {credentialsComplete(item) ? (
                    <button
                      type="button"
                      disabled={busy === item.instanceId}
                      onClick={() => cancelEdit(item.instanceId)}
                      className="text-xs text-[var(--muted)] hover:underline"
                    >
                      Cancelar
                    </button>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <dl className="space-y-2 text-sm">
                  {item.definition.fields.map((f) => {
                    const st = item.fieldState[f.key];
                    const display =
                      st?.set
                        ? st.masked ?? "••••••••"
                        : "—";
                    return (
                      <div key={f.key}>
                        <dt className="text-xs font-medium text-[var(--muted)]">
                          {f.label}
                        </dt>
                        <dd className="mt-0.5 font-mono text-xs">{display}</dd>
                      </div>
                    );
                  })}
                </dl>
                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={busy === item.instanceId}
                    onClick={() => startEdit(item.instanceId)}
                    className="text-xs font-medium hover:underline"
                  >
                    Cambiar credenciales
                  </button>
                  <button
                    type="button"
                    disabled={busy === item.instanceId || !canTest}
                    title={
                      canTest
                        ? undefined
                        : "Guarda todas las credenciales obligatorias"
                    }
                    onClick={() => void activate(item.instanceId, item)}
                    className="rounded-md border border-[var(--border)] px-4 py-2 text-xs disabled:opacity-50"
                  >
                    Probar y activar
                  </button>
                </div>
              </div>
            )}
          </li>
        );
      })}
      {success && (
        <p
          className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
          role="status"
        >
          {success}
        </p>
      )}
      {error && (
        <p
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
          role="alert"
        >
          {error}
        </p>
      )}
    </ul>
  );
}

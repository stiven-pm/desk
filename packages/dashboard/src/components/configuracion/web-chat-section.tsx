"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { ApiHttpError } from "@/lib/api-error";
import { humanizeApiError } from "@/lib/errors";
import { fetchPrimaryBot } from "@/lib/primary-bot";

type WebConfig = {
  orgSlug: string;
  chatUrl: string;
  storefrontUrl: string;
  publishableKey: string;
  publishableKeyPrefix: string;
  allowedOrigins: string[];
  maxOrigins: number;
  apiUrl: string;
  widgetScriptUrl: string;
  hostScriptUrl: string;
  embedSnippet: string;
};

function formatError(e: unknown): string {
  if (e instanceof ApiHttpError) {
    return e.message.trim() || humanizeApiError(e.code);
  }
  if (e instanceof Error) return e.message;
  return humanizeApiError("request_failed");
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }
  return (
    <div>
      <p className="text-xs font-medium">{label}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <input
          type="text"
          readOnly
          value={value}
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
    </div>
  );
}

export function ConfiguracionWebChatSection() {
  const [botId, setBotId] = useState<string | null>(null);
  const [config, setConfig] = useState<WebConfig | null>(null);
  const [originsDraft, setOriginsDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async (id: string) => {
    const d = await api<WebConfig>(`/v1/admin/bots/${id}/web`);
    setConfig(d);
    setOriginsDraft(d.allowedOrigins.join("\n"));
  }, []);

  useEffect(() => {
    void fetchPrimaryBot()
      .then((b) => {
        setBotId(b?.id ?? null);
        if (b?.id) return load(b.id);
      })
      .catch(() => setError("No pudimos cargar la configuración web."));
  }, [load]);

  async function saveOrigins() {
    if (!botId) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    const lines = originsDraft
      .split(/\n|,/)
      .map((l) => l.trim())
      .filter(Boolean);
    try {
      const d = await api<WebConfig & { ok?: boolean }>(
        `/v1/admin/bots/${botId}/web`,
        {
          method: "PATCH",
          body: JSON.stringify({ allowedOrigins: lines }),
        },
      );
      setConfig(d);
      setOriginsDraft(d.allowedOrigins.join("\n"));
      setSuccess("Sitios permitidos guardados.");
    } catch (e) {
      setError(formatError(e));
    } finally {
      setBusy(false);
    }
  }

  if (!botId) {
    return (
      <p className="mt-8 text-sm text-[var(--muted)]">
        Aún no hay asistente. Completa el registro o contacta soporte.
      </p>
    );
  }

  if (!config) {
    return (
      <p className="mt-8 text-sm text-[var(--muted)]">
        Cargando chat web…
      </p>
    );
  }

  return (
    <div className="mt-8 space-y-8">
      <section className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="text-sm font-semibold">Tienda en Desk</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Una web automática en Desk con tu catálogo, carrito y asistente — sin
          montar hosting.
        </p>
        <div className="mt-3 space-y-3">
          <CopyRow label="URL de tu tienda" value={config.storefrontUrl} />
          <p className="text-xs text-[var(--muted)]">
            <Link
              href={config.storefrontUrl}
              className="underline underline-offset-2"
              target="_blank"
              rel="noreferrer"
            >
              Abrir en nueva pestaña
            </Link>
          </p>
        </div>
      </section>

      <section className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="text-sm font-semibold">Chat (enlace directo)</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Compártelo en redes o como destino del botón de tu web. Los clientes entran
          sin cuenta Desk.
        </p>
        <div className="mt-3 space-y-3">
          <CopyRow label="URL pública" value={config.chatUrl} />
          <p className="text-xs text-[var(--muted)]">
            <Link
              href={config.chatUrl}
              className="underline underline-offset-2"
              target="_blank"
              rel="noreferrer"
            >
              Abrir en nueva pestaña
            </Link>
          </p>
        </div>
      </section>

      <section className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="text-sm font-semibold">Sitios permitidos</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Dominios donde puedes incrustar el widget (origen completo, p. ej.{" "}
          <code className="text-[11px]">https://www.tutienda.com</code>). Máximo{" "}
          {config.maxOrigins} en tu plan. El chat en{" "}
          <code className="text-[11px]">desk.rekov.co</code> no hace falta
          listarlo aquí.
        </p>
        <textarea
          className="mt-3 min-h-[120px] w-full rounded-md border border-[var(--border)] px-3 py-2 font-mono text-xs"
          value={originsDraft}
          onChange={(e) => setOriginsDraft(e.target.value)}
          placeholder={"https://www.mitienda.com\nhttps://app.mitienda.com"}
          disabled={busy || config.maxOrigins <= 0}
        />
        <button
          type="button"
          disabled={busy || config.maxOrigins <= 0}
          onClick={() => void saveOrigins()}
          className="mt-3 rounded-md bg-[var(--foreground)] px-4 py-2 text-xs text-[var(--background)] disabled:opacity-50"
        >
          Guardar sitios
        </button>
      </section>

      <section className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="text-sm font-semibold">Integrar en tu web</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Pega este bloque antes de{" "}
          <code className="text-[11px]">&lt;/body&gt;</code> en tu sitio (uno de
          los dominios permitidos). La clave publicable es pública por diseño;
          no uses la clave secreta aquí.
        </p>
        <CopyRow
          label="Clave publicable"
          value={config.publishableKey}
        />
        <label className="mt-4 block text-xs font-medium">Código del widget</label>
        <textarea
          readOnly
          className="mt-1 min-h-[180px] w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-[11px]"
          value={config.embedSnippet}
          onFocus={(e) => e.target.select()}
        />
        <p className="mt-2 text-xs text-[var(--muted)]">
          Componentes avanzados en la página padre:{" "}
          <code className="text-[11px]">{config.hostScriptUrl}</code> — ver{" "}
          <code className="text-[11px]">docs/DESK_HOST.md</code> en el repo.
        </p>
      </section>

      {success ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {success}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </p>
      ) : null}
    </div>
  );
}

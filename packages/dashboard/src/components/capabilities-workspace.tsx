"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { fetchPrimaryBot } from "@/lib/primary-bot";
import {
  SetupCredentialModal,
  type PendingCredentialRequest,
} from "@/components/setup-credential-modal";
import { CurlImportPanel } from "@/components/curl-import-panel";

type Tab = "chat" | "connections" | "skills";

type Turn = { role: "user" | "assistant"; content: string };

type Skill = {
  slug: string;
  title: string;
  description: string;
  status: string;
};

type Summary = {
  integrationsEnabled: boolean;
  connectors: Array<{ connector_key: string; status: string; enabled: number }>;
  httpTools: Array<{ name: string; description: string; enabled: number }>;
  mcpServers: Array<{ id: string; name: string; enabled: number }>;
  mcpCatalog?: Array<{
    serverId: string;
    name: string;
    toolCount: number;
    syncedAt: string | null;
  }>;
  openapi: Array<{ base_url: string; enabled: number }>;
};

const CONNECTOR_LABEL: Record<string, string> = {
  shopify: "Shopify",
  woocommerce: "WooCommerce",
  hubspot: "HubSpot",
  google_sheets: "Google Sheets",
  siigo: "Siigo",
  alegra: "Alegra",
  odoo: "Odoo",
  zendesk: "Zendesk",
  supabase: "Supabase",
  custom_rest: "API propia",
};

const EXAMPLE_PROMPTS = [
  "Quiero conectar mi tienda online para que el bot consulte pedidos",
  "Crea un procedimiento para cuando pregunten por el estado de un envío",
  "¿Qué puede hacer mi asistente con lo que ya tengo configurado?",
];

function connectorLabel(key: string): string {
  return CONNECTOR_LABEL[key] ?? key.replace(/_/g, " ");
}

export function CapabilitiesWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: Tab =
    tabParam === "connections" || tabParam === "skills" ? tabParam : "chat";

  const setTab = (t: Tab) => {
    router.replace(`/dashboard/capabilities?tab=${t}`, { scroll: false });
  };

  const [botId, setBotId] = useState<string | null>(null);
  const [mcpRefreshing, setMcpRefreshing] = useState<string | null>(null);
  const [botName, setBotName] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credentialModal, setCredentialModal] =
    useState<PendingCredentialRequest | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadPending = useCallback(async (id: string, autoOpen: boolean) => {
    const res = await api<{ pending: PendingCredentialRequest[] }>(
      `/v1/admin/bots/${id}/setup-credentials/pending`,
    );
    if (autoOpen && res.pending[0]) {
      setCredentialModal(res.pending[0]);
    }
  }, []);

  const loadSkills = useCallback(async (id: string) => {
    const res = await api<{ skills: Skill[] }>(`/v1/admin/bots/${id}/skills`);
    setSkills(res.skills ?? []);
  }, []);

  const loadSummary = useCallback(async (id: string) => {
    try {
      const res = await api<Summary>(
        `/v1/admin/integrations/summary?botId=${encodeURIComponent(id)}`,
      );
      setSummary(res);
    } catch {
      setSummary(null);
    }
  }, []);

  const refreshSideData = useCallback(
    (id: string) => {
      void loadSkills(id);
      void loadSummary(id);
    },
    [loadSkills, loadSummary],
  );

  useEffect(() => {
    if (!localStorage.getItem("token")) {
      window.location.href = "/login";
      return;
    }
    void fetchPrimaryBot().then((b) => {
      if (!b) return;
      setBotId(b.id);
      setBotName(b.name);
      void loadPending(b.id, true);
      refreshSideData(b.id);
    });
  }, [loadPending, refreshSideData]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, sending, tab]);

  async function send(text?: string) {
    const message = (text ?? input).trim();
    if (!botId || !message || sending) return;
    setInput("");
    setError(null);
    const nextTurns: Turn[] = [...turns, { role: "user", content: message }];
    setTurns(nextTurns);
    setSending(true);
    try {
      const history = nextTurns.slice(-10, -1);
      const res = await api<{
        text: string;
        pendingCredentials?: PendingCredentialRequest[];
      }>(`/v1/admin/bots/${botId}/setup-agent/chat`, {
        method: "POST",
        body: JSON.stringify({ message, history }),
      });
      setTurns((t) => [...t, { role: "assistant", content: res.text }]);
      if (res.pendingCredentials?.length) {
        setCredentialModal(res.pendingCredentials[0]);
      }
      refreshSideData(botId);
      setTab("connections");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos enviar el mensaje");
    } finally {
      setSending(false);
    }
  }

  async function refreshMcpCatalog(serverId: string) {
    if (!botId) return;
    setMcpRefreshing(serverId);
    try {
      await api(`/v1/admin/bots/${botId}/mcp-servers/${serverId}/refresh-catalog`, {
        method: "POST",
      });
      refreshSideData(botId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar MCP");
    } finally {
      setMcpRefreshing(null);
    }
  }

  const connectionCount =
    (summary?.connectors?.filter((c) => c.enabled).length ?? 0) +
    (summary?.httpTools?.filter((t) => t.enabled).length ?? 0) +
    (summary?.mcpServers?.filter((m) => m.enabled).length ?? 0) +
    (summary?.openapi?.filter((o) => o.enabled).length ?? 0);

  const publishedSkills = skills.filter((s) => s.status === "published").length;

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <header className="max-w-2xl">
        <h1 className="font-display text-2xl tracking-tight">Capacidades</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          Conecta <strong className="text-[var(--foreground)]">{botName || "tu asistente"}</strong> a
          pedidos, CRM o lo que ya uses — para que el cliente deje de esperar mientras alguien busca
          en el sistema. PDFs en{" "}
          <Link href="/dashboard/documents" className="underline underline-offset-2">
            Conocimiento
          </Link>
          ; acciones en vivo aquí.
        </p>
      </header>

      <div
        className="mt-8 flex flex-wrap gap-2 border-b border-[var(--border)] pb-0 text-sm"
        role="tablist"
      >
        {(
          [
            ["chat", "Configurar (chat)"],
            ["connections", `Conexiones${connectionCount ? ` (${connectionCount})` : ""}`],
            ["skills", `Procedimientos${publishedSkills ? ` (${publishedSkills})` : ""}`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`rounded-t-md px-4 py-2.5 -mb-px border-b-2 transition-colors ${
              tab === id
                ? "border-[var(--foreground)] font-medium text-[var(--foreground)]"
                : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "chat" && (
        <section className="mt-6" role="tabpanel">
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5">
            <p className="text-sm text-[var(--muted)]">
              Habla como con un colega de sistemas: &quot;conecta mi WooCommerce&quot;,
              &quot;cuando pregunten por facturas busca en Siigo&quot;. Si hace falta una clave o
              contraseña, te pediremos un formulario seguro (no la escribas en el chat).
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {EXAMPLE_PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className="rounded-full border border-[var(--border)] bg-[var(--muted-bg)]/30 px-3 py-1.5 text-left text-xs hover:bg-[var(--muted-bg)]"
                  onClick={() => void send(p)}
                  disabled={sending || !botId}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="mt-5 min-h-[240px] max-h-[420px] overflow-y-auto space-y-3 rounded-md bg-[var(--muted-bg)]/20 p-3">
              {turns.length === 0 && (
                <p className="py-8 text-center text-sm text-[var(--muted)]">
                  Empieza con una frase o toca un ejemplo de arriba.
                </p>
              )}
              {turns.map((t, i) => (
                <div
                  key={i}
                  className={
                    t.role === "user"
                      ? "ml-6 text-sm whitespace-pre-wrap"
                      : "mr-6 rounded-lg bg-[var(--card)] border border-[var(--border)] p-3 text-sm whitespace-pre-wrap shadow-sm"
                  }
                >
                  <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
                    {t.role === "user" ? "Tú" : "Asistente de configuración"}
                  </span>
                  <div className="mt-1">{t.content}</div>
                </div>
              ))}
              {sending && (
                <p className="text-center text-sm text-[var(--muted)]">Pensando…</p>
              )}
              <div ref={bottomRef} />
            </div>
            {error && (
              <p className="mt-2 text-sm text-red-600" role="alert">{error}</p>
            )}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <textarea
                className="min-h-[72px] flex-1 rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                placeholder="Ej.: Conecta HubSpot para guardar los contactos del chat…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <button
                type="button"
                className="rounded-md bg-[var(--primary)] px-5 py-2.5 text-sm text-[var(--primary-foreground)] disabled:opacity-50 sm:self-end"
                disabled={sending || !botId}
                onClick={() => void send()}
              >
                Enviar
              </button>
            </div>
          </div>
        </section>
      )}

      {tab === "connections" && (
        <section className="mt-6" role="tabpanel">
          <CurlImportPanel botId={botId} />
          {connectionCount === 0 ? (
            <div className="mt-4 rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] p-8 text-center">
              <p className="text-sm text-[var(--muted)]">
                Todavía no hay conexiones. Cuando configures una en el chat, aparecerá aquí
                automáticamente.
              </p>
              <button
                type="button"
                className="mt-4 text-sm font-medium text-[var(--primary)] underline underline-offset-2"
                onClick={() => setTab("chat")}
              >
                Ir a configurar
              </button>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {(summary?.connectors ?? [])
                .filter((c) => c.enabled)
                .map((c) => (
                  <li
                    key={c.connector_key}
                    className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-4 py-3"
                  >
                    <span className="font-medium">{connectorLabel(c.connector_key)}</span>
                    <span className="text-xs text-[var(--muted)]">
                      {c.status === "connected" ? "Conectado" : c.status}
                    </span>
                  </li>
                ))}
              {(summary?.openapi ?? [])
                .filter((o) => o.enabled)
                .map((o, i) => (
                  <li
                    key={`openapi-${i}`}
                    className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-4 py-3"
                  >
                    <span className="font-medium">API (OpenAPI)</span>
                    <p className="mt-0.5 truncate text-xs text-[var(--muted)]">{o.base_url}</p>
                  </li>
                ))}
              {(summary?.mcpServers ?? [])
                .filter((m) => m.enabled)
                .map((m) => {
                  const cat = summary?.mcpCatalog?.find((c) => c.serverId === m.id);
                  return (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-4 py-3"
                  >
                    <div>
                      <span className="font-medium">{m.name}</span>
                      <p className="text-xs text-[var(--muted)]">
                        MCP · {cat?.toolCount ?? 0} acciones
                        {cat?.syncedAt ? ` · sync ${new Date(cat.syncedAt).toLocaleString()}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-xs underline underline-offset-2 disabled:opacity-50"
                      disabled={mcpRefreshing === m.id}
                      onClick={() => refreshMcpCatalog(m.id)}
                    >
                      {mcpRefreshing === m.id ? "Actualizando…" : "Actualizar catálogo"}
                    </button>
                  </li>
                  );
                })}
              {(summary?.httpTools ?? [])
                .filter((t) => t.enabled)
                .slice(0, 20)
                .map((t) => (
                  <li
                    key={t.name}
                    className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-4 py-3"
                  >
                    <span className="font-medium">{t.name}</span>
                    {t.description && (
                      <p className="mt-0.5 text-xs text-[var(--muted)] line-clamp-2">
                        {t.description}
                      </p>
                    )}
                  </li>
                ))}
            </ul>
          )}
        </section>
      )}

      {tab === "skills" && (
        <section className="mt-6" role="tabpanel">
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-5">
            <h2 className="text-sm font-medium">¿Qué es un procedimiento?</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
              Es una &quot;receta&quot; que el bot sigue en el chat público: pasos para buscar un
              pedido, escalar a ventas, etc. <strong>No se escriben en código</strong>: en la pestaña{" "}
              <button
                type="button"
                className="underline underline-offset-2"
                onClick={() => setTab("chat")}
              >
                Configurar
              </button>{" "}
              di por ejemplo: &quot;Guarda un procedimiento para cuando pregunten por garantías&quot;.
              Los borradores deben publicarse para que el cliente final los use.
            </p>
          </div>
          {skills.length === 0 ? (
            <p className="mt-6 text-center text-sm text-[var(--muted)]">
              Aún no hay procedimientos. Pídelos en el chat de configuración.
            </p>
          ) : (
            <ul className="mt-6 space-y-2">
              {skills.map((s) => (
                <li
                  key={s.slug}
                  className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-4 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{s.title}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                        s.status === "published"
                          ? "bg-green-100 text-green-800"
                          : s.status === "draft"
                            ? "bg-amber-100 text-amber-900"
                            : "bg-[var(--muted-bg)] text-[var(--muted)]"
                      }`}
                    >
                      {s.status === "published"
                        ? "Activo en el chat"
                        : s.status === "draft"
                          ? "Borrador"
                          : "Archivado"}
                    </span>
                  </div>
                  {s.description && (
                    <p className="mt-1 text-xs text-[var(--muted)]">{s.description}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            disabled={!botId || sending}
            className="mt-6 w-full rounded-md border border-[var(--border)] py-2.5 text-sm hover:bg-[var(--muted-bg)]/40 disabled:opacity-50"
            onClick={() => {
              if (!botId) return;
              void api(`/v1/admin/bots/${botId}/skills/install-template`, {
                method: "POST",
                body: JSON.stringify({ template: "commerce-co-native" }),
              })
                .then(() => refreshSideData(botId))
                .catch(() => setError("No se pudo instalar la plantilla de comercio."));
            }}
          >
            Instalar plantilla: comercio Colombia (borrador)
          </button>
          <button
            type="button"
            className="mt-2 w-full rounded-md border border-[var(--border)] py-2.5 text-sm hover:bg-[var(--muted-bg)]/40"
            onClick={() => setTab("chat")}
          >
            Crear o editar procedimientos en el chat
          </button>
        </section>
      )}

      <p className="mt-10 text-xs text-[var(--muted)]">
        El chat que ven tus clientes está en{" "}
        <Link
          href="/dashboard/configuracion?tab=web"
          className="underline underline-offset-2"
        >
          Publicar chat
        </Link>
        . Solo usa instrucciones, documentos y lo que publiques aquí.
      </p>

      {botId && credentialModal && (
        <SetupCredentialModal
          botId={botId}
          request={credentialModal}
          onClose={() => setCredentialModal(null)}
          onFulfilled={() => {
            setCredentialModal(null);
            void loadPending(botId, false);
            refreshSideData(botId);
          }}
        />
      )}
    </main>
  );
}

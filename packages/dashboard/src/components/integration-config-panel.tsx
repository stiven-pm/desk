"use client";

import type { IntegrationCatalogEntry } from "@chatbot/domain";
import type { IntegrationTileDef, TileMethodDef, TileMethodType } from "@/lib/integration-tiles";
import { methodSearchText } from "@/lib/integration-tiles";
import { IntegrationLogo } from "@/components/integration-logo";
import { HTTP_ENDPOINT_PRESETS } from "@/lib/http-endpoint-presets";

export type HttpToolSummary = {
  id: string;
  name: string;
  description: string;
  method: string;
  path: string;
  base_url: string;
  source: string;
};

type SummarySlice = {
  openapi: Array<{ id: string; base_url: string }>;
  httpTools: HttpToolSummary[];
  mcpServers: Array<{ id: string; name: string; server_url: string }>;
  connectors: Array<{ id: string; connector_key: string; status: string }>;
  webhooks: Array<{ id: string; url: string }>;
};

export function isEditableHttpTool(t: Pick<HttpToolSummary, "source" | "name">): boolean {
  return t.source === "manual" && !t.name.startsWith("conn_");
}

export type IntegrationPanelProps = {
  tile: IntegrationTileDef;
  method: TileMethodDef | null;
  methodFilter: string;
  onMethodFilter: (v: string) => void;
  onSelectMethod: (m: TileMethodDef) => void;
  onBackToMethods: () => void;
  onClose: () => void;
  summary: SummarySlice | null;
  catalogEntry?: IntegrationCatalogEntry;
  connectorDraft: Record<string, string>;
  onDraftField: (key: string, value: string) => void;
  savingConnector: boolean;
  onSaveCatalog: () => void;
  connectedCatalog: boolean;
  // OpenAPI
  openApiBase: string;
  openApiSpec: string;
  openApiAuth: string;
  onOpenApiBase: (v: string) => void;
  onOpenApiSpec: (v: string) => void;
  onOpenApiAuth: (v: string) => void;
  onSaveOpenApi: () => void;
  // HTTP
  httpName: string;
  httpDesc: string;
  httpBase: string;
  httpPath: string;
  httpMethod: string;
  onHttpName: (v: string) => void;
  onHttpDesc: (v: string) => void;
  onHttpBase: (v: string) => void;
  onHttpPath: (v: string) => void;
  onHttpMethod: (v: string) => void;
  onSaveHttp: () => void;
  onHttpPreset: (
    kind: "bearer_get" | "post_json" | "order_lookup" | "erp_odata" | "crm_contact",
  ) => void;
  httpListFilter: string;
  onHttpListFilter: (v: string) => void;
  editingHttpId: string | null;
  onEditHttp: (id: string) => void;
  onDeleteHttp: (id: string) => void;
  onCancelEditHttp: () => void;
  // MCP
  mcpName: string;
  mcpUrl: string;
  mcpAuthToken: string;
  onMcpName: (v: string) => void;
  onMcpUrl: (v: string) => void;
  onMcpAuthToken: (v: string) => void;
  onSaveMcp: () => void;
  mcpListFilter: string;
  onMcpListFilter: (v: string) => void;
  editingMcpId: string | null;
  onEditMcp: (id: string) => void;
  onDeleteMcp: (id: string) => void;
  onCancelEditMcp: () => void;
  // custom REST
  erpBaseUrl: string;
  erpToken: string;
  erpPath: string;
  onErpBaseUrl: (v: string) => void;
  onErpToken: (v: string) => void;
  onErpPath: (v: string) => void;
  onSaveErp: () => void;
  // Webhook
  webhookUrl: string;
  commercePayloadKeys: string;
  onWebhookUrl: (v: string) => void;
  onCommercePayloadKeys: (v: string) => void;
  onSaveWebhook: () => void;
  onSaveCommerceKeys: () => void;
  webhooksEnabled: boolean;
};

function matchesFilter(haystack: string, q: string): boolean {
  if (!q.trim()) return true;
  return haystack.toLowerCase().includes(q.trim().toLowerCase());
}

function MethodPicker({
  tile,
  filter,
  onFilter,
  onSelect,
}: {
  tile: IntegrationTileDef;
  filter: string;
  onFilter: (v: string) => void;
  onSelect: (m: TileMethodDef) => void;
}) {
  const methods = tile.methods.filter((m) => matchesFilter(methodSearchText(m), filter));

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--muted)]">
        Elige cómo quieres conectar. Puedes usar varias formas a la vez.
      </p>
      <input
        type="search"
        placeholder="Buscar forma de conexión…"
        value={filter}
        onChange={(e) => onFilter(e.target.value)}
        className="w-full rounded-md border px-3 py-2 text-sm"
      />
      <ul className="space-y-2">
        {methods.length === 0 && (
          <li className="text-sm text-[var(--muted)]">Ningún método coincide con la búsqueda.</li>
        )}
        {methods.map((m) => (
          <li key={m.type + m.label}>
            <button
              type="button"
              onClick={() => onSelect(m)}
              className="flex w-full flex-col rounded-lg border border-[var(--border)] px-4 py-3 text-left transition hover:border-[var(--primary)] hover:bg-[var(--muted)]/5"
            >
              <span className="text-sm font-medium">{m.label}</span>
              <span className="mt-0.5 text-xs text-[var(--muted)]">{m.description}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CatalogForm({
  entry,
  draft,
  onDraftField,
  saving,
  onSave,
  connected,
}: {
  entry: IntegrationCatalogEntry;
  draft: Record<string, string>;
  onDraftField: (key: string, value: string) => void;
  saving: boolean;
  onSave: () => void;
  connected: boolean;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--muted)]">{entry.blurb}</p>
      {connected && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-xs text-green-900">
          Ya hay una conexión activa. Deja los secretos en blanco para mantener los guardados o
          rellena solo lo que quieras actualizar.
        </p>
      )}
      {entry.helpUrl && (
        <a
          href={entry.helpUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-[var(--primary)] underline"
        >
          Cómo obtener credenciales
        </a>
      )}
      <div className="grid gap-3">
        {entry.fields.map((field) => (
          <label key={field.key} className="block text-xs">
            {field.label}
            {field.required && !connected ? " *" : ""}
            <input
              className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
              type={field.type === "password" ? "password" : "text"}
              placeholder={field.placeholder}
              autoComplete="off"
              value={draft[field.key] ?? ""}
              onChange={(e) => onDraftField(field.key, e.target.value)}
            />
          </label>
        ))}
      </div>
      <button
        type="button"
        disabled={saving}
        onClick={onSave}
        className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm text-[var(--primary-foreground)] disabled:opacity-60"
      >
        {saving ? "Guardando…" : connected ? "Actualizar conexión" : "Guardar conexión"}
      </button>
    </div>
  );
}

function HttpSection(p: IntegrationPanelProps) {
  const listed = (p.summary?.httpTools ?? []).filter((t) =>
    matchesFilter(`${t.name} ${t.method} ${t.path}`, p.httpListFilter),
  );

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium">Endpoints configurados</p>
        <input
          type="search"
          placeholder="Filtrar por nombre o ruta…"
          value={p.httpListFilter}
          onChange={(e) => p.onHttpListFilter(e.target.value)}
          className="mt-2 w-full rounded-md border px-3 py-2 text-sm"
        />
        <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-[var(--muted)]">
          {listed.length === 0 && <li>No hay endpoints o no coinciden con el filtro.</li>}
          {listed.map((t) => {
            const editable = isEditableHttpTool(t);
            return (
              <li
                key={t.id}
                className={`flex flex-wrap items-center justify-between gap-2 rounded border px-2 py-1.5 ${
                  p.editingHttpId === t.id ? "border-[var(--primary)] bg-[var(--muted)]/5" : ""
                }`}
              >
                <span>
                  <span className="font-medium text-[var(--foreground)]">{t.name}</span> —{" "}
                  {t.method} {t.path}
                  {!editable && (
                    <span className="ml-1 text-[10px] text-[var(--muted)]">(conector/OpenAPI)</span>
                  )}
                </span>
                {editable && (
                  <span className="flex gap-1">
                    <button
                      type="button"
                      className="rounded border px-2 py-0.5 text-[10px]"
                      onClick={() => p.onEditHttp(t.id)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="rounded border border-red-200 px-2 py-0.5 text-[10px] text-red-700"
                      onClick={() => p.onDeleteHttp(t.id)}
                    >
                      Eliminar
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      <div>
        <p className="text-sm font-medium">
          {p.editingHttpId ? "Editar endpoint" : "Añadir endpoint"}
        </p>
        {p.editingHttpId && (
          <button
            type="button"
            onClick={p.onCancelEditHttp}
            className="mt-1 text-xs text-[var(--primary)] underline"
          >
            Cancelar edición
          </button>
        )}
        <p className="mt-2 text-xs text-[var(--muted)]">
          Solo HTTPS. Define token o cabecera en cada endpoint; las credenciales no se muestran en el
          chat. Plantillas habituales:
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {HTTP_ENDPOINT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              title={preset.hint}
              onClick={() => p.onHttpPreset(preset.id)}
              className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs font-medium transition hover:border-[var(--primary)]"
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            className="rounded-md border px-3 py-2 text-sm"
            placeholder="nombre_funcion"
            value={p.httpName}
            onChange={(e) => p.onHttpName(e.target.value)}
          />
          <select
            className="rounded-md border px-3 py-2 text-sm"
            value={p.httpMethod}
            onChange={(e) => p.onHttpMethod(e.target.value)}
          >
            {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <input
            className="sm:col-span-2 rounded-md border px-3 py-2 text-sm"
            placeholder="Descripción"
            value={p.httpDesc}
            onChange={(e) => p.onHttpDesc(e.target.value)}
          />
          <input
            className="sm:col-span-2 rounded-md border px-3 py-2 text-sm"
            placeholder="Base URL"
            value={p.httpBase}
            onChange={(e) => p.onHttpBase(e.target.value)}
          />
          <input
            className="sm:col-span-2 rounded-md border px-3 py-2 font-mono text-xs"
            placeholder="/ruta/{id}"
            value={p.httpPath}
            onChange={(e) => p.onHttpPath(e.target.value)}
          />
          <button type="button" onClick={p.onSaveHttp} className="rounded-md border px-4 py-2 text-sm">
            {p.editingHttpId ? "Guardar cambios" : "Añadir endpoint"}
          </button>
        </div>
      </div>
    </div>
  );
}

function McpSection(p: IntegrationPanelProps) {
  const listed = (p.summary?.mcpServers ?? []).filter((m) =>
    matchesFilter(`${m.name} ${m.server_url}`, p.mcpListFilter),
  );

  return (
    <div className="space-y-4">
      <input
        type="search"
        placeholder="Filtrar servidores MCP…"
        value={p.mcpListFilter}
        onChange={(e) => p.onMcpListFilter(e.target.value)}
        className="w-full rounded-md border px-3 py-2 text-sm"
      />
      <ul className="max-h-32 space-y-1 overflow-y-auto text-xs text-[var(--muted)]">
        {listed.map((m) => (
          <li
            key={m.id}
            className={`flex flex-wrap items-center justify-between gap-2 rounded border px-2 py-1.5 ${
              p.editingMcpId === m.id ? "border-[var(--primary)] bg-[var(--muted)]/5" : ""
            }`}
          >
            <span>
              <span className="font-medium text-[var(--foreground)]">{m.name}</span> —{" "}
              {m.server_url}
            </span>
            <span className="flex gap-1">
              <button
                type="button"
                className="rounded border px-2 py-0.5 text-[10px]"
                onClick={() => p.onEditMcp(m.id)}
              >
                Editar
              </button>
              <button
                type="button"
                className="rounded border border-red-200 px-2 py-0.5 text-[10px] text-red-700"
                onClick={() => p.onDeleteMcp(m.id)}
              >
                Eliminar
              </button>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-sm text-[var(--muted)]">
        Usa una URL <strong>HTTPS</strong> de un servidor que tú controlas. Desk enviará las
        cabeceras de autorización en cada llamada; el token se guarda cifrado.
      </p>
      <p className="text-sm font-medium">
        {p.editingMcpId ? "Editar servidor" : "Añadir servidor"}
      </p>
      {p.editingMcpId && (
        <button
          type="button"
          onClick={p.onCancelEditMcp}
          className="text-xs text-[var(--primary)] underline"
        >
          Cancelar edición
        </button>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          className="rounded-md border px-3 py-2 text-sm"
          placeholder="Nombre"
          value={p.mcpName}
          onChange={(e) => p.onMcpName(e.target.value)}
        />
        <input
          className="rounded-md border px-3 py-2 text-sm"
          placeholder="https://mcp.tu-servidor.com"
          value={p.mcpUrl}
          onChange={(e) => p.onMcpUrl(e.target.value)}
        />
        <input
          className="sm:col-span-2 rounded-md border px-3 py-2 text-sm"
          type="password"
          placeholder="Bearer token o API key (recomendado)"
          value={p.mcpAuthToken}
          onChange={(e) => p.onMcpAuthToken(e.target.value)}
          autoComplete="off"
        />
        <button type="button" onClick={p.onSaveMcp} className="rounded-md border px-4 py-2 text-sm">
          {p.editingMcpId ? "Guardar cambios" : "Guardar servidor MCP"}
        </button>
      </div>
    </div>
  );
}

function renderMethodBody(type: TileMethodType, p: IntegrationPanelProps) {
  switch (type) {
    case "catalog":
      if (!p.catalogEntry) return null;
      return (
        <CatalogForm
          entry={p.catalogEntry}
          draft={p.connectorDraft}
          onDraftField={p.onDraftField}
          saving={p.savingConnector}
          onSave={p.onSaveCatalog}
          connected={p.connectedCatalog}
        />
      );
    case "openapi":
      return (
        <div className="grid gap-3">
          {(p.summary?.openapi ?? []).length > 0 && (
            <ul className="text-xs text-[var(--muted)]">
              {p.summary!.openapi.map((o) => (
                <li key={o.id}>Configurado: {o.base_url}</li>
              ))}
            </ul>
          )}
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="Base URL https://api.tu-empresa.com"
            value={p.openApiBase}
            onChange={(e) => p.onOpenApiBase(e.target.value)}
          />
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="Bearer token (opcional)"
            value={p.openApiAuth}
            onChange={(e) => p.onOpenApiAuth(e.target.value)}
          />
          <textarea
            className="min-h-[120px] w-full rounded-md border px-3 py-2 font-mono text-xs"
            placeholder='{"openapi":"3.0.0",...}'
            value={p.openApiSpec}
            onChange={(e) => p.onOpenApiSpec(e.target.value)}
          />
          <button
            type="button"
            onClick={p.onSaveOpenApi}
            className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm text-[var(--primary-foreground)]"
          >
            Guardar OpenAPI
          </button>
        </div>
      );
    case "http":
      return <HttpSection {...p} />;
    case "mcp":
      return <McpSection {...p} />;
    case "custom_rest":
      return (
        <div className="grid gap-3">
          <input
            className="rounded-md border px-3 py-2 text-sm"
            placeholder="https://erp.tu-empresa.com"
            value={p.erpBaseUrl}
            onChange={(e) => p.onErpBaseUrl(e.target.value)}
          />
          <input
            className="rounded-md border px-3 py-2 text-sm"
            type="password"
            placeholder="Token / Bearer (opcional)"
            value={p.erpToken}
            onChange={(e) => p.onErpToken(e.target.value)}
            autoComplete="off"
          />
          <input
            className="rounded-md border px-3 py-2 font-mono text-xs"
            placeholder="/api/v1/clientes/{id}"
            value={p.erpPath}
            onChange={(e) => p.onErpPath(e.target.value)}
          />
          <button
            type="button"
            onClick={p.onSaveErp}
            className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm text-[var(--primary-foreground)]"
          >
            Vincular API
          </button>
        </div>
      );
    case "webhook":
      if (!p.webhooksEnabled) {
        return (
          <p className="text-sm text-[var(--muted)]">
            Los webhooks salientes requieren plan Growth o Business.
          </p>
        );
      }
      return (
        <div className="space-y-4">
          {(p.summary?.webhooks ?? []).map((w) => (
            <p key={w.id} className="text-xs text-[var(--muted)]">
              Registrado: {w.url}
            </p>
          ))}
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="https://tu-backend.com/desk-events"
            value={p.webhookUrl}
            onChange={(e) => p.onWebhookUrl(e.target.value)}
          />
          <button type="button" onClick={p.onSaveWebhook} className="rounded-md border px-4 py-2 text-sm">
            Registrar webhook
          </button>
          <div>
            <p className="text-xs text-[var(--muted)]">
              Allowlist de claves en <code>payload</code> de commerce.intent (vacío = cualquier clave
              válida).
            </p>
            <input
              className="mt-2 w-full rounded-md border px-3 py-2 text-sm"
              placeholder="sku, qty, variantId"
              value={p.commercePayloadKeys}
              onChange={(e) => p.onCommercePayloadKeys(e.target.value)}
            />
            <button
              type="button"
              onClick={p.onSaveCommerceKeys}
              className="mt-2 rounded-md border px-4 py-2 text-sm"
            >
              Guardar allowlist
            </button>
          </div>
        </div>
      );
    default:
      return null;
  }
}

export function IntegrationConfigPanel(p: IntegrationPanelProps) {
  const { tile, method, onClose, onBackToMethods } = p;
  const showMethodPicker = tile.methods.length > 1 && !method;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="integration-panel-title"
      onClick={onClose}
    >
      <div
        className="max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <IntegrationLogo name={tile.name} brand={tile.brand} size={36} />
          <div className="min-w-0 flex-1">
            <h2 id="integration-panel-title" className="font-display text-lg font-medium">
              {tile.name}
            </h2>
            <p className="text-sm text-[var(--muted)]">{tile.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-2 py-1 text-xs text-[var(--muted)]"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="mt-5">
          {showMethodPicker && (
            <MethodPicker
              tile={tile}
              filter={p.methodFilter}
              onFilter={p.onMethodFilter}
              onSelect={p.onSelectMethod}
            />
          )}
          {!showMethodPicker && method && (
            <div className="space-y-4">
              {tile.methods.length > 1 && (
                <button
                  type="button"
                  onClick={onBackToMethods}
                  className="text-xs text-[var(--primary)] underline"
                >
                  ← Otras formas de conectar
                </button>
              )}
              <p className="text-sm font-medium">{method.label}</p>
              {renderMethodBody(method.type, p)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

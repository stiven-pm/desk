"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  INTEGRATION_CATALOG,
  type IntegrationCatalogEntry,
} from "@chatbot/domain";
import { api } from "@/lib/api";
import {
  INTEGRATION_TILES,
  integrationCategoryLabel,
  tileSearchText,
  type IntegrationTileCategory,
  type IntegrationTileDef,
  type TileMethodDef,
} from "@/lib/integration-tiles";
import { IntegrationMarketplaceCard } from "@/components/integration-marketplace-card";
import { IntegrationConfigPanel } from "@/components/integration-config-panel";
import { IntegrationsSecurityNote } from "@/components/integrations-security-note";
import { ConfirmDialog } from "@/components/confirm-dialog";

type Bot = { id: string; name: string };

type PlanLimits = {
  maxHttpToolsPerBot: number;
  maxMcpServersPerBot: number;
  maxConnectorsPerBot: number;
  maxOrgWebhooks: number;
};

type Summary = {
  limits: PlanLimits;
  integrationsEnabled: boolean;
  openapi: Array<{ id: string; base_url: string; enabled: number }>;
  httpTools: Array<{
    id: string;
    name: string;
    description: string;
    method: string;
    path: string;
    base_url: string;
    source: string;
  }>;
  mcpServers: Array<{ id: string; name: string; server_url: string }>;
  connectors: Array<{ id: string; connector_key: string; status: string }>;
  webhooks: Array<{ id: string; url: string }>;
  commercePayloadKeys?: string[];
};

const CONNECTOR_ERROR_ES: Record<string, string> = {
  siigo_credentials_incomplete: "Completa usuario API, Access Key y Partner-Id de Siigo.",
  siigo_auth_failed: "Siigo rechazó las credenciales. Revisa usuario, key y Partner-Id.",
  hubspot_token_required: "Pega el token de tu app privada de HubSpot.",
  spreadsheet_id_required: "Indica el ID de la hoja de Google.",
  sheets_auth_required: "Añade API key de Google Cloud o un token de acceso.",
  shopify_credentials_incomplete: "Indica tienda y token Admin API.",
  woocommerce_credentials_incomplete: "Completa URL, consumer key y secret.",
  odoo_credentials_incomplete: "Indica URL de Odoo y API key.",
  alegra_credentials_incomplete: "Indica email y token de Alegra.",
  zendesk_credentials_incomplete: "Completa subdominio, email y token Zendesk.",
  supabase_credentials_incomplete: "Indica URL del proyecto Supabase y API key.",
  postgres_proxy_url_required: "Indica la URL de tu proxy HTTP de solo lectura.",
};

const CATEGORY_FILTERS: Array<IntegrationTileCategory | "all"> = [
  "all",
  "erp",
  "crm",
  "ecommerce",
  "sheets",
  "support",
  "data",
  "developer",
  "events",
];

const CATALOG_SECTION_ORDER: IntegrationTileCategory[] = [
  "erp",
  "crm",
  "ecommerce",
  "sheets",
  "support",
  "data",
  "developer",
  "events",
];

function IntegrationCardGrid({
  tiles,
  summary,
  onOpen,
}: {
  tiles: IntegrationTileDef[];
  summary: Summary;
  onOpen: (tile: IntegrationTileDef) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {tiles.map((tile) => (
        <IntegrationMarketplaceCard
          key={tile.id}
          tile={tile}
          connected={tileConnected(tile, summary)}
          compactStatus={
            tileConnected(tile, summary) ? tileDetail(tile, summary) : undefined
          }
          onClick={() => onOpen(tile)}
        />
      ))}
    </div>
  );
}

function tileConnected(tile: IntegrationTileDef, summary: Summary | null): boolean {
  if (!summary) return false;
  if (tile.id === "developer") {
    return (
      summary.openapi.length > 0 ||
      summary.httpTools.length > 0 ||
      summary.mcpServers.length > 0 ||
      summary.connectors.some((c) => c.connector_key === "custom_rest")
    );
  }
  if (tile.id === "webhooks") return summary.webhooks.length > 0;
  const entry = INTEGRATION_CATALOG.find((e) => e.id === tile.id);
  if (entry) {
    return summary.connectors.some(
      (c) => c.connector_key === entry.connectorKey && c.status === "connected",
    );
  }
  return false;
}

function tileDetail(tile: IntegrationTileDef, summary: Summary | null): string | undefined {
  if (!summary || !tileConnected(tile, summary)) return tile.subtitle.slice(0, 60);
  if (tile.id === "developer") {
    const n =
      summary.openapi.length +
      summary.httpTools.length +
      summary.mcpServers.length +
      summary.connectors.filter((c) => c.connector_key === "custom_rest").length;
    return `${n} conexión(es) activa(s)`;
  }
  if (tile.id === "webhooks") return `${summary.webhooks.length} webhook(s)`;
  return "Conectado";
}

export function IntegrationsWorkspace() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [botId, setBotId] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectorDrafts, setConnectorDrafts] = useState<Record<string, Record<string, string>>>(
    {},
  );
  const [savingConnector, setSavingConnector] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<IntegrationTileCategory | "all">("all");
  const [activeTile, setActiveTile] = useState<IntegrationTileDef | null>(null);
  const [activeMethod, setActiveMethod] = useState<TileMethodDef | null>(null);
  const [methodFilter, setMethodFilter] = useState("");
  const [httpListFilter, setHttpListFilter] = useState("");
  const [mcpListFilter, setMcpListFilter] = useState("");
  const [editingHttpToolId, setEditingHttpToolId] = useState<string | null>(null);
  const [editingMcpServerId, setEditingMcpServerId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    run: () => Promise<void>;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const [openApiBase, setOpenApiBase] = useState("");
  const [openApiSpec, setOpenApiSpec] = useState("");
  const [openApiAuth, setOpenApiAuth] = useState("");

  const [httpName, setHttpName] = useState("get_order");
  const [httpDesc, setHttpDesc] = useState("Consulta un pedido por ID");
  const [httpBase, setHttpBase] = useState("");
  const [httpPath, setHttpPath] = useState("/orders/{orderId}");
  const [httpMethod, setHttpMethod] = useState("GET");

  const [mcpName, setMcpName] = useState("principal");
  const [mcpUrl, setMcpUrl] = useState("");
  const [mcpAuthToken, setMcpAuthToken] = useState("");

  const [webhookUrl, setWebhookUrl] = useState("");
  const [commercePayloadKeys, setCommercePayloadKeys] = useState("");

  const [erpBaseUrl, setErpBaseUrl] = useState("");
  const [erpToken, setErpToken] = useState("");
  const [erpPath, setErpPath] = useState("/api/v1/recurso/{id}");

  const loadSummary = useCallback(async (id: string) => {
    if (!id) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    const data = await api<Summary>(
      `/v1/admin/integrations/summary?botId=${encodeURIComponent(id)}`,
      { token },
    );
    setSummary(data);
    setCommercePayloadKeys((data.commercePayloadKeys ?? []).join(", "));
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login";
      return;
    }
    api<{ bots: Bot[] }>("/v1/admin/bots", { token })
      .then((d) => {
        setBots(d.bots);
        if (d.bots[0]) setBotId(d.bots[0].id);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (botId) loadSummary(botId).catch(() => setSummary(null));
  }, [botId, loadSummary]);

  const filteredTiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return INTEGRATION_TILES.filter((t) => {
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      if (!q) return true;
      return tileSearchText(t).includes(q);
    });
  }, [search, categoryFilter]);

  const catalogBySection = useMemo(() => {
    if (search.trim() || categoryFilter !== "all") return null;
    return CATALOG_SECTION_ORDER.map((category) => ({
      category,
      tiles: filteredTiles.filter((t) => t.category === category),
    })).filter((s) => s.tiles.length > 0);
  }, [search, categoryFilter, filteredTiles]);

  const connectedTiles = useMemo(
    () => INTEGRATION_TILES.filter((t) => tileConnected(t, summary)),
    [summary],
  );

  function openTile(tile: IntegrationTileDef) {
    setActiveTile(tile);
    setMethodFilter("");
    setHttpListFilter("");
    setMcpListFilter("");
    if (tile.methods.length === 1) {
      setActiveMethod(tile.methods[0]!);
    } else {
      setActiveMethod(null);
    }
  }

  function closePanel() {
    setActiveTile(null);
    setActiveMethod(null);
  }

  function setDraftField(entryId: string, key: string, value: string) {
    setConnectorDrafts((prev) => ({
      ...prev,
      [entryId]: { ...(prev[entryId] ?? {}), [key]: value },
    }));
  }

  const activeCatalogEntry: IntegrationCatalogEntry | undefined = useMemo(() => {
    if (!activeTile || !activeMethod || activeMethod.type !== "catalog") return undefined;
    const id = activeMethod.catalogId ?? activeTile.id;
    return INTEGRATION_CATALOG.find((e) => e.id === id);
  }, [activeTile, activeMethod]);

  async function saveCatalogConnector(entry: IntegrationCatalogEntry) {
    setError(null);
    setMessage(null);
    const token = localStorage.getItem("token");
    if (!token || !botId) return;
    const draft = connectorDrafts[entry.id] ?? {};
    const alreadyConnected = summary?.connectors.some(
      (c) => c.connector_key === entry.connectorKey,
    );
    const config: Record<string, string> = {};
    for (const field of entry.fields) {
      const v = (draft[field.key] ?? "").trim();
      if (field.required && !v && !alreadyConnected) {
        setError(`Completa «${field.label}» en ${entry.name}.`);
        return;
      }
      if (v) config[field.key] = v;
    }
    if (!alreadyConnected && Object.keys(config).length === 0) {
      setError(`Completa los campos de ${entry.name}.`);
      return;
    }
    setSavingConnector(entry.id);
    try {
      const r = await api<{ tools: number }>(`/v1/admin/bots/${botId}/connectors`, {
        method: "PUT",
        token,
        body: JSON.stringify({
          connectorKey: entry.connectorKey,
          config,
        }),
      });
      setMessage(
        `${entry.name} conectado. ${r.tools > 0 ? `${r.tools} herramienta(s) activa(s).` : "Revisa credenciales si no ves herramientas."}`,
      );
      await loadSummary(botId);
    } catch (e) {
      const code = e instanceof Error ? e.message : "failed";
      setError(CONNECTOR_ERROR_ES[code] ?? code);
    } finally {
      setSavingConnector(null);
    }
  }

  async function saveOpenApi() {
    setError(null);
    setMessage(null);
    const token = localStorage.getItem("token");
    if (!token || !botId) return;
    try {
      const r = await api<{ toolsSynced: number }>(
        `/v1/admin/bots/${botId}/openapi`,
        {
          method: "PUT",
          token,
          body: JSON.stringify({
            baseUrl: openApiBase,
            spec: openApiSpec,
            authType: openApiAuth ? "bearer" : "none",
            authSecret: openApiAuth || undefined,
          }),
        },
      );
      setMessage(`OpenAPI guardado. ${r.toolsSynced} herramientas sincronizadas.`);
      await loadSummary(botId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    }
  }

  function resetHttpForm() {
    setEditingHttpToolId(null);
    setHttpName("get_order");
    setHttpDesc("Consulta un pedido por ID");
    setHttpBase("");
    setHttpPath("/orders/{orderId}");
    setHttpMethod("GET");
  }

  function startEditHttpTool(id: string) {
    const tool = summary?.httpTools.find((t) => t.id === id);
    if (!tool) return;
    setEditingHttpToolId(id);
    setHttpName(tool.name);
    setHttpDesc(tool.description || "");
    setHttpBase(tool.base_url || "");
    setHttpPath(tool.path);
    setHttpMethod(tool.method);
  }

  async function saveHttpTool() {
    setError(null);
    const token = localStorage.getItem("token");
    if (!token || !botId) return;
    const body = {
      name: httpName,
      description: httpDesc,
      method: httpMethod,
      baseUrl: httpBase,
      path: httpPath,
      parameters: [{ name: "orderId", in: "path", required: true }],
    };
    try {
      if (editingHttpToolId) {
        await api(`/v1/admin/bots/${botId}/http-tools/${editingHttpToolId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(body),
        });
        setMessage("Endpoint HTTP actualizado.");
      } else {
        await api(`/v1/admin/bots/${botId}/http-tools`, {
          method: "POST",
          token,
          body: JSON.stringify(body),
        });
        setMessage("Endpoint HTTP añadido.");
      }
      resetHttpForm();
      await loadSummary(botId);
    } catch (e) {
      const code = e instanceof Error ? e.message : "failed";
      setError(code === "tool_not_editable" ? "Este endpoint no se puede editar aquí." : code);
    }
  }

  function requestDeleteHttpTool(id: string) {
    setConfirmDialog({
      message: "¿Eliminar este endpoint HTTP?",
      run: () => deleteHttpTool(id),
    });
  }

  async function deleteHttpTool(id: string) {
    setError(null);
    const token = localStorage.getItem("token");
    if (!token || !botId) return;
    try {
      await api(`/v1/admin/bots/${botId}/http-tools/${id}`, {
        method: "DELETE",
        token,
      });
      if (editingHttpToolId === id) resetHttpForm();
      setMessage("Endpoint eliminado.");
      await loadSummary(botId);
    } catch (e) {
      const code = e instanceof Error ? e.message : "failed";
      setError(code === "tool_not_editable" ? "Este endpoint no se puede eliminar aquí." : code);
    }
  }

  function resetMcpForm() {
    setEditingMcpServerId(null);
    setMcpName("principal");
    setMcpUrl("");
    setMcpAuthToken("");
  }

  function mcpSaveBody(): { name: string; serverUrl: string; headers?: Record<string, string> } {
    const body: { name: string; serverUrl: string; headers?: Record<string, string> } = {
      name: mcpName,
      serverUrl: mcpUrl,
    };
    const token = mcpAuthToken.trim();
    if (token) {
      body.headers = { Authorization: `Bearer ${token}` };
    }
    return body;
  }

  function startEditMcpServer(id: string) {
    const server = summary?.mcpServers.find((m) => m.id === id);
    if (!server) return;
    setEditingMcpServerId(id);
    setMcpName(server.name);
    setMcpUrl(server.server_url);
  }

  async function saveMcp() {
    setError(null);
    const token = localStorage.getItem("token");
    if (!token || !botId) return;
    try {
      if (editingMcpServerId) {
        await api(`/v1/admin/bots/${botId}/mcp-servers/${editingMcpServerId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(mcpSaveBody()),
        });
        setMessage("Servidor MCP actualizado.");
        resetMcpForm();
      } else {
        await api(`/v1/admin/bots/${botId}/mcp-servers`, {
          method: "PUT",
          token,
          body: JSON.stringify(mcpSaveBody()),
        });
        setMessage("Servidor MCP guardado.");
      }
      await loadSummary(botId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    }
  }

  function requestDeleteMcpServer(id: string) {
    setConfirmDialog({
      message: "¿Eliminar este servidor MCP?",
      run: () => deleteMcpServer(id),
    });
  }

  async function deleteMcpServer(id: string) {
    setError(null);
    const token = localStorage.getItem("token");
    if (!token || !botId) return;
    try {
      await api(`/v1/admin/bots/${botId}/mcp-servers/${id}`, {
        method: "DELETE",
        token,
      });
      if (editingMcpServerId === id) resetMcpForm();
      setMessage("Servidor MCP eliminado.");
      await loadSummary(botId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    }
  }

  async function saveCommercePayloadKeys() {
    setError(null);
    const token = localStorage.getItem("token");
    if (!token) return;
    const keys = commercePayloadKeys
      .split(/[,;\s]+/)
      .map((k) => k.trim())
      .filter(Boolean);
    try {
      await api("/v1/admin/org-commerce-settings", {
        method: "PATCH",
        token,
        body: JSON.stringify({ commercePayloadKeys: keys }),
      });
      setMessage("Claves permitidas en commerce.intent guardadas.");
      if (botId) await loadSummary(botId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    }
  }

  async function saveWebhook() {
    setError(null);
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      await api("/v1/admin/org-webhooks", {
        method: "PUT",
        token,
        body: JSON.stringify({
          url: webhookUrl,
          events: [
            "conversation.handoff",
            "conversation.message",
            "commerce.intent",
          ],
        }),
      });
      setMessage("Webhook registrado.");
      if (botId) await loadSummary(botId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    }
  }

  async function saveErpConnector() {
    setError(null);
    const token = localStorage.getItem("token");
    if (!token || !botId || !erpBaseUrl.trim()) return;
    try {
      await api(`/v1/admin/bots/${botId}/connectors`, {
        method: "PUT",
        token,
        body: JSON.stringify({
          connectorKey: "custom_rest",
          config: {
            baseUrl: erpBaseUrl.trim().replace(/\/$/, ""),
            authType: "bearer",
            authSecret: erpToken.trim() || undefined,
            tools: [
              {
                name: "erp_consulta",
                description:
                  "Consulta un registro en tu ERP o API interna por identificador",
                method: "GET",
                path: erpPath.trim() || "/{id}",
                parameters: [{ name: "id", in: "path", required: true }],
              },
            ],
          },
        }),
      });
      setMessage("API de ERP / sistema interno vinculada.");
      await loadSummary(botId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    }
  }

  function applyHttpPreset(
    kind: "bearer_get" | "post_json" | "order_lookup" | "erp_odata" | "crm_contact",
  ) {
    if (kind === "bearer_get") {
      setHttpName("get_resource");
      setHttpDesc("Obtiene un recurso por ID desde tu API");
      setHttpMethod("GET");
      setHttpPath("/v1/recurso/{id}");
    } else if (kind === "post_json") {
      setHttpName("create_ticket");
      setHttpDesc("Crea un registro en tu sistema");
      setHttpMethod("POST");
      setHttpPath("/v1/tickets");
    } else if (kind === "order_lookup") {
      setHttpName("get_order");
      setHttpDesc("Consulta un pedido por número");
      setHttpMethod("GET");
      setHttpPath("/orders/{orderId}");
    } else if (kind === "erp_odata") {
      setHttpName("erp_entity");
      setHttpDesc("Lee una entidad del ERP (SAP OData, etc.)");
      setHttpMethod("GET");
      setHttpPath("/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner('{id}')");
    } else {
      setHttpName("crm_contact");
      setHttpDesc("Busca un contacto o cliente en tu CRM");
      setHttpMethod("GET");
      setHttpPath("/crm/v1/contacts/{id}");
    }
  }

  const multiBot = bots.length > 1;
  const catalogConnected = activeCatalogEntry
    ? summary?.connectors.some(
        (c) =>
          c.connector_key === activeCatalogEntry.connectorKey && c.status === "connected",
      )
    : false;

  return (
    <div className="space-y-8">
      {multiBot && (
        <label className="block text-sm">
          Asistente
          <select
            className="mt-1 block rounded-md border px-3 py-2"
            value={botId}
            onChange={(e) => setBotId(e.target.value)}
          >
            {bots.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </label>
      )}

      {message && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-900">{message}</p>
      )}
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}

      {summary?.integrationsEnabled && (
        <>
          {connectedTiles.length > 0 && (
            <section className="space-y-3">
              <div>
                <h2 className="font-medium">Conectadas ahora</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Las que ya usas en este asistente. Clic para ver o editar.
                </p>
              </div>
              <IntegrationCardGrid
                tiles={connectedTiles}
                summary={summary}
                onOpen={openTile}
              />
            </section>
          )}

          <IntegrationsSecurityNote />

          <section className="space-y-4">
            <div>
              <h2 className="font-medium">Añadir conexión</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Busca por nombre: Siigo, SAP, Shopify, Excel, Zendesk, base de datos… Si no aparece
                tu ERP, usa <strong>Sistema propio o SAP</strong> (API de tu proveedor).
              </p>
            </div>

            <input
              type="search"
              placeholder="Buscar Siigo, Alegra, Excel, SAP, Shopify…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full max-w-md rounded-md border px-3 py-2 text-sm"
            />

            <div className="flex flex-wrap gap-2">
              {CATEGORY_FILTERS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategoryFilter(c)}
                  className={`rounded-full px-3 py-1 text-xs ${
                    categoryFilter === c
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                      : "border border-[var(--border)] text-[var(--muted)]"
                  }`}
                >
                  {c === "all" ? "Todas" : integrationCategoryLabel(c)}
                </button>
              ))}
            </div>

            {filteredTiles.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                Ninguna integración coincide. Prueba otro término o categoría.
              </p>
            ) : catalogBySection ? (
              <div className="space-y-8">
                {catalogBySection.map(({ category, tiles }) => (
                  <div key={category}>
                    <h3 className="text-sm font-medium text-[var(--foreground)]">
                      {integrationCategoryLabel(category)}
                    </h3>
                    <div className="mt-3">
                      <IntegrationCardGrid
                        tiles={tiles}
                        summary={summary}
                        onOpen={openTile}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <IntegrationCardGrid
                tiles={filteredTiles}
                summary={summary}
                onOpen={openTile}
              />
            )}
          </section>
        </>
      )}

      {activeTile && summary?.integrationsEnabled && (
        <IntegrationConfigPanel
          tile={activeTile}
          method={activeMethod}
          methodFilter={methodFilter}
          onMethodFilter={setMethodFilter}
          onSelectMethod={setActiveMethod}
          onBackToMethods={() => setActiveMethod(null)}
          onClose={closePanel}
          summary={summary}
          catalogEntry={activeCatalogEntry}
          connectorDraft={
            activeCatalogEntry
              ? (connectorDrafts[activeCatalogEntry.id] ?? {})
              : {}
          }
          onDraftField={(key, value) => {
            if (activeCatalogEntry) setDraftField(activeCatalogEntry.id, key, value);
          }}
          savingConnector={savingConnector === activeCatalogEntry?.id}
          onSaveCatalog={() => {
            if (activeCatalogEntry) saveCatalogConnector(activeCatalogEntry);
          }}
          connectedCatalog={Boolean(catalogConnected)}
          openApiBase={openApiBase}
          openApiSpec={openApiSpec}
          openApiAuth={openApiAuth}
          onOpenApiBase={setOpenApiBase}
          onOpenApiSpec={setOpenApiSpec}
          onOpenApiAuth={setOpenApiAuth}
          onSaveOpenApi={saveOpenApi}
          httpName={httpName}
          httpDesc={httpDesc}
          httpBase={httpBase}
          httpPath={httpPath}
          httpMethod={httpMethod}
          onHttpName={setHttpName}
          onHttpDesc={setHttpDesc}
          onHttpBase={setHttpBase}
          onHttpPath={setHttpPath}
          onHttpMethod={setHttpMethod}
          onSaveHttp={saveHttpTool}
          onHttpPreset={applyHttpPreset}
          httpListFilter={httpListFilter}
          onHttpListFilter={setHttpListFilter}
          editingHttpId={editingHttpToolId}
          onEditHttp={startEditHttpTool}
          onDeleteHttp={requestDeleteHttpTool}
          onCancelEditHttp={resetHttpForm}
          mcpName={mcpName}
          mcpUrl={mcpUrl}
          mcpAuthToken={mcpAuthToken}
          onMcpName={setMcpName}
          onMcpUrl={setMcpUrl}
          onMcpAuthToken={setMcpAuthToken}
          onSaveMcp={saveMcp}
          mcpListFilter={mcpListFilter}
          onMcpListFilter={setMcpListFilter}
          editingMcpId={editingMcpServerId}
          onEditMcp={startEditMcpServer}
          onDeleteMcp={requestDeleteMcpServer}
          onCancelEditMcp={resetMcpForm}
          erpBaseUrl={erpBaseUrl}
          erpToken={erpToken}
          erpPath={erpPath}
          onErpBaseUrl={setErpBaseUrl}
          onErpToken={setErpToken}
          onErpPath={setErpPath}
          onSaveErp={saveErpConnector}
          webhookUrl={webhookUrl}
          commercePayloadKeys={commercePayloadKeys}
          onWebhookUrl={setWebhookUrl}
          onCommercePayloadKeys={setCommercePayloadKeys}
          onSaveWebhook={saveWebhook}
          onSaveCommerceKeys={saveCommercePayloadKeys}
          webhooksEnabled={(summary.limits.maxOrgWebhooks ?? 0) > 0}
        />
      )}

      <ConfirmDialog
        open={confirmDialog !== null}
        message={confirmDialog?.message ?? ""}
        confirmLabel="Eliminar"
        destructive
        busy={confirmBusy}
        onCancel={() => {
          if (!confirmBusy) setConfirmDialog(null);
        }}
        onConfirm={async () => {
          if (!confirmDialog) return;
          setConfirmBusy(true);
          try {
            await confirmDialog.run();
            setConfirmDialog(null);
          } finally {
            setConfirmBusy(false);
          }
        }}
      />
    </div>
  );
}

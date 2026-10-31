"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ORG_TIMEZONE_OPTIONS, formatOrgTimezoneLabel } from "@chatbot/domain";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { OpsShell } from "@/components/ops-shell";
import { opsApi } from "@/lib/api";

type OrgDetail = {
  org: {
    id: string;
    name: string;
    slug: string;
    plan_slug: string;
    status: string;
    timezone: string;
    metered_credits: number;
    messages_count: number;
    pct_messages: number;
    pct_credits: number;
    wallet_balance: number;
    variable_cost_usd: number;
    gross_margin_usd: number;
    gross_margin_pct: number;
    mrr_usd: number;
    bots_count: number;
    sources_count: number;
  };
  walletLedger: Array<{ delta_credits: number; kind: string; created_at: string }>;
  setupAudit: Array<{ tool_name: string; created_at: string }>;
};

type OrgIntegration = {
  instanceId: string;
  status: string;
  lastError: string | null;
  enabled: boolean;
  definition: { id: string; slug: string; name: string; kind: string };
};

type Flash = { type: "ok" | "err"; text: string } | null;

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente (cliente)",
  connected: "Conectada",
  error: "Error",
};

export default function OpsOrgDetailPage() {
  const params = useParams();
  const orgId = String(params.orgId ?? "");
  const [data, setData] = useState<OrgDetail | null>(null);
  const [grant, setGrant] = useState("10000");
  const [walletFlash, setWalletFlash] = useState<Flash>(null);
  const [definitions, setDefinitions] = useState<
    Array<{ id: string; name: string; kind: string }>
  >([]);
  const [orgIntegrations, setOrgIntegrations] = useState<OrgIntegration[]>([]);
  const [assignDef, setAssignDef] = useState("");
  const [intFlash, setIntFlash] = useState<Flash>(null);
  const [intBusy, setIntBusy] = useState(false);
  const [revokeConfirm, setRevokeConfirm] = useState<{
    instanceId: string;
    name: string;
  } | null>(null);
  const [timezone, setTimezone] = useState("America/Bogota");
  const [tzBusy, setTzBusy] = useState(false);
  const [tzFlash, setTzFlash] = useState<Flash>(null);

  const loadIntegrations = useCallback(async () => {
    const d = await opsApi<{ integrations: OrgIntegration[] }>(
      `/v1/ops/orgs/${orgId}/desk-integrations`,
    );
    setOrgIntegrations(d.integrations);
  }, [orgId]);

  useEffect(() => {
    if (!localStorage.getItem("ops_token")) {
      window.location.href = "/";
      return;
    }
    opsApi<OrgDetail>(`/v1/ops/orgs/${orgId}`)
      .then((d) => {
        setData(d);
        setTimezone(d.org.timezone ?? "America/Bogota");
      })
      .catch(() => {
        window.location.href = "/orgs";
      });
    opsApi<{ definitions: Array<{ id: string; name: string; kind: string }> }>(
      "/v1/ops/integration-definitions",
    )
      .then((d) => setDefinitions(d.definitions))
      .catch(() => undefined);
    void loadIntegrations().catch(() => undefined);
  }, [orgId, loadIntegrations]);

  async function assignIntegration() {
    if (!assignDef) return;
    setIntBusy(true);
    setIntFlash(null);
    try {
      await opsApi(`/v1/ops/orgs/${orgId}/desk-integrations`, {
        method: "POST",
        body: JSON.stringify({ definitionId: assignDef }),
      });
      setAssignDef("");
      await loadIntegrations();
      setIntFlash({
        type: "ok",
        text: "Integración habilitada. El cliente la verá en Desk → Integraciones.",
      });
    } catch (e) {
      setIntFlash({
        type: "err",
        text: e instanceof Error ? e.message : "No se pudo habilitar",
      });
    } finally {
      setIntBusy(false);
    }
  }

  async function revokeIntegration(instanceId: string, name: string) {
    setIntBusy(true);
    setIntFlash(null);
    try {
      await opsApi(`/v1/ops/orgs/${orgId}/desk-integrations/${instanceId}`, {
        method: "DELETE",
      });
      await loadIntegrations();
      setIntFlash({ type: "ok", text: `Integración "${name}" deshabilitada.` });
    } catch (e) {
      setIntFlash({
        type: "err",
        text: e instanceof Error ? e.message : "No se pudo deshabilitar",
      });
    } finally {
      setIntBusy(false);
    }
  }

  async function saveTimezone() {
    setTzBusy(true);
    setTzFlash(null);
    try {
      await opsApi(`/v1/ops/orgs/${orgId}/timezone`, {
        method: "PATCH",
        body: JSON.stringify({ timezone }),
      });
      setTzFlash({ type: "ok", text: "Zona horaria actualizada." });
      const fresh = await opsApi<OrgDetail>(`/v1/ops/orgs/${orgId}`);
      setData(fresh);
    } catch (e) {
      setTzFlash({
        type: "err",
        text: e instanceof Error ? e.message : "No se pudo guardar",
      });
    } finally {
      setTzBusy(false);
    }
  }

  async function grantCredits() {
    setWalletFlash(null);
    await opsApi(`/v1/ops/orgs/${orgId}/wallet/grant`, {
      method: "POST",
      body: JSON.stringify({ credits: Number(grant), note: "ops manual" }),
    });
    setWalletFlash({ type: "ok", text: "Saldo actualizado." });
    const fresh = await opsApi<OrgDetail>(`/v1/ops/orgs/${orgId}`);
    setData(fresh);
  }

  if (!data) {
    return (
      <OpsShell>
        <p className="p-10 text-sm text-[var(--ops-muted)]">Cargando…</p>
      </OpsShell>
    );
  }

  const o = data.org;
  const activeIntegrations = orgIntegrations.filter((i) => i.enabled);
  const assignedDefIds = new Set(
    activeIntegrations.map((i) => i.definition.id),
  );

  return (
    <OpsShell>
      <main className="mx-auto max-w-4xl px-6 py-10">
        <Link href="/orgs" className="text-sm text-[var(--ops-muted)] underline">
          ← Empresas
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">{o.name}</h1>
        <p className="text-sm text-[var(--ops-muted)]">
          {o.plan_slug} · {o.status} · MRR ${o.mrr_usd} ·{" "}
          {formatOrgTimezoneLabel(o.timezone ?? timezone)}
        </p>

        <section className="mt-6 flex flex-wrap items-end gap-3 rounded border border-[var(--ops-border)] bg-white p-4">
          <label className="block text-sm">
            Zona horaria (métricas)
            <select
              className="mt-1 block min-w-[220px] rounded border border-[var(--ops-border)] px-3 py-2 text-sm"
              value={timezone}
              disabled={tzBusy}
              onChange={(e) => setTimezone(e.target.value)}
            >
              {ORG_TIMEZONE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={tzBusy}
            onClick={() => void saveTimezone()}
            className="rounded px-4 py-2 text-sm font-medium text-[var(--ops-ink)]"
            style={{ background: "var(--ops-accent)" }}
          >
            Guardar zona
          </button>
          {tzFlash ? (
            <p
              className={`text-sm ${tzFlash.type === "ok" ? "text-emerald-800" : "text-red-700"}`}
              role="status"
            >
              {tzFlash.text}
            </p>
          ) : null}
        </section>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Stat label="Mensajes" value={`${o.messages_count} (${o.pct_messages}%)`} />
          <Stat
            label="Créditos medidos"
            value={`${o.metered_credits.toLocaleString("es")} (${o.pct_credits}%)`}
          />
          <Stat label="Wallet" value={o.wallet_balance.toLocaleString("es")} />
          <Stat label="COGS variable est." value={`$${o.variable_cost_usd.toFixed(2)}`} />
          <Stat
            label="Margen bruto est."
            value={`$${o.gross_margin_usd.toFixed(0)} (${o.gross_margin_pct}%)`}
          />
        </div>

        <section className="mt-10 rounded border border-[var(--ops-border)] bg-white p-4">
          <h2 className="font-medium text-sm">Integraciones Desk (cliente)</h2>
          <p className="mt-1 text-xs text-[var(--ops-muted)]">
            Habilitá integraciones aquí; el cliente solo completa credenciales en
            Integraciones.
          </p>

          {intFlash && (
            <p
              className={`mt-3 rounded px-3 py-2 text-sm ${
                intFlash.type === "ok"
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border border-red-200 bg-red-50 text-red-900"
              }`}
              role="status"
            >
              {intFlash.text}
            </p>
          )}

          {activeIntegrations.length > 0 && (
            <ul className="mt-4 space-y-2">
              {activeIntegrations.map((i) => (
                <li
                  key={i.instanceId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-[var(--ops-border)] px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-medium">{i.definition.name}</span>
                    <span className="text-[var(--ops-muted)]">
                      {" "}
                      · {i.definition.kind}
                    </span>
                    <span className="mt-0.5 block text-xs text-[var(--ops-muted)]">
                      {STATUS_LABEL[i.status] ?? i.status}
                      {i.lastError ? ` — ${i.lastError}` : ""}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={intBusy}
                    className="rounded border border-red-200 px-2 py-1 text-xs text-red-800 hover:bg-red-50"
                    onClick={() =>
                      setRevokeConfirm({
                        instanceId: i.instanceId,
                        name: i.definition.name,
                      })
                    }
                  >
                    Deshabilitar
                  </button>
                </li>
              ))}
            </ul>
          )}

          {definitions.length === 0 ? (
            <p className="mt-3 text-xs text-[var(--ops-muted)]">
              No hay integraciones disponibles en este entorno.
            </p>
          ) : (
            <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-[var(--ops-border)] pt-4">
              <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs">
                <span className="text-[var(--ops-muted)]">
                  Añadir integración
                </span>
                <select
                  className="rounded border px-2 py-1.5 text-sm"
                  value={assignDef}
                  onChange={(e) => setAssignDef(e.target.value)}
                >
                  <option value="">Elegir integración…</option>
                  {definitions
                    .filter((d) => !assignedDefIds.has(d.id))
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.kind})
                      </option>
                    ))}
                </select>
              </label>
              <button
                type="button"
                disabled={intBusy || !assignDef}
                className="rounded px-3 py-1.5 text-sm text-white disabled:opacity-50"
                style={{ background: "var(--ops-accent)" }}
                onClick={() => void assignIntegration()}
              >
                Habilitar
              </button>
            </div>
          )}
        </section>

        <section className="mt-10 rounded border border-[var(--ops-border)] bg-white p-4">
          <h2 className="font-medium text-sm">Recarga manual (wallet)</h2>
          {walletFlash && (
            <p
              className={`mt-2 rounded px-3 py-2 text-sm ${
                walletFlash.type === "ok"
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border border-red-200 bg-red-50 text-red-900"
              }`}
            >
              {walletFlash.text}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              className="rounded border px-2 py-1 text-sm w-32"
              value={grant}
              onChange={(e) => setGrant(e.target.value)}
            />
            <button
              type="button"
              className="rounded px-3 py-1 text-sm"
              style={{ background: "var(--ops-accent)" }}
              onClick={() => void grantCredits()}
            >
              Otorgar créditos
            </button>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-medium">Ledger wallet</h2>
          <ul className="mt-2 space-y-1 text-xs text-[var(--ops-muted)]">
            {data.walletLedger.map((r, i) => (
              <li key={i}>
                {r.created_at}: {r.delta_credits > 0 ? "+" : ""}
                {r.delta_credits} ({r.kind})
              </li>
            ))}
            {!data.walletLedger.length && <li>Sin movimientos.</li>}
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-medium">Setup agent (audit)</h2>
          <ul className="mt-2 space-y-1 text-xs font-mono text-[var(--ops-muted)]">
            {data.setupAudit.map((r, i) => (
              <li key={i}>{r.created_at} {r.tool_name}</li>
            ))}
            {!data.setupAudit.length && <li>Sin llamadas registradas.</li>}
          </ul>
        </section>
      </main>
      <ConfirmDialog
        open={Boolean(revokeConfirm)}
        title="Deshabilitar integración"
        message={
          revokeConfirm
            ? `¿Deshabilitar "${revokeConfirm.name}" para esta empresa? El cliente dejará de verla en Integraciones.`
            : ""
        }
        confirmLabel="Deshabilitar"
        destructive
        busy={intBusy}
        onCancel={() => setRevokeConfirm(null)}
        onConfirm={() => {
          if (!revokeConfirm) return;
          void revokeIntegration(
            revokeConfirm.instanceId,
            revokeConfirm.name,
          ).finally(() => setRevokeConfirm(null));
        }}
      />
    </OpsShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[var(--ops-border)] bg-white p-3 text-sm">
      <p className="text-[var(--ops-muted)]">{label}</p>
      <p className="mt-1 font-medium tabular-nums">{value}</p>
    </div>
  );
}

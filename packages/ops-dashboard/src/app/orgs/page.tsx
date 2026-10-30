"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { OpsShell } from "@/components/ops-shell";
import { opsApi } from "@/lib/api";
import { humanizeApiError } from "@/lib/errors";

type Org = {
  id: string;
  name: string;
  slug: string;
  plan_slug: string;
  status: string;
  messages_count: number;
  metered_credits: number;
  pct_messages: number;
  pct_credits: number;
  wallet_balance: number;
  gross_margin_pct: number;
  variable_cost_usd: number;
};

export default function OpsOrgsPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [name, setName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem("ops_token")) {
      window.location.href = "/";
      return;
    }
    opsApi<{ orgs: Org[] }>("/v1/ops/orgs")
      .then((d) => setOrgs(d.orgs))
      .catch((err) => {
        if (err instanceof Error && err.message.includes("NEXT_PUBLIC_API_URL")) {
          setError(err.message);
          setLoading(false);
          return;
        }
        localStorage.removeItem("ops_token");
        window.location.href = "/";
      })
      .finally(() => setLoading(false));
  }, []);

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInviteUrl(null);
    try {
      const data = await opsApi<{ inviteUrl: string }>("/v1/ops/orgs", {
        method: "POST",
        body: JSON.stringify({ name, adminEmail, status: "invited" }),
      });
      setInviteUrl(data.inviteUrl);
      const list = await opsApi<{ orgs: Org[] }>("/v1/ops/orgs");
      setOrgs(list.orgs);
      setName("");
      setAdminEmail("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : humanizeApiError("request_failed"),
      );
    }
  }

  async function suspend(orgId: string) {
    await opsApi(`/v1/ops/orgs/${orgId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "suspended" }),
    });
    const list = await opsApi<{ orgs: Org[] }>("/v1/ops/orgs");
    setOrgs(list.orgs);
  }

  return (
    <OpsShell>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-sm text-[var(--ops-muted)]">
          Uso del mes, margen estimado y wallet. Abre una fila para detalle y recargas manuales.
        </p>
        <form
          onSubmit={createOrg}
          className="mt-6 grid gap-3 rounded-[var(--ops-radius)] border border-[var(--ops-border)] bg-white p-4 md:grid-cols-3"
        >
          <input
            className="rounded-[var(--ops-radius)] border border-[var(--ops-border)] px-3 py-2 text-sm"
            placeholder="Nombre empresa"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            type="email"
            className="rounded-[var(--ops-radius)] border border-[var(--ops-border)] px-3 py-2 text-sm"
            placeholder="Email del owner"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            required
          />
          <button
            type="submit"
            className="rounded-[var(--ops-radius)] px-4 py-2 text-sm font-medium text-[var(--ops-ink)]"
            style={{ background: "var(--ops-accent)" }}
          >
            Crear e invitar
          </button>
        </form>
        {inviteUrl && (
          <p className="mt-3 text-sm break-all text-[var(--ops-muted)]">
            Invitación:{" "}
            <a className="underline text-[var(--ops-ink)]" href={inviteUrl}>
              {inviteUrl}
            </a>
          </p>
        )}
        {error && (
          <p className="mt-3 text-sm text-[oklch(0.45_0.15_25)]" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <p className="mt-8 text-sm text-[var(--ops-muted)]">Cargando…</p>
        ) : (
          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-[var(--ops-muted)]">
                  <th className="py-2 pr-4">Empresa</th>
                  <th className="py-2 pr-4">Msgs</th>
                  <th className="py-2 pr-4">Créditos</th>
                  <th className="py-2 pr-4">Wallet</th>
                  <th className="py-2 pr-4">COGS est.</th>
                  <th className="py-2 pr-4">Margen %</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {orgs.map((o) => (
                  <tr key={o.id} className="border-b border-[var(--ops-border)]">
                    <td className="py-3 pr-4">
                      <Link href={`/orgs/${o.id}`} className="font-medium underline-offset-2 hover:underline">
                        {o.name}
                      </Link>
                      <span className="ml-2 text-xs text-[var(--ops-muted)]">
                        {o.plan_slug} · {o.status}
                      </span>
                    </td>
                    <td className="tabular-nums">{o.pct_messages}%</td>
                    <td className="tabular-nums">{o.pct_credits}%</td>
                    <td className="tabular-nums">{o.wallet_balance.toLocaleString("es")}</td>
                    <td className="tabular-nums">${o.variable_cost_usd.toFixed(2)}</td>
                    <td className="tabular-nums">{o.gross_margin_pct}%</td>
                    <td className="text-right">
                      {o.status !== "suspended" && (
                        <button
                          type="button"
                          className="text-xs text-[oklch(0.45_0.15_25)]"
                          onClick={() => suspend(o.id)}
                        >
                          Suspender
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {orgs.length === 0 && (
              <p className="mt-4 text-sm text-[var(--ops-muted)]">Sin empresas aún.</p>
            )}
          </div>
        )}
      </main>
    </OpsShell>
  );
}

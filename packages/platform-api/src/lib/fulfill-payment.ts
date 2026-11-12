import {
  planFromSlug,
  type PlanSlug,
  WALLET_CREDIT_PACKS,
  type WalletPackId,
} from "@chatbot/domain";
import type { Env } from "../types";
import {
  getCreemCheckout,
  isCreemCheckoutPaid,
  walletPackFromCreemProductId,
} from "./creem";
import { creditWallet } from "./wallet";

export type PendingPaymentRow = {
  id: string;
  org_id: string;
  creem_checkout_id: string;
  plan_slug: string;
  status: string;
  reference: string | null;
  payment_kind: string;
  wallet_pack: string | null;
};

export async function fulfillPendingPayment(
  env: Env,
  payment: PendingPaymentRow,
  checkoutId?: string | null,
): Promise<{ kind: "wallet" | "subscription"; done: boolean }> {
  if (payment.status === "paid") {
    return {
      kind: payment.payment_kind === "wallet" ? "wallet" : "subscription",
      done: true,
    };
  }

  const cid = checkoutId?.trim() || payment.creem_checkout_id;

  if (payment.payment_kind === "wallet") {
    const pack = payment.wallet_pack as WalletPackId | null;
    if (!pack || !(pack in WALLET_CREDIT_PACKS)) {
      return { kind: "wallet", done: false };
    }
    await fulfillWalletPackPayment(env, {
      orgId: payment.org_id,
      pack,
      reference: payment.reference,
      checkoutId: cid,
    });
    return { kind: "wallet", done: true };
  }

  await applySubscriptionPayment(env, {
    orgId: payment.org_id,
    planSlug: planFromSlug(payment.plan_slug),
    reference: payment.reference,
    checkoutId: cid,
  });
  return { kind: "subscription", done: true };
}

/** Poll Creem when webhook is slow; idempotent. */
export async function syncPaidCheckoutToPending(
  env: Env,
  payment: PendingPaymentRow,
): Promise<boolean> {
  if (payment.status === "paid") return true;
  const checkout = await getCreemCheckout(env, payment.creem_checkout_id);
  if (!checkout || !isCreemCheckoutPaid(checkout)) return false;

  const productId = checkout.product_id?.trim();
  if (productId && walletPackFromCreemProductId(env, productId)) {
    const pack = walletPackFromCreemProductId(env, productId)!;
    if (payment.payment_kind !== "wallet") {
      payment = { ...payment, payment_kind: "wallet", wallet_pack: pack };
    }
  }

  const r = await fulfillPendingPayment(env, payment, checkout.id);
  return r.done;
}

export async function walletPurchaseAlreadyFulfilled(
  env: Env,
  checkoutId: string,
): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT 1 AS ok FROM wallet_ledger
     WHERE kind = 'creem_purchase' AND meta_json LIKE ? LIMIT 1`,
  )
    .bind(`%${checkoutId}%`)
    .first();
  return Boolean(row);
}

export async function fulfillWalletPackPayment(
  env: Env,
  input: {
    orgId: string;
    pack: WalletPackId;
    reference?: string | null;
    checkoutId?: string | null;
    usdCents?: number;
  },
): Promise<{ credited: boolean; alreadyDone: boolean }> {
  const checkoutId = input.checkoutId?.trim() ?? "";
  if (checkoutId && (await walletPurchaseAlreadyFulfilled(env, checkoutId))) {
    await markPendingPaid(env, input.orgId, input.reference, checkoutId);
    return { credited: false, alreadyDone: true };
  }

  const pack = WALLET_CREDIT_PACKS[input.pack];
  await creditWallet(env, {
    orgId: input.orgId,
    credits: pack.credits,
    kind: "creem_purchase",
    usdCents: input.usdCents ?? pack.usd * 100,
    meta: {
      pack: input.pack,
      checkoutId: checkoutId || undefined,
      reference: input.reference ?? undefined,
    },
  });
  await markPendingPaid(env, input.orgId, input.reference, checkoutId);
  return { credited: true, alreadyDone: false };
}

export async function applySubscriptionPayment(
  env: Env,
  input: {
    orgId: string;
    planSlug: PlanSlug;
    reference?: string | null;
    checkoutId?: string | null;
  },
): Promise<{ activated: boolean; upgraded: boolean }> {
  const planSlug = planFromSlug(input.planSlug);
  const org = await env.DB.prepare(`SELECT status, plan_slug FROM orgs WHERE id = ?`)
    .bind(input.orgId)
    .first<{ status: string; plan_slug: string }>();
  if (!org) return { activated: false, upgraded: false };

  const wasActive = org.status === "active";
  const upgraded = wasActive && org.plan_slug !== planSlug;

  await env.DB.prepare(
    `UPDATE orgs SET status = 'active', plan_slug = ?, trial_ends_at = NULL WHERE id = ?`,
  )
    .bind(planSlug, input.orgId)
    .run();

  await markPendingPaid(env, input.orgId, input.reference, input.checkoutId);

  if (!wasActive) {
    const { runProvisioningSaga } = await import("./saga");
    await runProvisioningSaga(env, input.orgId, [
      "activate_org",
      "warm_cache",
      "notify",
    ]);
    return { activated: true, upgraded: false };
  }

  return { activated: false, upgraded };
}

async function markPendingPaid(
  env: Env,
  orgId: string,
  reference?: string | null,
  checkoutId?: string | null,
): Promise<void> {
  const ref = reference?.trim() ?? "";
  const cid = checkoutId?.trim() ?? "";
  if (ref || cid) {
    await env.DB.prepare(
      `UPDATE pending_payments SET status = 'paid'
       WHERE org_id = ? AND status = 'pending'
       AND (reference = ? OR creem_checkout_id = ?)`,
    )
      .bind(orgId, ref, cid)
      .run();
  }
}

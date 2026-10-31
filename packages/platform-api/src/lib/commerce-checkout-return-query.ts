/** Query params for hosted chat after Wompi payment-return (server-resolved status). */
export type CheckoutReturnQueryInput = {
  orderAccessKey: string;
  status: string;
  publicRef: string | null;
  summary?: string | null;
  paymentId?: string | null;
  providerTransactionId?: string | null;
};

export function buildCheckoutReturnSearchParams(
  input: CheckoutReturnQueryInput,
): URLSearchParams {
  const out = new URLSearchParams();
  out.set("checkout_return", "1");
  out.set("order", input.orderAccessKey);
  out.set("checkout_status", input.status);
  const ref = input.publicRef?.trim();
  if (ref) out.set("public_ref", ref);
  const summary = input.summary?.trim();
  if (summary) out.set("summary", summary.slice(0, 200));
  const paymentId = input.paymentId?.trim();
  if (paymentId) out.set("paymentId", paymentId);
  const txId = input.providerTransactionId?.trim();
  if (txId) out.set("id", txId);
  return out;
}

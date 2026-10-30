import type { PlanSlug } from "@chatbot/domain";
import { api } from "@/lib/api";

/** Opens Creem checkout for the current session. Returns false if no redirect happened. */
export async function redirectToBillingCheckout(plan: PlanSlug): Promise<boolean> {
  const token = localStorage.getItem("token");
  if (!token) return false;

  const data = await api<{ url?: string }>("/v1/admin/billing/checkout", {
    method: "POST",
    token,
    body: JSON.stringify({ plan }),
  });

  if (data.url) {
    window.location.assign(data.url);
    return true;
  }
  return false;
}

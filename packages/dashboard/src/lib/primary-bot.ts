import { api } from "@/lib/api";

export type PrimaryBot = { id: string; name: string };

/** First bot for the org (Starter = one assistant; no picker in UI). */
export async function fetchPrimaryBot(): Promise<PrimaryBot | null> {
  const data = await api<{ bots: PrimaryBot[] }>("/v1/admin/bots");
  return data.bots[0] ?? null;
}

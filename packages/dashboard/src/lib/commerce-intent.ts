export async function postCommerceIntent(
  apiUrl: string,
  publishableKey: string,
  conversationId: string,
  body: {
    intent: "continue" | "pay" | "human";
    title?: string;
    itemId?: string;
    payload?: Record<string, unknown>;
  },
): Promise<void> {
  await fetch(
    `${apiUrl.replace(/\/$/, "")}/v1/public/conversations/${conversationId}/commerce-intent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": publishableKey,
      },
      body: JSON.stringify(body),
    },
  );
}

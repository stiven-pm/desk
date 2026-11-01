/** Prepare stored chat for LLM context (full thread, less noise). */

const DESK_UI_FENCE = /```desk-ui[\s\S]*?```/gi;

export function stripDeskUiBlocksForLlm(text: string): string {
  const stripped = text.replace(DESK_UI_FENCE, "").replace(/\n{3,}/g, "\n\n").trim();
  return stripped || text.trim().slice(0, 500);
}

export type AgentChatTurn = { role: "user" | "assistant"; content: string };

export function agentChatTurnsForLlm(
  turns: AgentChatTurn[],
  maxTurns = 24,
): AgentChatTurn[] {
  return turns.slice(-maxTurns).map((t) => ({
    role: t.role,
    content:
      t.role === "assistant"
        ? stripDeskUiBlocksForLlm(t.content).slice(0, 3500)
        : t.content.trim().slice(0, 3500),
  }));
}

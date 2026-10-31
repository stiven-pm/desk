import {
  isReadOnlyPendingDeskAction,
  parsePendingPrompt,
  PENDING_PROMPT_META_KEY,
  type PendingPrompt,
  type PendingPromptVerdict,
} from "@chatbot/domain";
import type { LlmEnv } from "./llm-client";
import { classifyPendingPromptReply } from "./pending-prompt-classifier";

export type PendingPromptResolution =
  | { type: "accept"; deskCommand: string }
  | { type: "decline"; replyText: string }
  | { type: "use_signed_action"; deskCommand: string; replyText: string }
  | { type: "continue" }
  | { type: "missing_pending" };

const DECLINE_REPLY =
  "Entendido. Cuando quieras, escríbeme o usa los botones del chat.";

export function readPendingPrompt(
  getMeta: (key: string) => string | null,
): PendingPrompt | null {
  const p = parsePendingPrompt(getMeta(PENDING_PROMPT_META_KEY));
  if (!p) return null;
  if (Date.parse(p.expiresAt) <= Date.now()) {
    return null;
  }
  return p;
}

export function clearPendingPrompt(
  setMeta: (key: string, value: string) => void,
): void {
  setMeta(PENDING_PROMPT_META_KEY, "");
}

export async function resolvePendingPromptBeforeTurn(args: {
  env: LlmEnv;
  userMessage: string;
  getMeta: (key: string) => string | null;
  setMeta: (key: string, value: string) => void;
}): Promise<PendingPromptResolution> {
  const pending = readPendingPrompt(args.getMeta);
  if (!pending) return { type: "continue" };

  const verdict = await classifyPendingPromptReply(
    args.env,
    pending,
    args.userMessage,
  );
  return applyPendingVerdict(pending, verdict, args.setMeta);
}

export function applyPendingVerdict(
  pending: PendingPrompt,
  verdict: PendingPromptVerdict,
  setMeta: (key: string, value: string) => void,
): PendingPromptResolution {
  clearPendingPrompt(setMeta);
  if (verdict === "accept") {
    if (isReadOnlyPendingDeskAction(pending.action)) {
      return { type: "accept", deskCommand: pending.action };
    }
    return {
      type: "use_signed_action",
      deskCommand: pending.action,
      replyText: "",
    };
  }
  if (verdict === "decline") {
    return { type: "decline", replyText: DECLINE_REPLY };
  }
  return { type: "continue" };
}

/** Respuesta a botones firmados Sí/No de oferta (sin clasificador LLM). */
export function resolvePendingPromptFromDeskOffer(
  kind: "offer_accept" | "offer_decline",
  getMeta: (key: string) => string | null,
  setMeta: (key: string, value: string) => void,
): PendingPromptResolution {
  const pending = readPendingPrompt(getMeta);
  if (!pending) {
    return { type: "missing_pending" };
  }
  if (kind === "offer_decline") {
    return applyPendingVerdict(pending, "decline", setMeta);
  }
  return applyPendingVerdict(pending, "accept", setMeta);
}

export { PENDING_PROMPT_META_KEY };

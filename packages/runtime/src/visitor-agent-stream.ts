/** Eventos de turno visitante (inspirado en OpenClaw AgentEvent / Hermes stream UX). */

export type VisitorAgentStreamStatus =
  | "thinking"
  | "tool"
  | "composing";

export type VisitorAgentStreamHandlers = {
  onStreamStart?: () => void;
  onDelta?: (chunk: string) => void | Promise<void>;
  onStatus?: (
    status: VisitorAgentStreamStatus,
    detail?: { toolName?: string },
  ) => void | Promise<void>;
};

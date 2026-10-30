/** Contrato postMessage: la web del cliente registra componentes React/Vue reales. */

export type DeskHostRenderRequest = {
  type: "desk:host:render";
  requestId: string;
  component: string;
  props: Record<string, unknown>;
  /** Selector donde montar si el host lo soporta (iframe embed). */
  targetId?: string;
};

export type DeskHostRenderAck = {
  type: "desk:host:render:ok";
  requestId: string;
  height?: number;
};

export type DeskHostAction = {
  type: "desk:host:action";
  action: string;
  payload?: Record<string, unknown>;
};

export function postHostRender(
  win: Window,
  req: Omit<DeskHostRenderRequest, "type" | "requestId">,
  targetOrigin: string | null,
): string | null {
  if (!targetOrigin) return null;
  const requestId = crypto.randomUUID();
  win.postMessage(
    {
      type: "desk:host:render",
      requestId,
      ...req,
    } satisfies DeskHostRenderRequest,
    targetOrigin,
  );
  return requestId;
}

export function postHostAction(
  win: Window,
  action: DeskHostAction,
  targetOrigin: string | null,
): void {
  if (!targetOrigin) return;
  win.postMessage(action, targetOrigin);
}

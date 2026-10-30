/**
 * En la web del cliente (antes del widget iframe):
 *
 * DeskHost.register({
 *   ProductCard: (el, props) => { ... monta tu componente real ... },
 * });
 *
 * window.addEventListener('message', (e) => {
 *   if (e.data?.type === 'desk:host:render') { ... }
 * });
 */

export type DeskHostComponent = (
  container: HTMLElement,
  props: Record<string, unknown>,
) => void | (() => void);

const registry = new Map<string, DeskHostComponent>();
let mountRoot: HTMLElement | null = null;
let allowedOrigins: string[] = [];

function originOk(origin: string): boolean {
  if (!allowedOrigins.length) return false;
  const o = origin.replace(/\/$/, "");
  return allowedOrigins.some((a) => a.replace(/\/$/, "") === o);
}

export const DeskHost = {
  setAllowedOrigins(origins: string[]) {
    allowedOrigins = origins.map((o) => o.trim()).filter(Boolean);
  },
  register(components: Record<string, DeskHostComponent>) {
    for (const [id, fn] of Object.entries(components)) {
      registry.set(id, fn);
    }
  },
  /** Dónde montar UI que envía el iframe del chat (por defecto document.body). */
  setMountRoot(el: HTMLElement) {
    mountRoot = el;
  },
  mountFromMessage(data: {
    type?: string;
    component?: string;
    props?: Record<string, unknown>;
    requestId?: string;
  }) {
    if (data.type !== "desk:host:render" || !data.component) return;
    const fn = registry.get(data.component);
    if (!fn) return;
    const slot = document.createElement("div");
    slot.className = "desk-host-slot";
    slot.dataset.deskRequest = data.requestId ?? "";
    (mountRoot ?? document.body).appendChild(slot);
    fn(slot, data.props ?? {});
  },
};

if (typeof window !== "undefined") {
  window.addEventListener("message", (e) => {
    if (!originOk(e.origin)) return;
    const data = e.data as Record<string, unknown>;
    if (data?.type === "desk:host:render") {
      DeskHost.mountFromMessage(data);
      return;
    }
    if (data?.type === "desk:host:action") {
      window.dispatchEvent(
        new CustomEvent("desk:commerce", { detail: data }),
      );
    }
  });
  DeskHost.setAllowedOrigins([window.location.origin]);
  (window as unknown as { DeskHost?: typeof DeskHost }).DeskHost = DeskHost;
}

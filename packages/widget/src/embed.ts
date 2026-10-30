export interface DeskWidgetOptions {
  apiUrl: string;
  publishableKey: string;
  botId: string;
  label?: string;
  container?: HTMLElement;
  /** Chat hosted (recomendado): UI rica + DeskHost en la página padre. */
  chatUrl?: string;
}

function mountIframeWidget(options: DeskWidgetOptions): void {
  const root = options.container ?? document.body;
  const label = options.label ?? "Chat";
  const chatBase = options.chatUrl!.replace(/\/$/, "");
  const iframeSrc = `${chatBase}${chatBase.includes("?") ? "&" : "?"}embed=1`;

  const launcher = document.createElement("button");
  launcher.type = "button";
  launcher.textContent = label;
  launcher.setAttribute("aria-label", label);
  launcher.style.cssText =
    "position:fixed;bottom:20px;right:20px;z-index:99998;padding:12px 18px;border:0;border-radius:999px;background:#171717;color:#fafafa;font:600 14px system-ui;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.18)";

  const panel = document.createElement("div");
  panel.hidden = true;
  panel.style.cssText =
    "position:fixed;bottom:72px;right:20px;width:min(400px,calc(100vw - 32px));height:min(560px,calc(100dvh - 96px));border:1px solid #d8dcde;border-radius:14px;background:#fff;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.15);z-index:99999";

  const iframe = document.createElement("iframe");
  iframe.src = iframeSrc;
  iframe.title = label;
  iframe.style.cssText = "width:100%;height:100%;border:0";
  iframe.allow = "clipboard-write";
  panel.appendChild(iframe);

  launcher.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
  });

  root.appendChild(launcher);
  root.appendChild(panel);
}

/** Fallback HTTP sin iframe (texto plano). */
function mountLegacyWidget(options: DeskWidgetOptions): void {
  const root = options.container ?? document.body;
  const label = options.label ?? "Chat";

  const launcher = document.createElement("button");
  launcher.type = "button";
  launcher.textContent = label;
  launcher.setAttribute("aria-label", label);
  launcher.style.cssText =
    "position:fixed;bottom:20px;right:20px;z-index:99998;padding:12px 18px;border:0;border-radius:999px;background:#171717;color:#fafafa;font:600 14px system-ui;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.18)";

  const panel = document.createElement("div");
  panel.hidden = true;
  panel.style.cssText =
    "position:fixed;bottom:72px;right:20px;width:min(380px,calc(100vw - 32px));height:480px;border:1px solid #d8dee9;border-radius:14px;background:#fff;font:14px system-ui;display:flex;flex-direction:column;box-shadow:0 12px 40px rgba(0,0,0,.15);z-index:99999";

  const log = document.createElement("div");
  log.style.cssText = "flex:1;overflow:auto;padding:12px";
  const form = document.createElement("form");
  form.style.cssText = "display:flex;border-top:1px solid #eee";
  const input = document.createElement("input");
  input.style.cssText = "flex:1;border:0;padding:10px;outline:none";
  input.placeholder = "Escribe un mensaje…";
  const send = document.createElement("button");
  send.type = "submit";
  send.textContent = "Enviar";
  send.style.cssText = "border:0;background:#171717;color:#fafafa;padding:0 14px";
  form.appendChild(input);
  form.appendChild(send);
  panel.appendChild(log);
  panel.appendChild(form);
  root.appendChild(launcher);
  root.appendChild(panel);

  launcher.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
  });

  const storageKey = (kind: "visitor" | "conv") =>
    `desk:${kind}:${options.botId}`;

  function getOrCreateVisitorId(): string {
    const key = storageKey("visitor");
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  }

  let conversationId: string | null = localStorage.getItem(storageKey("conv"));

  function append(role: string, text: string) {
    const line = document.createElement("div");
    line.style.marginBottom = "8px";
    line.textContent = `${role}: ${text}`;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  async function ensureSession() {
    if (conversationId) return conversationId;
    const res = await fetch(`${options.apiUrl}/v1/public/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": options.publishableKey,
      },
      body: JSON.stringify({
        botId: options.botId,
        visitorId: getOrCreateVisitorId(),
        conversationId: conversationId ?? undefined,
      }),
    });
    const data = (await res.json()) as { conversationId: string };
    conversationId = data.conversationId;
    localStorage.setItem(storageKey("conv"), conversationId);
    return conversationId;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    append("Tú", text);
    const id = await ensureSession();
    const res = await fetch(
      `${options.apiUrl}/v1/public/conversations/${id}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": options.publishableKey,
        },
        body: JSON.stringify({ text }),
      },
    );
    const data = (await res.json()) as { text?: string; error?: string };
    append("Asistente", data.text ?? data.error ?? "…");
  });
}

export function mountDeskWidget(options: DeskWidgetOptions): void {
  if (options.chatUrl) {
    mountIframeWidget(options);
    return;
  }
  mountLegacyWidget(options);
}

declare global {
  interface Window {
    DeskWidget?: { mount: typeof mountDeskWidget };
    ChatbotWidget?: { mount: typeof mountDeskWidget };
  }
}

if (typeof window !== "undefined") {
  window.DeskWidget = { mount: mountDeskWidget };
  window.ChatbotWidget = window.DeskWidget;
}

# DeskHost — componentes reales de tu web en el chat

## 1. En el panel (Asistente)

- **URL del stylesheet**: el CSS público de tu tienda (https).
- **IDs de componentes**: nombres que registrarás en JavaScript (`ProductCard`, etc.).

## 2. En tu web (antes del widget)

```html
<script src="https://api-desk.rekov.co/cdn/desk-host.js" async></script>
<script src="https://api-desk.rekov.co/cdn/desk-widget.js" async></script>
<script>
  DeskHost.setAllowedOrigins([window.location.origin]);
  DeskHost.register({
    ProductCard: (container, props) => {
      // Monta tu componente React/Vue o HTML con props de la IA (sku, title, price…)
      container.innerHTML = `<article class="product-card">…</article>`;
    },
  });
  DeskWidget.mount({
    apiUrl: "https://api-desk.rekov.co",
    publishableKey: "…",
    botId: "…",
    chatUrl: "https://desk.rekov.co/chat/tu-org",
    label: "Chat",
  });
</script>
```

El widget abre un **iframe** al chat hosted (`?embed=1`). Los bloques `type:"host"` envían `postMessage` al **parent**; el componente se monta en tu página (`DeskHost.setMountRoot` opcional), no dentro del iframe (cross-origin).

## 3. Qué emite la IA

```desk-ui
{"blocks":[{"type":"host","component":"ProductCard","props":{"sku":"A1","title":"Camisa"}}]}
```

Solo se renderizan IDs que listaste en el panel.

## Ofertas (`type: "offers"`)

La IA puede enviar imagen + precio + `intent` (`continue` | `pay` | `human`). Al pulsar:

- `postMessage` `desk:host:action` con `commerce.pay` / `commerce.continue` / `commerce.human`
- Webhook `commerce.intent` a tu backend (regístralo en webhooks salientes)

Tú decides cómo abrir pago, carrito o bandeja humana — Desk no procesa cobros.

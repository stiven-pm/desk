# Desk — posicionamiento, venta y límites honestos

## A quién vendemos (ICP)

Negocios con **web activa** que pierden horas en lo mismo: estado de pedido, stock, precios, horarios, requisitos, “¿tienen X?”. Tienen PDFs o procesos en Excel/ERP y **no** quieren montar contact center omnicanal.

**No es cliente:** quien solo busca widget gratis, quien exige WhatsApp+voz “todo en uno”, quien compara solo precio Tidio entry.

## Problemas que resolvemos (mensaje de venta)

| Dolor | Qué hace Desk |
|-------|----------------|
| “Contestamos lo mismo en WhatsApp y web” | Asistente 24/7 en **tu web** con tus documentos |
| “No sabemos si el bot mintió” | Respuestas ancladas a RAG + tools a **tus** APIs cuando las configuras |
| “Cuando falla, el cliente repite todo” | **Bandeja** humana con historial en el mismo hilo |
| “No entendemos la factura de IA” | **USD/mes fijo** + cupos visibles; subes de plan o compras créditos |

No vendemos “IA generativa”. Vendemos **menos interrupciones al equipo** con precio predecible.

## Qué SÍ / qué NO (decirlo en demo)

| | Sí | No |
|---|----|-----|
| Canales | Chat web hosted, enlace, widget iframe | WhatsApp, voz, Instagram DM operados por Desk |
| Precio | Plan mensual publicado (Starter / Growth / Business) | Pago por resolución opaco tipo Intercom Fin |
| Datos | PDFs, RAG, HTTP/MCP/conectores (límites por plan) | “Conecto tu ERP en un clic” sin trabajo del cliente |
| Tienda | Checkout nativo Desk + tools `commerce_*` | Reemplazar Shopify/Woo por completo |
| Catálogo | Tools + UI `desk-ui` + host en web del cliente | **Panel catálogo nativo** (productos/SKU en Desk) — **pendiente P0** |
| Exceso de cupo | Upgrade plan + wallet créditos (código listo; Creem one-time en prod) | Cobro automático silencioso por mensaje extra |
| Equipo | Asientos panel (owner/admin/agent) | Contact center con colas telefónicas |

## Competencia (referencia rápida)

| Producto | Modelo | Desk |
|----------|--------|------|
| Tidio / Crisp | Entry barato + extras | Más caro, más **conocimiento + integraciones + handoff** |
| Intercom | Asiento + $/resolución IA | Fijo + cupos; mejor para SMB que odia sorpresas |
| Wolkvox / suites CC | Cotización omnicanal | Solo capa **web + IA + bandeja** |

## Planes — para quién (no lista de features)

| Plan | Precio | Comprador típico |
|------|--------|------------------|
| **Starter** | $99 | Un negocio, un asistente, consultas web sin vivir en el panel |
| **Growth** | $199 | Volumen diario + conectar tienda/ERP/API |
| **Business** | $589 | Equipo grande, historial largo, integraciones al tope |

Regla interna: **Starter = fit calidad; Growth = volumen; Business = MRR y cuentas serias**. Economía interna: `docs/UNIT_ECONOMICS.md` (no comunicar al cliente).

## Qué recopilamos (transparencia interna / legal)

| Dato | Para qué |
|------|----------|
| Mensajes visitante + créditos/mes | Cupos y facturación |
| Conversación en DO/D1 | Servicio, handoff, retención según plan |
| Geo aproximada (CF) | Contexto en respuestas (zona horaria, país) |
| Logs Ops (señales IA, latencia, errores) | Calidad y soporte Rekov |
| Actividad panel | Auditoría invitaciones / config |

No vendemos datos de conversación a terceros; modelo **zero data retention** en Workers AI según Cloudflare.

## Brechas comerciales (prioridad)

1. **Catálogo en panel** — hoy catálogo vive en integración/tienda nativa; falta UX “mis productos” sin depender solo de PDF.
2. **Productos Creem wallet** en producción — packs definidos en `economics.ts`, checkout cableado; pegar `CREEM_PRODUCT_CREDITS_*`.
3. **Métricas tenant** — resolución vs handoff en dashboard (roadmap `SALES_AND_CHAT_ROADMAP.md`).
4. **Widget / theme** — paridad visual con la web del cliente (iframe + CSS tenant).

## Economía interna

No decidir precios con `linearCreditCeiling` (1.10/1k × cupo completo). Usar **`PLAN_STRESS_MARGINS`** y reconciliación CF en Ops. Detalle: `docs/UNIT_ECONOMICS.md`, `docs/COST_PER_MESSAGE.md`.

## GTM (acciones, no slides)

1. **2–3 pilotos pagando** — medir créditos/msg real vs cupo.
2. **Demo con su PDF + un pedido** — no tour del panel.
3. **Decir no** a omnicanal y a precio widget; **sí** a “menos WhatsApp repetitivo en la web”.
4. Cerrar wallet Creem en prod antes de campañas de volumen.

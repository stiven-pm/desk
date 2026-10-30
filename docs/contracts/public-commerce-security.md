# Contrato: enlace tienda→chat y página pública de pedido

## 1. Snapshot del carrito tienda (chat embed)

### Principio

El cliente **nunca** es fuente de verdad del carrito. Solo envía identificadores; el servidor lee el DO **store**.

### Identificadores

| Campo | Origen | Validación |
|--------|--------|------------|
| `storeConversationId` | UUID sesión store (`desk:store:conv:*`) | Fila en D1: mismo `org_id`, `bot_id`, `phase != closed` |
| `storeVisitorId` | UUID visitante store (`desk:store:visitor:*`) | Debe coincidir con `conversations.visitor_id` de la sesión store |
| `storeLinkToken` | `POST …/store-cart-link` | HMAC v2: store + chat + **visitante store** + **visitante chat** |

### Reglas API

1. **`POST /v1/public/conversations/:chatId/store-cart-link`**  
   Body: `{ storeConversationId, storeVisitorId, chatVisitorId }`.  
   Emite token solo si el visitante posee la sesión store y el DO store tiene `delivery_channel === "store"`.

2. **Mensajes, commerce-intent, sync-linked-store-cart**  
   Si hay `storeConversationId`: en **producción** exigen `storeVisitorId`, `chatVisitorId` y `storeLinkToken` válidos.  
   En no-producción: mínimo `storeVisitorId` coincidente (dev).

3. **Sincronización**  
   Tras validar enlace, la API llama `GET store DO /commerce/cart` y **`POST chat DO /sync-linked-store-cart`** (solo worker; el POST `/message` ya no acepta JSON de carrito).

4. **Amenaza**  
   Conocer solo un UUID de conversación ajena **no basta**: hace falta el visitante store y token firmado para el chat concreto.

### Pendiente (fase 2)

- Rotación de token al cambiar visitante store o chat (invalidar `desk:storelink:*` en sessionStorage).

---

## 2. Página pública `/o/{token}`

### Implementado

- Columna **`public_access_token`** (UUID, índice único). Migración **`0044_public_access_token.sql`** (backfill en filas existentes).
- URLs nuevas: **`/o/{public_access_token}`**. Redirect pasarela y `orderPageUrl` usan el token.
- **`public_ref` (`RK-…`)** sigue en pasarela, panel admin y copy al comprador; **no** es la ruta preferida.
- **`GET /v1/public/orders/:key`**: si `key` coincide con `^RK-`, lookup legacy por `public_ref`; si no, por `public_access_token`.
- JSON público sin `buyer_json` (solo ref legible, estado, líneas, total, instrucciones).

### Pendiente opcional

- Deprecar lookup por `RK-` en URL (solo token) tras periodo de gracia.

---

## 3. Turnstile en producción

Con `CHATBOT_ENV=production`, checkout público y `startCheckout` en DO **fallan** con `turnstile_not_configured` si falta `TURNSTILE_SECRET_KEY`.

---

## 4. Capacidades de integración (visión)

| Capacidad | Uso hoy |
|-----------|---------|
| `catalog.search` | Storefront API si no hay catálogo D1; runtime commerce HTTP tools |
| `payment.create_link` | `createProviderCheckoutUrl` en checkout (plantillas Wompi/etc.) |

Tienda nativa prioriza D1; chat y pasarela comparten la misma capa cuando la org conecta integraciones.

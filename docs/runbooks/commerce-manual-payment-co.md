# Pago manual y referencia RK (Colombia)

## Qué ve el comprador

1. Tras confirmar el pedido (chat o tienda hosted), Desk crea una orden con referencia pública **`RK-…`** (o el prefijo configurado en el manifiesto de comercio).
2. La página pública del pedido vive en **`/o/{ref}`** (mismo dominio del dashboard/widget). Ahí aparecen totales, estado y, si aplica, instrucciones de transferencia o enlace de pasarela.
3. En perfil **solo transferencia / evidencia manual**, el comprador sube comprobante desde esa página; el equipo valida en el panel de ventas.

## Flujo transferencia (sin pasarela automática)

- Manifiesto: `commerceProfile` distinto de flujo solo pasarela, con `paymentInstructions` (banco, titular, cuenta, notas).
- La orden queda en **`awaiting_payment`** o **`pending_fulfillment`** según manifiesto; la referencia **`RK-…`** identifica el pago en conciliación.
- El visitante abre **`/o/RK-…`**, adjunta evidencia; runtime dispara webhook/evento de evidencia y la bandeja humana puede marcar pagado.

## Chat vs tienda

- Carrito **tienda** y carrito **chat** son conversaciones distintas; el embed puede enlazar `storeConversationId` para unificar antes de pagar.
- Reserva de stock en D1 (`stock_reservations`, TTL ~20 min) reduce sobreventa entre sesiones; el checkout sigue revalidando catálogo.

## Operación

- Migraciones D1: `0042_sales_order_attribution.sql`, `0043_stock_reservations.sql`.
- Turnstile (si hay secret en API): checkout hosted y **`startCheckout` en el DO** (botón Pagar vía commerce-intent o texto «pagar» con token en el mensaje).

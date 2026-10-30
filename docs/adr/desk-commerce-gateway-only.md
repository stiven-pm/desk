# ADR: Comercio solo pasarela (product sales)

## Estado

Aceptado.

## Decisión

1. Venta de **productos** en Desk = carrito nativo + **checkout pasarela** (link generado por API).
2. **No** cobro por transferencia, comprobantes en `/o/REF`, ni confirmación manual de pago en panel.
3. Credenciales de pasarela: el **dueño del tenant** las ingresa en Desk → Pasarela (cifradas en D1). Rekov solo da de alta al merchant en el proveedor (fuera de Desk).
4. `commerceProfile: support_only` desactiva herramientas de carrito en el chat público.
5. Confirmación de pago: webhook Desk + `payment-return` en chat; referencia de cobro = `public_ref` (`RK-…`).

## Consecuencias

- Migración `0022_org_payment_provider.sql`.
- Deprecar `paymentInstructions` y UI de transferencia.
- MVP proveedor: Wompi (checkout link); Bold/MP después.

## Referencias

- [commerce-sources-of-truth.md](./commerce-sources-of-truth.md)
- [runbooks/tenant-conectar-pasarela-desk.md](../runbooks/tenant-conectar-pasarela-desk.md)

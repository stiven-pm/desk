# Runbook: cobro con pasarela

Checkout vía operación `payment.create_link` de la integración asignada. Confirmación vía webhook **declarative** según el perfil de pago de la plantilla en código.

Ver [tenant-conectar-pasarela-desk.md](./tenant-conectar-pasarela-desk.md).

---

## Flujo

1. **Ops** asigna integración a la org (plantillas en `packages/platform-api/src/lib/builtin-integrations/`: `wompi`, `wompi-test` sandbox).
2. **Tenant** completa credenciales en **Integraciones** y activa.
3. Chat: carrito → `commerce_start_checkout` → link según plantilla.
4. Pasarela notifica a Desk (si el tenant configuró la URL).

## Webhook Desk

- URL: `https://api-desk.rekov.co/webhooks/commerce-payments/{token}/declarative` (test: `api-test-desk…`).
- Auth: `Authorization: Bearer {eventsSecret}` (campo secreto de la plantilla; se sincroniza al guardar Integraciones).
- Cuerpo: paths de referencia/estado en el **perfil webhook** de la plantilla.

## Despliegue

Aplicar migraciones D1 incl. `0028_payment_provider_declarative_only.sql` antes de API en producción.

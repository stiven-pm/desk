# Dueño: conectar pasarela en Desk

## Pasos

1. Entra a **Panel → Cobros** (`/dashboard/panel#cobros`).
2. Define el **token** del webhook y la **URL de pago** con placeholders (`{{reference}}`, etc.).
3. Copia la **Webhook Desk** en tu pasarela.
4. Pulsa **Guardar** y **Activar**.
5. Prueba un checkout en el chat (referencia `RK-…`).

Sin pasarela activa, `commerce_start_checkout` no generará link de pago.

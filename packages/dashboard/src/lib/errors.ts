const MESSAGES: Record<string, string> = {
  invalid_credentials: "Email o contraseña incorrectos.",
  email_taken: "Ese email ya está registrado. Prueba entrar o usa otro correo.",
  signup_closed: "El registro público está cerrado en este entorno.",
  invalid_body: "Revisa los campos del formulario.",
  rate_limited: "Demasiados intentos. Espera unos minutos.",
  unauthorized: "Sesión expirada. Vuelve a iniciar sesión.",
  forbidden: "No tienes permiso para cambiar esto (solo dueño o admin).",
  plan_origin_limit: "Alcanzaste el máximo de dominios de tu plan.",
  origin_limit_exceeded: "Quita algún dominio: superaste el tope de tu plan.",
  invalid_token: "Sesión inválida. Vuelve a iniciar sesión.",
  no_org_membership: "No hay empresa asociada a esta cuenta.",
  invalid_org: "Empresa no válida.",
  billing_not_configured: "El pago no está configurado en este entorno. Contacta a soporte.",
  checkout_unavailable:
    "No pudimos abrir el pago con Creem. Revisa el plan o intenta de nuevo en unos minutos.",
  checkout_failed: "No pudimos iniciar el pago. Intenta desde el panel o contacta a soporte.",
  subscription_required:
    "Activa tu suscripción para usar esta función. Elige un plan en el resumen del panel.",
  invalid_otp: "Código incorrecto o caducado. Vuelve a iniciar sesión para recibir otro.",
  otp_email_failed:
    "No pudimos enviar el código por correo. Intenta magic link o contacta a soporte.",
  email_password_and_otp_required: "Completa email, contraseña y código.",
  email_required: "Indica tu email.",
  reference_required: "Falta la referencia del pago.",
  payment_not_found: "No encontramos ese pago. Prueba desde el panel o contacta soporte.",
  request_failed: "Algo salió mal. Intenta de nuevo.",
  plan_seat_limit:
    "Alcanzaste el máximo de usuarios del plan. Sube de plan o cancela una invitación pendiente.",
  capabilities_required: "Elige al menos una capacidad para este usuario.",
  invalid_capability: "Hay una capacidad no válida en la invitación.",
  not_configured: "Esta función no está configurada en el servidor. Avísanos.",
  missing_credentials:
    "Primero guarda las credenciales (las tres llaves) y luego usa Probar y activar.",
  missing_required_field:
    "Completa todos los campos obligatorios antes de guardar.",
  payment_provider_not_configured:
    "No se pudo registrar la pasarela internamente. Guarda de nuevo o contacta soporte.",
  payment_provider_schema:
    "El servidor aún no aplicó la migración de pasarela declarativa. Intenta en unos minutos.",
  integration_not_ready:
    "Las credenciales no están listas. Guarda de nuevo todos los campos.",
  url_host_mismatch:
    "El dominio de la API no coincide con la plantilla (revisa allowlist en Ops, ej. sandbox.wompi.co).",
  http_error:
    "La pasarela rechazó la prueba (llaves incorrectas o entorno distinto).",
  test_failed: "La prueba de conexión falló. Revisa llaves y la plantilla en Ops.",
  template_unresolved:
    "Falta un valor en las credenciales (p. ej. llave pública). Guarda de nuevo los tres campos.",
  base_url_missing: "La plantilla de integración no tiene URL base configurada.",
  not_found: "No encontramos el asistente de tu cuenta.",
  encryption_not_configured: "Falta configuración de seguridad en el servidor. Avísanos.",
  account_deletion_pending:
    "Esta cuenta está en proceso de eliminación. No puedes iniciar sesión hasta que finalice el periodo de gracia.",
  account_deleted: "Esta cuenta ya fue eliminada.",
  email_unchanged: "El correo nuevo es igual al actual.",
  slug_unavailable: "No pudimos generar un enlace único. Prueba otro nombre.",
};

export function humanizeApiError(code: string | undefined): string {
  if (!code) return MESSAGES.request_failed;
  return MESSAGES[code] ?? code.replaceAll("_", " ");
}

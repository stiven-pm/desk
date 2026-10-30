const MESSAGES: Record<string, string> = {
  invalid_credentials: "Email o contraseña incorrectos.",
  ops_password_not_configured:
    "El login de ops no está activo en este entorno. Contacta a ingeniería Rekov.",
  invalid_body: "Revisa los campos del formulario.",
  unauthorized: "Sesión expirada. Vuelve a entrar.",
  forbidden: "No tienes permiso para esta acción.",
  request_failed: "No se pudo completar la solicitud.",
};

export function humanizeApiError(code: string | undefined): string {
  if (!code) return MESSAGES.request_failed;
  return MESSAGES[code] ?? code.replaceAll("_", " ");
}

/** Qué esperar al conectar APIs, MCP y webhooks (lenguaje para el panel, no jargon de producto). */

export function IntegrationsSecurityNote() {
  return (
    <details className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--muted)]/5 px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium text-[var(--foreground)]">
        ¿Cómo se protegen mis credenciales?
      </summary>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[var(--muted)]">
        <li>
          Las claves y tokens que pegas aquí se guardan <strong>cifrados</strong> y solo los usa el
          asistente de <strong>tu</strong> cuenta; el visitante del chat no las ve.
        </li>
        <li>
          El modelo solo puede llamar las <strong>herramientas que tú configuraste</strong> (consultas
          de lectura que definas), no “todo internet”.
        </li>
        <li>
          <strong>HTTP y OpenAPI:</strong> usa siempre HTTPS y autenticación (Bearer, API key o
          cabecera personalizada). Un endpoint público sin auth es visible para quien conozca la URL.
        </li>
        <li>
          <strong>MCP:</strong> no es “solo un enlace”. Tu servidor MCP debe ser una API privada
          (HTTPS recomendado; en producción el protocolo exige transporte seguro). Desk puede enviar
          cabeceras de autorización en cada llamada; configúralas al guardar el servidor.
        </li>
        <li>
          <strong>Webhooks salientes:</strong> opcionalmente firmamos cada evento con un secreto
          (cabecera <code className="text-xs">X-Desk-Signature</code>) para que tu backend verifique
          que el POST viene de Desk.
        </li>
      </ul>
      <p className="mt-3 text-xs text-[var(--muted)]">
        MCP:{" "}
        <a
          href="https://modelcontextprotocol.io/docs/concepts/architecture"
          className="text-[var(--primary)] underline"
          target="_blank"
          rel="noreferrer"
        >
          arquitectura y transporte (documentación oficial)
        </a>
        . Si no controlas el servidor MCP, no lo conectes.
      </p>
    </details>
  );
}

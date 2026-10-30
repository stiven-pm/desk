/** Título público del chat — sin nombres internos tipo "Default bot". */
export function publicAssistantTitle(botName: string, orgName: string): string {
  const n = botName.trim();
  if (!n || /^default\s*bot$/i.test(n) || n === "Asistente principal") {
    return orgName ? `Asistente · ${orgName}` : "Asistente";
  }
  return n.includes("·") ? n : `${n} · ${orgName}`;
}

export function filterTenantWidgetOrigins(
  origins: string[],
  appUrl: string | undefined,
): string[] {
  const desk = appUrl?.trim().replace(/\/$/, "");
  if (!desk) return origins;
  return origins.filter((o) => o.replace(/\/$/, "") !== desk);
}

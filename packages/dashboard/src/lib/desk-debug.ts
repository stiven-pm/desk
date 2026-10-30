/** Activar en consola del navegador: localStorage.setItem('desk_debug', '1') y recargar. */
export function isDeskDebug(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("desk_debug") === "1";
}

export function deskDebug(label: string, data?: unknown): void {
  if (!isDeskDebug()) return;
  if (data !== undefined) {
    console.info(`[Desk] ${label}`, data);
  } else {
    console.info(`[Desk] ${label}`);
  }
}

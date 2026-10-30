export class ApiHttpError extends Error {
  readonly code: string;
  readonly requestId: string | null;
  readonly httpStatus: number;

  constructor(message: string, code: string, httpStatus: number, requestId: string | null) {
    super(message);
    this.name = "ApiHttpError";
    this.code = code;
    this.requestId = requestId;
    this.httpStatus = httpStatus;
  }
}

export function actionErrorLines(e: unknown): { message: string; hint: string | null } {
  if (e instanceof ApiHttpError) {
    const parts = [`${e.code} (${e.httpStatus})`];
    if (e.requestId) parts.push(`ref ${e.requestId}`);
    return { message: e.message, hint: parts.join(" · ") };
  }
  if (e instanceof Error) return { message: e.message, hint: null };
  return { message: "Algo salió mal. Intenta de nuevo.", hint: null };
}

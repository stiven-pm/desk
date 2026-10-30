export function json<T>(data: T, status = 200, headers?: HeadersInit): Response {
  return Response.json(data, { status, headers });
}

export function apiError(
  code: string,
  status = 400,
  requestId?: string,
  detail?: string,
): Response {
  return json(
    {
      error: code,
      code,
      request_id: requestId ?? null,
      ...(detail?.trim() ? { detail: detail.trim() } : {}),
    },
    status,
  );
}

export function randomId(): string {
  return crypto.randomUUID();
}

export function periodStartIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

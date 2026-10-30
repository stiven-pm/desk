import { requireApiUrl } from "./config";
import { ApiHttpError } from "./api-error";
import { humanizeApiError } from "./errors";

export async function api<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const token =
    options.token ??
    (typeof window !== "undefined" ? localStorage.getItem("token") : null);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${requireApiUrl()}${path}`, { ...options, headers });
  const data = (await res.json()) as T & {
    error?: string;
    code?: string;
    request_id?: string | null;
    detail?: string;
  };
  if (!res.ok) {
    const code = data.code ?? data.error ?? "request_failed";
    const msg =
      data.detail?.trim() ||
      humanizeApiError(code);
    const requestId =
      typeof data.request_id === "string" ? data.request_id : null;
    throw new ApiHttpError(msg, code, res.status, requestId);
  }
  return data;
}

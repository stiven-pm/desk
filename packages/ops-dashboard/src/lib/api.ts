import { requireApiUrl } from "./config";
import { humanizeApiError } from "./errors";

export async function opsApi<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const apiUrl = requireApiUrl();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const token =
    typeof window !== "undefined" ? localStorage.getItem("ops_token") : null;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${apiUrl}${path}`, { ...options, headers });
  const data = (await res.json()) as T & { error?: string; code?: string };
  if (!res.ok) {
    throw new Error(humanizeApiError(data.error ?? data.code));
  }
  return data;
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  return opsApi(path, options);
}

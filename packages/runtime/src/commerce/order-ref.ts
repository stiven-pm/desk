export function formatPublicOrderRef(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `RK-${n}`;
}

export function formatPublicAccessToken(): string {
  return crypto.randomUUID();
}

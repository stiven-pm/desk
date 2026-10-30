export function redactSecretsInText(
  text: string,
  secrets: Array<string | undefined>,
): string {
  let out = text;
  for (const secret of secrets) {
    if (!secret || secret.length < 4) continue;
    out = out.split(secret).join("[REDACTED]");
  }
  return out;
}

const MAX_TOOL_OUTPUT_CHARS = 12_000;

export function truncateToolOutput(raw: string): string {
  if (raw.length <= MAX_TOOL_OUTPUT_CHARS) return raw;
  return `${raw.slice(0, MAX_TOOL_OUTPUT_CHARS)}\n… [truncado]`;
}

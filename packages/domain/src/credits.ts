/** Internal credit weights (approximate token economics). */
export const CREDIT_WEIGHTS = {
  inputPer1k: 1,
  outputPer1k: 4,
  cacheReadPer1k: 0.1,
  embeddingPer1k: 0.5,
} as const;

export function creditsFromUsage(usage: {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
}): number {
  const inC = (usage.inputTokens / 1000) * CREDIT_WEIGHTS.inputPer1k;
  const outC = (usage.outputTokens / 1000) * CREDIT_WEIGHTS.outputPer1k;
  const cacheC =
    ((usage.cacheReadTokens ?? 0) / 1000) * CREDIT_WEIGHTS.cacheReadPer1k;
  return Math.ceil(inC + outC + cacheC);
}

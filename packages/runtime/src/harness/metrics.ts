export type HarnessMetricPoint = {
  botId?: string;
  phase: string;
  toolCount: number;
  promptTokens?: number;
  catalogSize?: number;
  mcpListCalls?: number;
};

export function logHarnessMetric(
  analytics: AnalyticsEngineDataset | undefined,
  point: HarnessMetricPoint,
): void {
  if (!analytics) return;
  try {
    analytics.writeDataPoint({
      blobs: [
        point.phase,
        point.botId ?? "",
        String(point.toolCount),
        String(point.catalogSize ?? 0),
        String(point.mcpListCalls ?? 0),
      ],
      doubles: [point.promptTokens ?? 0],
      indexes: [point.botId ?? "unknown"],
    });
  } catch {
    /* best-effort */
  }
}

/** Queue ingest contracts (implementation in platform-api worker consumer). */
export type IngestQueueMessage = {
  orgId: string;
  sourceId: string;
  jobId: string;
};

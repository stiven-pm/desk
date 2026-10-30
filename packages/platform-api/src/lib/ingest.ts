import type { Env } from "../types";
import { randomId } from "./http";
import { embedTexts } from "./embeddings";
import { extractDocumentText } from "./extract-document-text";

export interface IngestQueueMessage {
  orgId: string;
  sourceId: string;
  jobId: string;
}

export async function enqueueIngest(
  env: Env,
  msg: IngestQueueMessage,
): Promise<void> {
  await env.INGEST_QUEUE.send(msg);
}

export async function processIngestJob(
  env: Env,
  msg: IngestQueueMessage,
): Promise<void> {
  const source = await env.DB.prepare(
    `SELECT id, org_id, bot_id, r2_key, status, document_filename, title FROM sources WHERE id = ?`,
  )
    .bind(msg.sourceId)
    .first<{
      id: string;
      org_id: string;
      bot_id: string;
      r2_key: string | null;
      status: string;
      document_filename: string | null;
      title: string;
    }>();

  if (!source?.r2_key) {
    await markSourceFailed(env, msg.sourceId, "missing_r2_key");
    return;
  }

  const obj = await env.SOURCES.get(source.r2_key);
  if (!obj) {
    await markSourceFailed(env, msg.sourceId, "r2_not_found");
    return;
  }

  const filename =
    source.document_filename?.trim() || source.title?.trim() || "document";
  const text = (await extractDocumentText(env, obj, filename)).trim();
  if (!text) {
    await markSourceFailed(env, msg.sourceId, "empty_extracted_text");
    return;
  }
  const chunks = chunkText(text, 800);
  const embeddings = await embedTexts(env, chunks);
  if (!embeddings?.length || embeddings.some(isZeroEmbedding)) {
    await markSourceFailed(env, msg.sourceId, "embeddings_unavailable");
    return;
  }
  const vectors: VectorizeVector[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const id = `${source.id}:${i}`;
    vectors.push({
      id,
      values: embeddings[i] ?? embeddings[0],
      metadata: {
        org_id: source.org_id,
        bot_id: source.bot_id,
        source_id: source.id,
        text: chunks[i].slice(0, 500),
      },
    });
  }

  if (vectors.length > 0) {
    await env.VECTORIZE.upsert(vectors);
  }

  await env.DB.prepare(
    `UPDATE sources SET status = 'ready', updated_at = datetime('now') WHERE id = ?`,
  )
    .bind(msg.sourceId)
    .run();

  await env.DB.prepare(
    `UPDATE ingest_jobs SET status = 'done' WHERE id = ?`,
  )
    .bind(msg.jobId)
    .run();
}

async function markSourceFailed(
  env: Env,
  sourceId: string,
  reason: string,
): Promise<void> {
  await env.DB.prepare(
    `UPDATE sources SET status = 'failed', error_message = ?, updated_at = datetime('now') WHERE id = ?`,
  )
    .bind(reason, sourceId)
    .run();
}

function isZeroEmbedding(values: number[]): boolean {
  return values.length > 0 && values.every((v) => v === 0);
}

/** Vuelve a encolar ingestión desde R2 (mismo archivo, nuevo job). */
export async function reindexSource(
  env: Env,
  sourceId: string,
  orgId: string,
): Promise<boolean> {
  const source = await env.DB.prepare(
    `SELECT id, org_id, r2_key FROM sources WHERE id = ? AND org_id = ?`,
  )
    .bind(sourceId, orgId)
    .first<{ id: string; org_id: string; r2_key: string | null }>();
  if (!source?.r2_key) return false;

  const jobId = randomId();
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE sources SET status = 'indexing', error_message = NULL, updated_at = datetime('now') WHERE id = ?`,
    ).bind(sourceId),
    env.DB.prepare(
      `INSERT INTO ingest_jobs (id, org_id, source_id, idempotency_key, status)
       VALUES (?, ?, ?, ?, 'queued')`,
    ).bind(jobId, orgId, sourceId, `reindex-${sourceId}-${jobId}`),
  ]);

  await enqueueIngest(env, { orgId, sourceId, jobId });
  return true;
}

export async function reindexBotSources(
  env: Env,
  botId: string,
  orgId: string,
): Promise<number> {
  const rows = await env.DB.prepare(
    `SELECT id FROM sources WHERE org_id = ? AND bot_id = ? AND r2_key IS NOT NULL`,
  )
    .bind(orgId, botId)
    .all<{ id: string }>();

  let n = 0;
  for (const row of rows.results ?? []) {
    if (await reindexSource(env, row.id, orgId)) n += 1;
  }
  return n;
}

function chunkText(text: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    out.push(text.slice(i, i + size));
  }
  return out.length ? out : [""];
}

export async function createSourceUpload(
  env: Env,
  params: {
    orgId: string;
    botId: string;
    title: string;
    description?: string;
    documentFilename?: string;
    contentType: string;
    body: ArrayBuffer;
    idempotencyKey: string;
  },
): Promise<{ sourceId: string; jobId: string }> {
  const existing = await env.DB.prepare(
    `SELECT source_id FROM ingest_jobs WHERE org_id = ? AND idempotency_key = ?`,
  )
    .bind(params.orgId, params.idempotencyKey)
    .first<{ source_id: string }>();
  if (existing) {
    return { sourceId: existing.source_id, jobId: existing.source_id };
  }

  const sourceId = randomId();
  const jobId = randomId();
  const r2Key = `${params.orgId}/${sourceId}`;

  await env.SOURCES.put(r2Key, params.body, {
    httpMetadata: { contentType: params.contentType },
  });

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO sources (id, org_id, bot_id, name, title, description, document_filename, kind, status, r2_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'upload', 'indexing', ?)`,
    ).bind(
      sourceId,
      params.orgId,
      params.botId,
      params.title,
      params.title,
      params.description ?? "",
      params.documentFilename ?? null,
      r2Key,
    ),
    env.DB.prepare(
      `INSERT INTO ingest_jobs (id, org_id, source_id, idempotency_key, status)
       VALUES (?, ?, ?, ?, 'queued')`,
    ).bind(jobId, params.orgId, sourceId, params.idempotencyKey),
  ]);

  await enqueueIngest(env, {
    orgId: params.orgId,
    sourceId,
    jobId,
  });

  return { sourceId, jobId };
}

const MAX_VECTOR_CHUNKS_GUESS = 256;

/** Removes upload from D1/R2 and best-effort Vectorize chunks for this source. */
export async function deleteDocumentSource(
  env: Env,
  sourceId: string,
  orgId: string,
): Promise<boolean> {
  const source = await env.DB.prepare(
    `SELECT r2_key, bot_id FROM sources WHERE id = ? AND org_id = ?`,
  )
    .bind(sourceId, orgId)
    .first<{ r2_key: string | null; bot_id: string }>();

  if (!source) return false;

  const vectorIds = Array.from(
    { length: MAX_VECTOR_CHUNKS_GUESS },
    (_, i) => `${sourceId}:${i}`,
  );
  try {
    await env.VECTORIZE.deleteByIds(vectorIds);
  } catch (e) {
    console.error("vectorize_delete_failed", sourceId, e);
  }

  if (source.r2_key) {
    try {
      await env.SOURCES.delete(source.r2_key);
    } catch {
      /* ignore */
    }
  }

  await env.DB.prepare(`DELETE FROM sources WHERE id = ? AND org_id = ?`)
    .bind(sourceId, orgId)
    .run();

  const { invalidateBotCache } = await import("./tenant-cache");
  await invalidateBotCache(env, source.bot_id);
  return true;
}

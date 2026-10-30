import {
  DEFAULT_EMBEDDING_DIMENSIONS,
  embeddingDimensions,
  llmEmbeddings,
} from "@chatbot/runtime/llm-client";
import type { Env } from "../types";

export function embeddingDimensionsForEnv(env: Env): number {
  return embeddingDimensions(env);
}

export async function embedText(env: Env, text: string): Promise<number[]> {
  const batch = await embedTexts(env, [text]);
  return batch?.[0] ?? zeroVector(embeddingDimensionsForEnv(env));
}

export async function embedTexts(env: Env, texts: string[]): Promise<number[][] | null> {
  if (!texts.length) return [];

  const vectors = await llmEmbeddings(env, texts);
  if (vectors) return vectors;

  console.warn("embeddings_unavailable");
  return null;
}

function zeroVector(dim: number): number[] {
  return new Array(dim).fill(0);
}

export { DEFAULT_EMBEDDING_DIMENSIONS };

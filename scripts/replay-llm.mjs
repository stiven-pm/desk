/**
 * Replay a captured Workers AI payload against multiple models.
 *
 * Usage:
 *   REPLAY_MODELS=@cf/zai-org/glm-5.3-flash,@cf/deepseek-ai/deepseek-v4-flash-0731 \
 *   CF_ACCOUNT_ID=... CF_API_TOKEN=... \
 *   node --env-file=.env.test scripts/replay-llm.mjs payload.json
 */

import { readFileSync } from "node:fs";

const payloadPath = process.argv[2];
if (!payloadPath) {
  console.error("Usage: node scripts/replay-llm.mjs <payload.json>");
  process.exit(1);
}

const accountId = process.env.CF_ACCOUNT_ID?.trim();
const token = process.env.CF_API_TOKEN?.trim();
if (!accountId || !token) {
  console.error("Set CF_ACCOUNT_ID and CF_API_TOKEN");
  process.exit(1);
}

/** @type {{ messages: unknown[]; tools?: unknown[]; max_tokens?: number }} */
const payload = JSON.parse(readFileSync(payloadPath, "utf8"));
const models = (process.env.REPLAY_MODELS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!models.length) {
  console.error("Set REPLAY_MODELS=comma-separated Workers AI model ids");
  process.exit(1);
}

const RUNS = Number(process.env.REPLAY_RUNS ?? "8") || 8;

function extractText(j) {
  const msg = j?.result?.choices?.[0]?.message;
  const text = (msg?.content ?? j?.result?.response ?? "").trim();
  const calls = msg?.tool_calls ?? j?.result?.tool_calls ?? [];
  return { text, calls };
}

for (const model of models) {
  let ok = 0;
  let tool = 0;
  const encoded = encodeURIComponent(model);
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${encoded}`;

  for (let i = 0; i < RUNS; i++) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        ...payload,
        tool_choice: "auto",
      }),
    });
    const j = await res.json();
    const { text, calls } = extractText(j);
    if (text || calls.length) ok++;
    if (calls.length) tool++;
  }
  console.log(`${model}: usable ${ok}/${RUNS}, con tool_call ${tool}/${RUNS}`);
}

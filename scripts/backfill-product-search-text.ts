#!/usr/bin/env npx tsx
/**
 * Rellena products.search_text para filas existentes (misma regla que admin POST/PATCH).
 *
 *   npx tsx scripts/backfill-product-search-text.ts --local
 *   npx tsx scripts/backfill-product-search-text.ts --remote
 *   npx tsx scripts/backfill-product-search-text.ts --remote --test
 */
import { execFileSync } from "node:child_process";
import { buildProductSearchText } from "@chatbot/domain";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const remote = process.argv.includes("--remote");
const testEnv = process.argv.includes("--test");
const cfg = path.join(repoRoot, "infra/cloudflare/wrangler.toml");
const dbName = testEnv ? "desk-control-test" : "desk-control";

function d1Json(command: string): unknown {
  const wranglerArgs = [
    "wrangler",
    "d1",
    "execute",
    dbName,
    ...(testEnv ? ["--env", "test"] : []),
    ...(remote ? ["--remote"] : ["--local"]),
    "--config",
    cfg,
    "--json",
    "--command",
    command,
  ];
  const out = execFileSync("npx", wranglerArgs, {
    encoding: "utf8",
    cwd: repoRoot,
  });
  const parsed = JSON.parse(out) as Array<{
    results?: Array<{ rows?: Record<string, unknown>[] }>;
  }>;
  const rows = parsed[0]?.results?.[0]?.rows ?? [];
  return rows;
}

type Row = {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  category: string | null;
};

const rows = d1Json(
  "SELECT id, org_id, name, description, category FROM products",
) as Row[];

let updated = 0;
for (const row of rows) {
  const searchText = buildProductSearchText({
    name: row.name,
    description: row.description,
    category: row.category,
  });
  const esc = searchText.replace(/'/g, "''");
  d1Json(
    `UPDATE products SET search_text = '${esc}' WHERE id = '${row.id.replace(/'/g, "''")}' AND org_id = '${row.org_id.replace(/'/g, "''")}'`,
  );
  updated += 1;
}

console.log(`backfill search_text (${dbName}): ${updated} products`);

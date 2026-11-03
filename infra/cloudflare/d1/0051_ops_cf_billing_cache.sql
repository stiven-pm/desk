-- Cache última consulta Billable Usage API (Cloudflare).

CREATE TABLE ops_cf_billing_cache (
  cache_key TEXT PRIMARY KEY,
  fetched_at TEXT NOT NULL,
  period_from TEXT NOT NULL,
  period_to TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  total_usd REAL NOT NULL,
  by_family_json TEXT NOT NULL DEFAULT '{}',
  rows_json TEXT NOT NULL DEFAULT '[]',
  fetch_error TEXT
);

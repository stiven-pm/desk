export type HarnessEnv = {
  HARNESS_LAZY_TOOLS?: string;
  HARNESS_SETUP_VERIFY?: string;
  HARNESS_COMPACT_HISTORY?: string;
  HARNESS_ROUTER?: string;
};

function truthy(v: string | undefined): boolean {
  const t = v?.trim().toLowerCase();
  if (!t) return false;
  return t === "1" || t === "true" || t === "yes" || t === "on";
}

/** Lazy catalog + hydrate tools (visitor). Default on when unset in production-like envs. */
export function harnessLazyToolsEnabled(env: HarnessEnv): boolean {
  const v = env.HARNESS_LAZY_TOOLS?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off") return false;
  if (truthy(env.HARNESS_LAZY_TOOLS)) return true;
  return true;
}

export function harnessSetupVerifyEnabled(env: HarnessEnv): boolean {
  const v = env.HARNESS_SETUP_VERIFY?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off") return false;
  return true;
}

export function harnessCompactHistoryEnabled(env: HarnessEnv): boolean {
  const v = env.HARNESS_COMPACT_HISTORY?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off") return false;
  return true;
}

export function harnessRouterEnabled(env: HarnessEnv): boolean {
  if (!harnessLazyToolsEnabled(env)) return false;
  const v = env.HARNESS_ROUTER?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off") return false;
  return truthy(env.HARNESS_ROUTER) || v === undefined || v === "";
}

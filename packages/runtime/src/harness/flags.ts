export type HarnessEnv = {
  HARNESS_SETUP_VERIFY?: string;
  HARNESS_COMPACT_HISTORY?: string;
  AGENT_FLOW_TOOLS?: string;
  AGENT_DRIVEN_WIZARD?: string;
  /** Default on: integrations via desk_codemode instead of ranked HTTP tools. */
  INTEGRATION_CODE_MODE?: string;
};

function truthy(v: string | undefined): boolean {
  const t = v?.trim().toLowerCase();
  if (!t) return false;
  return t === "1" || t === "true" || t === "yes" || t === "on";
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

function falsyOff(v: string | undefined): boolean {
  const t = v?.trim().toLowerCase();
  return t === "0" || t === "false" || t === "off";
}

/** Checkout flow tools (view cart, begin payment, …) instead of legacy set_buyer/start_checkout. Default on. */
export function agentFlowToolsEnabled(env: HarnessEnv): boolean {
  if (falsyOff(env.AGENT_FLOW_TOOLS)) return false;
  return true;
}

/** Buyer wizard + checkout via agent tools. Default on. */
export function agentDrivenWizardEnabled(env: HarnessEnv): boolean {
  if (falsyOff(env.AGENT_DRIVEN_WIZARD)) return false;
  return true;
}

/** ERP/payment templates via desk_codemode instead of ranked tool schemas. Default on. */
export function integrationCodeModeEnabled(env: HarnessEnv): boolean {
  if (falsyOff(env.INTEGRATION_CODE_MODE)) return false;
  return true;
}

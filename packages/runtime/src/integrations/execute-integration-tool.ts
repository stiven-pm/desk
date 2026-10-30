import {
  getJsonPath,
  validateIntegrationAiArgs,
} from "@chatbot/domain";
import type { DeskIntegrationTool } from "./types";
import { executeIntegrationOperation } from "./integration-http-engine";

export async function executeDeskIntegrationTool(
  tool: DeskIntegrationTool,
  args: Record<string, unknown>,
): Promise<string> {
  if (tool.requiresConfirm && args.confirm !== true && args.confirm !== "true") {
    return JSON.stringify({
      ok: false,
      code: "confirmation_required",
      hint: "Pasa confirm: true para ejecutar esta operación.",
    });
  }

  const validated = validateIntegrationAiArgs(tool.operation.params ?? [], args);
  if (!validated.ok) {
    return JSON.stringify({ ok: false, code: validated.code });
  }

  const result = await executeIntegrationOperation(
    tool.connector,
    tool.operation,
    tool.fieldValues,
    validated.values,
  );

  if (!result.ok) {
    return JSON.stringify({ ok: false, code: result.code, status: result.status });
  }

  const maxItems =
    tool.operation.response?.maxItems ??
    tool.operation.responseMap?.maxItems ??
    48;

  let payload: Record<string, unknown> = { ok: true, mapped: result.mapped };
  const itemsPath =
    tool.operation.response?.itemsPath ??
    tool.operation.responseMap?.itemsPath;
  if (itemsPath && result.bodyJson) {
    const items = getJsonPath(result.bodyJson, itemsPath);
    if (Array.isArray(items)) {
      payload = { ...payload, items: items.slice(0, maxItems) };
    }
  }

  return JSON.stringify(payload);
}

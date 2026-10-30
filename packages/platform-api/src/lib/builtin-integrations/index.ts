import type { Env } from "../../types";
import {
  syncBuiltinIntegrationDefinition,
  type IntegrationDefinitionPayload,
} from "../integration-definitions";
import { BUILTIN_WOMPI_ID, wompiIntegrationDefinition } from "./wompi";
import {
  BUILTIN_WOMPI_TEST_ID,
  wompiTestIntegrationDefinition,
} from "./wompi-test";

const BUILTINS: Array<{ fixedId: string; build: (env: Env) => IntegrationDefinitionPayload }> =
  [
    { fixedId: BUILTIN_WOMPI_ID, build: wompiIntegrationDefinition },
    {
      fixedId: BUILTIN_WOMPI_TEST_ID,
      build: () => wompiTestIntegrationDefinition(),
    },
  ];

export async function syncBuiltinIntegrationTemplates(env: Env): Promise<void> {
  for (const b of BUILTINS) {
    await syncBuiltinIntegrationDefinition(env, b.fixedId, b.build(env));
  }
}

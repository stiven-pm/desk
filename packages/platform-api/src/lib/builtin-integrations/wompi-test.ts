import { createWompiIntegrationPayload } from "./wompi-shared";

/** Siempre apunta a sandbox.wompi.co (llaves pub_test_ / pruebas), en prod y test. */
export const BUILTIN_WOMPI_TEST_ID = "builtin_wompi_test";

export function wompiTestIntegrationDefinition() {
  return createWompiIntegrationPayload({
    slug: "wompi-test",
    name: "Wompi test",
    description:
      "Wompi en modo pruebas que permite probar el flujo antes de un cliente real",
    sandbox: true,
    operationIdPrefix: "builtin_wompi_test",
  });
}

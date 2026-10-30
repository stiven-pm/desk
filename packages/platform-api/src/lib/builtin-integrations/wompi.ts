import type { Env } from "../../types";
import { createWompiIntegrationPayload } from "./wompi-shared";

export const BUILTIN_WOMPI_ID = "builtin_wompi";

export function wompiIntegrationDefinition(env: Env) {
  const sandbox = (env.CHATBOT_ENV ?? "production") === "test";
  return createWompiIntegrationPayload({
    slug: "wompi",
    name: "Wompi",
    description: sandbox
      ? "Wompi con entorno sandbox (desk test). Usa «Wompi test» si solo quieres pruebas en prod."
      : "Wompi producción (production.wompi.co, llaves pub_prod_…).",
    sandbox,
    operationIdPrefix: "builtin_wompi",
  });
}

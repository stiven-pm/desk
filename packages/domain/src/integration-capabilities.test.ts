import { describe, expect, it } from "vitest";
import {
  applyResponseMap,
  buildLlmInputSchemaFromParams,
  getJsonPath,
  normalizeIntegrationCapability,
  parseDeclarativeWebhook,
  renderTemplate,
  resolveOperationParams,
  validateIntegrationAiArgs,
} from "./integration-capabilities";

describe("renderTemplate", () => {
  it("replaces placeholders", () => {
    expect(
      renderTemplate("/pay/{{reference}}?a={{amount}}", {
        reference: "RK-1",
        amount: "100",
      }),
    ).toBe("/pay/RK-1?a=100");
  });
});

describe("getJsonPath", () => {
  it("reads array index segments", () => {
    const body = { data: { items: [{ id: "p1" }] } };
    expect(getJsonPath(body, "data.items[0].id")).toBe("p1");
  });
});

describe("normalizeIntegrationCapability", () => {
  it("maps legacy names", () => {
    expect(normalizeIntegrationCapability("catalog.list_products")).toBe(
      "catalog.search",
    );
    expect(normalizeIntegrationCapability("payment.create_checkout")).toBe(
      "payment.create_link",
    );
  });
});

describe("resolveOperationParams", () => {
  it("builds prefixed template keys", () => {
    const vars = resolveOperationParams(
      [
        { key: "query", origin: "ai" },
        { key: "apiKey", origin: "secret", configKey: "apiKey" },
      ],
      {
        fieldValues: { apiKey: "sek" },
        ai: { query: "zapato" },
        ctx: {},
        computed: {},
      },
    );
    expect(vars["ai.query"]).toBe("zapato");
    expect(vars["secret.apiKey"]).toBe("sek");
  });
});

describe("validateIntegrationAiArgs", () => {
  it("rejects missing required ai param", () => {
    const r = validateIntegrationAiArgs(
      [{ key: "q", origin: "ai", required: true, schema: { type: "string" } }],
      {},
    );
    expect(r.ok).toBe(false);
  });

  it("accepts valid args", () => {
    const r = validateIntegrationAiArgs(
      [{ key: "q", origin: "ai", schema: { type: "string" } }],
      { q: "hola" },
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.values.q).toBe("hola");
  });
});

describe("buildLlmInputSchemaFromParams", () => {
  it("only includes ai params", () => {
    const schema = buildLlmInputSchemaFromParams([
      { key: "q", origin: "ai", description: "buscar" },
      { key: "apiKey", origin: "secret" },
    ]);
    expect(Object.keys(schema.properties as object)).toEqual(["q"]);
  });
});

describe("applyResponseMap", () => {
  it("maps dotted paths", () => {
    const body = { data: { url: "https://pay.test", id: "tx1" } };
    const out = applyResponseMap(body, {
      fields: { checkoutUrl: "data.url", externalId: "data.id" },
    });
    expect(out).toEqual({
      checkoutUrl: "https://pay.test",
      externalId: "tx1",
    });
  });
});

describe("parseDeclarativeWebhook", () => {
  it("uses profile paths", () => {
    const body = { payload: { ref: "RK-9", state: "APPROVED" } };
    const parsed = parseDeclarativeWebhook(body, {
      webhookAuth: { type: "bearer" },
      referenceJsonPath: "payload.ref",
      statusJsonPath: "payload.state",
      paidStatusValues: ["APPROVED"],
      syncGenericWebhookSecret: true,
    });
    expect(parsed.orderReference).toBe("RK-9");
    expect(parsed.status).toBe("paid");
  });

  it("uses inboundReferencePaths", () => {
    const body = { meta: { orderRef: "RK-77" }, status: "paid" };
    const parsed = parseDeclarativeWebhook(body, {
      webhookAuth: { type: "bearer" },
      inboundReferencePaths: ["meta.orderRef"],
      statusJsonPath: "status",
      syncGenericWebhookSecret: true,
    });
    expect(parsed.orderReference).toBe("RK-77");
    expect(parsed.status).toBe("paid");
  });
});

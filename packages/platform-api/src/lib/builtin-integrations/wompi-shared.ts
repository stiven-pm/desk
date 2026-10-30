import type { IntegrationDefinitionPayload } from "../integration-definitions";

export function createWompiIntegrationPayload(opts: {
  slug: string;
  name: string;
  description: string;
  sandbox: boolean;
  operationIdPrefix: string;
}): IntegrationDefinitionPayload {
  const baseUrl = opts.sandbox
    ? "https://sandbox.wompi.co/v1"
    : "https://production.wompi.co/v1";
  const host = opts.sandbox ? "sandbox.wompi.co" : "production.wompi.co";
  const p = opts.operationIdPrefix;

  return {
    slug: opts.slug,
    name: opts.name,
    kind: "payment",
    description: opts.description,
    fields: [
      {
        key: "publicKey",
        label: "Llave pública Wompi",
        secret: false,
        required: true,
        placeholder: opts.sandbox ? "pub_test_…" : "pub_prod_…",
      },
      {
        key: "privateKey",
        label: "Llave privada Wompi",
        secret: true,
        required: true,
      },
      {
        key: "eventsSecret",
        label: "Secret de eventos (Wompi = Desk webhook)",
        secret: true,
        required: true,
      },
    ],
    connector: {
      baseUrl,
      allowedHosts: [host],
      authType: "bearer",
      authFieldKey: "privateKey",
    },
    paymentProfile: {
      webhookAuth: { type: "bearer", secretFieldKey: "eventsSecret" },
      referenceJsonPath: "data.transaction.reference",
      statusJsonPath: "data.transaction.status",
      paidStatusValues: ["APPROVED"],
      inboundReferencePaths: [
        "data.transaction.reference",
        "data.reference",
      ],
      syncGenericWebhookSecret: true,
    },
    testOperationId: "verify_merchant",
    operations: [
      {
        id: `${p}_create_link`,
        capability: "payment.create_link",
        slug: "create_link",
        method: "POST",
        pathTemplate: "/payment_links",
        bodyTemplate: `{
  "name": "Pedido {{reference}}",
  "description": "{{description}}",
  "single_use": true,
  "collect_shipping": false,
  "currency": "{{currency}}",
  "amount_in_cents": {{amountInCents}},
  "reference": "{{reference}}",
  "redirect_url": "{{redirectUrl}}"
}`,
        queryTemplate: {},
        params: [],
        response: {
          fields: {
            checkoutUrl: "data.url",
            externalId: "data.id",
          },
        },
        responseMap: {
          fields: {
            checkoutUrl: "data.url",
            externalId: "data.id",
          },
        },
        exposeToAi: false,
        sideEffect: "write",
        requiresConfirm: false,
        sortOrder: 0,
        authMode: "inherit",
      },
      {
        id: `${p}_verify_merchant`,
        capability: "payment.verify",
        slug: "verify_merchant",
        method: "GET",
        pathTemplate: "/merchants/{{publicKey}}",
        queryTemplate: {},
        params: [],
        response: { fields: {} },
        responseMap: { fields: {} },
        exposeToAi: false,
        sideEffect: "read",
        requiresConfirm: false,
        sortOrder: 1,
        authMode: "none",
      },
    ],
  };
}

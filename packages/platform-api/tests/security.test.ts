import { describe, expect, it } from "vitest";
import {
  generateApiKey,
  hashApiKey,
  isPublishableKey,
  isSecretKey,
} from "../src/lib/keys";
import { verifyCreemWebhookSignature } from "../src/lib/creem";

describe("api keys", () => {
  it("distinguishes publishable and secret prefixes", () => {
    const pub = generateApiKey("publishable");
    const sec = generateApiKey("secret");
    expect(isPublishableKey(pub.token)).toBe(true);
    expect(isSecretKey(sec.token)).toBe(true);
    expect(isPublishableKey(sec.token)).toBe(false);
  });

  it("hashes deterministically", async () => {
    const a = await hashApiKey("cb_pub_test");
    const b = await hashApiKey("cb_pub_test");
    expect(a).toBe(b);
  });
});

describe("creem webhook", () => {
  it("rejects missing signature", async () => {
    const ok = await verifyCreemWebhookSignature("{}", null, "secret");
    expect(ok).toBe(false);
  });
});

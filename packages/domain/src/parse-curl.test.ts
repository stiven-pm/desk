import { describe, expect, it } from "vitest";
import { parseCurlCommand } from "./parse-curl";

describe("parseCurlCommand", () => {
  it("parses bearer token and URL", () => {
    const p = parseCurlCommand(
      `curl -X GET 'https://api.shop.com/admin/products.json' -H 'Authorization: Bearer sk_test_abc'`,
    );
    expect(p).not.toBeNull();
    expect(p?.method).toBe("GET");
    expect(p?.baseUrl).toBe("https://api.shop.com");
    expect(p?.authType).toBe("bearer");
    expect(p?.authSecret).toBe("sk_test_abc");
  });
});

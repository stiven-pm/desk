import { describe, expect, it } from "vitest";
import {
  isCommerceToolProseLeak,
  parseCommerceToolProseLine,
} from "./parse-commerce-tool-prose";

describe("parseCommerceToolProseLine", () => {
  it("parses product details leak", () => {
    const allowed = new Set(["commerce_get_product_details"]);
    expect(
      parseCommerceToolProseLine(
        "commerce_get_product_details d76fd79a-ecab-4b46-8e77-80b378fe3367",
        allowed,
      ),
    ).toEqual({
      name: "commerce_get_product_details",
      args: { productId: "d76fd79a-ecab-4b46-8e77-80b378fe3367" },
    });
  });

  const allowed = new Set(["commerce_cart_add"]);

  it("parses GLM space-separated cart add", () => {
    const parsed = parseCommerceToolProseLine(
      "commerce_cart_add snacks 1 porción d76fd79a-ecab-4b46-8e77-80b378fe3367 1",
      allowed,
    );
    expect(parsed).toEqual({
      name: "commerce_cart_add",
      args: {
        name: "snacks",
        lineNotes: "1 porción",
        productId: "d76fd79a-ecab-4b46-8e77-80b378fe3367",
        quantity: 1,
      },
    });
    expect(
      isCommerceToolProseLeak(
        "commerce_cart_add snacks 1 porción d76fd79a-ecab-4b46-8e77-80b378fe3367 1",
        allowed,
      ),
    ).toBe(true);
  });
});

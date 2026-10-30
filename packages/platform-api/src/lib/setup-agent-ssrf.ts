import { assertPublicHttpUrl } from "@chatbot/domain";

export function assertPublicHttpsUrl(raw: string): URL {
  return assertPublicHttpUrl(raw);
}

/** Dominios de documentación habituales para autoconfiguración. */
const DOC_HOST_SUFFIXES = [
  "shopify.dev",
  "shopify.com",
  "hubspot.com",
  "developers.hubspot.com",
  "woocommerce.com",
  "woocommerce.github.io",
  "swagger.io",
  "readme.io",
  "github.com",
  "raw.githubusercontent.com",
  "googleapis.com",
  "cloudflare.com",
  "stripe.com",
  "mercadopago.com",
  "vtex.com",
  "nuvemshop.com.br",
  "tiendanube.com",
];

export function isDocFetchAllowed(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  if (DOC_HOST_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`))) {
    return true;
  }
  return host.endsWith(".readthedocs.io") || host.includes("developer.");
}

export function isOpenApiSpecUrlAllowed(url: URL): boolean {
  const path = url.pathname.toLowerCase();
  const looksLikeSpec =
    path.includes("openapi") ||
    path.includes("swagger") ||
    path.endsWith(".json") ||
    path.endsWith(".yaml") ||
    path.endsWith(".yml");
  if (looksLikeSpec) return true;
  return isDocFetchAllowed(url);
}

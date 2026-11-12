import { LEGAL_TERMS_VERSION } from "@chatbot/domain";

/** Public legal identity for policies, hub legal and receipts cross-reference. */
export const LEGAL_ENTITY = {
  legalName: "Rekov Systems S.A.S.",
  /** Colombian tax ID — also configured in Creem merchant profile for checkout receipts. */
  taxId: "902122807-2",
  productName: "Desk",
  brand: "Rekov",
  country: "Colombia",
  governingLaw: "Republic of Colombia",
  siteUrl: "https://desk.rekov.co",
  contactEmail: "contact@rekov.co",
  privacyEmail: "privacy@rekov.co",
  securityEmail: "security@rekov.co",
  dmcaEmail: "contact@rekov.co",
  lastUpdatedEn: "November 3, 2026",
  lastUpdatedEs: "3 de noviembre de 2026",
  termsVersion: LEGAL_TERMS_VERSION,
} as const;

export { LEGAL_TERMS_VERSION };

import type { PendingPromptVerdict } from "@chatbot/domain";

export type PendingPromptClassifierFixture = {
  id: string;
  offerSummary: string;
  userMessage: string;
  expected: PendingPromptVerdict;
};

/** Casos para eval del clasificador (accept / decline / other). */
export const PENDING_PROMPT_CLASSIFIER_FIXTURES: PendingPromptClassifierFixture[] =
  [
    // accept — menú
    {
      id: "menu-yes-1",
      offerSummary: "ver el menú de productos publicados",
      userMessage: "sí",
      expected: "accept",
    },
    {
      id: "menu-yes-2",
      offerSummary: "ver el menú de productos publicados",
      userMessage: "sí porfa",
      expected: "accept",
    },
    {
      id: "menu-yes-3",
      offerSummary: "ver el menú de productos publicados",
      userMessage: "dale",
      expected: "accept",
    },
    {
      id: "menu-yes-4",
      offerSummary: "ver el menú de productos publicados",
      userMessage: "claro que sí",
      expected: "accept",
    },
    {
      id: "menu-yes-5",
      offerSummary: "ver el menú de productos publicados",
      userMessage: "va",
      expected: "accept",
    },
    {
      id: "menu-yes-6",
      offerSummary: "ver el menú de productos publicados",
      userMessage: "listo muéstrame",
      expected: "accept",
    },
    // decline — menú
    {
      id: "menu-no-1",
      offerSummary: "ver el menú de productos publicados",
      userMessage: "no",
      expected: "decline",
    },
    {
      id: "menu-no-2",
      offerSummary: "ver el menú de productos publicados",
      userMessage: "no gracias",
      expected: "decline",
    },
    {
      id: "menu-no-3",
      offerSummary: "ver el menú de productos publicados",
      userMessage: "después",
      expected: "decline",
    },
    {
      id: "menu-no-4",
      offerSummary: "ver el menú de productos publicados",
      userMessage: "ahora no",
      expected: "decline",
    },
    // other — menú (negativos)
    {
      id: "menu-other-1",
      offerSummary: "ver el menú de productos publicados",
      userMessage: "cuánto cuesta el envío?",
      expected: "other",
    },
    {
      id: "menu-other-2",
      offerSummary: "ver el menú de productos publicados",
      userMessage: "tienen costillas?",
      expected: "other",
    },
    {
      id: "menu-other-3",
      offerSummary: "ver el menú de productos publicados",
      userMessage: "hola",
      expected: "other",
    },
    {
      id: "menu-other-4",
      offerSummary: "ver el menú de productos publicados",
      userMessage: "quiero hablar con una persona",
      expected: "other",
    },
    {
      id: "menu-other-5",
      offerSummary: "ver el menú de productos publicados",
      userMessage: "sí pero primero dime el horario",
      expected: "other",
    },
    // accept — carrito
    {
      id: "cart-yes-1",
      offerSummary: "ver el carrito",
      userMessage: "sí",
      expected: "accept",
    },
    {
      id: "cart-yes-2",
      offerSummary: "ver el carrito",
      userMessage: "ok",
      expected: "accept",
    },
    {
      id: "cart-yes-3",
      offerSummary: "ver el carrito",
      userMessage: "muéstrame lo que llevo",
      expected: "accept",
    },
    // decline — carrito
    {
      id: "cart-no-1",
      offerSummary: "ver el carrito",
      userMessage: "no",
      expected: "decline",
    },
    {
      id: "cart-no-2",
      offerSummary: "ver el carrito",
      userMessage: "sigue con el menú",
      expected: "other",
    },
    // other — carrito
    {
      id: "cart-other-1",
      offerSummary: "ver el carrito",
      userMessage: "agrégale dos papas",
      expected: "other",
    },
    {
      id: "cart-other-2",
      offerSummary: "ver el carrito",
      userMessage: "cuál es el total con domicilio?",
      expected: "other",
    },
    // accept — pago
    {
      id: "pay-yes-1",
      offerSummary: "continuar al pago",
      userMessage: "sí",
      expected: "accept",
    },
    {
      id: "pay-yes-2",
      offerSummary: "continuar al pago",
      userMessage: "dale pago",
      expected: "accept",
    },
    {
      id: "pay-yes-3",
      offerSummary: "continuar al pago",
      userMessage: "listo",
      expected: "accept",
    },
    // decline — pago
    {
      id: "pay-no-1",
      offerSummary: "continuar al pago",
      userMessage: "no todavía",
      expected: "decline",
    },
    {
      id: "pay-no-2",
      offerSummary: "continuar al pago",
      userMessage: "espera quiero agregar algo",
      expected: "other",
    },
    // other — pago
    {
      id: "pay-other-1",
      offerSummary: "continuar al pago",
      userMessage: "aceptan Nequi?",
      expected: "other",
    },
    {
      id: "pay-other-2",
      offerSummary: "continuar al pago",
      userMessage: "cuánto demora?",
      expected: "other",
    },
    {
      id: "pay-other-3",
      offerSummary: "continuar al pago",
      userMessage: "???",
      expected: "other",
    },
    // ambiguos → other (no forzar accept)
    {
      id: "ambig-1",
      offerSummary: "ver el menú de productos publicados",
      userMessage: "tal vez",
      expected: "other",
    },
    {
      id: "ambig-2",
      offerSummary: "ver el carrito",
      userMessage: "no sé",
      expected: "other",
    },
    {
      id: "ambig-3",
      offerSummary: "continuar al pago",
      userMessage: "depende",
      expected: "other",
    },
    {
      id: "ambig-4",
      offerSummary: "ver el menú de productos publicados",
      userMessage: "sí no sé qué quiero",
      expected: "other",
    },
    {
      id: "ambig-5",
      offerSummary: "ver el carrito",
      userMessage: "no pero muéstrame precios",
      expected: "other",
    },
    {
      id: "accept-short-1",
      offerSummary: "ver el menú de productos publicados",
      userMessage: "porfa",
      expected: "accept",
    },
    {
      id: "decline-polite-1",
      offerSummary: "continuar al pago",
      userMessage: "prefiero seguir comprando",
      expected: "other",
    },
    {
      id: "other-insult-1",
      offerSummary: "ver el menú de productos publicados",
      userMessage: "no me jodas",
      expected: "other",
    },
    {
      id: "other-topic-1",
      offerSummary: "ver el carrito",
      userMessage: "dónde están ubicados?",
      expected: "other",
    },
    {
      id: "accept-emoji-1",
      offerSummary: "ver el menú de productos publicados",
      userMessage: "👍",
      expected: "other",
    },
    {
      id: "accept-si-accent",
      offerSummary: "ver el carrito",
      userMessage: "sí",
      expected: "accept",
    },
    {
      id: "decline-later",
      offerSummary: "continuar al pago",
      userMessage: "más tarde",
      expected: "decline",
    },
    {
      id: "other-product-name",
      offerSummary: "ver el menú de productos publicados",
      userMessage: "costillas",
      expected: "other",
    },
    {
      id: "accept-yep",
      offerSummary: "ver el menú de productos publicados",
      userMessage: "yes",
      expected: "other",
    },
  ];

export const PENDING_PROMPT_CLASSIFIER_MIN_ACCURACY = 0.95;

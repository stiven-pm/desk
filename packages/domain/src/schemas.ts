import { z } from "zod";

export const registerBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(10).max(128),
  orgName: z.string().min(2).max(120),
});

export const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

export const createBotBodySchema = z.object({
  name: z.string().min(1).max(120),
  systemPrompt: z.string().max(16_000).optional(),
  model: z.string().max(64).optional(),
});

export const updateBotBodySchema = z.object({
  name: z.string().min(1).max(120).optional(),
  systemPrompt: z.string().max(16_000).optional(),
  model: z.string().max(64).optional(),
  themeCssUrl: z.string().url().max(2048).optional().nullable(),
  hostComponents: z.array(z.string().min(1).max(64)).max(32).optional(),
  welcomeMessage: z.string().max(500).optional().nullable(),
  closingMessage: z.string().max(500).optional().nullable(),
  idleReplyMessage: z.string().max(500).optional().nullable(),
});

export const visitorContactSchema = z.object({
  dialCode: z.string().min(2).max(6),
  phoneNumber: z.string().min(6).max(20),
});

export const publicSessionBodySchema = z.object({
  botId: z.string().uuid(),
  visitorId: z.string().min(8).max(128).optional(),
  conversationId: z.string().uuid().optional(),
  visitorContact: visitorContactSchema.optional(),
  /** `store` = carrito hosted; default chat/web. */
  channel: z.enum(["web", "store"]).optional(),
});

export const publicMessageBodySchema = z.object({
  text: z.string().min(1).max(8_000),
  deskAction: z.string().max(512).optional(),
  /** Sesión de carrito en la tienda hosted (misma org/bot). */
  storeConversationId: z.string().uuid().optional(),
  storeVisitorId: z.string().min(8).max(128).optional(),
  storeLinkToken: z.string().max(2048).optional(),
  chatVisitorId: z.string().min(8).max(128).optional(),
  turnstileToken: z.string().max(4096).optional(),
});

export const commerceIntentBodySchema = z.object({
  intent: z.enum(["continue", "pay", "human"]),
  title: z.string().max(200).optional(),
  itemId: z.string().max(64).optional(),
  payload: z.record(z.unknown()).optional(),
  storeConversationId: z.string().uuid().optional(),
  storeVisitorId: z.string().min(8).max(128).optional(),
  storeLinkToken: z.string().max(2048).optional(),
  chatVisitorId: z.string().min(8).max(128).optional(),
  turnstileToken: z.string().max(4096).optional(),
});

export const storeCartLinkBodySchema = z.object({
  storeConversationId: z.string().uuid(),
  storeVisitorId: z.string().min(8).max(128),
  chatVisitorId: z.string().min(8).max(128),
});

export const createSourceBodySchema = z.object({
  botId: z.string().uuid(),
  name: z.string().min(1).max(200),
  kind: z.enum(["upload", "url", "webhook"]),
  url: z.string().url().optional(),
});

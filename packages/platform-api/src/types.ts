import type { MemberCapability } from "@chatbot/domain";
import type { ConversationDO } from "@chatbot/runtime";

export type AuthScope = "tenant" | "ops";

export interface SessionUser {
  id: string;
  email: string;
  scope: AuthScope;
  orgId?: string;
  role?: string;
  capabilities?: MemberCapability[];
}

export type TenantUser = SessionUser & {
  scope: "tenant";
  orgId: string;
  role: string;
  capabilities?: MemberCapability[];
};

export interface OpsUser {
  id: string;
  email: string;
  scope: "ops";
  role: "platform_admin";
}

export interface Env {
  DB: D1Database;
  TENANT_CACHE: KVNamespace;
  SOURCES: R2Bucket;
  INGEST_QUEUE: Queue;
  VECTORIZE: VectorizeIndex;
  ANALYTICS: AnalyticsEngineDataset;
  CONVERSATION: DurableObjectNamespace<ConversationDO>;
  AI: Ai;
  JWT_SECRET: string;
  CREEM_API_KEY?: string;
  CREEM_WEBHOOK_SECRET?: string;
  CREEM_API_BASE_URL?: string;
  CREEM_PRODUCT_STARTER?: string;
  CREEM_PRODUCT_GROWTH?: string;
  CREEM_PRODUCT_BUSINESS?: string;
  CREEM_PRODUCT_CREDITS_25?: string;
  CREEM_PRODUCT_CREDITS_50?: string;
  CREEM_PRODUCT_CREDITS_100?: string;
  ENCRYPTION_KEY?: string;
  ASSETS?: Fetcher;
  GOOGLE_OAUTH_CLIENT_ID?: string;
  GOOGLE_OAUTH_CLIENT_SECRET?: string;
  HUBSPOT_OAUTH_CLIENT_ID?: string;
  HUBSPOT_OAUTH_CLIENT_SECRET?: string;
  SHOPIFY_OAUTH_CLIENT_ID?: string;
  SHOPIFY_OAUTH_CLIENT_SECRET?: string;
  CHATBOT_ENV?: string;
  APP_URL?: string;
  OPS_APP_URL?: string;
  PLATFORM_API_URL?: string;
  SIGNUPS_OPEN?: string;
  WORKERS_AI_CHAT_MODEL?: string;
  WORKERS_AI_EMBEDDING_MODEL?: string;
  LLM_CHAT_MODEL?: string;
  LLM_EMBEDDING_MODEL?: string;
  LLM_REQUEST_TIMEOUT_MS?: string;
  LLM_STREAM_ENABLED?: string;
  EMBEDDING_DIMENSIONS?: string;
  OPS_BOOTSTRAP_ADMIN_EMAILS?: string;
  OPS_BOOTSTRAP_PASSWORD?: string;
  DESK_FROM_EMAIL?: string;
  EMAIL?: SendEmail;
  /** When true, skip email OTP step after password (dev/test only). */
  LOGIN_OTP_SKIP?: string;
  /** Comma-separated emails that skip OTP (e.g. Meta App Review test user). */
  LOGIN_OTP_BYPASS_EMAILS?: string;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_SITE_KEY?: string;
  /** URL opcional de consola shell Enterprise (Moltworker / Computer). */
  ENTERPRISE_SHELL_BASE_URL?: string;
  HARNESS_SETUP_VERIFY?: string;
  HARNESS_COMPACT_HISTORY?: string;
  AGENT_FLOW_TOOLS?: string;
  AGENT_DRIVEN_WIZARD?: string;
  INTEGRATION_CODE_MODE?: string;
  LOADER?: import("@chatbot/runtime").WorkerLoaderBinding;
  DESK_CODEMODE?: {
    get(options: { props: { botId: string } }): import("@chatbot/runtime").DeskCodemodeRpc;
  };
}

export interface ApiKeyAuth {
  orgId: string;
  botId: string | null;
  kind: "publishable" | "secret";
  keyId: string;
}

export type AppEnv = {
  Bindings: Env;
  Variables: { requestId: string };
};

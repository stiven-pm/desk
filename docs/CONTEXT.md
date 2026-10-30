# Chatbot platform — domain context

## Product

Multi-tenant SaaS: embeddable web chatbot, RAG over customer sources, **Harness 2 commerce** (cart, orders, tenant checkout link) in chat, **Workers AI** (binding `AI` on the platform Worker / Conversation DO), human escalation, flat monthly billing (Creem). See [adr/harness-2-commerce.md](./adr/harness-2-commerce.md) and [AI.md](./AI.md).

Visitor turns are orchestrated with a **deterministic intent router** before the LLM ([adr/visitor-intent-router.md](./adr/visitor-intent-router.md)).

## Architecture

- **Control plane**: `platform-api` Worker + D1 + KV cache + Creem webhooks.
- **Runtime**: one Durable Object per conversation (`tenantId:conversationId`).
- **RAG**: R2 raw files → Queue → chunk/embed → Vectorize (tenant metadata filter).
- **Environments**: production Worker + test Worker (Creem test), separate D1 — see [CLOUDFLARE.md](./CLOUDFLARE.md).

## Plans

Starter / Growth / Business — límites, billing Creem, observabilidad y backlog: [PRODUCT.md](./PRODUCT.md).

## Deploy

[DEPLOY.md](./DEPLOY.md)

# Desk

Plataforma multi-tenant de chatbot web + RAG en Cloudflare.

| Panel | URL (test) |
|-------|------------|
| Cliente | https://test-desk.rekov.co |
| Ops Rekov | https://ops-test-desk.rekov.co |
| API | https://api-test-desk.rekov.co |

## Deploy

```bash
npm run desk:env:pull        # 1ª vez: secretos desde Flatbase
npm run desk:secrets:test    # 1ª vez (o al cambiar secretos)
npm run desk:deploy:test     # API + paneles (incluye D1/KV + migraciones)
```

Atajo: `npm run desk:ship:test` · Prod: `desk:secrets:prod` + `desk:deploy:prod`

Detalle: [docs/DEPLOY.md](docs/DEPLOY.md) · Planes: [docs/PRODUCT.md](docs/PRODUCT.md) · Creem: [docs/CREEM.md](docs/CREEM.md)

## Flujo producto

1. **Ops**: login (email + `OPS_BOOTSTRAP_PASSWORD` en secrets) → crear empresa → invitación owner.
2. **Admin**: accept-invite → panel → Creem si org inactiva.
3. **RAG**: documentos con título/descripción/archivo.
4. **Widget**: API keys del bot.

# Unit economics — Desk (estimación)

Precios públicos USD/mes: **Starter $49**, **Growth $149**, **Business $499** — fuente única `packages/domain/src/marketing.ts` + bandas de coste en `packages/domain/src/economics.ts` (lo usa **Desk Ops**).

Cupos técnicos: `packages/domain/src/plans.ts`.

## Cómo traducimos “créditos Desk” a dinero

En runtime, por respuesta:

`créditos ≈ ceil(prompt_tokens/1000 + completion_tokens/1000 × 4)`

No es 1:1 con la factura de Cloudflare; es un **contador interno**. Para planificar usamos:

| Hipótesis | USD por 1 000 créditos Desk (IA chat + RAG) |
|-----------|---------------------------------------------|
| Optimista (respuestas cortas, índice Vectorize pequeño) | **$0.25** |
| Base (solo tokens chat en contador; sin embed/Vectorize) | **$0.40** |
| **Realista all-in** (embed + chat + Vectorize típico) | **$0.55 – $1.00** — ver `docs/COST_PER_MESSAGE.md` |
| Pesimista (respuestas largas, índice grande, tools) | **$1.50+** |

Otros costes fijos por org/mes (infra CF + pasarela, uso alto pero no extremo):

| Partida | Starter | Growth | Business |
|---------|---------|--------|----------|
| Creem (~4% + fijo) | $2.5 | $7 | $22 |
| Workers, D1, DO, Vectorize, R2 | $2 | $6 | $18 |

**Seats:** `maxSeats` en `plans.ts` (Starter 3, Growth 5, Business 25).

---

## Uso máximo de cada plan (techo del código)

| Plan | Precio | Msgs/mes | Créditos IA/mes | Archivos RAG | Bots |
|------|--------|----------|-----------------|--------------|------|
| Starter | $49 | 2 000 | 32 000 | 5 | 1 |
| Growth | $149 | 10 000 | 90 000 | 25 | 5 |
| Business | $499 | 50 000 | 400 000 | 100 | 25 |

Escenario **máximo teórico**: consumen **100%** mensajes **y** **100%** créditos (en la práctica suele ligarse antes uno de los dos).

---

## Coste estimado al máximo (USD/mes por empresa)

### Solo IA (créditos al 100%)

| Plan | Créditos | Optimista ($0.25/1k) | Base ($0.40/1k) | Pesimista ($0.55/1k) |
|------|----------|----------------------|-----------------|----------------------|
| Starter | 32k | $8 | **$12.8** | $17.6 |
| Growth | 90k | $22.5 | **$36** | $49.5 |
| Business | 400k | $100 | **$160** | $220 |

### Coste total al máximo (IA base + infra + Creem)

| Plan | Ingreso | Coste total (base) | **Margen bruto** | **Margen %** |
|------|---------|-------------------|------------------|--------------|
| Starter | $49 | $2.5 + $2 + $12.8 ≈ **$17.3** | **~$31.7** | **~65%** |
| Growth | $149 | $7 + $6 + $36 ≈ **$49** | **~$100** | **~67%** |
| Business | $499 | $22 + $18 + $160 ≈ **$200** | **~$299** | **~60%** |

### Mismo escenario, IA pesimista

| Plan | Ingreso | Coste total (pesimista) | Margen bruto | Margen % |
|------|---------|-------------------------|--------------|----------|
| Starter | $49 | ~$32 | ~$17 | ~35% |
| Growth | $149 | ~$123 | ~$26 | ~17% |
| Business | $499 | ~$590 | **negativo** | **pérdida** |

**Conclusión:** Business a **$499** con un cliente que quema **1M créditos** puede **perder dinero** si las respuestas son largas/RAG pesado. Starter/Growth al techo siguen siendo mayormente positivos en base, pero el margen no es enorme.

---

## Uso “realista” al máximo de mensajes (no siempre 100% créditos)

Si cada mensaje del usuario dispara ~6–10 créditos de media:

| Plan | Msgs máx | Créditos implícitos | IA base (~$0.40/1k) | Margen bruto aprox. |
|------|----------|---------------------|---------------------|---------------------|
| Starter | 2 000 | 12k–20k | $5–8 | **$36–41** (~73–84%) |
| Growth | 10 000 | 60k–100k | $24–40 | **$96–112** (~64–75%) |
| Business | 50 000 | 300k–500k | $120–200 | **$259–339** (~52–68%) |

Aquí el negocio se ve mucho mejor: **el riesgo es el abuso del cupo de créditos**, no el de mensajes solo.

---

## Seats (panel)

Implementado: `maxSeats` en `plans.ts` + tope en invitaciones.

| Plan | **Seats incluidas** | Rol típico |
|------|---------------------|------------|
| **Starter** | **3** | owner + 2 del equipo |
| **Growth** | **5** | equipo con integraciones |
| **Business** | **25** | varias marcas/líneas; opcional add-on por seat |

Extra seat sugerido (si lo vendes): **$8–15 USD/mes** (Growth), **$5–10** (Business por volumen).

Motivo: las seats **no suben mucho el coste Cloudflare**; suben **soporte, formación y churn**. El límite protege tu tiempo, no la factura de CF.

---

## Resumen ejecutivo (una línea por plan, uso máximo teórico)

| Plan | ¿Ganas? al techo msgs+credits (IA base) | Margen bruto base |
|------|----------------------------------------|-------------------|
| **Starter $49** | Sí, ~**$32** | **~65%** |
| **Growth $149** | Sí, ~**$100** | **~67%** |
| **Business $499** | Sí, ~**$299** | **~60%** (pesimista IA larga: revisar) |

**Acción:** medir 1 org por plan en test con script de estrés y mirar **Workers AI + DO** en el dashboard de Cloudflare; ajustar el factor `$ / 1k créditos` si la realidad se aleja de $0.40/1k.

---

## ¿Sigue siendo competitivo el precio?

Referencia interna: `docs/POSITIONING.md` (Tidio ~$24–49 + extras, Intercom asiento + $/resolución IA, suites tipo Wolkvox sin precio público).

| Plan | Precio | Lo que el SMB compara | Lectura |
|------|--------|------------------------|---------|
| **Starter $49** | Fijo | Tidio/Crisp entry + “IA con mis PDFs” + handoff | **Razonable** si vendes *conocimiento + chat alojado*, no solo widget. Más caro que free tiers; más barato que Intercom por asiento. |
| **Growth $149** | Fijo | 10k sesiones + **5 asistentes** + integraciones API/MCP | **Fuerte** frente a “chat + Zapier + otro RAG”; el cupo de mensajes es el ancla comercial. |
| **Business $499** | Fijo | 50k sesiones + 25 bots + integraciones altas | **Competitivo** para multi-marca; enterprise sin precio público sigue siendo otro segmento. |

Métricas en vivo: **Desk Ops → Métricas** (`/v1/ops/economics/*`), bandas en `packages/domain/src/economics.ts`.

---

## Pay-as-you-go (créditos extra) — **no está en código hoy**

Hoy: cupo agotado → **429** (`usage_credits_exceeded` / mensajes); suscripción vencida → panel **402**, chat público **org_inactive**. Ver `docs/POSITIONING.md`.

Si vendes “recarga en USD lo que quieran” después del cupo o con plan pausado:

| Concepto | Recomendación |
|----------|----------------|
| Precio al cliente | **$0.90 – $1.20 USD por 1 000 créditos Desk** (redondea en packs: $25, $50, $100) |
| Tu coste IA (base) | ~**$0.40** / 1 000 créditos |
| Creem one-shot | ~4% + fijo → exige **mínimo ~$20–25** de compra o pierdes margen |
| Margen bruto variable | ~**55–70%** solo en la porción IA (mejor que muchos SaaS “usage” al 30%) |
| No regales | Sin suscripción activa, cobra **premium** (+20–30%) o solo packs con plan activo |

Implementación producto: wallet `ai_credits_bonus` en D1 + checkout Creem one-time + consumir bonus después del cupo del plan.

---

## Estrés “todo al mismo tiempo” (una org, un mes)

**Importante:** `maxBots` = cuántos **asistentes puedes crear**, no cuántos chats **simultáneos**. Cada visitante = su propia conversación + Durable Object (`orgId:conversationId`). Diez personas en el bot 1 y cinco en el bot 2 = **15 chats en paralelo**; no necesitas “bot 16”.

| Carga | ¿Qué pasa? | Coste típico |
|-------|------------|--------------|
| **25 seats** abiertas en el panel | Lecturas D1/API | **Centavos**; no disparan IA |
| **Ops** inspeccionando orgs | Listados D1, sin IA | **Despreciable** por tenant |
| **N visitantes** chateando a la vez | N Workers + N DO + N llamadas IA | **Escala con N en ese minuto**, pero el **techo del mes** sigue siendo `monthlyMessages` + `monthlyAiCredits` **por org** (compartido entre todos los bots) |
| **5 bots “al máximo”** (RAG + tools) | Mismo cupo org; más tokens por respuesta si hay tools | Peor caso = quemar **créditos** antes que mensajes → por eso bajamos cupos de créditos |

Ejemplo **Business** en el peor mes (100% mensajes + 100% créditos, IA base): coste ~**$200**, ingreso **$499** → ~**$299** bruto **aunque** un día tengan 200 chats concurrentes, **siempre que** no pasen el cupo mensual. El pico concurrente no multiplica la factura CF como un call center por asiento.

Límites blandos anti-abuso: rate limit público ~**120 req/min/org/IP** (`public.ts`); no hay cola global “máx 5 chats a la vez” por plan.

---

## ¿Se queda atrás si “x+1” hablan a la vez?

| Pregunta | Respuesta |
|----------|-----------|
| ¿Más visitantes que `maxBots`? | **No.** Pueden hablar **miles** en el mismo bot; `maxBots` no es concurrencia. |
| ¿Bot número 6 en Growth (max 5)? | **No puedes crear** el 6.º asistente; los 5 existentes atienden todo el tráfico que cupo permita. |
| ¿Sexto canal de negocio distinto? | Necesita **subir de plan** o consolidar en un bot con más orígenes. |
| ¿Cola / lentitud? | Posible si CF/IA tiene presión regional; no es límite de producto Desk hoy. Mitigación futura: cola fair por org (roadmap). |

# Escala, coste y calidad (sin bajar el producto)

## Qué limitan los planes (y qué no)

| Limita por plan | No limitamos por plan |
|-----------------|------------------------|
| Conversaciones / mes | Motor de chat, RAG, streaming |
| Créditos IA / mes | Integraciones HTTP, MCP, conectores (con topes numéricos por escala) |
| Asistentes, usuarios panel, documentos | Handoff a humano |
| Retención de historial | Calidad del modelo (mismo Workers AI por defecto) |

Un visitante **no** tiene “3 llamadas API”: puede hacer muchas preguntas; cada respuesta puede usar RAG + varias herramientas. Eso consume **créditos**, no un contador de “peticiones” en la UI.

## Cómo Desk evita llamadas caras (ya en producción)

| Capa | Qué hace |
|------|-----------|
| **Conversation DO** | Estado por conversación; historial y fase (automatizado vs humano) sin round-trip extra a D1 por mensaje |
| **Caché RAG en DO** | Misma pregunta reciente reutiliza contexto (~2 min) |
| **Harness lazy tools** | No mandamos 50+ schemas al LLM; catálogo MCP en D1 + hidratación bajo demanda |
| **MCP catalog** | Sync de herramientas sin listar todo en cada turno |
| **Compactación / resumen** | Historia larga se resume para no inflar tokens |
| **Metering** | Créditos + factor RAG (+3/msg) alinea uso con coste real |

## Handoff humano

Cuando la conversación pasa a **humano activo**, `canAutomateReply` bloquea respuestas del bot: el visitante queda con tu equipo en bandeja. No hay doble respuesta bot + humano en paralelo.

## Qué vigilar al crecer (Ops + ingeniería)

1. **Vectorize compartido** — Cliente Business con índice enorme: coste RAG sube; roadmap partición por org/bot.
2. **Créditos al techo** — Revisar margen en Ops; packs wallet o subir plan.
3. **Tools muy amplios** — Muchas llamadas HTTP por turno: revisar prompts y límites en integraciones.
4. **Calibrar `ECONOMICS_USD_PER_1K_CREDITS`** — Contra factura Cloudflare cada trimestre.

## Mejoras siguientes (calidad sin recortar)

- Caché KV de embeddings por bot + hash de pregunta (menos Vectorize repetido).
- Router de intención barato antes de hidratar muchas tools.
- Vectorize por tenant en Business heavy.

No bajar temperatura/calidad del modelo para ahorrar: el control es **arquitectura + cupos honestos + precio acorde**.

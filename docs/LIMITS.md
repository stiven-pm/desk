# Límites por plan (Desk)

Fuente de verdad en código: `packages/domain/src/plans.ts`.

## Documentos (conocimiento / RAG)

| Plan | Archivos indexados (`maxRagSources`) |
|------|--------------------------------------|
| Starter | 5 |
| Growth | 25 |
| Business | 100 |

- Cada archivo subido = 1 fila en `sources` + objeto en **R2** (`orgId/sourceId`) + chunks en **Vectorize**.
- No hay límite de MB por archivo documentado en producto hoy; el Worker tiene límites de tamaño de request — archivos muy grandes pueden fallar en subida o indexación.
- **Eliminar** un documento borra D1 + R2 + intento de borrar vectores asociados.

## Imágenes / adjuntos en el chat público

- **Hoy:** el chat permite adjuntar en la UI; el modelo recibe solo texto (se menciona el nombre del archivo). No cuentan como documento RAG ni consumen cupo de archivos.
- **Próximo:** adjuntos en conversación (visión / extracción) irán con límites propios (tamaño, retención en DO) y consumirán **créditos IA**.

## Mensajes y créditos IA

| Plan | Mensajes/mes | Créditos IA/mes |
|------|--------------|-----------------|
| Starter | 2 000 | 32 000 |
| Growth | 10 000 | 90 000 |
| Business | 50 000 | 400 000 |

Créditos ≈ `ceil(prompt_tokens/1000 + completion_tokens/1000 × 4)` por respuesta del asistente.

Los créditos están alineados al techo de mensajes (~8–16 créditos por respuesta típica) para proteger margen si alguien exprime el contador.

## Equipo (panel)

| Plan | Usuarios (`maxSeats`) |
|------|------------------------|
| Starter | 3 |
| Growth | 2 (usa **capacidades combinadas** en una persona) |
| Business | 25 |

Cada usuario puede tener varias capacidades a la vez (`knowledge`, `inbox`, `integrations`, `team`, etc.). Ver `packages/domain/src/member-access.ts`.

## Integraciones (Growth+)

Ver `maxHttpToolsPerBot`, `maxMcpServersPerBot`, `maxConnectorsPerBot`, `maxOrgWebhooks` en `plans.ts`.

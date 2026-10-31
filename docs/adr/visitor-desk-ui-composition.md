# ADR: composición de desk-ui en el chat visitante (estado previo)

## Estado

Superseded por [visitor-actions-policy.md](./visitor-actions-policy.md). Se conserva como contexto histórico del bug de composición.

## Fecha

Octubre 2026.

## Contexto

La respuesta del assistant puede incluir varios fences ` ```desk-ui ` con bloques JSON (`cart`, `product_catalog`, `choices`, etc.). El front (`parseAssistantUi`) acepta **varios fences** y los aplana en bloques; eso no es un bug del parser.

El síntoma visible (filas duplicadas de Pagar / Menú / Hablar con una persona) viene de **tres productores de `choices` sin un dueño**:

1. **Nativo** — `appendPostCartChoicesDeskUi`, `buildProductDetailDeskUi`, `buildBuyerConsentDeskUi` en `commerce-ui.ts`.
2. **Agente** — bloques `choices` / `product_catalog` en la salida del LLM.
3. **Barra global** — `buildVisitorStateBarChoices` + `appendVisitorStateBarDeskUi` en `visitorAssistantWithHarness` (DO).

Ninguna capa conoce la política completa del turno; solo añade botones locales.

## Bug concreto: multi-fence + primer match

`appendVisitorStateBarDeskUi` (antes del parche) usaba `fenceRe.exec` **una sola vez**. Si el **primer** fence era solo `cart` y un fence posterior ya traía `choices`, el merge no encontraba `choices` en el primer JSON y **añadía un segundo fence** con la barra global → dos bloques `choices` renderizados.

## Dependencia de orden: `appendPostCartChoicesDeskUi`

```typescript
if (text.includes('"type":"choices"') || text.includes('"type": "choices"')) {
  return text;
}
```

Ese guard mira el **string entero**, no el fence activo. Si la barra global corre **antes**, el string ya contiene `"type":"choices"` y el post-cart **no se añade**. Si corre **después**, ambos pueden coexistir (antes del consolidate). El resultado depende del orden de llamadas, no solo de la intención del turno.

## Conclusión

No basta con “arreglar el front” ni con otro `if` en la barra. Hace falta **una política única** de acciones (ver ADR `visitor-actions-policy`) y, mientras migra, **consolidar todos los fences** al fusionar `choices`.

## Parche inmediato

`consolidateDeskUiFences` en `visitor-state-bar-ui.ts`: recorre **todos** los fences, fusiona ítems `choices` y emite **un solo** fence al final del mensaje.

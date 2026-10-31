# ADR: política de acciones del visitante (`turnKind`)

## Estado

Aceptado.

## Fecha

Octubre 2026.

## Contexto

Tres capas (nativo, agente, barra global) producían bloques `choices` de forma independiente. Eso generaba duplicados, botón “Hablar con una persona” en casi todo turno y merges frágiles (ver [visitor-desk-ui-composition.md](./visitor-desk-ui-composition.md)).

## Decisión

1. **Productores de turno** (nativo, agente) devuelven **prosa + bloques de datos** (`cart`, `product_catalog`, `html`, …) y un **`turnKind`**. No deben añadir bloques `choices` salvo durante la migración; el objetivo es cero `choices` locales.
2. **`resolveVisitorActions(turnKind, state)`** en `@chatbot/domain` (`visitor-actions-policy.ts`) es la **única** fuente de botones de acción rápida.
3. El harness del DO (`visitorAssistantWithHarness`) aplica esas acciones con **`consolidateDeskUiFences`**: como máximo **un** bloque `choices` al final del mensaje.
4. **Humano en cuerpo**: solo en `agent_struggling` y `handoff`. Acceso permanente vía enlace fijo en el encabezado del chat (pendiente UI).
5. **Límite duro**: máximo **4** botones por turno (`MAX_VISITOR_ACTION_BUTTONS`); si la política excede, se recorta por prioridad fija (pagar → carrito → menú → consent → oferta → humano).

## `TurnKind`

```typescript
export type VisitorTurnKind =
  | "greeting"
  | "faq"
  | "browse_catalog"
  | "product_detail"
  | "pick_qty"
  | "line_notes"
  | "buyer_field"
  | "buyer_consent"
  | "cart_view"
  | "cart_updated"
  | "pending_offer"
  | "checkout"
  | "agent_struggling"
  | "handoff";
```

## Matriz de política (botones vía `resolveVisitorActions`)

| `turnKind` | Botones finales | Humano en cuerpo |
| --- | --- | --- |
| `greeting`, `faq` | Menú (si hay catálogo), Carrito (si hay líneas) | No |
| `browse_catalog` | Ninguno (el `product_catalog` es la acción) | No |
| `product_detail` | Añadir (si `productId`), Menú | No |
| `pick_qty`, `line_notes`, `buyer_field` | Ninguno | No |
| `buyer_consent` | Acepto | No |
| `cart_view` | Pagar + Menú si hay líneas; solo Menú si vacío y hay catálogo | No |
| `cart_updated` | Pagar, Carrito, Menú (según carrito/catálogo) | No |
| `pending_offer` | Sí, No | No |
| `checkout` | Ninguno | No |
| `agent_struggling` | Menú (si catálogo) + Humano | Sí |
| `handoff` | Humano | Sí |

Los bloques embebidos (`product_catalog`, fichas `html`, picker `quantity`) **no** se duplican como `choices` salvo que la política lo indique explícitamente.

## Invariantes (tests)

Sobre el `assistantText` final (tras harness):

- Como máximo **un** bloque `choices` (`parseAssistantUi`).
- Sin `message` repetido dentro del bloque.
- Máximo **4** ítems en `choices`.
- `pick_qty`, `line_notes`, `buyer_field`, `browse_catalog`, `checkout` → cero botones de acción cuando `turnKind` está fijado.
- `DESK_CMD_HUMAN` en cuerpo solo si `turnKind` es `agent_struggling` o `handoff`.

Implementación: `checkVisitorAssistantUiInvariants` en runtime; política unitaria en `visitor-actions-policy.test.ts`.

## Asignación de `turnKind`

| Origen | Regla |
| --- | --- |
| Nativo | Por comando / `commerce_ux_json.mode` en `tryNativeCommerceTurn`. |
| Agente | Declarado al final del turno o inferido de tools (catálogo → `browse_catalog`, solo prosa → `faq`); pendiente cableado completo. |
| Small talk local | `greeting`. |

## Migración

1. ✅ Consolidar multi-fence al aplicar barra.
2. ✅ `turnKind` en `NativeCommerceTurnResult` + `resolveVisitorActions` cuando hay `turnKind`.
3. ✅ Helpers nativos sin bloques `choices` locales.
4. ✅ Encabezado “Hablar con una persona” + `visitor_struggle_count` en meta del DO.
5. ✅ `turnKind` en agente (tools + catálogo en respuesta).
6. ✅ Prosa fija `NATIVE_COMMERCE_LEAD.catalogBrowse` en menú nativo.
7. ✅ Tests de invariantes (`visitor-assistant-harness.test.ts`).

## Consecuencias

- La barra global legacy (`buildVisitorStateBarChoices`) solo aplica cuando **no** hay `turnKind` (agente antiguo, rutas sin migrar).
- Cambios de botones requieren editar la matriz y los tests de invariantes, no tres archivos sueltos.

## Relación

- [harness-2-commerce.md](./harness-2-commerce.md)
- [visitor-intent-router.md](./visitor-intent-router.md) (intención LLM ≠ `turnKind` de UI)

# Desk — identidad visual

Desk usa un sistema **monocromo** (negro / blanco / grises). Rekov aparece solo como firma (“by Rekov Systems” en header y footer).

## Tokens

| Rol | Variable CSS | Hex | Uso |
|-----|----------------|-----|-----|
| Fondo hero / OG | `--desk-black` | `#0A0A0A` | Marketing hero, fondos oscuros |
| Superficie | `--desk-surface` | `#141414` | Tarjetas sobre negro |
| Texto claro | `--desk-white` | `#FAFAFA` | Titulares en hero |
| Texto secundario | `--desk-muted` | `#A3A3A3` | Cuerpo en hero |
| Borde oscuro | `--desk-border` | `#262626` | Marcos en hero |
| Fondo app | `--desk-paper` | `#F5F5F4` | Páginas claras |
| Texto app | `--desk-ink` | `#171717` | Cuerpo, CTAs en claro |
| Estado | `--desk-live` | `#22C55E` | Solo “en línea”, checks |

Implementación: `packages/dashboard/src/app/globals.css`.

## Tipografía

- **Newsreader** — titulares (`font-display`)
- **Figtree** — UI (`font-sans`)

## Wordmark

- Primaria: **Desk**
- Secundaria: **by Rekov Systems** (11–12px, gris)

## LinkedIn / lanzamiento

1. Preferir **screenshot de producto** (panel + chat), no stock de call center.
2. Formato 1080×1080 o 1200×1200; una frase + `desk.rekov.co`.
3. Flatbase mantiene su propia familia visual (infra); no mezclar con Desk en creativos.

## Assets en el repo

`packages/dashboard/public/brand/`:

| Archivo | Uso |
|---------|-----|
| `desk-logo-dark.png` | Logo horizontal blanco (hero oscuro, OG provisional) |
| `desk-logo-light.png` | Variante oscura sobre negro (referencia) |
| `desk-mark-white.png` | Favicon / pestaña |
| `desk-mark-gradient.png` | Header claro, UI |
| `desk-icon-app.png` | Apple touch icon |

Componente: `DeskLogo` (`header` | `hero` | `mark`).

**Pendiente ideal:** SVG exportados desde diseño y OG dedicado 1200×630 (hoy se reutiliza el logo horizontal).

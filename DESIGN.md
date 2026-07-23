# DESIGN — rent-collector-dashboard

> Sistema de diseño. Los tokens **canónicos** viven en `src/app/globals.css` (variables CSS `@theme`/`:root`)
> y se consumen vía clases Tailwind + `cn()` de `@/lib/utils`. Este doc los nombra y fija las reglas visuales.
>
> **Regla acompañante:** no colores/estilos "mágicos" inline sueltos — usa los tokens de `globals.css`
> (`bg-primary`, `text-muted-foreground`, `border-border`, etc.). Los hex de marca de `AGENTS.md`
> (`#2952F3`, `#0B1426`) corresponden a `--primary` / `--foreground` y solo se citan como referencia.

## Tokens de color (de `src/app/globals.css`)

Definidos en oklch con modo claro (`:root`) y oscuro (`.dark`). Nombres semánticos shadcn:

| Token | Uso | Claro (oklch) |
|---|---|---|
| `background` / `foreground` | fondo y texto base | `1 0 0` / `0.111 0.028 258` |
| `primary` / `primary-foreground` | acción principal (azul marca) | `0.476 0.258 264` / `1 0 0` |
| `secondary` / `muted` / `accent` | superficies suaves | `0.97 0 0` |
| `muted-foreground` | texto secundario | `0.556 0 0` |
| `destructive` | error / peligro | `0.577 0.245 27.325` |
| `border` / `input` / `ring` | bordes y foco | `0.922 0 0` / `0.708 0 0` |
| `card` / `popover` | contenedores | `1 0 0` |
| `sidebar*` | shell de navegación | ver `globals.css` |
| `chart-1..5` | series de gráficas (recharts) | escala de grises |

> Correspondencia con `AGENTS.md`: azul `#2952F3` ≈ `--primary`; tinta `#0B1426` ≈ `--foreground`; grises = escala slate/`muted`.

## Tipografía

- `--font-sans` = Inter (`--font-inter`); `--font-heading` = sans; `--font-mono` = Geist Mono.
- **Escala en uso** (extraída de las páginas y componentes actuales):

| Nivel | Clases reales | Uso |
|---|---|---|
| Título de página (h1) | `text-[22px] font-bold tracking-tight` | encabezado de cada ruta |
| Sección (h2) | `text-[14px]`–`text-[16px] font-semibold` | subtítulos dentro de la página |
| Título de card | `font-heading text-base font-medium` (`text-sm` en card `size=sm`) | `CardTitle` |
| Cuerpo | `text-sm` | texto por defecto (el más usado, ~58×) |
| Meta / caption | `text-xs` · `text-[11px]` | labels, badges, notas |

- **Pesos:** `font-semibold` (predominante) · `font-medium` · `font-bold` (solo títulos).
- ⚠️ **Deuda detectada:** los `h1` usan valores arbitrarios `text-[22px]` y color `text-[#0B1426]` en lugar de tokens (`text-foreground`). Es la realidad actual; conviene migrarlos a tokens (candidato a tarea de limpieza, no bloqueante).

## Radios y espaciado

- Radio base `--radius: 0.625rem`; escala `sm/md/lg/xl/2xl/3xl/4xl` derivada (ver `@theme` en `globals.css`).
- **Radios en uso:** `rounded-lg` (botones) · `rounded-full` / `rounded-4xl` (badges, dots) · `rounded-xl` (cards) · `rounded-2xl` (contenedores grandes).
- **Espaciado en uso** (utilidades Tailwind, escala de 4px): gaps predominantes `gap-1/2/3/4`; verticales `space-y-1` … `space-y-5`; padding de contenedores `p-3`/`p-4`, horizontal `px-4`/`px-6`, vertical `py-2`/`py-3`/`py-4`. Las cards usan `px-4 py-4 gap-4`.

## Componentes

- Primitivas shadcn/base-ui en `src/components/ui/`:
  - **button** — variantes `default · outline · secondary · ghost · destructive · link`; tamaños `xs · sm · default · lg · icon(-xs/-sm/-lg)`.
  - **badge** — variantes `default · secondary · destructive · outline · ghost · link`; `h-5 rounded-4xl text-xs font-medium`.
  - **card** (+ `CardHeader · CardTitle · CardDescription · CardContent · CardFooter`) — `rounded-xl`, `ring-1 ring-foreground/10`, `size=sm` compacta.
  - **table · input · select · switch · tabs · avatar · separator · progress · dialog**.
  - **StatusBadge** — `PaymentStatusBadge` y `AttemptStatusBadge` (ver paleta de estados abajo).
- Piezas de shell en `src/components/layout/` (Sidebar, ConnectionBanner, DataBootstrap…).

## Paleta de estados (de `src/components/ui/StatusBadge.tsx`)

Sistema de color por estado de cobranza — usa la escala cruda de Tailwind (no los tokens semánticos), a propósito:

| Estado | Color | Ejemplos |
|---|---|---|
| Éxito / pagado | `emerald` | Pagado, Verificado, Intrabancario OK, Manual |
| Parcial / abono | `sky` (pago) · `amber` (intento) | Parcial, Abono |
| Pendiente | `amber` | Pendiente |
| Error / vencido | `red` | Vencido, Error, Rechazado, Intrabancario Fallido |
| Revisión | `purple` | Revisión |
| Inactivo | `slate` | Abandonado |

Los estados "vivos" (Parcial, Pendiente, Vencido) llevan un dot con `animate-pulse`.

## Reglas visuales

1. Texto de UI en **español (es-MX)**; identificadores en inglés.
2. Clases Tailwind con la paleta de tokens; `cn()` para clases condicionales.
3. Componentes pequeños y atómicos; extrae subcomponente cuando un JSX supere ~80 líneas.
4. Secciones dentro de archivos grandes con comentarios `// ── Sección ──`.

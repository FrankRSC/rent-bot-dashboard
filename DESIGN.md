---
name: Rent Collector Dashboard
description: Panel operativo de cobranza de rentas para arrendadores mexicanos.
colors:
  action-blue: "#2952F3"
  ink-dark: "#0B1426"
  signal-blue-light: "#7b9af7"
  action-tint: "#eef1fd"
  surface: "#FFFFFF"
  surface-subtle: "oklch(0.97 0 0)"
  border-default: "oklch(0.922 0 0)"
  text-primary: "oklch(0.111 0.028 258)"
  text-secondary: "oklch(0.556 0 0)"
  destructive: "oklch(0.577 0.245 27.325)"
  status-paid: "#10b981"
  status-partial: "#38bdf8"
  status-pending: "#fbbf24"
  status-rejected: "#ef4444"
  status-review: "#a855f7"
  status-neutral: "#94a3b8"
  auth-panel-top: "#0A2839"
  auth-panel-mid: "#071B2D"
  auth-panel-deep: "#041018"
  auth-ember: "#16A9E8"
  auth-moss: "#4ED8AC"
  auth-haze: "#96C4E8"
  auth-ember-core: "#BEECFF"
  auth-ember-light: "#46C8F5"
  auth-plate: "#EEF4F9"
typography:
  display-hero:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 5vw, 3rem)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.02em"
  kpi-display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "clamp(1.375rem, 2.5vw, 1.625rem)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.01em"
  display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  headline-lg:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
  headline:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.4
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  compact:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.3
  label-xs:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0em"
  micro:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.625rem"
    fontWeight: 400
    lineHeight: 1.2
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  base: "0.625rem"
  xl: "0.875rem"
  full: "9999px"
spacing:
  xs: "0.375rem"
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "1.75rem"
components:
  button-primary:
    backgroundColor: "{colors.action-blue}"
    textColor: "{colors.surface}"
    rounded: "{rounded.base}"
    padding: "0 0.625rem"
    height: "2rem"
  button-primary-hover:
    backgroundColor: "#1f3fd4"
    textColor: "{colors.surface}"
    rounded: "{rounded.base}"
    padding: "0 0.625rem"
    height: "2rem"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "oklch(0.205 0 0)"
    rounded: "{rounded.base}"
    padding: "0 0.625rem"
    height: "2rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.base}"
    padding: "0 0.625rem"
    height: "2rem"
  button-destructive:
    backgroundColor: "oklch(0.577 0.245 27.325 / 0.10)"
    textColor: "{colors.destructive}"
    rounded: "{rounded.base}"
    padding: "0 0.625rem"
    height: "2rem"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "1rem"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.base}"
    padding: "0.25rem 0.625rem"
    height: "2rem"
  nav-item-active:
    backgroundColor: "{colors.action-blue}"
    textColor: "{colors.surface}"
    rounded: "{rounded.base}"
    padding: "0.625rem 0.75rem"
  nav-item-default:
    backgroundColor: "transparent"
    textColor: "oklch(0.708 0 0)"
    rounded: "{rounded.base}"
    padding: "0.625rem 0.75rem"
---

# Design System: Rent Collector Dashboard

## Overview

**Creative North Star: "El Escritorio Operativo"**

This is a professional operations dashboard where the UI's only job is to get out of the way. Every visual decision — the deep navy sidebar, the white content plane, the reserved electric blue accent — exists to let the landlord read the state of their portfolio at a glance and act. There is no decoration for decoration's sake. No gradient, no illustration, no ambient texture. The form is information; the information is the form.

The layout follows a split-screen discipline: a fixed dark sidebar anchors navigation and identity on the left; the white content area holds all data on the right, flowing naturally within available width. This contrast — ink dark against pure white — is the only structural expression the system makes. Everything else defers to the data: status badges, metric cards, payment tables. When the blue (#2952F3) appears, it means something is active or actionable. When it doesn't, the system breathes.

Status states are communicated through a five-color semaphore (emerald / sky / amber / red / purple) applied consistently across every surface where payment state matters. This vocabulary is learned once and read everywhere — the landlord sees "green" and knows it's collected before reading the label.

**Key Characteristics:**
- Dark sidebar / white content split — structure through contrast, not chrome
- Single-typeface system (Inter) — hierarchy through weight and size alone, not font variety
- Tonal ring cards, zero shadows — surfaces share a plane; depth implied through background contrast
- Semaphoric status system — five semantic colors, consistently applied, never reused for non-status purposes
- Electric blue reserved — appears only for active states, primary actions, and chart fills
- Animated data — count-up numbers, pulsing status dots, smooth transitions that serve comprehension

## Colors

Two brand anchors plus a structured semaphoric status system. The palette is intentionally narrow; every color earns its place.

### Primary
- **Azul Eléctrico** (#2952F3): The single action color. Active navigation items, primary buttons, avatar backgrounds, chart area fills, selected state highlights. Used on ≤10% of any screen surface. When it appears, it signals "this is current" or "this is actionable."
- **Tinte de Selección** (#eef1fd): A very low-saturation blue tint. Applied to selected-state backgrounds in content areas (selected month strip, list-item hover). Visually connects to Azul Eléctrico without competing with it.

### Neutral
- **Tinta Nocturna** (#0B1426): The sidebar material. Also used for high-hierarchy text — tenant names, large metric values, critical labels. The ink that gives the system weight and authority.
- **Azul Señal Claro** (#7b9af7): The brand logotype label inside the sidebar. A lighter sibling of Azul Eléctrico, readable against Tinta Nocturna without requiring full-brightness blue.
- **Blanco Puro** (#FFFFFF): Card faces, content areas, modal surfaces. The information plane.
- **Gris Neutro** (oklch(0.97 0 0) ≈ #F4F4F5): Muted backgrounds, secondary button fills, card footers. Almost white; distinguishable only by adjacency.
- **Borde Sutil** (oklch(0.922 0 0) ≈ #E8E8EA): Card tonal rings, input borders, dividers. At 1px, near-imperceptible; defines edge without adding visual weight.
- **Texto Secundario** (oklch(0.556 0 0) ≈ #7F7F84): Property names under tenant names, timestamps, descriptions, placeholder text. Never for primary data.

### Landing (solo pantallas de autenticación)
Colores traídos de la landing (`savetime.shiftly.mx`) para que la entrada al producto se reconozca como el mismo sitio. Viven **únicamente** en el panel del logotipo de `AuthCard`: el degradado `#0A2839 → #071B2D → #041018` con blooms radiales en cian `#16A9E8` y musgo `#4ED8AC`, y la placa del logotipo en `#EEF4F9`. Ninguno entra al dashboard, donde manda Azul Eléctrico; el cian nunca toca un control.

### Status Semantic
- **Verde Cobrado** (emerald): `bg-emerald-50 / border-emerald-200 / text-emerald-700`. Dot: `bg-emerald-500` (static). Used for Pagado, Verificado, Manual Verificado.
- **Cielo Parcial** (sky): `bg-sky-50 / border-sky-200 / text-sky-700`. Dot: `bg-sky-400 animate-pulse`. Partial payment received.
- **Ámbar Pendiente** (amber): `bg-amber-50 / border-amber-200 / text-amber-600`. Dot: `bg-amber-400 animate-pulse`. Urgency without alarm.
- **Rojo Vencido** (red): `bg-red-50 / border-red-200 / text-red-600`. Dot: `bg-red-500 animate-pulse`. Overdue or rejected.
- **Púrpura Revisión** (purple): `bg-purple-50 / border-purple-200 / text-purple-600`. Under active review.
- **Pizarra Neutro** (slate): `bg-slate-100 / border-slate-200 / text-slate-500`. Abandoned, neutral, or structural. No dot animation.

### Named Rules
**The Semaphore Rule.** Each payment status maps to exactly one semantic color family, and each semantic color family maps to exactly one status. No creative reuse of status colors for non-status UI elements. The landlord reads color before reading the label — that speed depends on exclusivity.

**The Reserve Rule.** Azul Eléctrico (#2952F3) appears only for: active navigation items, primary buttons, avatar initials backgrounds, primary chart series, selection highlights. It does not appear in decorative or ambient contexts.

**The Pulse Rule.** Dot indicators animate with `animate-pulse` only for non-terminal states (payment not yet resolved). Terminal states (Pagado, Verificado) have static dots.

## Typography

**Display Font:** Inter (Google Fonts, `--font-inter` variable, latin subset, `display: swap`)
**Body Font:** Inter (same)
**Label/Mono Font:** Inter (same — no distinct monospace; financial values use `tabular-nums` feature, not a monospace family)

`--font-heading` resolves to `--font-sans` which is Inter. There is no separate heading typeface. Hierarchy is expressed through weight (400/500/600/700) and size alone.

**Character:** A single typeface doing all the work. Inter's humanist proportions and optical sizing keep every density level legible — critical when a single table row contains a name, a currency amount, a date, and a status badge in 14px. No type mixing means no font-loading overhead and no personality clash between weights.

### Hierarchy
- **Display Hero** (700, 40px → 48px responsive, lh 1.0, ls -0.02em): The primary cobrado amount in the dashboard hero banner. Dominant focal point — unambiguously the most important number on screen. Responds `text-[40px] sm:text-[48px]`. Month label above it is `text-[13px] font-semibold text-white/60`.
- **KPI Display** (700, 22px → 26px responsive, lh 1.0, ls -0.01em): Dashboard KPI card primary values (Cobrado, Pendiente, Vencido, Inquilinos). Responsive from `text-[22px] sm:text-[26px]`. `tabular-nums` always. Sits between Display and Display Hero — scoped to the main dashboard card grid.
- **Display** (700, 1.375rem / 22px, lh 1.2, ls -0.01em): Section-level KPI numbers in detail views (property totals, report summaries). `tabular-nums` always.
- **Headline LG** (600, 1.25rem / 20px, lh 1.3): Primary page headings in detail and report views.
- **Headline** (500, 1rem / 16px, lh 1.4): Card titles, dialog headings, section group labels. Font-medium, not bold — authority without shouting.
- **Title** (600, 0.9375rem / 15px, lh 1.4): Section headings within cards, form group titles.
- **Body** (400, 0.875rem / 14px, lh 1.5): Primary content — nav labels, form field values, table data in spacious contexts.
- **Compact** (400, 0.8125rem / 13px, lh 1.4): The most-used size in the system (164+ occurrences). Dense table rows, mobile tenant names, amounts in tight layouts. The workhorse of data-dense views.
- **Label** (500, 0.75rem / 12px, lh 1.3): Contextual metadata, timestamps, property names under tenant names, secondary chart labels.
- **Label XS** (600, 0.6875rem / 11px, lh 1.3): Status badge text, "Manual" pills, sub-metadata chips. Semi-bold at small size for legibility. Never uppercase in badges.
- **Micro** (400, 0.625rem / 10px, lh 1.2): Sidebar brand sub-label ("Dashboard"), extreme-density annotations. Legibility limit of the system.

### Named Rules
**The Tabular Rule.** All financial amounts and all numeric counts rendered in tabular context (tables, KPI cards, metric strips) must use `tabular-nums`. Proportional digits in a money column are a legibility failure.

**The One-Family Rule.** Inter is the only typeface. Introducing a second family for headings, display text, or accent use would fragment the system's visual coherence without adding hierarchy the weight scale cannot already provide.

## Layout

A two-column shell: fixed sidebar (`w-60` / 240px) anchors left; the content area fills the remaining viewport width with no max-width container. Horizontal overflow is managed at the component level (tables and code blocks scroll within their own containers; the body never overflows horizontally).

**Sidebar behavior:** Fixed on mobile (`fixed inset-y-0 left-0`), slides in via `translate-x` toggle, overlays content with `z-50`. Static on `md:` breakpoint and above. Content area has independent scroll with a 4px thin scrollbar (`scrollbar-width: thin`, slate-300 thumb on hover).

**Content spacing rhythm:** `px-4 py-4` or `px-6 py-6` for page content containers. Gap between cards: `gap-4`. Sidebar header: `px-6 py-5`. Card internal content: `px-4` sections, `py-4` vertical. Compact card variant: `px-3 py-3`. There are no other spacing values; this rhythm is strict.

**Responsive grid:** Dashboard KPI cards — 2-column on mobile, 4-column at `lg:+`. Tables and payment lists — single-column, full-width. Tenant detail grids — 2-column at `sm:+`. All grids collapse to single-column on mobile.

## Elevation & Depth

**Flat by design — one intentional exception.** Card surfaces are delimited by a `ring-1 ring-foreground/10` — a single-pixel tonal outline at 10% foreground opacity. Every standard card, every input, and every dialog surface is ring-bounded and shadowless.

The one explicit exception is the **Dashboard Hero Banner**: a dark (`#0B1426`) featured card with `box-shadow: 0 4px 24px rgba(11,20,38,0.28), 0 1px 4px rgba(11,20,38,0.18)`. This shadow is intentional — the hero card is the darkest surface on an otherwise white page, and the shadow grounds it against the background without a visible border. It is the only permitted shadow in the system, confined to this single component.

Depth elsewhere is communicated through background color contrast: Tinta Nocturna sidebar against Blanco Puro content area; light card surfaces against off-white page backgrounds. Stacking context (modals, dropdowns) uses DOM order and backdrop overlays (`z-50`), not shadow.

### Shadow Vocabulary
- **Hero grounding shadow** (`box-shadow: 0 4px 24px rgba(11,20,38,0.28), 0 1px 4px rgba(11,20,38,0.18)`): Dashboard hero banner only. Deep-navy ambient spread + tight definition layer. Not replicated on any other surface.

### Named Rules
**The Flat-First Rule.** All surfaces except the dashboard hero banner are shadowless. A `box-shadow` on a new component implies a layering model the rest of the UI doesn't use. To signal elevation or stacking, use tonal background shifts, rings, or a backdrop overlay. The hero card exception is not a precedent.

## Shapes

**Softly functional.** The base radius is `0.625rem` (10px) — contemporary but not circular. This applies to buttons, inputs, navigation items, and general interactive controls. Cards use `rounded-xl` (14px) — a slightly more generous radius that signals "container" vs. "control" without departing from the same family.

Status badges and user avatars are fully pill-shaped (`rounded-full`). This is intentional and exclusive: pill shapes are reserved for classification tokens (badges, chips, status indicators) and initials avatars. Interactive controls (buttons, inputs) are never pill-shaped, creating an unambiguous visual grammar.

Dot indicators are circular at 6px (`w-1.5 h-1.5`), 8px, or 10px depending on context. No other non-rectangular shapes exist in the system.

**No sharp corners.** Every surface in the system has at least `rounded-sm` (6px). Razor edges are not part of this language.

## Components

### Buttons
- **Shape:** Rounded corners (0.625rem / 10px radius) — not pill-shaped. This distance from badge shapes is intentional.
- **Primary:** Azul Eléctrico background (#2952F3) + white text. `h-8` (32px), `px-2.5`. Compact for data-dense use.
- **Hover:** `bg-primary/80` — 80% opacity. Active press: `translate-y-px` (1px downward nudge).
- **Focus:** `ring-3 ring-ring/50` (3-unit ring at 50% opacity). `border-ring` border shift on focus-visible.
- **Outline:** White bg, `border-border` stroke, `hover:bg-muted`. For secondary actions alongside a primary.
- **Ghost:** Transparent bg, `hover:bg-muted`. Tertiary actions, icon buttons.
- **Destructive:** `bg-destructive/10` (10% opacity red) + red text. Never full-saturation red on a button surface.
- **Disabled:** `opacity-50`, `pointer-events-none`. No cursor changes beyond the pointer removal.
- **Size variants:** Default h-8, sm h-7, lg h-9, xs h-6, plus icon-only square variants at each size.

### Status Badges (Signature Component)
The most distinctive UI pattern in the system. Pills (`rounded-full`) with three-part color formula: tinted background + matching border + matching text, led by a colored dot. Non-terminal states have a pulsing dot.

- **Size:** `text-[11px] font-semibold`, `px-2.5 py-[3px]` — tight and efficient.
- **Dot:** `w-1.5 h-1.5` (6px) circular, matching hue family.
- **Pulse:** `animate-pulse` on dot for Pendiente, Parcial, Vencido (non-terminal). Static for Pagado, Verificado, Revisión.
- **Formula:** Always `bg-{hue}-50 border-{hue}-200 text-{hue}-{6|7}00`. Never deviate.
- Never use these six hue families for anything other than payment status.

### Cards / Containers
- **Corner Style:** `rounded-xl` (14px) — more generous than controls.
- **Background:** Blanco Puro (#FFFFFF) — always.
- **Depth:** `ring-1 ring-foreground/10` — tonal ring, no shadow.
- **Internal Padding:** `py-4` + `px-4` content sections. Compact variant: `py-3` + `px-3`.
- **Footer:** `bg-muted/50` + `border-t` + `rounded-b-xl`. Content-flush with card; padding p-4.

### Inputs / Fields
- **Style:** Transparent background, `border border-input` (oklch(0.922 0 0)), `rounded-lg` (8px with md variant). Height `h-8` (32px). Padding `px-2.5 py-1`.
- **Placeholder:** `text-muted-foreground` — secondary hierarchy.
- **Focus:** Border shifts to `ring` color + `ring-3 ring-ring/50` halo. The color shift + ring confirms focus without relying on a single cue.
- **Error:** `border-destructive` + `ring-3 ring-destructive/20`. Red border with faint red halo.
- **Disabled:** `bg-input/50 opacity-50 cursor-not-allowed`.

### Navigation (Sidebar)
- **Container:** `w-60`, `bg-[#0B1426]`, `text-slate-100`. Fixed height, vertical flex.
- **Logo zone:** `px-6 py-5`, `border-b border-white/10`. Blue 32×32 rounded square icon + brand text stack.
- **Items:** Full-width links, `rounded-lg`, `py-2.5 px-3`, `text-sm font-medium`, `gap-3` between icon and label.
- **Default state:** `text-slate-400` — recedes against the dark background.
- **Hover:** `bg-white/10` fill + `text-slate-100` — visible, restrained.
- **Active:** `bg-[#2952F3]` + `text-white` — the only solid fill in the nav; unmistakable.
- **Transition:** `transition-colors` — immediate, snappy.

### Charts (Recharts)
- Primary series: Azul Eléctrico (#2952F3) for area fills, active bars.
- Supporting series: slate tones (`slate-400`, `slate-200`) for secondary bars in composed charts.
- Grid: `CartesianGrid` with `strokeOpacity: 0.1` — barely visible structural lines.
- All charts: `<ResponsiveContainer width="100%">`. No fixed pixel widths.
- Tooltips: default recharts styling; no custom override observed.

## Do's and Don'ts

### Do:
- **Do** use `tabular-nums` for all monetary amounts and numeric counts in tables and KPI cards.
- **Do** reserve Azul Eléctrico (#2952F3) for active states, primary actions, and primary chart series only — one accent, used with precision.
- **Do** apply the three-part color formula to all status badges: `bg-{hue}-50 border-{hue}-200 text-{hue}-{6|7}00`. The formula is the vocabulary; never approximate it.
- **Do** use `animate-pulse` on status dots for non-terminal states (Pendiente, Parcial, Vencido). Static dots for resolved states.
- **Do** use `ring-1 ring-foreground/10` on all card surfaces. This is the system's depth vocabulary — the only card border that exists.
- **Do** collapse all layouts to single-column on mobile. No horizontal scrolling on the page body.

### Don't:
- **Don't** add `box-shadow` to cards, buttons, containers, or any surface. This system is flat by design; one shadow creates a visual inconsistency that reads as an error.
- **Don't** reuse status semantic colors (emerald, sky, amber, red, purple) for non-status purposes. The semaphore depends on exclusivity.
- **Don't** use `rounded-full` on buttons or inputs. Pill shapes are reserved for badges, chips, and avatar initials.
- **Don't** vary the sidebar background color. Tinta Nocturna (#0B1426) is the sidebar material; it does not respond to theme, section, or state.
- **Don't** display financial amounts without `tabular-nums`. Shifting digit widths in a currency column make the UI feel broken.
- **Don't** introduce a second typeface. Inter carries all hierarchy via weight; a second family would add loading cost without adding clarity.

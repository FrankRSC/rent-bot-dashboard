# PLAN — rent-collector-dashboard

> **PLAN ligero (índice).** La arquitectura, el contrato con el backend y el backlog **no se duplican aquí**:
> viven en `docs/` y son la fuente de verdad. Este archivo solo mapea "qué necesito → dónde está" y
> define las **fases de ejecución** (§8), que es lo único que no existía en otro documento.
>
> Regla: si un dato ya está en `docs/CONTRATOS_API.md` o `docs/MEJORAS.md`, se referencia — no se copia.

---

## §0 Decisiones cerradas (no negociables)

- **Solo frontend.** El backend (`rent-collector bot`, NestJS `:3001`) es un repo aparte y queda **fuera** de este harness.
- **Stack fijo** (ver `AGENTS.md` → "Stack"): Next.js 16.2.6 (App Router) · React 19 · TS estricto · zustand 5 (un solo store) · Tailwind 4 · shadcn/base-ui · recharts · date-fns · lucide-react. **Sin librería de fetching** (fetch nativo en `src/lib/api.ts`).
- **`src/lib/api.ts` + `src/lib/types.ts` = espejo de `docs/CONTRATOS_API.md`.** Se cambian en el mismo commit.
- **`request<T>` es el único punto HTTP.** Nunca `fetch` directo desde componentes o el store.

## §1 Estructura y config para Claude Code

- Estructura del repo: `AGENTS.md` → "Estructura".
- Archivos del harness: `CLAUDE.md` (raíz, importa `AGENTS.md`), este `PLAN.md`, `PROGRESS.md`, `DECISIONS.md`, `DESIGN.md`, `.claude/commands/{fase,validar}.md`.
- Un solo stack ⇒ **no hay** `CLAUDE.md` anidados.

## §2 Arquitectura general

```
Navegador (mismo origen)
  └─ Componentes / store (zustand)
       └─ src/lib/api.ts  request<T>   BASE = NEXT_PUBLIC_API_URL ?? "/api"
            └─ rewrite Next  /api/:path*  ──►  ${BACKEND_URL}/:path*   (NestJS :3001)
```
Detalle del mecanismo: `docs/CONTRATOS_API.md` §1.

## §3 Modelo de datos

Tipos espejo del backend en `src/lib/types.ts`; forma de cada entidad documentada en `docs/CONTRATOS_API.md` §2 (`Landlord`, `Property`, `Tenant`, `PaymentAttempt`, `Factura`, `PeriodBalance`, `LandlordReport`).

## §4 Contratos del API

`docs/CONTRATOS_API.md` §2 (catálogo por ruta) y §3 (gaps G1–G9). Checklist al cambiar el contrato: §4 de ese doc.

## §5 Reglas de negocio (implementar exactamente así)

- Estados de cobranza (`paymentStatus`, `PeriodBalance.status`): `docs/CONTRATOS_API.md` §2.3 y §2.7.
- Honestidad de UI y mutaciones optimistas con rollback: `AGENTS.md` → "Honestidad de la UI" y "Manejo de errores".

## §6 Pantallas y flujos

Rutas en `src/app/(dashboard)/`: dashboard, propiedades, pagos (+ detalle), facturas, recordatorios, reportes, configuración. Backlog de mejoras por pantalla: `docs/MEJORAS.md` (D1–D10).

## §7 Variables de entorno

`.env.example` (raíz): `BACKEND_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_LANDLORD_ID`. Explicación: `docs/CONTRATOS_API.md` §1.1.

## §8 Fases de ejecución para el agente

> Propuesta de fases **nuevas** (el backlog D1–D3, D5, D6, D9, D10 ya está aplicado). Estado y notas en `PROGRESS.md`.
> Una fase por sesión. Al terminar: `/validar` y detenerse. No empezar una fase futura sin confirmación.

### Fase 1 — Vigencia de contrato y ajuste de renta en el formulario de inquilino
- **Alcance:** capturar/editar los campos que el backend **ya acepta** pero el formulario aún no muestra: `contractStartDate`, `contractEndDate`, `nextMonthlyAmount`, `adjustmentDate` (`docs/CONTRATOS_API.md` §2.3). Mostrar la vigencia en la ficha del inquilino.
- **No depende de backend nuevo.** `createTenant`/`updateTenant` ya los envían.
- **Criterios de aceptación (verificables):**
  - `npm run lint` sin errores · `npm run build` pasa.
  - Alta/edición de inquilino persiste los 4 campos y al recargar vienen del backend (no defaults).
  - Un inquilino fuera de vigencia se ve marcado en el UI.

### Fase 2 — Auth / login (cierra D4, gaps G1/G2)
- **Alcance:** página de login (`POST /auth/login`), guardar JWT, header `Authorization: Bearer` en `request()`, derivar "quién soy" de `GET /me`, eliminar `NEXT_PUBLIC_LANDLORD_ID` de `useStore.ts` y `configuracion/page.tsx`. Contrato: `docs/CONTRATOS_API.md` §2.9.
- **⚠️ Bloqueada:** no codificar contra §2.9 hasta que el backend marque esa sección **"backend listo"** (regla de `AGENTS.md`).
- **Criterios de aceptación:**
  - Sin token → redirige a login; con token → funciona con el `landlordId` del token.
  - `request()` manda `Authorization`; un `401` redirige a login.
  - `npm run lint` · `npm run build` · `npm run test:e2e` pasan.

### Fase 3 — Tipos generados desde el backend (cierra D7, gap G7)
- **Alcance:** generar tipos desde OpenAPI/Swagger del backend (`openapi-typescript`) y consumirlos en `types.ts` en vez de mantenerlos a mano.
- **⚠️ Bloqueada:** depende de que el backend exponga OpenAPI (backend Q9).
- **Criterios de aceptación:** cambiar un campo en el backend rompe el `build` del dashboard (deseable); `npm run build` pasa con los tipos generados.

### Fase 4 — Server Components + caché (cierra D8)
- **Alcance:** mover el fetch inicial de páginas como Dashboard/Reportes a Server Components; evaluar SWR/React Query en las partes interactivas. Antes de tocar data fetching, leer `node_modules/next/dist/docs/01-app/01-getting-started/06-fetching-data.md` y `08-caching.md` (regla de `AGENTS.md`).
- **Criterios de aceptación:** el Dashboard pinta datos en el primer render sin parpadeo de "cargando"; `npm run build` pasa.

## §9 Variables de entorno

Ver §7 y `.env.example`.

## §10 Guardrails (qué NO hacer)

Fuente literal: `AGENTS.md`. Resumen innegociable:
1. Prohibido `catch {}` vacío (eslint `no-empty`); toda acción fallida muestra feedback visible.
2. Nunca `fetch` directo desde componentes/store — todo pasa por `request<T>` de `api.ts`.
3. No hardcodear `localhost:3001` en `src/`; el cliente llama `/api`, el destino es `BACKEND_URL`.
4. No mostrar como "guardado/enviado" lo que no persiste en el backend → "Próximamente".
5. No codificar contra el contrato de auth (§2.9) hasta que el backend lo marque "backend listo".
6. `api.ts`/`types.ts` se actualizan junto con `docs/CONTRATOS_API.md`.

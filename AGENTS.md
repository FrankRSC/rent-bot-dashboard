<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Reglas del proyecto — rent-collector-dashboard

Dashboard de cobranza de rentas para arrendadores. El backend vive en el proyecto aparte `rent-collector bot` (NestJS, puerto `:3001`); este repo es **solo el frontend**.

## Stack

- **Next.js 16.2.6** (App Router) + **React 19** + **TypeScript** estricto.
- **zustand 5** para estado global (`src/store/useStore.ts`), un solo store.
- **Tailwind CSS 4** + componentes shadcn/base-ui en `src/components/ui/`.
- **recharts** para gráficas, **date-fns** para fechas, **lucide-react** para iconos.
- Sin librería de fetching (fetch nativo envuelto en `src/lib/api.ts`).

## Estructura

```
src/
  app/                  # rutas (App Router)
    (dashboard)/        # grupo de rutas con layout de dashboard (Sidebar)
  components/
    ui/                 # primitivas shadcn/base-ui (button, card, dialog…)
    layout/             # piezas del shell (Sidebar, ConnectionBanner, DataBootstrap…)
  lib/
    api.ts              # ÚNICO punto de acceso HTTP al backend
    types.ts            # tipos espejo del backend + tipos de UI
    utils.ts            # helpers (cn…)
  store/
    useStore.ts         # store zustand global
docs/
  CONTRATOS_API.md      # contrato dashboard ↔ backend (fuente de verdad)
  MEJORAS.md            # backlog de mejoras priorizado (D1–D10)
```

- Nuevas páginas van en `src/app/(dashboard)/<ruta>/page.tsx`.
- Componentes de una sola página: junto a la página. Compartidos: en `src/components/`.

## Contrato con el backend (regla de oro)

- `src/lib/api.ts` y `src/lib/types.ts` son un **espejo** de `docs/CONTRATOS_API.md`. Si cambias uno, actualiza el otro en el mismo cambio (checklist en §4 de ese doc).
- Toda llamada HTTP pasa por `request<T>` en `api.ts`. **Nunca** hagas `fetch` directo desde componentes o el store.
- La URL del backend se configura con `BACKEND_URL` (rewrite en `next.config.ts`); el cliente siempre llama `/api/...` (mismo origen). No hardcodees `localhost:3001` en `src/`.
- El `landlordId` se lee del store (`useStore((s) => s.landlordId)`). No dupliques `parseInt(process.env.NEXT_PUBLIC_LANDLORD_ID...)` en páginas — es temporal hasta tener auth (mejora D4).

## Manejo de errores (obligatorio)

- **Prohibido `catch {}` vacío** (regla eslint `no-empty`). Toda acción del usuario que falle debe mostrar feedback visible (error inline junto al botón, o estado de error en el store).
- Los fetch del store dejan su error en el `*State.error` correspondiente (`propertiesState`, `tenantsState`, `paymentsState`, `facturasState`); `ConnectionBanner` los muestra con opción de reintentar.
- Mutaciones optimistas: aplica el cambio local, llama la API y **haz rollback** si falla (patrón de `facturasEnabled` en configuración).

## Honestidad de la UI

- No muestres como "guardado" o "enviado" algo que no persiste en el backend. Si el backend aún no soporta una feature (ver gaps G1–G9 en `docs/CONTRATOS_API.md`), márcala como "Próximamente" o etiqueta claramente que es una marca local del dispositivo.
- El estado del bot (`botStatus`) viene del health check real (`checkBackendHealth`), no de un toggle manual.

## Convenciones de código

- Componentes de página: `"use client"` hoy (migración a Server Components pendiente, mejora D8). Antes de introducir data fetching en servidor, lee `node_modules/next/dist/docs/01-app/01-getting-started/06-fetching-data.md` y `08-caching.md`.
- Texto de UI en **español** (es-MX); código e identificadores en inglés.
- Secciones dentro de archivos grandes con comentarios `// ── Sección ──…`.
- Importa con alias `@/` (p. ej. `@/lib/api`, `@/store/useStore`).
- Estilos: clases Tailwind inline siguiendo la paleta existente (azul `#2952F3`, tinta `#0B1426`, grises slate). Usa `cn()` de `@/lib/utils` para clases condicionales.
- Componentes pequeños y atómicos; extrae subcomponentes cuando un JSX supere ~80 líneas.

## Comandos

```bash
npm run dev     # desarrollo (backend esperado en :3001 o BACKEND_URL)
npm run build   # build de producción — debe pasar antes de dar por buena una tarea
npm run lint    # eslint (incluye la regla anti catch vacío)
```

## Git

- Commits en español, imperativo, sin firma de Claude ni `Co-Authored-By`.
- Rama de trabajo actual: `feature/facturas-y-mejoras-dashboard`; PRs contra `master`.

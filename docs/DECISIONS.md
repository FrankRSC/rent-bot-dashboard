# Decisiones de arquitectura — rent-collector-dashboard

Registro de decisiones técnicas no obvias. El objetivo es que cualquier agente o colaborador entienda el *por qué* de cada elección sin tener que reconstruirlo desde cero.

---

## D-001 — BFF con cookie httpOnly en lugar de localStorage

**Decisión:** El JWT nunca llega al JS del cliente. El BFF (`src/app/api/[...path]/route.ts`) lee la cookie `rc_token` en el servidor y adjunta `Authorization: Bearer` en cada petición al backend.

**Alternativa descartada:** Guardar el token en `localStorage` o en estado de React.

**Por qué:** `localStorage` es accesible desde cualquier script de la página (vector XSS). Una cookie `httpOnly` + `sameSite: lax` + `secure` en producción es inmune a ese vector: el JS del cliente nunca puede leerla ni exfiltrarla.

---

## D-002 — `GET /me` como única fuente de verdad para la identidad del cliente

**Decisión:** Al hacer login, el BFF intercepta `POST /auth/login`, guarda el token en la cookie y devuelve solo `{ landlord }`. El store llama `GET /me` después para obtener `landlordId`, `isAdmin` e `impersonatedBy`. No se extrae nada del JWT en el cliente.

**Por qué:** Decodificar el JWT en el cliente requeriría exponerlo (rompe D-001) o reimplementar la lógica de claims (diverge del backend). `GET /me` es la forma canónica de preguntar "quién soy" sin ver el token.

---

## D-003 — `isAdmin` derivado del allowlist `ADMIN_EMAILS` en el backend

**Decisión:** No hay tabla de roles en la BD. El backend mantiene un allowlist de emails en `ADMIN_EMAILS` (env var). `GET /me` devuelve `isAdmin: boolean` derivado de ese check. El frontend lo lee y muestra/oculta la sección Admin del sidebar.

**Alternativa descartada:** Duplicar el allowlist en `NEXT_PUBLIC_ADMIN_EMAILS` en el frontend.

**Por qué:** Un check del lado cliente es decorativo (cualquiera puede modificar el estado del store). El guard real lo hace el backend (`AdminOnlyGuard`). El frontend solo usa `isAdmin` para UX (mostrar/ocultar items de nav), no como control de acceso.

---

## D-004 — Impersonación con segunda cookie `rc_admin_session`

**Decisión:** Cuando el admin impersona a un arrendador (`POST /auth/impersonate/:id`):
1. El BFF guarda el token actual del admin en `rc_admin_session` (httpOnly, 24h).
2. Reemplaza `rc_token` con el token de impersonación (httpOnly, 2h).
3. "Volver a admin" (`POST /auth/impersonate/end`) restaura `rc_admin_session` como `rc_token` sin llamar al backend.

**Por qué:** El JWT es stateless — el backend no puede invalidar una sesión. No tiene sentido construir un endpoint de "fin de impersonación" porque no hay nada que invalidar server-side. Guardar el token original en una segunda cookie es suficiente: el token del admin (24h) sigue siendo válido durante la impersonación (2h) y se puede restaurar directamente.

**Efecto secundario positivo:** Si la sesión de impersonación expira (2h), `rc_admin_session` sigue viva y el admin puede volver sin re-login.

---

## D-005 — Layout del dashboard con `h-screen overflow-hidden`

**Decisión:** El contenedor raíz del dashboard usa `h-screen overflow-hidden`. Solo `<main>` tiene `overflow-y-auto` con scrollbar delgado (clase `.dashboard-scroll`).

**Alternativa descartada:** `min-h-screen` en el outer + scroll del body.

**Por qué:** Con `min-h-screen`, el cuerpo del documento crece con el contenido y el scroll ocurre a nivel de `<body>`. Next.js App Router resetea el scroll del body en cada navegación, lo que hace que el sidebar y el header "salten" al top junto con el contenido. Con `h-screen overflow-hidden`, solo el panel `<main>` scrollea; el sidebar y el header nunca se mueven.

---

## D-006 — BFF devuelve 503 JSON cuando el backend está caído

**Decisión:** `forward()` en el BFF envuelve el `fetch()` al backend en try/catch. Si el backend no responde, devuelve `503 { message: "Backend no disponible" }` en lugar de dejar que Next.js genere una página HTML 500.

**Por qué:** Sin try/catch, la excepción de red lanzaba una página HTML completa como response. `api.ts` la metía entera en el mensaje de error y los componentes la mostraban en crudo. Con 503 JSON, el componente puede detectar `error.startsWith("503")` y mostrar un mensaje legible al usuario.

---

## D-007 — `DataBootstrap` para hidratación inicial del store

**Decisión:** `DataBootstrap` (Client Component montado en el layout) dispara `fetchProperties`, `fetchAllTenants`, etc. una sola vez al montar. Las páginas leen del store sin hacer fetch propio.

**Alternativa descartada:** Cada página hace su propio fetch en `useEffect`.

**Por qué:** Evita múltiples llamadas paralelas al mismo endpoint cuando el usuario navega. El store actúa como caché en memoria para la sesión.

---

## D-008 — Proxy de sesión en `src/proxy.ts` (pendiente de activar como middleware)

**Decisión:** El guard de sesión del servidor vive en `src/proxy.ts` con la firma correcta de middleware de Next.js, pero está renombrado para no activarse automáticamente. `src/middleware.ts` fue eliminado.

**Estado:** Pendiente — el `AuthGate` del cliente hace el redirect a `/login` como respaldo. Cuando se active el SSR completo (mejora D8), `proxy.ts` debe renombrarse a `middleware.ts` para proteger rutas en servidor antes del primer render.

---

## D-009 — Tipos admin en `types.ts` + api.ts estricto

**Decisión:** Los endpoints admin (`GET /payments/metrics/ocr`, `GET /ocr/dataset-cases`, `GET /landlords`, `GET /landlords/admin/tenants`) tienen tipos TypeScript estrictos (`OcrMetrics`, `DatasetCase`, `AdminTenant`, etc.) en `src/lib/types.ts`. `api.ts` los usa en lugar de `Record<string, unknown>`.

**Por qué:** Los tipos permiten que el compilador valide el shape de los datos y que los componentes accedan a los campos sin casts. El schema se obtuvo del backend vía el canal de sincronización (`docs/../rent-collector-sync.md`).

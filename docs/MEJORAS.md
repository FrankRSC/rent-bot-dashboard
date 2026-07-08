# 🎨 Mejoras del Dashboard — Rent Collector Dashboard

> Análisis del frontend (Next.js 16 + React 19 + zustand + shadcn). Cada item: **dónde** (`archivo:línea`), **por qué importa**, **pasos exactos**.
>
> El backend vive en el proyecto aparte `rent-collector bot`. Los contratos y la conexión están en [CONTRATOS_API.md](./CONTRATOS_API.md). Las mejoras del backend están en `../rent-collector bot/docs/`.
>
> Ordenado por impacto. **D1, D2 y D3 son bugs reales: features que aparentan funcionar pero no persisten nada.**

---

## Índice por impacto

| ID | Impacto | Mejora | Esfuerzo |
|----|---------|--------|----------|
| D1 | 🔴 Crítico | Settings de notificaciones/recordatorios no se guardan (solo local) | Medio |
| D2 | 🔴 Crítico | Recordatorios "enviados" viven en `localStorage`, no en el backend | Medio |
| D3 | 🟠 Alto | Estado del bot es un `true` hardcodeado, no un health real | Bajo |
| D4 | 🟠 Alto | Auth ausente + `landlordId` hardcodeado y duplicado | Medio |
| D5 | 🟠 Alto | Errores de guardado silenciados (el usuario no se entera) | Bajo |
| D6 | 🟡 Medio | Carga de datos redundante (N+1 + doble fetch de inquilinos) | Medio |
| D7 | 🟡 Medio | Tipos duplicados a mano → drift con el backend | Medio |
| D8 | 🟡 Medio | Todo client-side: sin Server Components ni caché | Medio |
| D9 | 🟡 Medio | `ConnectionBanner` no cubre todos los estados de error | Bajo |
| D10 | 🔵 Mejora | Proxy `/api` y config hardcodeada a `localhost:3001` | Bajo |

---

## D1 🔴 Los settings de notificaciones/recordatorios no se persisten

### Problema
En `configuracion/page.tsx`, los switches de **Notificaciones y recordatorios** (`notifyOnPayment`, `notifyOnOverdue`, `autoRemindersEnabled`, `defaultReminderDays`) y el de **Bot conectado** llaman solo a `updateSettings({...})` (`useStore.ts:235`), que **únicamente cambia el estado local de zustand**. No hay ninguna llamada a la API. Al recargar la página, todo vuelve al default (`useStore.ts:100-117`).

Peor: el backend **ni siquiera tiene columnas** para estos campos — la entidad `Landlord` del backend no incluye `autoRemindersEnabled`, `notifyOnPayment`, etc. Es decir, estos controles **no hacen absolutamente nada persistente**.

### Por qué importa
El arrendador activa "Recordatorios automáticos" o "Notificar al recibir pago", cree que quedó guardado, y no pasa nada. Es una promesa de producto rota.

### Pasos
**Paso 1 — Decidir el alcance.** Estas preferencias necesitan respaldo en backend. Coordina con el proyecto backend para añadir columnas a `Landlord` (`autoRemindersEnabled`, `defaultReminderDays`, `notifyOnPayment`, `notifyOnOverdue`) y exponerlas en el `PATCH /landlords/:id`. Ver `../rent-collector bot/docs/MEJORAS_NEGOCIO.md` N4/N6.

**Paso 2 — Persistir desde el dashboard.** En cada `onCheckedChange`, en vez de solo `updateSettings`, llama `api.updateLandlord(LANDLORD_ID, { autoRemindersEnabled: c })` con rollback optimista (como ya se hace bien con `facturasEnabled` en `configuracion/page.tsx:349-357`):
```tsx
onCheckedChange={async (c) => {
  updateSettings({ [key]: c });
  await api.updateLandlord(LANDLORD_ID, { [key]: c }).catch(() => {
    updateSettings({ [key]: !c }); // rollback si falla
  });
}}
```

**Paso 3 — Mientras el backend no lo soporte,** oculta o marca como "Próximamente" los toggles que no persisten, para no mentirle al usuario.

**Verificar:** activar un toggle, recargar, y que siga activo (viene del backend, no del default).

---

## D2 🔴 Los recordatorios "enviados" viven en `localStorage`

### Problema
`toggleReminderSent` (`useStore.ts:227-233`) guarda si se envió un recordatorio en `localStorage` con clave `reminderSent_<tenantId>_<año>_<mes>`. `_recomputeTenantsWithStatus` (`useStore.ts:276`) lo lee de ahí. Esto significa:
- El estado "recordatorio enviado" **se pierde al cambiar de navegador/dispositivo**.
- No hay envío real de recordatorio: es solo una marca visual local.
- Dos personas viendo el mismo arrendador ven estados distintos.

### Por qué importa
La sección Recordatorios da la impresión de que el sistema envía y rastrea recordatorios, pero es un estado cosmético por dispositivo. No es confiable para cobranza.

### Pasos
**Paso 1 — El envío real de recordatorios es del backend** (WhatsApp API + cron), ver `../rent-collector bot/docs/MEJORAS_NEGOCIO.md` N4. El dashboard debe **disparar** el envío y **leer** el estado, no inventarlo.

**Paso 2 — Endpoint de recordatorio.** Coordina un `POST /tenants/:id/reminder` (envía por WhatsApp y registra un evento con fecha) y un campo `lastReminderAt` en el inquilino/estado.

**Paso 3 — Reemplazar `localStorage`** por ese estado del backend en `_recomputeTenantsWithStatus`.

**Verificar:** enviar un recordatorio desde un dispositivo se refleja en otro tras recargar.

---

## D3 🟠 El estado del bot es un `true` hardcodeado

### Problema
`settings.botConnected` arranca en `true` (`useStore.ts:107`) y el switch en configuración lo cambia localmente (`configuracion/page.tsx:273`). No consulta ningún endpoint real. El indicador "Bot en línea" **siempre dice que sí**, aunque el backend esté caído.

### Por qué importa
El arrendador confía en un semáforo que miente. Si el bot está caído, no se entera desde el dashboard.

### Pasos
**Paso 1 — Health real.** Coordina un `GET /health` en el backend (ver `../rent-collector bot/docs/CALIDAD_Y_OPERACION.md` Q4) que verifique BD y, si se puede, el estado del webhook de WhatsApp.

**Paso 2 — Consultarlo** con un intervalo (p. ej. cada 30 s) y reflejar el estado real en el indicador. Quita el switch manual (no tiene sentido "apagar" el bot desde un toggle cosmético).

**Verificar:** apagar el backend pone el indicador en "Desconectado".

---

## D4 🟠 Auth ausente + `landlordId` hardcodeado y duplicado

### Problema
- No se envía ningún token: `request()` (`lib/api.ts:12-16`) solo manda `Content-Type`.
- El `landlordId` viene de `NEXT_PUBLIC_LANDLORD_ID` y está **hardcodeado en dos lugares**: `useStore.ts:14` y `configuracion/page.tsx:14`. Al ser `NEXT_PUBLIC_`, es visible en el cliente.
- Como el backend no valida propiedad (ver `../rent-collector bot/docs/VULNERABILIDADES.md` P0-1), cambiar ese id da acceso a datos de otro arrendador.

### Por qué importa
No es multi-tenant: es un solo arrendador fijado por env, sin login. No puedes tener más de un cliente real de forma segura.

### Pasos
**Paso 1 — (Backend primero)** implementar auth JWT + ownership: `../rent-collector bot/docs/MEJORAS_NEGOCIO.md` N11.

**Paso 2 — Login en el dashboard.** Página de login que llama `POST /auth/login`, guarda el JWT (cookie httpOnly vía route handler, o memoria + refresh) y obtiene el `landlordId` del token (deja de usar `NEXT_PUBLIC_LANDLORD_ID`).

**Paso 3 — Adjuntar el token** en `request()`:
```ts
headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...init?.headers }
```

**Paso 4 — Centralizar el `landlordId`** en el store (ya existe `landlordId` en el estado, `useStore.ts:87`); elimina la constante duplicada de `configuracion/page.tsx`.

**Verificar:** sin token, el dashboard redirige a login; con token, todo funciona con el id del usuario autenticado.

---

## D5 🟠 Errores de guardado silenciados

### Problema
Varios `catch` vacíos ocultan fallos:
- `configuracion/page.tsx:107` (`handleSaveProfile`) y `:122` (`handleSaveFiscal`) → `catch { /* silenciado */ }`. Si el guardado falla, el usuario ve "Guardar" y cree que quedó, pero no.
- `useStore.ts:133` (`fetchAllTenants`) → `catch {}` sin avisar.
- `configuracion/page.tsx:88` → `.catch(() => {})` al cargar el landlord.

### Por qué importa
En un producto que maneja datos fiscales (RFC, cuenta de cobro), un guardado que falla en silencio es peligroso: el arrendador cree tener bien sus datos de facturación cuando no.

### Pasos
**Paso 1 — Mostrar feedback.** Usa un toast/inline error en cada save fallido (shadcn ya está; añade `sonner` o un estado de error local). Nunca `catch {}` en una acción del usuario.

**Paso 2 — Estado de error por formulario.** Guarda `error` en el estado del componente y muéstralo cerca del botón Guardar.

**Paso 3 — Regla de lint** contra `catch {}` vacío en el repo.

**Verificar:** simula un backend caído; guardar perfil muestra un error visible, no un éxito falso.

---

## D6 🟡 Carga de datos redundante (N+1 + doble fetch)

### Problema
En `DataBootstrap.tsx:9-14` se disparan al montar: `fetchPayments()`, `fetchAllTenants()`, y `fetchProperties().then(fetchTenants)`.
- `fetchTenants` (`useStore.ts:160`) hace **una petición por propiedad**: `Promise.all(properties.map((p) => api.getTenants(p.id)))` → N+1 requests.
- Pero `fetchAllTenants` (`useStore.ts:129`) ya trae **todos** los inquilinos con su estado en **una** llamada (`GET /landlords/:id/tenants`). Se cargan los inquilinos **dos veces** por caminos distintos, y `_recomputeTenantsWithStatus` los cruza.

### Por qué importa
Con muchas propiedades, el arranque hace decenas de requests innecesarios y más lento el primer render.

### Pasos
**Paso 1 — Usar `getAllTenants` como fuente principal.** Ya devuelve inquilinos + `paymentStatus` + `lastPaymentDate` (el backend lo calcula en `getAllTenants`). Puebla `tenants` y `tenantsWithStatus` desde ahí en una sola llamada.

**Paso 2 — Cargar inquilinos por propiedad solo bajo demanda** (al abrir el detalle de una propiedad, `propiedades/[id]`), no en el bootstrap global.

**Paso 3 — Eliminar el N+1** de `fetchTenants` o limitarlo a la propiedad abierta.

**Verificar:** en el arranque, la pestaña Network muestra ~3 requests, no 3 + N.

---

## D7 🟡 Tipos duplicados a mano → drift con el backend

### Problema
`lib/types.ts` reescribe manualmente los tipos del backend (`AttemptStatus`, `PaymentAttempt`, `Factura`, `LandlordReport`...). Si el backend cambia un campo, el dashboard no se entera hasta que algo se rompe en runtime. Además `ocrData`/`cepResponse` son `Record<string, unknown>` (sin forma).

### Por qué importa
Los contratos divergen silenciosamente. Es la causa típica de bugs "funcionaba y de repente no".

### Pasos
**Paso 1 — Generar tipos desde el backend.** Cuando el backend exponga OpenAPI/Swagger (`../rent-collector bot/docs/CALIDAD_Y_OPERACION.md` Q9), genera los tipos con `openapi-typescript` y consúmelos, en vez de mantenerlos a mano.

**Paso 2 — Tipar `ocrData`/`cepResponse`** con una interface real (los campos son conocidos: `claveRastreo`, `monto`, `bancoEmisor`, etc.).

**Paso 3 — Un solo origen de verdad** para los tipos compartidos (paquete o generación automática).

**Verificar:** cambiar un campo en el backend rompe el `build` del dashboard (deseable), no producción.

---

## D8 🟡 Todo client-side: sin Server Components ni caché

### Problema
Toda la data se carga en el cliente con `"use client"` + `useEffect` + zustand (`DataBootstrap`, cada página). No se aprovecha el App Router de Next 16 (Server Components, fetch en servidor, caché). Hay un *waterfall*: `fetchProperties().then(fetchTenants)` es secuencial.

### Por qué importa
Primer render más lento (pantalla vacía hasta que resuelven los fetch del cliente) y más carga en el navegador.

### Pasos
**Paso 1 — Carga inicial en el servidor.** Para páginas como Dashboard/Reportes, haz el fetch inicial en un Server Component (o route handler) y pasa los datos ya hidratados. Reduce el waterfall y mejora el *first paint*.

**Paso 2 — Considerar React Query/SWR** para caché, dedupe y revalidación en las partes interactivas, en vez de refetch manual en cada montaje.

**Paso 3 — Respetar `AGENTS.md`.** El proyecto avisa que este Next tiene cambios importantes; lee `node_modules/next/dist/docs/` antes de tocar routing/data fetching.

**Verificar:** el Dashboard pinta datos en el primer render sin parpadeo de "cargando".

---

## D9 🟡 `ConnectionBanner` no cubre todos los errores

### Problema
`ConnectionBanner.tsx:9` solo mira `propertiesState.error` y `paymentsState.error`. Si fallan `tenants` o `facturas`, no se muestra el aviso. Combinado con D5 (saves silenciados), el usuario puede quedar sin ninguna señal de que algo falló.

### Pasos
**Paso 1 — Incluir todos los estados de carga** (`tenantsState`, `facturasState`) en el banner.

**Paso 2 — Acción de reintento** en el banner (botón "Reintentar") que vuelva a disparar los fetch fallidos, en vez de pedir recargar la página a mano.

**Verificar:** un fallo al cargar facturas muestra el banner con opción de reintentar.

---

## D10 🔵 Proxy `/api` y config hardcodeada

### Problema
`next.config.ts:7-8` reescribe `/api/:path*` a `http://localhost:3001` **hardcodeado**. En producción el backend no está en localhost. `lib/api.ts:10` además tiene otro default `http://localhost:3001`. Dos fuentes de verdad para la URL del backend.

### Pasos
**Paso 1 — Parametrizar el destino** del rewrite con una env (`BACKEND_URL`) en `next.config.ts`.

**Paso 2 — Una sola fuente.** Deja que `lib/api.ts` use siempre `/api` (que el rewrite resuelve) y elimina el default a localhost, o al revés; no ambos.

**Paso 3 — CORS.** Asegura que el backend permita el origen del dashboard en prod (variable `CORS_ORIGIN` del backend).

**Verificar:** cambiar `BACKEND_URL` apunta el dashboard a otro backend sin tocar código.

---

## Orden de ataque recomendado

1. **D1 + D2 + D3** — deja de simular features que no persisten (notificaciones, recordatorios, estado del bot). Es lo que más rompe la confianza del usuario.
2. **D5** — muestra los errores de guardado (barato, evita pérdida de datos fiscales silenciosa).
3. **D6** — arregla la carga redundante (mejor rendimiento de arranque).
4. **D4** — auth + login (depende del backend N11).
5. **D7, D8, D9, D10** — calidad, contratos y rendimiento.

> Muchas de estas dependen de cambios en el backend (notificaciones, recordatorios, health, auth). El detalle de qué debe exponer el backend está en [CONTRATOS_API.md](./CONTRATOS_API.md).

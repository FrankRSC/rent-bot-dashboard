# Contratos de API y conexión con el backend

> Fuente de verdad de **cómo este dashboard habla con el backend** (`rent-collector bot`, NestJS en `:3001`).
> Documenta: (1) el mecanismo de conexión, (2) cada endpoint que el cliente consume con su request/response, y (3) los **gaps de contrato** — cosas que el UI asume pero el backend no cumple todavía.
>
> Este archivo es un espejo del código en `src/lib/api.ts` y `src/lib/types.ts`. Si cambias uno, actualiza el otro.

---

## 1. Mecanismo de conexión

### 1.1 Cómo viaja una petición

```
Componente / store
   └─ src/lib/api.ts  (request<T>)
        └─ fetch(`${BASE}${path}`)          BASE = NEXT_PUBLIC_API_URL ?? "http://localhost:3001"
             └─ /api/:path*  (rewrite Next) ──► http://localhost:3001/:path*   (NestJS)
```

- **`src/lib/api.ts:10`** — `const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"`.
- **`.env.local`** — `NEXT_PUBLIC_API_URL=/api`. Con este valor, las peticiones salen a `/api/...` (mismo origen) y las intercepta el rewrite.
- **`next.config.ts`** — reescribe `/api/:path*` → `http://localhost:3001/:path*`. El prefijo `/api` **se elimina**: el backend NO tiene rutas bajo `/api`, recibe `/landlords/...` directo.
- **`NEXT_PUBLIC_LANDLORD_ID`** (`.env.local`, `=2`) — el ID del arrendador "logueado". Hoy es fijo; se lee en `store/useStore.ts` y en `configuracion/page.tsx`. **No hay auth real** (ver gaps G1, G2).

### 1.2 Envoltura `request<T>` (`src/lib/api.ts:12-23`)

- Método por defecto: `GET`. Header único: `Content-Type: application/json`. **No envía `Authorization`.**
- `!res.ok` → lanza `Error(\`${status}: ${body}\`)`. Los stores capturan esto en su `*State.error`.
- Cuerpo vacío (`204`, DELETE) → devuelve `undefined`. Cuerpo con texto → `JSON.parse`.

> ⚠️ El backend debe responder **JSON** con `Content-Type` correcto y CORS abierto al origen del dashboard (o servirse tras el rewrite, que evita CORS al ser mismo origen).

---

## 2. Catálogo de endpoints (contrato por ruta)

Base path efectiva en el backend (sin el prefijo `/api` del rewrite).

### 2.1 Landlord (arrendador)

| Fn (`api.ts`) | Método | Ruta | Body | Respuesta |
|---|---|---|---|---|
| `getLandlord(id)` | GET | `/landlords/:id` | — | `Landlord` |
| `getLandlordReport(id, month?)` | GET | `/landlords/:id/report?month=YYYY-MM` | — | `LandlordReport` |
| `updateLandlord(id, data)` | PATCH | `/landlords/:id` | `Partial<{name,email,phone,ownerBank,beneficiaryAccount,beneficiaryAccountType,facturasEnabled}>` | `Landlord` |
| `updateLandlordFiscal(id, data)` | PATCH | `/landlords/:id/fiscal` | `{rfc, taxRegime, zipCode, fiscalName?}` | `Landlord` |

**`Landlord`** (`types.ts:27`)
```ts
{ id:number; name:string; email:string; phone:string; isActive:boolean; createdAt:string;
  ownerBank?:string; beneficiaryAccount?:string; beneficiaryAccountType?:string;
  rfc?:string; taxRegime?:string; zipCode?:string; fiscalName?:string; facturasEnabled?:boolean }
```

**`LandlordReport`** (`types.ts:119`) — objeto con `month`, `summary`, `byProperty[]`, `byTenant[]`, `monthlyTrend[]`. Ver `types.ts` para forma exacta de cada fila (`ReportPropertyRow`, `ReportTenantRow`).

### 2.2 Properties (propiedades)

| Fn | Método | Ruta | Body | Respuesta |
|---|---|---|---|---|
| `getProperties(landlordId)` | GET | `/landlords/:landlordId/properties` | — | `Property[]` |
| `createProperty(landlordId, data)` | POST | `/landlords/:landlordId/properties` | `{name}` | `Property` |
| `updateProperty(id, data)` | PATCH | `/properties/:id` | `Partial<{name}>` | `Property` |
| `deleteProperty(id)` | DELETE | `/properties/:id` | — | `204 / void` |

**`Property`** (`types.ts:44`): `{ id:number; name:string; landlordId:number }`

### 2.3 Tenants (inquilinos)

| Fn | Método | Ruta | Body | Respuesta |
|---|---|---|---|---|
| `getTenants(propertyId)` | GET | `/properties/:propertyId/tenants` | — | `Tenant[]` |
| `getAllTenants(landlordId)` | GET | `/landlords/:landlordId/tenants` | — | `Tenant[]` (con `paymentStatus`, `lastPaymentDate`) |
| `createTenant(propertyId, data)` | POST | `/properties/:propertyId/tenants` | `{name, phone, destinationAccount?, destinationAccountType?, paymentDay?, monthlyAmount?}` | `Tenant` |
| `updateTenant(id, data)` | PATCH | `/properties/tenants/:id` | `Partial<{name,phone,destinationAccount,destinationAccountType,paymentDay,monthlyAmount}>` | `Tenant` |
| `deleteTenant(id)` | DELETE | `/properties/tenants/:id` | — | `204 / void` |
| `updateTenantFiscal(id, data)` | PATCH | `/tenants/:id/fiscal` | `{rfc?, taxRegime?, zipCode?}` | `Tenant` |

**`Tenant`** (`types.ts:50`): incluye `phone` en formato `52XXXXXXXXXX`, y campos opcionales de cuenta/renta/fiscales. `paymentStatus` y `lastPaymentDate` sólo vienen poblados desde `getAllTenants`.

> ⚠️ **Inconsistencia de rutas de tenant.** Crear/listar usa `/properties/:propertyId/tenants`, pero editar/borrar usa `/properties/tenants/:id` y lo fiscal usa `/tenants/:id/fiscal`. Tres prefijos distintos para la misma entidad — el backend debe mantener los tres o el UI se rompe (ver gap G6).

### 2.4 Payments (intentos de pago)

| Fn | Método | Ruta | Body | Respuesta |
|---|---|---|---|---|
| `getPayments(limit=50)` | GET | `/payments?limit=N` | — | `PaymentAttempt[]` |
| `getPaymentById(id)` | GET | `/payments/:id` | — | `PaymentAttempt` |

**`PaymentAttempt`** (`types.ts:80`): `status:AttemptStatus`, `verifiedOnFirstTry`, `ocrData?`, `cepResponse?`, `events:PaymentEvent[]`, `tenant?`. **Sólo lectura desde el dashboard** — los intentos los crea el bot de WhatsApp, no el UI.

`AttemptStatus` = `PENDING | VERIFIED | REJECTED | INTRABANK_OK | INTRABANK_REJECTED | ERROR | ABANDONED`.

### 2.5 Facturas (CFDI)

| Fn | Método | Ruta | Body | Respuesta |
|---|---|---|---|---|
| `getLandlordFacturas(landlordId, period?)` | GET | `/landlords/:landlordId/facturas?period=YYYY-MM` | — | `Factura[]` |
| `issueFactura(data)` | POST | `/facturas` | `{landlordId, tenantId, paymentAttemptId?, billingPeriod?, amount?, concepto?}` | `Factura` |
| `cancelFactura(id, data)` | POST | `/facturas/:id/cancel` | `{motivo:"01"\|"02"\|"03"\|"04", uuidSustitucion?}` | `unknown` |

**`Factura`** (`types.ts:156`): `id:string` (UUID interno), `status:FacturaStatus` (`DRAFT|STAMPED|CANCELLED|ERROR`), `uuidCfdi`, `serie`, `folio`, `subtotal/iva/total`, `xmlUrl`, `pdfUrl`, `errorMessage`, `stampedAt`.

> ⚠️ `cancelFactura` devuelve `unknown` en el cliente — el contrato de cancelación **no está tipado**. Definir la respuesta del backend (¿la `Factura` actualizada? ¿un acuse?) y tiparla.

---

## 3. Gaps de contrato (lo que el UI asume y el backend NO cumple)

Estos son los puntos donde el cliente y el servidor **no concuerdan hoy**. Cada uno enlaza con la mejora del dashboard (`docs/MEJORAS.md`) y/o del backend.

| # | Gap | Dónde se ve | Qué falta en el backend |
|---|---|---|---|
| **G1** | **Sin auth.** `request()` no manda `Authorization`; el `landlordId` viaja en el path sin validar dueño. | `api.ts:14`; `.env NEXT_PUBLIC_LANDLORD_ID` | Auth (JWT) + aislamiento por dueño → backend **N11 / P0-1**. El UI deberá mandar el token; hoy no hay a quién mandárselo. |
| **G2** | **`landlordId` hardcodeado.** El UI no descubre "quién soy"; lo lee de env. | `useStore.ts`, `configuracion/page.tsx` | Endpoint tipo `GET /me` que derive el landlord del token. Ver dashboard **D4**. |
| **G3** | **Settings de notificación no persisten.** `GlobalSettings.autoRemindersEnabled / defaultReminderDays / notifyOnPayment / notifyOnOverdue` existen en el UI pero **no hay endpoint** que los guarde. `updateSettings` es local. | `types.ts:135`, `useStore.ts` (`updateSettings`) | Persistir preferencias del landlord (columnas o tabla settings) + PATCH que las acepte. Ver dashboard **D1**. |
| **G4** | **`botConnected` es ficticio.** El UI muestra estado del bot pero no hay endpoint de salud. | `GlobalSettings.botConnected` | `GET /health` (o similar) del backend → CALIDAD **Q4**. Ver dashboard **D3**. |
| **G5** | **`reminderSent` vive en localStorage.** No es parte del contrato; el backend no sabe qué recordatorios se enviaron. | `TenantWithStatus.reminderSent`, `useStore.toggleReminderSent` | Estado de recordatorio del lado servidor → backend **N4**. Ver dashboard **D2**. |
| **G6** | **Rutas de tenant inconsistentes** (`/properties/:pid/tenants`, `/properties/tenants/:id`, `/tenants/:id/fiscal`). | `api.ts:72-166` | Unificar el recurso tenant en el backend, o congelar estas tres formas como contrato estable. |
| **G7** | **Tipos duplicados a mano.** `types.ts` reescribe las entidades del backend; cualquier cambio de forma se detecta en runtime, no en compilación. | `src/lib/types.ts` | Contrato compartido: OpenAPI/Swagger en el backend (CALIDAD **Q9**) → generar tipos. Ver dashboard **D7**. |
| **G8** | **`cancelFactura` sin tipo de respuesta** (`unknown`). | `api.ts:141-148` | Definir y documentar la respuesta de cancelación en el backend. |
| **G9** | **Sin versionado de API.** El UI llama rutas "planas"; un cambio incompatible rompe el cliente sin aviso. | todo `api.ts` | `app.enableVersioning()` en el backend (CALIDAD **Q9**). |

---

## 4. Checklist al cambiar el contrato

Antes de modificar `api.ts` o `types.ts`, o al enterarte de un cambio del backend:

1. ¿La **ruta** cambió? → actualiza `api.ts` y la tabla de §2.
2. ¿La **forma de la respuesta** cambió? → actualiza `types.ts` y la interfaz en §2.
3. ¿Es un campo **nuevo requerido** en un body? → revisa que el formulario del UI lo mande.
4. ¿El backend ahora exige **auth**? → añade el header en `request()` (cierra G1) y prueba un 401.
5. Corre el flujo real (bootstrap de datos, alta de inquilino, emisión de factura) contra el backend en `:3001` antes de dar por bueno el cambio.

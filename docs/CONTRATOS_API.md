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
        └─ fetch(`${BASE}${path}`)          BASE = NEXT_PUBLIC_API_URL ?? "/api"
             └─ /api/:path*  (rewrite Next) ──► ${BACKEND_URL}/:path*   (NestJS)
```

- **`BACKEND_URL`** (`.env.local` / entorno del servidor, default `http://localhost:3001`) — **única fuente de verdad** de dónde vive el backend. Solo la lee `next.config.ts`; no se expone al navegador.
- **`next.config.ts`** — reescribe `/api/:path*` → `${BACKEND_URL}/:path*`. El prefijo `/api` **se elimina**: el backend NO tiene rutas bajo `/api`, recibe `/landlords/...` directo.
- **`src/lib/api.ts`** — `const BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api"`. El default `/api` hace que las peticiones salgan al mismo origen (evita CORS) y las resuelva el rewrite. Ya **no hay default a `localhost:3001`** en el cliente.
- **`NEXT_PUBLIC_LANDLORD_ID`** (`.env.local`, `=2`) — el ID del arrendador "logueado". Hoy es fijo; se lee en `store/useStore.ts` y en `configuracion/page.tsx`. **No hay auth real** (ver gaps G1, G2).
- **`.env.example`** — documenta las tres variables anteriores con sus defaults.

### 1.2 Envoltura `request<T>` (`src/lib/api.ts`)

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
| `updateLandlord(id, data)` | PATCH | `/landlords/:id` | `Partial<{name,email,phone,password,ownerBank,beneficiaryAccount,beneficiaryAccountType,facturasEnabled,autoRemindersEnabled,defaultReminderDays,notifyOnPayment,notifyOnOverdue}>` | `Landlord` |
| `updateLandlordFiscal(id, data)` | PATCH | `/landlords/:id/fiscal` | `{rfc, taxRegime, zipCode, fiscalName?}` | `Landlord` |
| *(sin fn aún)* | POST | `/landlords` | `{name, email, phone, ...}` — `409` si el email ya existe | `Landlord` |
| *(sin fn aún)* | GET | `/landlords` | — | `Landlord[]` (con `properties`) |
| *(sin fn aún)* | DELETE | `/landlords/:id` | — | `204 / void` |

> `PATCH /landlords/:id/fiscal` lo sirve el **módulo de facturación** (`FacturasController`, con DTO validado por whitelist); la ruta y el contrato no cambian para el cliente.

> ⚠️ **`PATCH /landlords/:id` ahora es estricto** (`forbidNonWhitelisted`): un campo desconocido ya **no se ignora en silencio** → responde `400` con `{ statusCode: 400, message: string[], error: "Bad Request" }` donde `message` lista cada campo inválido (ej. `"property foo should not exist"`). Los campos fiscales (`rfc`, `taxRegime`, `zipCode`, `fiscalName`) **tampoco** se aceptan aquí — van por `/landlords/:id/fiscal` — así que mandarlos al PATCH general también da `400`.

**`Landlord`** (`types.ts:27`)
```ts
{ id:number; name:string; email:string; phone:string; isActive:boolean; createdAt:string;
  ownerBank?:string; beneficiaryAccount?:string; beneficiaryAccountType?:string;
  rfc?:string; taxRegime?:string; zipCode?:string; fiscalName?:string; facturasEnabled?:boolean;
  // Preferencias de notificación — NUEVAS, persistidas en el backend (cierra G3):
  autoRemindersEnabled:boolean;   // default true
  defaultReminderDays:number;     // default 3 (0–28)
  notifyOnPayment:boolean;        // default true
  notifyOnOverdue:boolean }       // default true
```

> Las 4 preferencias ya **persisten, vienen en todos los GET y gobiernan el comportamiento real** del backend:
> - `autoRemindersEnabled: false` → el cron diario (8:00 AM CDMX) **no** manda mensajes automáticos a los inquilinos de ese landlord (ni aviso previo, ni día de vencimiento, ni atrasos +1/+3/+7). No afecta el recordatorio **manual** de §2.3, que siempre envía.
> - `defaultReminderDays: N` → el aviso previo sale N días antes del `paymentDay` (antes fijo en 3). Con `0` no hay aviso previo, solo el del día de vencimiento.
> - `notifyOnOverdue: false` → el landlord no recibe el resumen diario de inquilinos en atraso (independiente de si los inquilinos reciben el suyo).
> - `notifyOnPayment: false` → el landlord no recibe el aviso de "pago recibido" cuando el bot verifica un comprobante. El aviso de **pago no validado** (requiere revisión) se manda siempre.

**`LandlordReport`** (`types.ts:119`) — objeto con `month`, `summary`, `byProperty[]`, `byTenant[]`, `monthlyTrend[]`. Ver `types.ts` para forma exacta de cada fila (`ReportPropertyRow`, `ReportTenantRow`).

### 2.2 Properties (propiedades)

| Fn | Método | Ruta | Body | Respuesta |
|---|---|---|---|---|
| `getProperties(landlordId)` | GET | `/landlords/:landlordId/properties` | — | `Property[]` |
| `createProperty(landlordId, data)` | POST | `/landlords/:landlordId/properties` | `{name}` | `Property` |
| `updateProperty(id, data)` | PATCH | `/properties/:id` | `Partial<{name}>` | `Property` |
| `deleteProperty(id)` | DELETE | `/properties/:id` | — | `204 / void` |
| *(sin fn aún)* | GET | `/properties/:id` | — | `Property` (`404` si no existe) |

**`Property`** (`types.ts:44`): `{ id:number; name:string; landlordId:number }`

### 2.3 Tenants (inquilinos)

| Fn | Método | Ruta | Body | Respuesta |
|---|---|---|---|---|
| `getTenants(propertyId)` | GET | `/properties/:propertyId/tenants` | — | `Tenant[]` |
| `getAllTenants(landlordId)` | GET | `/landlords/:landlordId/tenants` | — | `Tenant[]` (con `paymentStatus`, `lastPaymentDate`) |
| `createTenant(propertyId, data)` | POST | `/properties/:propertyId/tenants` | `{name, phone, destinationAccount?, destinationAccountType?, paymentDay?, monthlyAmount?, contractStartDate?, contractEndDate?, nextMonthlyAmount?, adjustmentDate?}` | `Tenant` |
| `updateTenant(id, data)` | PATCH | `/properties/tenants/:id` | `Partial<>` del body de crear | `Tenant` |
| `deleteTenant(id)` | DELETE | `/properties/tenants/:id` | — | `204 / void` |
| `updateTenantFiscal(id, data)` | PATCH | `/tenants/:id/fiscal` | `{rfc?, taxRegime?, zipCode?}` | `Tenant` |
| `sendTenantReminder(id)` *(NUEVO — UI implementado ✅)* | POST | `/tenants/:id/reminder` | — (sin body) | `{ sentAt: string }` (ISO) |

**POST `/tenants/:id/reminder`** — recordatorio manual de renta por WhatsApp, disparado por el landlord desde el UI:
- Envía la **plantilla Meta `renta_pendiente`** (nombre, periodo actual, monto efectivo de renta), por lo que entrega **aunque no haya ventana de sesión de 24 h** con el inquilino.
- Si el envío llega a Meta: actualiza `tenant.lastReminderAt` y responde `200 { sentAt }` (mismo instante, ISO). Respuesta mínima a propósito: el UI ya tiene el row del tenant y puede hacer `lastReminderAt = sentAt` en sitio (o refetch de `getAllTenants`).
- Errores: `404` tenant inexistente (o soft-deleted), `400` tenant sin teléfono, `502` Meta rechazó el envío (en ese caso `lastReminderAt` **no** se actualiza).
- No hay throttle en el backend: cada POST envía de verdad. Si el UI quiere evitar dobles clics, deshabilite el botón con base en `lastReminderAt`.

**`Tenant`** (`types.ts:50`): incluye `phone` en formato `52XXXXXXXXXX`, y campos opcionales de cuenta/renta/fiscales. **NUEVO — normalización de teléfonos (backend):** todo `phone` que entre por `createTenant`/`updateTenant` (y por `POST/PATCH /landlords`) se normaliza antes de guardar: se descartan no-dígitos; 10 dígitos → se antepone `52`; `521XXXXXXXXXX` (formato viejo de Meta) → `52XXXXXXXXXX`. El UI puede mandar los 10 dígitos tal cual los captura; el backend siempre guarda y devuelve `52XXXXXXXXXX`. Las filas existentes ya fueron migradas a este formato. `paymentStatus` y `lastPaymentDate` sólo vienen poblados desde `getAllTenants`. **NUEVO:** `lastReminderAt: string | null` (ISO, `null` si nunca) — viene en **todas** las respuestas de tenant, incluida `GET /landlords/:id/tenants` (cierra G5: el estado de recordatorio ya es del servidor).

**`paymentStatus`** (solo desde `getAllTenants`) — estado del mes en curso: `"Pagado"` (los abonos del mes cubren `monthlyAmount`; **sin tolerancia** — cubre si `paid >= monthlyAmount`), `"Parcial"` (hay abonos pero no cubren la renta, i.e. `paid < monthlyAmount`), `"Revisión"` (hay intentos rechazados/erróneos este mes), `"Vencido"` (sin pago este mes pero pagó en meses previos), `"Pendiente"` (sin actividad). Cuenta `VERIFIED`, `INTRABANK_OK`, `MANUAL_VERIFIED` y `PARTIAL`. Para el desglose exacto esperado/pagado/restante usa `PeriodBalance` (`GET /payments/manual/balance/:tenantId`).

> ✅ **`"Parcial"` implementado (pendiente de deploy).** `getAllTenants` ya compara los abonos del mes contra `monthlyAmount` y devuelve `"Parcial"` cuando `paid < monthlyAmount`. **Cambio de regla (2026-07-22):** se eliminó la tolerancia de $1 — ahora **cualquier pago menor al 100% de la renta es parcial** (ej. renta 100, pago 99 → `"Parcial"`, faltante 1). Mismo criterio en el bot de WhatsApp y en el modo manual (`AMOUNT_TOLERANCE = 0`). El frontend ya lo tipa en `PaymentStatus`; en cuanto el backend despliegue, la tabla reflejará el status sin llamadas extra. Para el desglose exacto usa `GET /payments/manual/balance/:tenantId?period=YYYY-MM` (§2.7).

**Campos de contrato — NUEVOS en el backend** (el UI ya los tipa en `types.ts` y `createTenant`/`updateTenant` los aceptan; el formulario aún no los captura):
```ts
{ contractStartDate?: string | null;   // YYYY-MM-DD — inicio de vigencia
  contractEndDate?: string | null;     // YYYY-MM-DD — fin de vigencia
  nextMonthlyAmount?: number | null;   // renta que aplicará tras el ajuste
  adjustmentDate?: string | null }     // YYYY-MM-DD — cuándo entra nextMonthlyAmount
```
> ⚠️ Efecto de negocio: si el contrato del inquilino **no está vigente** (fuera del rango start/end), el bot **rechaza sus comprobantes** por WhatsApp. El UI debería mostrar la vigencia y permitir editarla (crear/editar tenant ya la acepta).

> ⚠️ **Inconsistencia de rutas de tenant.** Crear/listar usa `/properties/:propertyId/tenants`, pero editar/borrar usa `/properties/tenants/:id` y lo fiscal usa `/tenants/:id/fiscal`. Tres prefijos distintos para la misma entidad — el backend debe mantener los tres o el UI se rompe (ver gap G6).

### 2.4 Payments (intentos de pago)

| Fn | Método | Ruta | Body | Respuesta |
|---|---|---|---|---|
| `getPayments(limit=50)` | GET | `/payments?limit=N` | — | `PaymentAttempt[]` (con `tenant`) |
| `getPaymentById(id)` | GET | `/payments/:id` | — | `PaymentAttempt` (con `events` y `tenant`; `404` si no existe) |
| *(sin fn aún)* | GET | `/payments?phone=52XXXXXXXXXX` | — | `PaymentAttempt[]` del inquilino (con `events`); ignora `limit` |

**`PaymentAttempt`** (`types.ts`): `status:AttemptStatus`, `verifiedOnFirstTry`, `ocrData?:OcrData`, `cepResponse?:CepResponse`, `events:PaymentEvent[]`, `tenant?`. Desde el **modo manual** (§2.7) el backend añadió campos nuevos que el UI puede leer:

```ts
{ source: "WHATSAPP" | "MANUAL";          // quién originó el intento
  amount?: number | null;                  // monto capturado a mano (los del bot lo llevan en ocrData.monto)
  paymentMethod?: "EFECTIVO" | "TRANSFERENCIA" | "DEPOSITO" | "OTRO" | null;
  paymentDate?: string | null;             // YYYY-MM-DD
  billingPeriod?: string | null;           // YYYY-MM — periodo de renta que cubre
  note?: string | null }
```

> Los intentos ya **no son sólo lectura**: además del bot, el UI puede crearlos vía §2.7.

**`OcrData` / `CepResponse`** (`types.ts`): campos conocidos de una transferencia SPEI, todos opcionales (`claveRastreo?`, `monto?`, `bancoEmisor?`, `bancoReceptor?`, `cuentaBeneficiario?`, `nombreBeneficiario?`, `cuentaOrdenante?`, `nombreOrdenante?`, `fechaOperacion?`, `concepto?`, `referenciaNumerica?`; `CepResponse` añade `estado?`), con index signature `[key: string]: unknown` para tolerar campos extra del bot. El backend puede poblar cualquier subconjunto.

`AttemptStatus` = `PENDING | VERIFIED | REJECTED | INTRABANK_OK | INTRABANK_REJECTED | ERROR | ABANDONED | MANUAL_VERIFIED | PARTIAL`.

- `MANUAL_VERIFIED` — el arrendador lo registró/aprobó a mano (cuenta como **Pagado** en reportes).
- `PARTIAL` — abono que aún no cubre la renta del periodo (suma en el saldo de §2.7 pero no marca el mes como pagado).

`PaymentEvent.event` añade: `MANUAL_REGISTERED | RECEIPT_UPLOADED | MANUAL_REVIEW`.

### 2.5 Facturas (CFDI)

| Fn | Método | Ruta | Body | Respuesta |
|---|---|---|---|---|
| `getLandlordFacturas(landlordId, period?)` | GET | `/landlords/:landlordId/facturas?period=YYYY-MM` | — | `Factura[]` |
| `issueFactura(data)` | POST | `/facturas` | `{landlordId, tenantId, paymentAttemptId?, billingPeriod?, amount?, concepto?}` | `Factura` |
| `cancelFactura(id, data)` | POST | `/facturas/:id/cancel` | `{motivo:"01"\|"02"\|"03"\|"04", uuidSustitucion?}` | `CancelFacturaResponse` |
| *(sin fn aún)* | GET | `/facturas?limit=N` | — | `Factura[]` (todas, más recientes primero) |
| *(sin fn aún)* | GET | `/facturas/:id` | — | `Factura` (`404` si no existe) |
| *(sin fn aún)* | GET | `/tenants/:id/facturas` | — | `Factura[]` del inquilino |

**`Factura`** (`types.ts`): `id:string` (UUID interno), `status:FacturaStatus` (`DRAFT|STAMPED|CANCELLED|ERROR`), `uuidCfdi`, `serie`, `folio`, `subtotal/iva/total`, `xmlUrl`, `pdfUrl`, `errorMessage`, `stampedAt`.

**Respuesta exacta de `POST /facturas/:id/cancel`** (confirmada contra el backend — cierra G8): devuelve el registro de **cancelación** (`CancelacionFactura`), **no** la `Factura`:
```ts
{ id: string;                              // UUID de la cancelación (no de la factura)
  facturaId: string;
  motivo: "01" | "02" | "03" | "04";       // motivos SAT CFDI 4.0
  uuidSustitucion?: string | null;         // solo con motivo "01"
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "ERROR";
  providerResponse?: Record<string, unknown> | null;  // respuesta cruda de Factura Digital
  errorMessage?: string | null;            // poblado si status === "ERROR"
  createdAt: string }                      // ISO
```
- `status: "ACCEPTED"` implica que la `Factura` quedó `CANCELLED` (el backend la actualiza en la misma llamada); con `"ERROR"` la factura **no** cambia.
- Errores: `404` factura inexistente; `400` si la factura no está `STAMPED`, o si `motivo === "01"` sin `uuidSustitucion`.
- ✅ `CancelFacturaResponse` en `types.ts` ya refleja esta forma; el UI solo marca la factura como `CANCELLED` con `status === "ACCEPTED"`, la deja `STAMPED` con `PENDING`, y muestra el error inline con `REJECTED`/`ERROR`.

### 2.6 Health (estado del backend)

| Fn (`api.ts`) | Método | Ruta | Body | Respuesta |
|---|---|---|---|---|
| `checkBackendHealth(landlordId)` | GET | `/health` (fallback: `/landlords/:id`) | — | `Promise<boolean>` |

Contrato de `checkBackendHealth(landlordId: number): Promise<boolean>` (dashboard **D3**, cierra el lado cliente del gap G4):

1. Intenta `GET /health`; si responde ok → `true`.
2. Si `/health` devuelve **404** (backend viejo), fallback a `GET /landlords/:id`; ok → `true`.
3. Error de red, timeout (`AbortSignal.timeout(5000)`) o cualquier otro fallo → `false`.
4. **Nunca lanza.**

> ✅ **El backend ya expone `GET /health`** → responde `{ status: "ok", timestamp: string }` (ISO). El gap G4 quedó cerrado por ambos lados; el fallback puede quedarse como red de seguridad.

### 2.7 Modo manual (control de rentas sin bot) — **backend listo, UI implementado** ✅

El arrendador puede hacer desde el UI todo lo que el bot hace por WhatsApp: registrar pagos a mano, subir un comprobante y validarlo (mismo pipeline OCR + Banxico CEP), llevar abonos parciales por periodo y aprobar/rechazar intentos. Base: `/payments/manual`.

| Acción | Método | Ruta | Body | Respuesta |
|---|---|---|---|---|
| Registrar pago a mano | POST | `/payments/manual` | JSON (abajo) | `{ attempt: PaymentAttempt, balance: PeriodBalance }` |
| Subir comprobante y validar | POST | `/payments/manual/receipt` | `multipart/form-data` (abajo) | `ReceiptValidationResult` |
| Completar campos faltantes | POST | `/payments/manual/attempts/:id/complete` | JSON `ReceiptFields` | `ReceiptValidationResult` |
| Saldo del periodo | GET | `/payments/manual/balance/:tenantId?period=YYYY-MM` | — | `PeriodBalance` |
| Aprobar/rechazar a mano | PATCH | `/payments/manual/attempts/:id/review` | JSON (abajo) | `{ attempt: PaymentAttempt, balance: PeriodBalance \| null }` |

**POST `/payments/manual`** — registro directo, confianza total en el arrendador (efectivo, depósito, etc.):
```ts
{ tenantId: number;                       // requerido
  amount: number;                         // requerido, > 0
  paymentMethod?: "EFECTIVO" | "TRANSFERENCIA" | "DEPOSITO" | "OTRO"; // default OTRO
  paymentDate?: string;                   // YYYY-MM-DD, default hoy
  billingPeriod?: string;                 // YYYY-MM, default mes de paymentDate
  note?: string }
```
El backend decide el estado: si `amount` + lo ya abonado cubre `tenant.monthlyAmount` (tolerancia $1) → `MANUAL_VERIFIED`; si no → `PARTIAL`. Errores: `400` (monto/periodo inválido), `404` (tenant inexistente).

**POST `/payments/manual/receipt`** — `multipart/form-data`:
- `file` — imagen o PDF del comprobante (**requerido**)
- `tenantId` — **requerido**
- Campos opcionales que **sobreescriben** lo que detecte el OCR: `claveRastreo`, `referencia`, `monto`, `bancoEmisor`, `bancoReceptor`, `cuentaDestino`, `fecha`, `billingPeriod`

**`ReceiptValidationResult`** — discriminado por `status`:
```ts
// Todos incluyen: { attemptId: number; data: OcrData }
| { status: "VERIFIED"; validation; balance: PeriodBalance }      // Banxico dijo LIQUIDADO
| { status: "INTRABANK_OK"; balance: PeriodBalance }              // mismo banco, cuenta cotejada vs la registrada
| { status: "INCOMPLETE"; missingFields: string[] }               // faltan campos → usar /attempts/:id/complete
| { status: "REJECTED"; message: string; validation }             // Banxico no lo encontró / no coincide
| { status: "INTRABANK_REJECTED"; message: string }               // cuenta del comprobante ≠ registrada
| { status: "ERROR"; message: string }                            // fallo técnico (OCR ilegible, Banxico caído)
```
Flujo `INCOMPLETE`: el intento queda `PENDING` con lo detectado guardado; el UI muestra un formulario con `missingFields`, y manda **solo esos campos** a `POST /payments/manual/attempts/:id/complete` (mismo `ReceiptValidationResult` de vuelta, sin re-subir el archivo).

**`PeriodBalance`** — fuente de verdad del estado de cobranza de un inquilino en un periodo (soporta abonos):
```ts
{ tenantId: number; tenantName: string;
  period: string;                          // YYYY-MM
  expected: number | null;                 // tenant.monthlyAmount (null si no está configurada)
  paid: number;                            // suma de VERIFIED + INTRABANK_OK + MANUAL_VERIFIED + PARTIAL del periodo
  remaining: number | null;
  status: "PAGADO" | "PARCIAL" | "PENDIENTE" | "SIN_RENTA_CONFIGURADA";
  attempts: PaymentAttempt[] }             // los intentos que suman al periodo
```
> Los intentos del bot (sin `billingPeriod`) cuentan al periodo por su mes de `createdAt`; los manuales por su `billingPeriod` explícito.

**PATCH `/payments/manual/attempts/:id/review`** — override del arrendador sobre **cualquier** intento (ej. aprobar uno que el bot rechazó, o rechazar uno dudoso):
```ts
{ action: "APPROVE" | "REJECT";           // requerido
  note?: string;                          // ej. "Confirmado en el estado de cuenta"
  amount?: number;                        // si no viene, usa amount ?? ocrData.monto
  billingPeriod?: string }                // si no viene, usa el existente ?? mes de createdAt
```
`APPROVE` → `MANUAL_VERIFIED`; `REJECT` → `REJECTED`. Se registra un evento `MANUAL_REVIEW` con el estado previo para auditoría.

> **Nota de reportes:** `GET /landlords/:id/report` y `GET /landlords/:id/tenants` ya cuentan `MANUAL_VERIFIED` como "Pagado". **Actualizado:** `getAllTenants` ahora distingue `"Parcial"` cuando los abonos del mes no cubren la renta (antes lo marcaba "Pagado"), así que la tabla de inquilinos ya refleja parcialidad sin llamada extra. Para el desglose numérico (esperado/pagado/restante) sigue siendo `PeriodBalance`, que además soporta consultar periodos pasados por `?period=YYYY-MM`.

### 2.8 Endpoints internos (existen, pero el UI NO debe consumirlos)

Documentados para que nadie los "descubra" y los use por accidente:

| Método | Ruta | Qué es |
|---|---|---|
| GET | `/` | Hello de NestJS (smoke). |
| GET / POST | `/whatsapp` | Webhook de Meta (verificación por token + recepción de mensajes). Solo lo llama la plataforma de WhatsApp. |
| POST | `/banxico/validate` | Validación CEP directa (`{claveRastreo, bancoEmisor}`). Herramienta de debug; para validar comprobantes desde el UI usa §2.7 (`/payments/manual/receipt`), que corre el flujo completo. |

### 2.9 Auth multi-tenant — ✅ **backend listo — levantado y VERIFICADO en local (`:3001`)**

Implementado exactamente como esta sección y **verificado end-to-end contra la BD local** (2026-07-22): `POST /auth/login` → **200** `{ accessToken, landlord }` (401 credenciales inválidas), `GET /me` (Bearer → Landlord, 401 sin/mal token), JWT HS256 `{ sub, email }` 24 h, guard de ownership en `/landlords/:id/*` (200 dueño / 403 ajeno / 401 sin token), `password` con bcrypt y **nunca** devuelto (ni en login, ni en `/me`, ni en el schema OpenAPI). 274 tests en verde. **Credenciales de prueba** (seed): `carlos@rentdemo.com` / `SaveTime123!` (landlord id **3** en la BD sembrada → `NEXT_PUBLIC_LANDLORD_ID=3`; el login es por email, el id solo importa para el ownership). Coordinar la ventana para conectar login + header `Authorization` y quitar `NEXT_PUBLIC_LANDLORD_ID` (al activar el guard, `/landlords/:id/*` sin token da 401).

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| POST | `/auth/login` | `{ email: string, password: string }` | `200 { accessToken: string, landlord: Landlord }` · `401` credenciales inválidas |
| GET | `/me` | — (header `Authorization: Bearer <accessToken>`) | `200 Landlord` (cierra G2) · `401` sin/mal token |

- **Token**: JWT firmado HS256, payload `{ sub: <landlordId>, email }`, **expiración 24 h**.
- **Sin refresh token en v1**: al expirar, el UI recibe `401` y redirige a login (re-login). Si 24 h resulta molesto se alarga o se agrega refresh en v2 — decisión abierta al front.
- **Aislamiento por dueño**: con el guard activo, toda ruta `/landlords/:id/*` valida `:id === token.sub` → `403` si intentas leer datos de otro landlord. Rutas de recursos hijos (tenant, property, payment, factura) validan la cadena de propiedad → `403` igual.
- El UI mandaría el header en `request()` (cierra G1) y derivaría "quién soy" de `GET /me` en vez de `NEXT_PUBLIC_LANDLORD_ID` (cierra G2).
- `landlord.password` ya existe como columna (hoy en texto plano y sin uso); al implementar se hashea con bcrypt y **nunca** se devuelve en respuestas.

> **Front: confirmen** (1) nombres `accessToken` / header estándar `Authorization: Bearer`, (2) 24 h sin refresh para v1, (3) que login devuelva el `Landlord` embebido (les ahorra el `GET /me` inicial). Con ese OK, el backend lo implementa.

> ✅ **OK del front (2026-07-19), los 3 puntos tal cual:** (1) `accessToken` + `Authorization: Bearer` confirmados; (2) 24 h sin refresh está bien para v1 — ante `401` el UI redirige a login; (3) sí, devuelvan el `Landlord` embebido en el login. Backend: implementen exactamente esta sección y márquenla "backend listo" al desplegar (como §2.7); con eso el front conecta login, `GET /me` y el header `Authorization` en `request()`.

---

## 3. Gaps de contrato (lo que el UI asume y el backend NO cumple)

Estos son los puntos donde el cliente y el servidor **no concuerdan hoy**. Cada uno enlaza con la mejora del dashboard (`docs/MEJORAS.md`) y/o del backend.

| # | Gap | Dónde se ve | Qué falta en el backend |
|---|---|---|---|
| **G1** | 🟡 **Auth implementada, pendiente de deploy.** `request()` aún no manda `Authorization`; el `landlordId` viaja en el path. | `api.ts` (`request`); `.env NEXT_PUBLIC_LANDLORD_ID` | §2.9 **implementada y probada** en el backend (2026-07-22); **pendiente deploy + seed de passwords**. Conectar el header solo cuando el backend marque "backend listo (desplegado)". |
| **G2** | **`landlordId` hardcodeado.** El UI no descubre "quién soy"; lo lee de env. | `useStore.ts`, `configuracion/page.tsx` | Endpoint tipo `GET /me` que derive el landlord del token. Ver dashboard **D4**. |
| **G3** | ✅ **CERRADO (ambos lados).** Las 4 preferencias son columnas del `Landlord`, se aceptan en `PATCH /landlords/:id` (estricto, `400` con lista si mandas campos desconocidos), vienen en los GET **y el cron/avisos ya las respetan** (§2.1). El UI las carga al bootstrap (`fetchLandlordSettings`) y las guarda con rollback optimista desde Configuración y Recordatorios. | `types.ts` (`Landlord`), `configuracion/page.tsx`, `recordatorios/page.tsx` | — nada. |
| **G4** | ✅ **CERRADO (ambos lados).** El cliente expone `checkBackendHealth()` (§2.6) y el backend ya sirve `GET /health` → `{status:"ok", timestamp}`. | `api.ts` (`checkBackendHealth`) | — nada; el fallback a `/landlords/:id` queda como red de seguridad. |
| **G5** | ✅ **CERRADO (ambos lados).** `POST /tenants/:id/reminder` envía el recordatorio real por WhatsApp y persiste `tenant.lastReminderAt` (§2.3). El UI lo consume (`sendTenantReminder` + botón "Enviar ahora" en Recordatorios) y `reminderSent` se deriva de `lastReminderAt` (mes en curso); las marcas de `localStorage` quedaron jubiladas. | `useStore.sendReminder`, `recordatorios/page.tsx` | — nada. |
| **G6** | ✅ **DECIDIDO: se CONGELAN las tres formas como contrato estable** (`/properties/:pid/tenants` crear/listar, `/properties/tenants/:id` editar/borrar, `/tenants/:id/*` fiscal/reminder/facturas). El backend las mantiene todas; no habrá unificación antes de auth. Unificar bajo `/tenants` quedará, si acaso, para una v2 versionada (G9). | `api.ts:72-166` | — nada; el UI puede confiar en las tres rutas tal cual. |
| **G7** | 🟡 **OpenAPI/Swagger implementado (pendiente deploy).** `ocrData`/`cepResponse` ya se tiparon como `OcrData`/`CepResponse` (§2.4). | `src/lib/types.ts` | Backend expone **Swagger** (`@nestjs/swagger`): UI en `/docs`, JSON en **`/docs-json`**, cubriendo Landlord, Tenant, PaymentAttempt, Factura, PeriodBalance, LandlordReport. Correr `openapi-typescript` contra `/docs-json` en cuanto esté desplegado. Ver dashboard **D7**. |
| **G8** | ✅ **CERRADO (ambos lados).** La respuesta real de `POST /facturas/:id/cancel` está documentada en §2.5 (objeto `CancelacionFactura`, no la `Factura`) y `CancelFacturaResponse` en `types.ts` ya la refleja; el UI actúa según `status` (`ACCEPTED` → `CANCELLED`, `REJECTED`/`ERROR` → error visible). | `api.ts` (`cancelFactura`), `useStore.cancelFactura` | — nada. |
| **G9** | **Sin versionado de API.** El UI llama rutas "planas"; un cambio incompatible rompe el cliente sin aviso. | todo `api.ts` | `app.enableVersioning()` en el backend (CALIDAD **Q9**) — **aún NO añadido** (opcional, no bloquea `openapi-typescript`). |

---

## 4. Checklist al cambiar el contrato

Antes de modificar `api.ts` o `types.ts`, o al enterarte de un cambio del backend:

1. ¿La **ruta** cambió? → actualiza `api.ts` y la tabla de §2.
2. ¿La **forma de la respuesta** cambió? → actualiza `types.ts` y la interfaz en §2.
3. ¿Es un campo **nuevo requerido** en un body? → revisa que el formulario del UI lo mande.
4. ¿El backend ahora exige **auth**? → añade el header en `request()` (cierra G1) y prueba un 401.
5. Corre el flujo real (bootstrap de datos, alta de inquilino, emisión de factura) contra el backend en `:3001` antes de dar por bueno el cambio.

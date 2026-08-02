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
        └─ fetch(`/api/${path}`)
             └─ src/app/api/[...path]/route.ts  (BFF, servidor Next.js)
                  ├─ Lee cookie httpOnly `rc_token`
                  ├─ Añade `Authorization: Bearer <token>`
                  └─ fetch(`${BACKEND_URL}/${path}`)  ──► NestJS :3001
```

- **`BACKEND_URL`** (`.env.local` / entorno del servidor, default `http://localhost:3001`) — solo la lee el BFF en el servidor; nunca se expone al navegador.
- **`src/app/api/[...path]/route.ts`** (BFF) — reemplaza el rewrite de `next.config.ts`. Intercepta rutas especiales (`auth/login`, `auth/logout`, `auth/impersonate/*`) y reenvía el resto al backend añadiendo el Bearer. Si el backend no responde, devuelve `503 { message: "Backend no disponible" }` en lugar de 500 HTML.
- **`src/lib/api.ts`** — `const BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api"`. El default `/api` hace que las peticiones salgan al mismo origen. Ya **no hay default a `localhost:3001`** en el cliente.
- ~~`NEXT_PUBLIC_LANDLORD_ID`~~ — **eliminado**. El `landlordId` ahora se deriva del login vía `GET /me` y se guarda en el store. Ya no existe en `.env.local` ni en el código fuente (cierra G2).
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
| `getLandlords()` | GET | `/landlords` | — | `Landlord[]` — **solo admin** (`AdminOnlyGuard`); `403` para landlords normales |
| `registerLandlord(data)` | POST | `/landlords` | `{name, email, phone, password}` — **público, sin auth**. `409` si email ya existe. `400` si falta campo o password < 8 chars (`ValidationPipe whitelist+forbid`). | `Landlord` |
| *(sin fn aún)* | DELETE | `/landlords/:id` | — | `204 / void` |

> `PATCH /landlords/:id/fiscal` lo sirve el **módulo de facturación** (`FacturasController`, con DTO validado por whitelist); la ruta y el contrato no cambian para el cliente.

> ⚠️ **`PATCH /landlords/:id` ahora es estricto** (`forbidNonWhitelisted`): un campo desconocido ya **no se ignora en silencio** → responde `400` con `{ statusCode: 400, message: string[], error: "Bad Request" }` donde `message` lista cada campo inválido (ej. `"property foo should not exist"`). Los campos fiscales (`rfc`, `taxRegime`, `zipCode`, `fiscalName`) **tampoco** se aceptan aquí — van por `/landlords/:id/fiscal` — así que mandarlos al PATCH general también da `400`.

**`Landlord`** (`types.ts:27`)
```ts
{ id:number; name:string; email:string; phone:string; isActive:boolean; createdAt:string;
  ownerBank?:string; beneficiaryAccount?:string; beneficiaryAccountType?:string;
  rfc?:string; taxRegime?:string; zipCode?:string; fiscalName?:string; facturasEnabled?:boolean;
  // Admin (solo en GET /me):
  isAdmin?:boolean;                // true si el email está en ADMIN_EMAILS del backend
  impersonatedBy?:string|null;    // email del admin que abrió la sesión; null en sesión normal
  // Preferencias de notificación — persistidas en el backend (cierra G3):
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
| `getAllTenants(landlordId)` | GET | `/landlords/:landlordId/tenants` | — | `Tenant[]` (con `paymentStatus`, `lastPaymentDate`, `periodAdjustment`) |
| `createTenant(propertyId, data)` | POST | `/properties/:propertyId/tenants` | `{name, phone, destinationAccount?, destinationAccountType?, paymentDay?, monthlyAmount?, contractStartDate?, contractEndDate?, nextMonthlyAmount?, adjustmentDate?}` | `Tenant` |
| `updateTenant(id, data)` | PATCH | `/properties/tenants/:id` | `Partial<>` del body de crear | `Tenant` |
| `deleteTenant(id)` | DELETE | `/properties/tenants/:id` | — | `204 / void` |
| `updateTenantFiscal(id, data)` | PATCH | `/tenants/:id/fiscal` | `{rfc?, taxRegime?, zipCode?}` | `Tenant` · `400` si RFC inválido o CP ≠ 5 dígitos |
| `sendTenantReminder(id)` *(NUEVO — UI implementado ✅)* | POST | `/tenants/:id/reminder` | — (sin body) | `{ sentAt: string }` (ISO) |
| `setPeriodAdjustment(id, data)` *(NUEVO — sin UI aún)* | POST | `/tenants/:id/period-adjustment` | `{billingPeriod, expectedAmount, reason?}` | `TenantPeriodAdjustment` |
| `removePeriodAdjustment(id, billingPeriod)` *(NUEVO — sin UI aún)* | DELETE | `/tenants/:id/period-adjustment/:billingPeriod` | — | `204 / void` |
| `getPeriodAdjustmentsHistory(id)` *(NUEVO — sin UI aún)* | GET | `/tenants/:id/period-adjustments` | — | `TenantPeriodAdjustment[]` (más reciente primero) |

**POST/DELETE/GET `/tenants/:id/period-adjustment(s)`** — ajuste puntual de la renta esperada para UN mes
específico (ej. descuento por gastos de la casa este mes), **sin** cambiar `monthlyAmount` ni requerir
revertir nada el mes siguiente — a diferencia de `nextMonthlyAmount`/`adjustmentDate` (§ más abajo), que es
un cambio **permanente** de renta:
- `billingPeriod`: `YYYY-MM`. `expectedAmount`: número positivo, reemplaza `monthlyAmount` **solo** para ese
  periodo al calcular `paymentStatus` (`getAllTenants`), `PeriodBalance` (`GET /payments/manual/balance/:id`)
  y el mensaje de "pago parcial" del bot. `reason`: texto libre, opcional (ej. "Gastos de la casa").
- `POST` hace upsert (un solo ajuste por `tenantId`+`billingPeriod` — un segundo `POST` con el mismo periodo
  actualiza el monto en vez de duplicar).
- `TenantPeriodAdjustment`: `{ id, tenantId, billingPeriod, expectedAmount, reason: string | null, createdAt, updatedAt }`.
  `createdAt` es cuándo se creó por primera vez; `updatedAt` cambia cada vez que se edita (el `POST` hace
  upsert — si el arrendador corrige un ajuste ya existente para el mismo periodo, `expectedAmount`/`reason`
  se sobreescriben en la misma fila y solo `updatedAt` refleja que hubo un cambio, no queda el valor previo).
- `GET /tenants/:id/period-adjustments` (plural) devuelve el **historial completo**, no solo el mes actual.
- **Importante para que el arrendador pueda "llevar control" del ajuste (pedido explícito del humano):**
  `getAllTenants` y `PeriodBalance` ya devuelven `periodAdjustment: {billingPeriod?, expectedAmount, reason,
  createdAt, updatedAt} | null` junto con `paymentStatus`/`expected` — si un tenant tiene `periodAdjustment
  != null`, el número que se está usando como "renta esperada" ese mes **no** es `tenant.monthlyAmount`, es
  el del ajuste. Sin mostrar esto en el UI, un arrendador vería p.ej. "Pagado" con un monto menor a
  `monthlyAmount` y no entendería por qué — recomendamos un badge/tooltip en la fila del tenant cuando
  `periodAdjustment` no sea `null` (con el `reason` y, si `updatedAt != createdAt`, algo como "editado el
  {updatedAt}").
- No es ruta congelada de G6 (adición nueva, no toca las 3 familias existentes). **No hay UI todavía** —
  avisen si quieren el formulario para setear/quitar el ajuste desde el dashboard.

**POST `/tenants/:id/reminder`** — recordatorio manual de renta por WhatsApp, disparado por el landlord desde el UI:
- Envía la **plantilla Meta `renta_pendiente`** (nombre, periodo actual, monto efectivo de renta), por lo que entrega **aunque no haya ventana de sesión de 24 h** con el inquilino.
- Si el envío llega a Meta: actualiza `tenant.lastReminderAt` y responde `200 { sentAt }` (mismo instante, ISO). Respuesta mínima a propósito: el UI ya tiene el row del tenant y puede hacer `lastReminderAt = sentAt` en sitio (o refetch de `getAllTenants`).
- Errores: `404` tenant inexistente (o soft-deleted), `400` tenant sin teléfono, `502` Meta rechazó el envío (en ese caso `lastReminderAt` **no** se actualiza).
- No hay throttle en el backend: cada POST envía de verdad. Si el UI quiere evitar dobles clics, deshabilite el botón con base en `lastReminderAt`.

**`Tenant`** (`types.ts:50`): incluye `phone` en formato `52XXXXXXXXXX`, y campos opcionales de cuenta/renta/fiscales. **NUEVO — normalización de teléfonos (backend):** todo `phone` que entre por `createTenant`/`updateTenant` (y por `POST/PATCH /landlords`) se normaliza antes de guardar: se descartan no-dígitos; 10 dígitos → se antepone `52`; `521XXXXXXXXXX` (formato viejo de Meta) → `52XXXXXXXXXX`. El UI puede mandar los 10 dígitos tal cual los captura; el backend siempre guarda y devuelve `52XXXXXXXXXX`. Las filas existentes ya fueron migradas a este formato. `paymentStatus` y `lastPaymentDate` sólo vienen poblados desde `getAllTenants`. **NUEVO:** `lastReminderAt: string | null` (ISO, `null` si nunca) — viene en **todas** las respuestas de tenant, incluida `GET /landlords/:id/tenants` (cierra G5: el estado de recordatorio ya es del servidor).

**`paymentStatus`** (solo desde `getAllTenants`) — estado del mes en curso: `"Pagado"` (los abonos del mes cubren `monthlyAmount`; **sin tolerancia** — cubre si `paid >= monthlyAmount`), `"Parcial"` (hay abonos pero no cubren la renta, i.e. `paid < monthlyAmount`), `"Revisión"` (hay intentos rechazados/erróneos/en revisión este mes — status `REJECTED`, `ERROR`, `ABANDONED` o `REVIEW`), `"Vencido"` (sin pago este mes pero pagó en meses previos), `"Pendiente"` (sin actividad). Cuenta `VERIFIED`, `MANUAL_VERIFIED` y `PARTIAL` como pagado. Para el desglose exacto esperado/pagado/restante usa `PeriodBalance` (`GET /payments/manual/balance/:tenantId`).

> ✅ **`"Parcial"` implementado y activo (2026-07-25: no está "pendiente de deploy", es parte del código igual que el resto del backend — no hay entorno compartido persistente, cada lado lo corre localmente para probar).** `getAllTenants` ya compara los abonos del mes contra `monthlyAmount` y devuelve `"Parcial"` cuando `paid < monthlyAmount` (`landlords.service.ts:163-166`, usa el mismo `AMOUNT_TOLERANCE` compartido). **Cambio de regla (2026-07-22):** se eliminó la tolerancia de $1 — ahora **cualquier pago menor al 100% de la renta es parcial** (ej. renta 100, pago 99 → `"Parcial"`, faltante 1). Mismo criterio en el bot de WhatsApp y en el modo manual (`AMOUNT_TOLERANCE = 0`). El frontend ya lo tipa en `PaymentStatus`. Para el desglose exacto usa `GET /payments/manual/balance/:tenantId?period=YYYY-MM` (§2.7).

**Campos de contrato — NUEVOS en el backend** (el UI los tipa en `types.ts`, `createTenant`/`updateTenant` los aceptan, y el formulario de alta/edición en `propiedades/[id]/page.tsx` ya los captura ✅):
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

**`PaymentAttempt`** (`types.ts`): `status:AttemptStatus`, `verifiedOnFirstTry`, `ocrData?:OcrData`, `cepResponse?:CepResponse`, `events:PaymentEvent[]`, `tenant?`. Campo de primer nivel **nuevo (2026-07-26)**:
- `claveRastreo?: string | null` — clave de rastreo extraída al nivel de la entidad (antes solo estaba en `ocrData.claveRastreo`). `null` para transferencias intrabancarias (no generan CEP). Viene en `GET /payments`, `GET /payments/:id` y todos los endpoints de `payments/manual/*` que devuelven el intento. Usado por el backend para detectar comprobantes duplicados o reutilizados entre inquilinos.

Desde el **modo manual** (§2.7) el backend añadió también:

```ts
{ source: "WHATSAPP" | "MANUAL";          // quién originó el intento
  amount?: number | null;                  // monto capturado a mano (los del bot lo llevan en ocrData.monto)
  paymentMethod?: "EFECTIVO" | "TRANSFERENCIA" | "DEPOSITO" | "OTRO" | null;
  paymentDate?: string | null;             // YYYY-MM-DD
  billingPeriod?: string | null;           // YYYY-MM — periodo de renta que cubre
  note?: string | null }
```

> Los intentos ya **no son sólo lectura**: además del bot, el UI puede crearlos vía §2.7.

**`OcrData`** (`types.ts`): campos de `OcrExtractionResult` — todos primitivos (`string|null` o `number`): `claveRastreo`, `referencia`, `concepto`, `bancoEmisor`, `bancoReceptor`, `cuentaDestino`, `monto` (number), `fecha`, `isIntrabancario` (boolean). **No tiene campos objeto anidado.**

**`CepResponse`** (`types.ts`): tiene `estado?` (string) más un campo **`details?: object`** (anidado — shape variable: `bancoEmisor`, `bancoReceptor`, `monto`, `message`, `claveRastreo`, `referencia`, `tipoCriterio`, `fechaValidacion`). El UI filtra `details` porque es un objeto y no lo renderiza directamente; si en el futuro se quiere mostrar, tratar sus sub-campos como primitivos individualmente.

**`PaymentEvent.data`** es `Record<string, any>` libre. Keys que llegan como **objeto anidado** (no primitivo) y el UI filtra automáticamente:
- `extractedData` (evento `OCR_SUCCESS`) — mismo shape que `OcrData`.
- `geminiData` (evento `CEP_GEMINI_RETRY`) — subset parcial de `OcrData`.
- `overrides` (evento `RECEIPT_UPLOADED`) — campos manuales que el arrendador sobreescribió al subir el comprobante.

El resto de eventos llevan solo primitivos (`reason`, `status`, `error`, `size`, `mediaId`, `messageId`).

`AttemptStatus` = `PENDING | VERIFIED | REJECTED | ERROR | REVIEW | ABANDONED | MANUAL_VERIFIED | PARTIAL`.

- **`INTRABANK_OK`/`INTRABANK_REJECTED` eliminados (2026-08-02)** — unificados con `VERIFIED`/`REJECTED`. El status ya no distingue intra vs. interbancario (ese dato sigue disponible en `ocrData.isIntrabancario` si se necesita); antes eran dos nombres para el mismo concepto de "pago confirmado"/"pago rechazado".
- `VERIFIED` — pago confirmado, sea interbancario (Banxico/CEP) o intrabancario (cuenta destino cotejada contra la registrada).
- `REJECTED` — pago rechazado, mismo criterio (Banxico dijo que no, o la cuenta destino no coincide).
- `REVIEW` — no se pudo verificar automático (nuevo, 2026-08-01) — pasa a revisión manual del arrendador; notificado por WhatsApp (template `pagos_por_revisar_plataforma`, pendiente de aprobación en Meta).
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
El backend decide el estado: si `amount` + lo ya abonado cubre `tenant.monthlyAmount` (**sin tolerancia**, `paid >= monthlyAmount`, `AMOUNT_TOLERANCE = 0`) → `MANUAL_VERIFIED`; si no → `PARTIAL`. *(Corregido 2026-07-25: esta línea decía "tolerancia $1", desactualizada desde el cambio de regla del 2026-07-22; el criterio real es el mismo que en §2.3.)* Errores: `400` (monto/periodo inválido), `404` (tenant inexistente).

**POST `/payments/manual/receipt`** — `multipart/form-data`:
- `file` — imagen o PDF del comprobante (**requerido**)
- `tenantId` — **requerido**
- Campos opcionales que **sobreescriben** lo que detecte el OCR: `claveRastreo`, `referencia`, `monto`, `bancoEmisor`, `bancoReceptor`, `cuentaDestino`, `fecha`, `billingPeriod`

**`ReceiptValidationResult`** — discriminado por `status`. **Cambio (2026-08-02):** `INTRABANK_OK`/
`INTRABANK_REJECTED` se eliminaron — ahora es `VERIFIED`/`REJECTED` para ambos casos (interbancario e
intrabancario), pero **`validation` ya no está garantizado quede el status que quede** — solo viene cuando
hubo verificación real contra Banxico (interbancario). Si fue intrabancario (cuenta destino cotejada contra
la registrada, sin CEP), `validation` está ausente. `validation?` debe volverse opcional en el tipo del
front:
```ts
// Todos incluyen: { attemptId: number; data: OcrData }
| { status: "VERIFIED"; validation?; balance: PeriodBalance }     // validation presente = Banxico LIQUIDADO (interbancario)
                                                                  // validation ausente = cuenta cotejada vs la registrada (intrabancario)
| { status: "INCOMPLETE"; missingFields: string[] }               // faltan campos → usar /attempts/:id/complete
| { status: "REJECTED"; message: string; validation? }            // validation presente = Banxico no lo encontró/no coincide (interbancario)
                                                                  // validation ausente = cuenta del comprobante ≠ registrada (intrabancario),
                                                                  // o "Este comprobante ya fue registrado en el intento #<id>" (duplicado)
| { status: "ERROR"; message: string }                            // fallo técnico (OCR ilegible, Banxico caído)
```
Flujo `INCOMPLETE`: el intento queda `PENDING` con lo detectado guardado; el UI muestra un formulario con `missingFields`, y manda **solo esos campos** a `POST /payments/manual/attempts/:id/complete` (mismo `ReceiptValidationResult` de vuelta, sin re-subir el archivo).

**`PeriodBalance`** — fuente de verdad del estado de cobranza de un inquilino en un periodo (soporta abonos):
```ts
{ tenantId: number; tenantName: string;
  period: string;                          // YYYY-MM
  expected: number | null;                 // tenant.monthlyAmount (null si no está configurada)
  paid: number;                            // suma de VERIFIED + MANUAL_VERIFIED + PARTIAL del periodo
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
| GET | `/me` | — (header `Authorization: Bearer <accessToken>`) | `200 Landlord` (con `isAdmin` e `impersonatedBy`) · `401` sin/mal token |
| POST | `/auth/impersonate/:landlordId` | — | **interceptado por BFF** — devuelve `{ landlord: Landlord }` al cliente; el `accessToken` se guarda solo en la cookie `rc_token` (ver §2.10) |
| POST | `/auth/impersonate/end` | — | **BFF-only, sin llamada al backend** — restaura la cookie `rc_admin_session` como `rc_token` y responde `204` |

- **Token**: JWT firmado HS256, payload `{ sub: <landlordId>, email }`, **expiración 24 h**.
- **Sin refresh token en v1**: al expirar, el UI recibe `401` y redirige a login (re-login). Si 24 h resulta molesto se alarga o se agrega refresh en v2 — decisión abierta al front.
- **Aislamiento por dueño (expandido 2026-07-26)**: el guard ya **no se limita a `/landlords/:id/*`**. Cubre también `/properties/*`, `/tenants/*`, `/payments/manual/*`, `/facturas` (escritura), `/landlords/:id/facturas`, `/banxico/validate`, `GET /landlords`. Dueño → `200`; token ajeno → `403`; sin token → `401`. Rutas que siguen públicas: `POST /landlords` (alta), webhook de WhatsApp, `POST /auth/login`. (Detalle multipart: `POST /payments/manual/receipt` valida ownership manualmente en el controller porque Multer no expone `body` en fase de Guard.)
- El UI manda el header en el BFF (cierra G1) y deriva "quién soy" de `GET /me` (`hydrateAuth` / `login`, cierra G2). `NEXT_PUBLIC_LANDLORD_ID` eliminado.
- `landlord.password` ya existe como columna (hoy en texto plano y sin uso); al implementar se hashea con bcrypt y **nunca** se devuelve en respuestas.

> **Front: confirmen** (1) nombres `accessToken` / header estándar `Authorization: Bearer`, (2) 24 h sin refresh para v1, (3) que login devuelva el `Landlord` embebido (les ahorra el `GET /me` inicial). Con ese OK, el backend lo implementa.

> ✅ **OK del front (2026-07-19), los 3 puntos tal cual:** (1) `accessToken` + `Authorization: Bearer` confirmados; (2) 24 h sin refresh está bien para v1 — ante `401` el UI redirige a login; (3) sí, devuelvan el `Landlord` embebido en el login. Backend: implementen exactamente esta sección y márquenla "backend listo" al desplegar (como §2.7); con eso el front conecta login, `GET /me` y el header `Authorization` en `request()`.

### 2.10 Admin — endpoints de superadministración

Solo accesibles con un token cuyo email esté en `ADMIN_EMAILS` en el backend (`AdminOnlyGuard`). Visibles en el UI solo si `isAdmin === true` (del store, derivado de `GET /me`).

#### Impersonación (`POST /auth/impersonate/*`)

El flujo completo de impersonación vive en el BFF (`src/app/api/[...path]/route.ts`) — el backend expone la ruta pero el cliente nunca ve el `accessToken`:

```
Admin → POST /api/auth/impersonate/:id
  BFF: guarda rc_token actual → rc_admin_session (httpOnly, 24h)
       llama backend: POST /auth/impersonate/:id → { accessToken, landlord }
       guarda accessToken → rc_token (httpOnly, 2h)
       devuelve { landlord } al cliente JS (sin token)

Admin → POST /api/auth/impersonate/end
  BFF: restaura rc_admin_session → rc_token; borra rc_admin_session
       responde 204 sin llamar al backend
```

- Después de impersonar, `hydrateAuth()` llama `GET /me` → `impersonatedBy` llega con el email del admin; el banner ámbar se muestra.
- Expiración: sesión de impersonación 2 h; sesión admin guardada 24 h (puede restaurarse aunque expire la de impersonación).
- `endImpersonation()` en el store llama `/api/auth/impersonate/end` → BFF restaura la cookie → `hydrateAuth()` → redirige a `/admin/arrendadores`.

#### Listado de arrendadores (`GET /landlords`)

| Fn (`api.ts`) | Método | Ruta backend | Respuesta |
|---|---|---|---|
| `getLandlords()` | GET | `/landlords` | `Landlord[]` — `403` si no es admin |

Tabla en `/admin/arrendadores`: nombre (avatar iniciales + badge Admin), email, teléfono, estado activo/inactivo, fecha de registro. Botón "Impersonar" disponible para cada landlord no-admin.

#### Todos los inquilinos (`GET /landlords/admin/tenants`)

| Fn (`api.ts`) | Método | Ruta backend | Respuesta |
|---|---|---|---|
| `getAllTenantsAdmin()` | GET | `/landlords/admin/tenants` | `AdminTenant[]` — `403` si no es admin |

**`AdminTenant`** (`types.ts`) — extiende `Tenant` con:
```ts
{ landlordId: number; landlordName: string }
```
Tabla en `/admin/inquilinos`: inquilino (nombre + día de pago), arrendador (badge), teléfono, renta (MXN), estado, último pago. Búsqueda en tiempo real por nombre/arrendador/teléfono.

#### Métricas OCR (`GET /payments/metrics/ocr`)

| Fn (`api.ts`) | Método | Ruta backend | Respuesta |
|---|---|---|---|
| `getOcrMetrics()` | GET | `/payments/metrics/ocr` | `OcrMetrics` — `403` si no es admin |

**`OcrMetrics`** (`types.ts`):
```ts
{
  byMethod: OcrMethodStat[];   // un renglón por cada methodUsed distinto en la BD
  summary: {
    ocrOnly:    OcrSummaryBucket;  // métodos que NO incluyen "GEMINI"
    aiInvolved: OcrSummaryBucket;  // métodos que sí incluyen "GEMINI"
  };
}

OcrMethodStat {
  methodUsed: string;    // ej. "OCR_SPACE", "GEMINI_ONLY", "OCR_SPACE + GEMINI", "SIN_DATO"
  total: number;         // intentos que usaron este método
  success: number;       // VERIFIED + MANUAL_VERIFIED
  successRate: number;   // 0–100, ya redondeado a 1 decimal
}

OcrSummaryBucket {
  total: number;
  success: number;
  successRate: number;   // 0–100
}
```

`"SIN_DATO"` agrupa intentos anteriores a que el pipeline empezara a registrar `methodUsed` (incluye todo el seed demo). UI en `/admin/metricas`: dos tarjetas resumen (Solo OCR / Con IA) + tabla de métodos con inline bars. Colores: verde ≥80%, amarillo ≥50%, rojo <50%.

#### Dataset de casos OCR (`GET /ocr/dataset-cases`)

| Fn (`api.ts`) | Método | Ruta backend | Respuesta |
|---|---|---|---|
| `getDatasetCases()` | GET | `/ocr/dataset-cases` | `DatasetCase[]` — `403` si no es admin |

**`DatasetCase`** (`types.ts`):
```ts
{
  id: number;
  attemptId: number;
  methodUsed: string;
  rawText: string | null;              // casi siempre null (no se persiste)
  originalExtraction: ExtractionFields; // lo que detectó el OCR
  correctedValues: ExtractionFields;    // valores tras la corrección
  correctedFields: string[];           // subset de keys que realmente cambiaron — usar este para el diff
  source: DatasetCaseSource;           // "complete" | "review"
  createdAt: string;                   // ISO
}

ExtractionFields {
  fecha?: string | null;
  monto?: string | null;           // string decimal, ej. "1250.00" (no number)
  methodUsed?: string | null;
  referencia?: string | null;
  bancoEmisor?: string | null;
  claveRastreo?: string | null;
  bancoReceptor?: string | null;
  cuentaDestino?: string | null;
  isIntrabancario?: boolean | null;
  ocrCuentaDestino?: string | null;
}

DatasetCaseSource = "complete"   // se completaron campos que OCR/IA no leyó
                                  // (inquilino vía WhatsApp o arrendador en modo manual)
                  | "review"    // arrendador corrigió el monto al aprobar
```

UI en `/admin/dataset`: tabla con filas expandibles. Click en una fila muestra diff rojo (original) → verde (corregido); campos sin cambio en gris.

---

## 3. Gaps de contrato (lo que el UI asume y el backend NO cumple)

Estos son los puntos donde el cliente y el servidor **no concuerdan hoy**. Cada uno enlaza con la mejora del dashboard (`docs/MEJORAS.md`) y/o del backend.

| # | Gap | Dónde se ve | Qué falta en el backend |
|---|---|---|---|
| **G1** | ✅ **CERRADO (ambos lados, 2026-07-26).** El BFF lee la cookie httpOnly `rc_token` y añade `Authorization: Bearer` en cada request. El backend expandió `JwtAuthGuard` a todas las rutas protegidas: `/properties/*`, `/tenants/*`, `/payments/manual/*`, `/facturas` (escritura), `/landlords/:id/facturas`, `/banxico/validate`, `GET /landlords`. Solo quedan públicos: `POST /landlords` (alta), webhook de WhatsApp y `POST /auth/login`. Verificado con F1-F4 integration tests (11.7 s, todos verde). | `src/app/api/[...path]/route.ts`, backend `JwtAuthGuard` | — nada. |
| **G2** | ✅ **CERRADO (lado front, 2026-07-25).** `landlordId` se deriva de `GET /me` al hidratar la sesión (`store.hydrateAuth`) y del login (`store.login`). `NEXT_PUBLIC_LANDLORD_ID` eliminado del env y del código. | `src/store/useStore.ts` (`hydrateAuth`, `login`) | — nada. |
| **G3** | ✅ **CERRADO (ambos lados).** Las 4 preferencias son columnas del `Landlord`, se aceptan en `PATCH /landlords/:id` (estricto, `400` con lista si mandas campos desconocidos), vienen en los GET **y el cron/avisos ya las respetan** (§2.1). El UI las carga al bootstrap (`fetchLandlordSettings`) y las guarda con rollback optimista desde Configuración y Recordatorios. | `types.ts` (`Landlord`), `configuracion/page.tsx`, `recordatorios/page.tsx` | — nada. |
| **G4** | ✅ **CERRADO (ambos lados).** El cliente expone `checkBackendHealth()` (§2.6) y el backend ya sirve `GET /health` → `{status:"ok", timestamp}`. | `api.ts` (`checkBackendHealth`) | — nada; el fallback a `/landlords/:id` queda como red de seguridad. |
| **G5** | ✅ **CERRADO (ambos lados).** `POST /tenants/:id/reminder` envía el recordatorio real por WhatsApp y persiste `tenant.lastReminderAt` (§2.3). El UI lo consume (`sendTenantReminder` + botón "Enviar ahora" en Recordatorios) y `reminderSent` se deriva de `lastReminderAt` (mes en curso); las marcas de `localStorage` quedaron jubiladas. | `useStore.sendReminder`, `recordatorios/page.tsx` | — nada. |
| **G6** | ✅ **DECIDIDO: se CONGELAN las tres formas como contrato estable** (`/properties/:pid/tenants` crear/listar, `/properties/tenants/:id` editar/borrar, `/tenants/:id/*` fiscal/reminder/facturas). El backend las mantiene todas; no habrá unificación antes de auth. Unificar bajo `/tenants` quedará, si acaso, para una v2 versionada (G9). | `api.ts:72-166` | — nada; el UI puede confiar en las tres rutas tal cual. |
| **G7** | ✅ **CERRADO (ambos lados, 2026-07-26).** `openapi-typescript` corrido contra `/docs-json` → `src/lib/backend-schema.ts` generado (25 schemas, 6 modelos clave). Guardia de drift en `backend-schema.check.ts`. `npm run openapi:types` para regenerar. Schema ya corregido: `contractStartDate/EndDate/adjustmentDate` como `format: date` (era `date-time`); decimales como `number` (ya no `string`). Ver **D7** en `MEJORAS.md`. | `src/lib/backend-schema.ts`, `src/lib/backend-schema.check.ts` | — nada. |
| **G8** | ✅ **CERRADO (ambos lados).** La respuesta real de `POST /facturas/:id/cancel` está documentada en §2.5 (objeto `CancelacionFactura`, no la `Factura`) y `CancelFacturaResponse` en `types.ts` ya la refleja; el UI actúa según `status` (`ACCEPTED` → `CANCELLED`, `REJECTED`/`ERROR` → error visible). | `api.ts` (`cancelFactura`), `useStore.cancelFactura` | — nada. |
| **G9** | **Sin versionado de API.** El UI llama rutas "planas"; un cambio incompatible rompe el cliente sin aviso. | todo `api.ts` | `app.enableVersioning()` en el backend (CALIDAD **Q9**) — **aún NO añadido** (opcional, no bloquea `openapi-typescript`). |
| **G10** | ✅ **Backend implementado y verificado en vivo (2026-08-02).** `POST /auth/forgot-password` (`{email}` → `200` siempre, exista o no el email) y `POST /auth/reset-password` (`{token,password}` → `200` en éxito, `400` si el token es inválido/usado/expirado) ya existen. Token de un solo uso en BD (no JWT, 30 min de vida), enlace `<FRONTEND_URL>/nueva-contrasena?token=<token>` (**token de BD, no JWT** — el front no debe intentar decodificarlo). Envío de correo vía SMTP (Hostinger, `nodemailer`) — funciona solo si el humano ya cargó `SMTP_USER`/`SMTP_PASSWORD` en el `.env` del backend; si no, el token se genera pero el correo no sale (sin error visible para el usuario, igual que especificaron). Probado de punta a punta contra `:3001` real: forgot → reset → login con la password nueva → reintentar el mismo token (correctamente `400`). | `src/app/recuperar-contrasena/page.tsx`, `src/app/nueva-contrasena/page.tsx`, `api.ts` (`forgotPassword`, `resetPassword`) | — nada de su lado, el contrato ya es el que pidieron. Confirmen cuando prueben end-to-end (necesitan que el humano tenga el SMTP configurado para ver el correo real). |

---

## 4. Checklist al cambiar el contrato

Antes de modificar `api.ts` o `types.ts`, o al enterarte de un cambio del backend:

1. ¿La **ruta** cambió? → actualiza `api.ts` y la tabla de §2.
2. ¿La **forma de la respuesta** cambió? → actualiza `types.ts` y la interfaz en §2.
3. ¿Es un campo **nuevo requerido** en un body? → revisa que el formulario del UI lo mande.
4. ¿El backend ahora exige **auth**? → añade el header en `request()` (cierra G1) y prueba un 401.
5. Corre el flujo real (bootstrap de datos, alta de inquilino, emisión de factura) contra el backend en `:3001` antes de dar por bueno el cambio.

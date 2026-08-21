import type {
  Landlord,
  LandlordReport,
  Property,
  Tenant,
  TenantPeriodAdjustment,
  PaymentAttempt,
  Factura,
  CancelFacturaResponse,
  ManualPaymentMethod,
  PeriodBalance,
  ReceiptFields,
  ReceiptValidationResult,
  OcrMetrics,
  DatasetCase,
  AdminTenant,
  BusinessMetrics,
  Plan,
  LandlordSubscription,
  SubscriptionPayment,
  SubscriptionStatus,
  SubscriptionStatusView,
} from "@/lib/types";

// El rewrite de next.config.ts resuelve `/api/:path*` → `${BACKEND_URL}/:path*`.
const BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Con FormData el navegador fija el Content-Type (incluye el boundary).
  // El BFF (src/app/api/[...path]/route.ts) adjunta el `Authorization: Bearer`
  // desde la cookie httpOnly; el cliente ya NO maneja el token.
  const isFormData = init?.body instanceof FormData;
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: isFormData
      ? init?.headers
      : { "Content-Type": "application/json", ...init?.headers },
  });
  // 401 (cookie ausente/expirada): mandamos a login. Excluye el propio login,
  // donde un 401 significa "credenciales inválidas" y lo maneja el form.
  if (res.status === 401 && path !== "/auth/login" && typeof window !== "undefined") {
    if (window.location.pathname !== "/login") window.location.href = "/login";
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body || res.statusText}`);
  }
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

// ── Auth (§2.9 CONTRATOS_API.md, vía BFF) ────────────────────────────────────
// El BFF guarda el JWT en cookie httpOnly y devuelve solo el `landlord`.
export const login = (email: string, password: string) =>
  request<{ landlord: Landlord }>(`/auth/login`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

export const logout = () => request<void>(`/auth/logout`, { method: "POST" });

// POST /auth/forgot-password — envía correo con enlace de recuperación.
// Siempre responde 200 para no revelar si el email existe (gap G10).
export const forgotPassword = (email: string) =>
  request<void>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });

// POST /auth/reset-password — establece nueva contraseña con el token del correo.
// 400/404 si el token es inválido o expiró.
export const resetPassword = (token: string, password: string) =>
  request<void>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });

export const getMe = () => request<Landlord>(`/me`);

// ── Health ────────────────────────────────────────────────────────────────────

/**
 * Comprueba si el backend está vivo. Intenta `GET /health`; si el backend aún
 * no expone ese endpoint (404), hace fallback a `GET /landlords/:id`.
 * Nunca lanza: ante error de red, timeout (5s) o cualquier otro fallo → `false`.
 */
export async function checkBackendHealth(landlordId: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) return true;
    if (res.status !== 404) return false;
    // El backend aún no expone /health: probamos con un endpoint conocido.
    const fallback = await fetch(`${BASE}/landlords/${landlordId}`, {
      signal: AbortSignal.timeout(5000),
    });
    return fallback.ok;
  } catch {
    return false;
  }
}

// ── Landlord ─────────────────────────────────────────────────────────────────

export const getLandlord = (id: string) =>
  request<Landlord>(`/landlords/${id}`);

export const getLandlordReport = (id: string, month?: string) =>
  request<LandlordReport>(
    `/landlords/${id}/report${month ? `?month=${month}` : ""}`
  );

// PATCH estricto (forbidNonWhitelisted): un campo desconocido responde 400 con
// la lista de campos inválidos; lo fiscal va aparte por /landlords/:id/fiscal.
export const updateLandlord = (
  id: string,
  data: Partial<{
    name: string;
    email: string;
    phone: string;
    ownerBank: string;
    beneficiaryAccount: string;
    beneficiaryAccountType: string;
    facturasEnabled: boolean;
    autoRemindersEnabled: boolean;
    defaultReminderDays: number; // 0–28
    notifyOnPayment: boolean;
    notifyOnOverdue: boolean;
  }>
) =>
  request<Landlord>(`/landlords/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

// ── Properties ────────────────────────────────────────────────────────────────

export const getProperties = (landlordId: string) =>
  request<Property[]>(`/landlords/${landlordId}/properties`);

export const createProperty = (
  landlordId: string,
  data: { name: string }
) =>
  request<Property>(`/landlords/${landlordId}/properties`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateProperty = (
  id: string,
  data: Partial<{ name: string }>
) =>
  request<Property>(`/properties/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const deleteProperty = (id: string) =>
  request<void>(`/properties/${id}`, { method: "DELETE" });

// ── Tenants ───────────────────────────────────────────────────────────────────

export const getTenants = (propertyId: string) =>
  request<Tenant[]>(`/properties/${propertyId}/tenants`);

export const getAllTenants = (landlordId: string) =>
  request<Tenant[]>(`/landlords/${landlordId}/tenants`);

export const createTenant = (
  propertyId: string,
  data: {
    name: string;
    phone: string;
    destinationAccount?: string;
    destinationAccountType?: string;
    paymentDay?: number;
    monthlyAmount?: number;
    contractStartDate?: string; // YYYY-MM-DD
    contractEndDate?: string; // YYYY-MM-DD
    nextMonthlyAmount?: number;
    adjustmentDate?: string; // YYYY-MM-DD
  }
) =>
  request<Tenant>(`/properties/${propertyId}/tenants`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateTenant = (
  id: string,
  data: Partial<{
    name: string;
    phone: string;
    destinationAccount: string;
    destinationAccountType: string;
    paymentDay: number;
    monthlyAmount: number;
    contractStartDate: string;
    contractEndDate: string;
    nextMonthlyAmount: number;
    adjustmentDate: string;
  }>
) =>
  request<Tenant>(`/properties/tenants/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const deleteTenant = (id: string) =>
  request<void>(`/properties/tenants/${id}`, { method: "DELETE" });

/**
 * Envía el recordatorio de renta por WhatsApp (plantilla Meta `renta_pendiente`,
 * entrega aunque no haya ventana de 24 h). El backend persiste
 * `tenant.lastReminderAt = sentAt`. Errores: 404 tenant inexistente,
 * 400 sin teléfono, 502 si Meta rechaza (sin tocar `lastReminderAt`).
 */
export const sendTenantReminder = (tenantId: string) =>
  request<{ sentAt: string }>(`/tenants/${tenantId}/reminder`, {
    method: "POST",
  });

// ── Ajuste puntual de renta (§2.3 CONTRATOS_API.md) ──────────────────────────

/**
 * Crea o actualiza el ajuste de renta esperada para un mes específico.
 * Upsert: un segundo POST para el mismo billingPeriod sobreescribe en lugar de duplicar.
 */
export const setPeriodAdjustment = (
  tenantId: string,
  data: { billingPeriod: string; expectedAmount: number; reason?: string }
) =>
  request<TenantPeriodAdjustment>(`/tenants/${tenantId}/period-adjustment`, {
    method: "POST",
    body: JSON.stringify(data),
  });

/** Elimina el ajuste de un mes específico. */
export const removePeriodAdjustment = (tenantId: string, billingPeriod: string) =>
  request<void>(`/tenants/${tenantId}/period-adjustment/${billingPeriod}`, {
    method: "DELETE",
  });

/** Devuelve el historial completo de ajustes del inquilino (más reciente primero). */
export const getPeriodAdjustmentsHistory = (tenantId: string) =>
  request<TenantPeriodAdjustment[]>(`/tenants/${tenantId}/period-adjustments`);

// ── Payments ──────────────────────────────────────────────────────────────────

export const getPayments = (limit = 50) =>
  request<PaymentAttempt[]>(`/payments?limit=${limit}`);

export const getPaymentById = (id: string) =>
  request<PaymentAttempt>(`/payments/${id}`);

// ── Modo manual (docs/CONTRATOS_API.md §2.7) ──────────────────────────────────

/**
 * Registra un pago capturado a mano (efectivo, depósito, etc.). El backend
 * decide el estado: MANUAL_VERIFIED si cubre la renta del periodo, PARTIAL si no.
 */
export const registerManualPayment = (data: {
  tenantId: string;
  amount: number;
  paymentMethod?: ManualPaymentMethod; // default OTRO
  paymentDate?: string; // YYYY-MM-DD, default hoy
  billingPeriod?: string; // YYYY-MM, default mes de paymentDate
  note?: string;
}) =>
  request<{ attempt: PaymentAttempt; balance: PeriodBalance }>(
    "/payments/manual",
    { method: "POST", body: JSON.stringify(data) }
  );

/**
 * Sube un comprobante (imagen o PDF) y lo valida con el mismo pipeline del bot
 * (OCR + Banxico CEP). `overrides` sobreescribe lo que detecte el OCR.
 */
export const uploadReceipt = (
  tenantId: string,
  file: File,
  overrides?: ReceiptFields
) => {
  const form = new FormData();
  form.append("file", file);
  form.append("tenantId", String(tenantId));
  Object.entries(overrides ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== "") form.append(key, String(value));
  });
  return request<ReceiptValidationResult>("/payments/manual/receipt", {
    method: "POST",
    body: form,
  });
};

/** Completa los `missingFields` de una validación INCOMPLETE (sin re-subir el archivo). */
export const completeReceiptValidation = (
  attemptId: string,
  fields: ReceiptFields
) =>
  request<ReceiptValidationResult>(
    `/payments/manual/attempts/${attemptId}/complete`,
    { method: "POST", body: JSON.stringify(fields) }
  );

export const getPeriodBalance = (tenantId: string, period?: string) =>
  request<PeriodBalance>(
    `/payments/manual/balance/${tenantId}${period ? `?period=${period}` : ""}`
  );

/** Override del arrendador sobre cualquier intento: APPROVE → MANUAL_VERIFIED, REJECT → REJECTED. */
export const reviewAttempt = (
  attemptId: string,
  data: {
    action: "APPROVE" | "REJECT";
    note?: string;
    amount?: number; // si no viene, usa amount ?? ocrData.monto
    billingPeriod?: string; // si no viene, usa el existente ?? mes de createdAt
  }
) =>
  request<{ attempt: PaymentAttempt; balance: PeriodBalance | null }>(
    `/payments/manual/attempts/${attemptId}/review`,
    { method: "PATCH", body: JSON.stringify(data) }
  );

// ── Facturas ──────────────────────────────────────────────────────────────────

export const getLandlordFacturas = (landlordId: string, period?: string) =>
  request<Factura[]>(
    `/landlords/${landlordId}/facturas${period ? `?period=${period}` : ""}`
  );

export const issueFactura = (data: {
  landlordId: string;
  tenantId: string;
  paymentAttemptId?: string;
  billingPeriod?: string;
  amount?: number;
  concepto?: string;
}) =>
  request<Factura>("/facturas", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const cancelFactura = (
  id: string,
  data: { motivo: "01" | "02" | "03" | "04"; uuidSustitucion?: string }
) =>
  request<CancelFacturaResponse>(`/facturas/${id}/cancel`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateLandlordFiscal = (
  id: string,
  data: { rfc: string; taxRegime: string; zipCode: string; fiscalName?: string }
) =>
  request<Landlord>(`/landlords/${id}/fiscal`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const updateTenantFiscal = (
  id: string,
  data: { rfc?: string; taxRegime?: string; zipCode?: string }
) =>
  request<Tenant>(`/tenants/${id}/fiscal`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

// ── Register (autoservicio público) ──────────────────────────────────────────

export const registerLandlord = (data: {
  name: string;
  email: string;
  phone: string;
  password: string;
}) => request<Landlord>("/landlords", {
  method: "POST",
  body: JSON.stringify(data),
});

// ── Admin (solo super-admin, gateado por ADMIN_EMAILS en el backend) ──────────

export const getBusinessMetrics = () =>
  request<BusinessMetrics>("/landlords/admin/business-metrics");

export const getOcrMetrics = () =>
  request<OcrMetrics>("/payments/metrics/ocr");

export const getDatasetCases = () =>
  request<DatasetCase[]>("/ocr/dataset-cases");

export const getLandlords = () =>
  request<Landlord[]>("/landlords");

export const getAllTenantsAdmin = () =>
  request<AdminTenant[]>("/landlords/admin/tenants");

export const impersonateLandlord = (landlordId: string) =>
  request<{ landlord: Landlord }>(`/auth/impersonate/${landlordId}`, { method: "POST" });

export const endImpersonation = () =>
  request<void>("/auth/impersonate/end", { method: "POST" });

// ── Suscripción del arrendador (§2.10) ───────────────────────────────────────
// NO es admin: va con OwnershipGuard, cada arrendador ve solo la suya (403 con
// otro :id). Solo lectura — el arrendador no contrata ni renueva desde el UI
// porque el pago es en efectivo, fuera de la plataforma.

export const getSubscriptionStatus = (landlordId: string) =>
  request<SubscriptionStatusView>(`/landlords/${landlordId}/subscription`);

// ── Admin de planes y suscripciones (§2.10) ──────────────────────────────────
// Todas responden 403 sin token de admin y 401 sin token. Cada acción queda
// registrada en `admin_audit_logs` del backend.

export const getPlans = (includeInactive = false) =>
  request<Plan[]>(`/admin/plans${includeInactive ? "?includeInactive=true" : ""}`);

export const createPlan = (data: {
  name: string;
  minTenants: number;
  maxTenants?: number | null;
  pricePerTenant: number;
  description?: string;
  isActive?: boolean;
}) => request<Plan>("/admin/plans", { method: "POST", body: JSON.stringify(data) });

export const updatePlan = (planId: string, data: Partial<Parameters<typeof createPlan>[0]>) =>
  request<Plan>(`/admin/plans/${planId}`, { method: "PATCH", body: JSON.stringify(data) });

export const getSubscriptions = () =>
  request<LandlordSubscription[]>("/admin/subscriptions");

// El escalón (y por tanto el precio) se deriva solo de `contractedTenants`:
// no mandes `planId` salvo un trato especial (25+).
export const createSubscription = (data: {
  landlordId: string;
  contractedTenants: number;
  planId?: string;
  status?: SubscriptionStatus;
  startDate?: string;
  months?: number;
  notes?: string;
}) => request<LandlordSubscription>("/admin/subscriptions", {
  method: "POST",
  body: JSON.stringify(data),
});

export const updateSubscription = (
  subscriptionId: string,
  data: {
    contractedTenants?: number;
    planId?: string;
    status?: SubscriptionStatus;
    currentPeriodEnd?: string;
    notes?: string;
  }
) => request<LandlordSubscription>(`/admin/subscriptions/${subscriptionId}`, {
  method: "PATCH",
  body: JSON.stringify(data),
});

// Un pago = un mes: extiende `currentPeriodEnd` un mes y deja ACTIVA. Si ya
// estaba vencida, el mes nuevo arranca en `paidAt` (no cubre el hueco). Sin
// prorrateo ni pagos parciales.
export const recordSubscriptionPayment = (
  subscriptionId: string,
  data: { amount?: number; paidAt?: string; billingPeriod?: string; notes?: string } = {}
) => request<{ payment: SubscriptionPayment; subscription: LandlordSubscription }>(
  `/admin/subscriptions/${subscriptionId}/payments`,
  { method: "POST", body: JSON.stringify(data) }
);

export const getSubscriptionPayments = (subscriptionId: string) =>
  request<SubscriptionPayment[]>(`/admin/subscriptions/${subscriptionId}/payments`);

/**
 * Quita el plan y deja al arrendador SIN suscripción (no se bloquea, sin tope).
 * Es para deshacer una asignación equivocada.
 *
 * `409` si ya hay efectivo capturado: `subscription_payments` cuelga con
 * ON DELETE CASCADE, así que borrar se llevaría el historial del dinero recibido.
 * En ese caso el camino correcto es `status: "CANCELADA"`, que lo preserva —
 * ojo que **cancelar bloquea** y no tener plan no. No son equivalentes.
 */
export const deleteSubscription = (subscriptionId: string) =>
  request<void>(`/admin/subscriptions/${subscriptionId}`, { method: "DELETE" });

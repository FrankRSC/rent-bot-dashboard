import type {
  Landlord,
  LandlordReport,
  Property,
  Tenant,
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

export const getMe = () => request<Landlord>(`/me`);

// ── Health ────────────────────────────────────────────────────────────────────

/**
 * Comprueba si el backend está vivo. Intenta `GET /health`; si el backend aún
 * no expone ese endpoint (404), hace fallback a `GET /landlords/:id`.
 * Nunca lanza: ante error de red, timeout (5s) o cualquier otro fallo → `false`.
 */
export async function checkBackendHealth(landlordId: number): Promise<boolean> {
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

export const getLandlord = (id: number) =>
  request<Landlord>(`/landlords/${id}`);

export const getLandlordReport = (id: number, month?: string) =>
  request<LandlordReport>(
    `/landlords/${id}/report${month ? `?month=${month}` : ""}`
  );

// PATCH estricto (forbidNonWhitelisted): un campo desconocido responde 400 con
// la lista de campos inválidos; lo fiscal va aparte por /landlords/:id/fiscal.
export const updateLandlord = (
  id: number,
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

export const getProperties = (landlordId: number) =>
  request<Property[]>(`/landlords/${landlordId}/properties`);

export const createProperty = (
  landlordId: number,
  data: { name: string }
) =>
  request<Property>(`/landlords/${landlordId}/properties`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateProperty = (
  id: number,
  data: Partial<{ name: string }>
) =>
  request<Property>(`/properties/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const deleteProperty = (id: number) =>
  request<void>(`/properties/${id}`, { method: "DELETE" });

// ── Tenants ───────────────────────────────────────────────────────────────────

export const getTenants = (propertyId: number) =>
  request<Tenant[]>(`/properties/${propertyId}/tenants`);

export const getAllTenants = (landlordId: number) =>
  request<Tenant[]>(`/landlords/${landlordId}/tenants`);

export const createTenant = (
  propertyId: number,
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
  id: number,
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

export const deleteTenant = (id: number) =>
  request<void>(`/properties/tenants/${id}`, { method: "DELETE" });

/**
 * Envía el recordatorio de renta por WhatsApp (plantilla Meta `renta_pendiente`,
 * entrega aunque no haya ventana de 24 h). El backend persiste
 * `tenant.lastReminderAt = sentAt`. Errores: 404 tenant inexistente,
 * 400 sin teléfono, 502 si Meta rechaza (sin tocar `lastReminderAt`).
 */
export const sendTenantReminder = (tenantId: number) =>
  request<{ sentAt: string }>(`/tenants/${tenantId}/reminder`, {
    method: "POST",
  });

// ── Payments ──────────────────────────────────────────────────────────────────

export const getPayments = (limit = 50) =>
  request<PaymentAttempt[]>(`/payments?limit=${limit}`);

export const getPaymentById = (id: number) =>
  request<PaymentAttempt>(`/payments/${id}`);

// ── Modo manual (docs/CONTRATOS_API.md §2.7) ──────────────────────────────────

/**
 * Registra un pago capturado a mano (efectivo, depósito, etc.). El backend
 * decide el estado: MANUAL_VERIFIED si cubre la renta del periodo, PARTIAL si no.
 */
export const registerManualPayment = (data: {
  tenantId: number;
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
  tenantId: number,
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
  attemptId: number,
  fields: ReceiptFields
) =>
  request<ReceiptValidationResult>(
    `/payments/manual/attempts/${attemptId}/complete`,
    { method: "POST", body: JSON.stringify(fields) }
  );

export const getPeriodBalance = (tenantId: number, period?: string) =>
  request<PeriodBalance>(
    `/payments/manual/balance/${tenantId}${period ? `?period=${period}` : ""}`
  );

/** Override del arrendador sobre cualquier intento: APPROVE → MANUAL_VERIFIED, REJECT → REJECTED. */
export const reviewAttempt = (
  attemptId: number,
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

export const getLandlordFacturas = (landlordId: number, period?: string) =>
  request<Factura[]>(
    `/landlords/${landlordId}/facturas${period ? `?period=${period}` : ""}`
  );

export const issueFactura = (data: {
  landlordId: number;
  tenantId: number;
  paymentAttemptId?: number;
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
  id: number,
  data: { rfc: string; taxRegime: string; zipCode: string; fiscalName?: string }
) =>
  request<Landlord>(`/landlords/${id}/fiscal`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const updateTenantFiscal = (
  id: number,
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
}) => request<{ landlord: { id: number; name: string; email: string } }>("/landlords", {
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

export const impersonateLandlord = (landlordId: number) =>
  request<{ landlord: Landlord }>(`/auth/impersonate/${landlordId}`, { method: "POST" });

export const endImpersonation = () =>
  request<void>("/auth/impersonate/end", { method: "POST" });

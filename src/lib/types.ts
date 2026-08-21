export type AccountType = "CLABE" | "CARD" | "PHONE";
/**
 * Estado de pago del inquilino en el mes en curso (§Tenant CONTRATOS_API.md).
 *
 * Los tres estados de plazo dependen de los **días de gracia** (`Tenant.graceDays`,
 * con fallback a `Landlord.defaultGraceDays`):
 *
 * - `"Vigente"`  — dentro de su plazo: día de pago + gracia. Sin `paymentDay` no
 *                  hay cómo juzgar el plazo, así que el backend manda esto.
 * - `"Atrasado"` — se le acabó la gracia y el mes sigue corriendo.
 * - `"Vencido"`  — el mes cerró sin pago.
 *
 * `"Pendiente"` ya NO existe: lo sustituyó `"Vigente"` (2026-08-16). Ojo al leer
 * código viejo — `"Vencido"` existía antes con el significado que hoy tiene
 * `"Atrasado"`, así que una comparación heredada puede seguir compilando y
 * significar otra cosa.
 */
export type PaymentStatus = "Pagado" | "Parcial" | "Vigente" | "Atrasado" | "Vencido" | "Revisión";

export type AttemptStatus =
  | "PENDING"
  | "VERIFIED"
  | "REJECTED"
  | "ERROR"
  | "ABANDONED"
  | "REVIEW"
  | "MANUAL_VERIFIED" // aprobado/registrado a mano por el arrendador (cuenta como Pagado)
  | "PARTIAL"; // abono que aún no cubre la renta del periodo

export type EventType =
  | "MEDIA_RECEIVED"
  | "TEXT_WITH_DATA"
  | "OCR_SUCCESS"
  | "OCR_FAILED"
  | "FIELD_REQUESTED"
  | "FIELD_PROVIDED"
  | "CEP_CALLED"
  | "CEP_GEMINI_RETRY"
  | "VERIFIED"
  | "REJECTED"
  | "ERROR"
  | "MANUAL_REGISTERED"
  | "RECEIPT_UPLOADED"
  | "MANUAL_REVIEW";

export interface Landlord {
  id: string;
  name: string;
  email: string;
  phone: string;
  isActive: boolean;
  createdAt: string;
  isAdmin?: boolean;
  impersonatedBy?: string | null; // email del admin cuando el token es de impersonación
  ownerBank?: string;
  beneficiaryAccount?: string;
  beneficiaryAccountType?: string;
  rfc?: string;
  taxRegime?: string;
  zipCode?: string;
  fiscalName?: string;
  facturasEnabled?: boolean;
  // Preferencias de notificación — persistidas y respetadas por el cron/avisos
  // del backend (gap G3 cerrado; detalle de efectos en §2.1 de CONTRATOS_API.md).
  autoRemindersEnabled: boolean; // default true
  defaultReminderDays: number; // default 3 (rango 0–28)
  notifyOnPayment: boolean; // default true
  notifyOnOverdue: boolean; // default true
}

export interface Property {
  id: string;
  name: string;
  landlordId: string;
}

export interface TenantPeriodAdjustment {
  id: string;
  tenantId: string;
  billingPeriod: string; // YYYY-MM
  expectedAmount: number;
  reason: string | null;
  createdAt: string;
}

export interface Tenant {
  id: string;
  name: string;
  phone: string; // format: 52XXXXXXXXXX
  propertyId: string;
  destinationAccount?: string;
  destinationAccountType?: string;
  paymentDay?: number;
  // Días de gracia de ESTE inquilino. `null` = hereda `defaultGraceDays` del
  // arrendador. El 0 es un valor real (sin gracia), no un "sin configurar".
  graceDays?: number | null;
  monthlyAmount?: number;
  rfc?: string;
  taxRegime?: string;
  zipCode?: string;
  paymentStatus?: PaymentStatus;
  lastPaymentDate?: string | null;
  lastReminderAt: string | null; // ISO — último recordatorio enviado por WhatsApp (gap G5 cerrado)
  contractStartDate?: string | null; // YYYY-MM-DD
  contractEndDate?: string | null; // YYYY-MM-DD
  nextMonthlyAmount?: number | null; // renta que aplicará tras el ajuste
  adjustmentDate?: string | null; // YYYY-MM-DD — cuándo entra nextMonthlyAmount
  // Ajuste puntual de renta para un mes específico (§2.3 CONTRATOS_API.md).
  // Solo viene de getAllTenants; reemplaza monthlyAmount en el cálculo de paymentStatus.
  periodAdjustment?: { billingPeriod?: string; expectedAmount: number; reason: string | null } | null;
}

export interface TenantWithStatus extends Tenant {
  paymentStatus: PaymentStatus;
  lastPaymentDate: string | null;
  reminderSent: boolean; // derivado: lastReminderAt cae en el mes en curso
}

// ── SPEI / verificación de pagos ─────────────────────────────────────────────

/**
 * Datos extraídos por OCR del comprobante de transferencia SPEI que envía el
 * inquilino por WhatsApp. Todos los campos son opcionales: el OCR puede fallar
 * en cualquiera. El index signature tolera campos extra que el bot añada.
 */
export interface OcrData {
  claveRastreo?: string;
  referencia?: string;
  concepto?: string;
  bancoEmisor?: string;
  bancoReceptor?: string;
  cuentaDestino?: string;
  monto?: number;
  fecha?: string;
  isIntrabancario?: boolean;
  /**
   * Solo en la respuesta de `/payments/manual/receipt` (no en el flujo del bot,
   * que usa `ocrLast4Destino` — nombre distinto, ver rent-collector-sync.md
   * 2026-08-04T22:35). `cuentaDestino` de arriba es la cuenta esperada/registrada
   * del tenant; este campo es lo que el OCR leyó del comprobante (cuenta completa).
   */
  ocrCuentaDestino?: string | null;
  /**
   * Últimos 4 dígitos de la cuenta destino leídos del comprobante — fallback para
   * comprobantes que enmascaran la cuenta completa (caso común BBVA/Dimo). Antes
   * de 2026-08-05 el modo manual no tenía este fallback y esos comprobantes
   * siempre caían en `status: "ERROR"`; ahora, si coincide con la cuenta
   * registrada → `VERIFIED`, si no coincide → `REJECTED` (ver rent-collector-sync.md
   * 2026-08-05T01:20). `ERROR` queda solo para cuando no hay ninguna señal
   * (ni cuenta completa ni último-4).
   */
  ocrLast4Destino?: string | null;
  [key: string]: unknown;
}

/**
 * Respuesta de la consulta al CEP de Banxico (comprobante electrónico de pago)
 * con la que el bot verifica la transferencia. Misma tolerancia que `OcrData`.
 */
export interface CepResponse {
  claveRastreo?: string;
  monto?: number;
  bancoEmisor?: string;
  bancoReceptor?: string;
  cuentaBeneficiario?: string;
  nombreBeneficiario?: string;
  cuentaOrdenante?: string;
  nombreOrdenante?: string;
  fechaOperacion?: string;
  concepto?: string;
  referenciaNumerica?: string;
  estado?: string;
  [key: string]: unknown;
}

export interface PaymentEvent {
  id: string;
  attemptId: string;
  event: EventType;
  data?: Record<string, unknown>;
  createdAt: string;
}

export type PaymentSource = "WHATSAPP" | "MANUAL";

export type ManualPaymentMethod =
  | "EFECTIVO"
  | "TRANSFERENCIA"
  | "DEPOSITO"
  | "OTRO";

export interface PaymentAttempt {
  id: string;
  tenantPhone: string;
  tenantId?: string;
  status: AttemptStatus;
  verifiedOnFirstTry: boolean;
  ocrData?: OcrData;
  cepResponse?: CepResponse;
  createdAt: string;
  completedAt?: string;
  events: PaymentEvent[];
  tenant?: Tenant;
  imageMediaId?: string | null;
  // Modo manual (docs/CONTRATOS_API.md §2.7)
  source: PaymentSource; // quién originó el intento
  amount?: number | null; // monto capturado a mano (los del bot lo llevan en ocrData.monto)
  paymentMethod?: ManualPaymentMethod | null;
  paymentDate?: string | null; // YYYY-MM-DD
  billingPeriod?: string | null; // YYYY-MM — periodo de renta que cubre
  note?: string | null;
  // Deduplicación de comprobantes (§2.4)
  claveRastreo?: string | null; // null para intrabancarias sin CEP
}

// ── Modo manual (docs/CONTRATOS_API.md §2.7) ─────────────────────────────────

/**
 * Fuente de verdad del estado de cobranza de un inquilino en un periodo.
 * Soporta abonos parciales: `paid` suma VERIFIED + MANUAL_VERIFIED + PARTIAL
 * del periodo.
 */
export interface PeriodBalance {
  tenantId: string;
  tenantName: string;
  period: string; // YYYY-MM
  expected: number | null; // tenant.monthlyAmount (null si no está configurada)
  paid: number;
  remaining: number | null;
  status: "PAGADO" | "PARCIAL" | "PENDIENTE" | "SIN_RENTA_CONFIGURADA";
  attempts: PaymentAttempt[];
}

/** Campos que el arrendador puede aportar u overridear sobre lo que detecte el OCR. */
export interface ReceiptFields {
  claveRastreo?: string;
  referencia?: string;
  monto?: number;
  bancoEmisor?: string;
  bancoReceptor?: string;
  cuentaDestino?: string;
  fecha?: string;
  billingPeriod?: string;
}

/**
 * Resultado de subir/completar un comprobante, discriminado por `status`.
 * Flujo INCOMPLETE: el intento queda PENDING con lo detectado; el UI pide
 * `missingFields` y los manda a POST /payments/manual/attempts/:id/complete.
 * `validation?` solo viene en transferencias interbancarias (Banxico/CEP);
 * ausente en intrabancarias (cuenta cotejada contra la registrada, sin CEP).
 */
export type ReceiptValidationResult =
  | { status: "VERIFIED"; attemptId: string; data: OcrData; validation?: unknown; balance: PeriodBalance }
  | { status: "INCOMPLETE"; attemptId: string; data: OcrData; missingFields: string[] }
  | { status: "REJECTED"; attemptId: string; data: OcrData; message: string; validation?: unknown }
  | { status: "ERROR"; attemptId: string; data: OcrData; message: string };

export interface ReportTenantRow {
  tenantId: string;
  tenantName: string;
  phone: string;
  propertyId: string;
  propertyName: string;
  paymentDay: number | null;
  monthlyAmount: number | null;
  paymentStatus: PaymentStatus;
  lastVerifiedAt: string | null;
  amountPaid: number | null;
  attemptsCount: number;
}

export interface ReportPropertyRow {
  propertyId: string;
  propertyName: string;
  totalCobrado: number;
  cobradoCount: number;
  vigenteCount: number;
  /** @deprecated Alias de `vigenteCount`. El backend lo mantiene por compatibilidad. */
  pendienteCount: number;
  atrasadoCount: number;
  vencidoCount: number;
  totalTenants: number;
  paidPercent: number;
}

export interface LandlordReport {
  month: string;
  summary: {
    totalCobrado: number;
    totalPendiente: number;
    cobradoCount: number;
    vigenteCount: number;
    /** @deprecated Alias de `vigenteCount`. El backend lo mantiene por compatibilidad. */
    pendienteCount: number;
    // `atrasadoCount` y `vencidoCount` cuentan cosas DISTINTAS desde 2026-08-16
    // (antes `vencidoCount` era alias del otro).
    atrasadoCount: number;
    vencidoCount: number;
    totalTenants: number;
    verifiedOnFirstTryCount: number;
  };
  byProperty: ReportPropertyRow[];
  byTenant: ReportTenantRow[];
  monthlyTrend: Array<{ month: string; totalCobrado: number; cobradoCount: number }>;
}

export interface GlobalSettings {
  landlordName: string;
  email: string;
  phone: string;
  ownerBank: string;
  beneficiaryAccount: string;
  beneficiaryAccountType: string;
  autoRemindersEnabled: boolean;
  defaultReminderDays: number;
  defaultGraceDays: number; // 0–28; gracia por defecto de los inquilinos sin `graceDays`
  notifyOnPayment: boolean;
  notifyOnOverdue: boolean;
  rfc: string;
  taxRegime: string;
  zipCode: string;
  fiscalName: string;
  facturasEnabled: boolean;
}

export type FacturaStatus = "DRAFT" | "STAMPED" | "CANCELLED" | "ERROR";

export interface Factura {
  id: string;
  landlordId: string;
  tenantId: string | null;
  paymentAttemptId: string | null;
  uuidCfdi: string | null;
  serie: string | null;
  folio: string | null;
  subtotal: number;
  iva: number;
  total: number;
  concepto: string;
  billingPeriod: string;
  status: FacturaStatus;
  xmlUrl: string | null;
  pdfUrl: string | null;
  errorMessage: string | null;
  stampedAt: string | null;
  createdAt: string;
  tenant?: Tenant;
}

/**
 * Respuesta de `POST /facturas/:id/cancel` (§2.5, gap G8 cerrado): el registro
 * de cancelación (`CancelacionFactura`), NO la `Factura`. Con `status:
 * "ACCEPTED"` el backend ya dejó la factura en `CANCELLED` en la misma llamada;
 * con `"ERROR"` la factura no cambia.
 */
export interface CancelFacturaResponse {
  id: string; // UUID de la cancelación (no de la factura)
  facturaId: string;
  motivo: "01" | "02" | "03" | "04"; // motivos SAT CFDI 4.0
  uuidSustitucion?: string | null; // solo con motivo "01"
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "ERROR";
  providerResponse?: Record<string, unknown> | null;
  errorMessage?: string | null; // poblado si status === "ERROR"
  createdAt: string; // ISO
}

// ── Admin — Métricas de negocio globales (§2.10) ─────────────────────────────

export interface BusinessMetricsLandlordDetail {
  landlordId: string;
  landlordName: string;
  tenantCount: number;
  esperadoMes: number;
  cobradoMes: number;
  activoUltimos30Dias: boolean;
  bot30d: number;
  manual30d: number;
  pctBotPct: number; // 0–100
}

export interface BusinessMetrics {
  periodo: string; // YYYY-MM
  cobranza: {
    esperado: number;
    cobrado: number;
    tasaCobranzaPct: number; // 0–100
  };
  arrendadores: {
    total: number;
    activosUltimos30Dias: number;
    inactivos: number;
    detalle: BusinessMetricsLandlordDetail[];
  };
  adopcionBot: {
    ventanaDias: number;
    global: { bot: number; manual: number; pctBotPct: number };
  };
}

// ── Admin — OCR / Dataset (solo super-admin) ─────────────────────────────────

export interface OcrMethodStat {
  methodUsed: string;
  total: number;
  success: number;
  successRate: number; // 0–100, ya redondeado
}

export interface OcrSummaryBucket {
  total: number;
  success: number;
  successRate: number;
}

export interface OcrMetrics {
  byMethod: OcrMethodStat[];
  summary: {
    ocrOnly: OcrSummaryBucket;
    aiInvolved: OcrSummaryBucket;
  };
}

export interface ExtractionFields {
  fecha?: string | null;
  monto?: string | null; // string decimal, ej. "1250.00"
  methodUsed?: string | null;
  referencia?: string | null;
  bancoEmisor?: string | null;
  claveRastreo?: string | null;
  bancoReceptor?: string | null;
  cuentaDestino?: string | null;
  isIntrabancario?: boolean | null;
  ocrCuentaDestino?: string | null;
}

export interface AdminTenant extends Tenant {
  landlordId: string;
  landlordName: string;
}

export type DatasetCaseSource = "complete" | "review";

export interface DatasetCase {
  id: number; // fila propia de admin/dataset, no migró a UUID (ver backend-schema.ts OcrDatasetCase)
  attemptId: string;
  methodUsed: string;
  rawText: string | null;
  originalExtraction: ExtractionFields;
  correctedValues: ExtractionFields;
  correctedFields: string[]; // subset de keys que realmente cambiaron
  source: DatasetCaseSource;
  createdAt: string;
}

// ── Planes y suscripciones (§2.10 CONTRATOS_API.md) ──────────────────────────
// El backend NO cobra: la suscripción se paga en efectivo fuera de la plataforma
// y el super admin captura lo recibido. No hay pasarela ni checkout.
//
// La unidad de cobro es el INQUILINO, no la propiedad (cambio del 2026-08-15).
// Crear propiedades es libre y sin tope; el 409 salta al dar de alta inquilinos.

export type SubscriptionStatus = "ACTIVA" | "VENCIDA" | "CANCELADA" | "CORTESIA";

export interface Plan {
  id: string;
  name: string;
  minTenants: number;
  maxTenants: number | null; // null = escalón "10 o más", sin techo
  pricePerTenant: number;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface LandlordSubscription {
  id: string;
  landlordId: string;
  planId: string;
  plan: Plan;
  contractedTenants: number; // TOPE contratado, no un conteo de uso
  /**
   * Inquilinos vivos hoy. Solo viene en `GET /admin/subscriptions`.
   * No lo derives contando `GET /landlords/admin/tenants`: ese listado usa
   * `withDeleted: true` e incluye a los dados de baja, que no consumen plan.
   */
  tenantsUsed?: number;
  monthlyAmount: number; // contractedTenants × pricePerTenant, CONGELADO al contratar
  status: SubscriptionStatus;
  currentPeriodStart: string; // "YYYY-MM-DD"
  currentPeriodEnd: string; // "YYYY-MM-DD", último día cubierto (inclusive)
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionPayment {
  id: string;
  subscriptionId: string;
  landlordId: string;
  billingPeriod: string; // "YYYY-MM"
  amount: number;
  paidAt: string; // "YYYY-MM-DD"
  recordedBy: string; // email del admin que capturó el efectivo
  notes: string | null;
  createdAt: string;
}

/**
 * Vista de solo lectura del plan del arrendador (`GET /landlords/:id/subscription`).
 * Va con OwnershipGuard: cada arrendador ve solo el suyo.
 */
export interface SubscriptionStatusView {
  hasSubscription: boolean; // false = sin plan asignado (NO se bloquea)
  /**
   * ÚNICA fuente para decidir si mostrar el banner de bloqueo.
   * No lo derives de `status`: puede decir "ACTIVA" con `currentPeriodEnd` ya
   * pasado hasta que corra el cron (1:00 UTC).
   */
  isOperational: boolean;
  status: SubscriptionStatus | null;
  planName: string | null;
  contractedTenants: number | null;
  tenantsUsed: number; // inquilinos vivos; para "3 de 7 inquilinos"
  monthlyAmount: number | null;
  currentPeriodEnd: string | null; // "YYYY-MM-DD"
  blockedReason: string | null; // texto listo para mostrar; null si opera normal
}

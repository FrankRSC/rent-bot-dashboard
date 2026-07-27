export type AccountType = "CLABE" | "CARD" | "PHONE";
export type PaymentStatus = "Pagado" | "Parcial" | "Pendiente" | "Vencido" | "Revisión";

export type AttemptStatus =
  | "PENDING"
  | "VERIFIED"
  | "REJECTED"
  | "INTRABANK_OK"
  | "INTRABANK_REJECTED"
  | "ERROR"
  | "ABANDONED"
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
  | "VERIFIED"
  | "REJECTED"
  | "INTRABANK_OK"
  | "INTRABANK_REJECTED"
  | "ERROR"
  | "MANUAL_REGISTERED"
  | "RECEIPT_UPLOADED"
  | "MANUAL_REVIEW";

export interface Landlord {
  id: number;
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
  id: number;
  name: string;
  landlordId: number;
}

export interface Tenant {
  id: number;
  name: string;
  phone: string; // format: 52XXXXXXXXXX
  propertyId: number;
  destinationAccount?: string;
  destinationAccountType?: string;
  paymentDay?: number;
  monthlyAmount?: number;
  rfc?: string;
  taxRegime?: string;
  zipCode?: string;
  paymentStatus?: PaymentStatus;
  lastPaymentDate?: string | null;
  lastReminderAt: string | null; // ISO — último recordatorio enviado por WhatsApp (gap G5 cerrado)
  // Vigencia de contrato y ajuste de renta (§2.3 de CONTRATOS_API.md).
  // El backend los acepta en crear/editar; el formulario del UI aún no los captura.
  contractStartDate?: string | null; // YYYY-MM-DD
  contractEndDate?: string | null; // YYYY-MM-DD
  nextMonthlyAmount?: number | null; // renta que aplicará tras el ajuste
  adjustmentDate?: string | null; // YYYY-MM-DD — cuándo entra nextMonthlyAmount
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
  id: number;
  attemptId: number;
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
  id: number;
  tenantPhone: string;
  tenantId?: number;
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
 * Soporta abonos parciales: `paid` suma VERIFIED + INTRABANK_OK +
 * MANUAL_VERIFIED + PARTIAL del periodo.
 */
export interface PeriodBalance {
  tenantId: number;
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
 */
export type ReceiptValidationResult =
  | { status: "VERIFIED"; attemptId: number; data: OcrData; validation?: unknown; balance: PeriodBalance }
  | { status: "INTRABANK_OK"; attemptId: number; data: OcrData; balance: PeriodBalance }
  | { status: "INCOMPLETE"; attemptId: number; data: OcrData; missingFields: string[] }
  | { status: "REJECTED"; attemptId: number; data: OcrData; message: string; validation?: unknown }
  | { status: "INTRABANK_REJECTED"; attemptId: number; data: OcrData; message: string }
  | { status: "ERROR"; attemptId: number; data: OcrData; message: string };

export interface ReportTenantRow {
  tenantId: number;
  tenantName: string;
  phone: string;
  propertyId: number;
  propertyName: string;
  paymentDay: number | null;
  monthlyAmount: number | null;
  paymentStatus: PaymentStatus;
  lastVerifiedAt: string | null;
  amountPaid: number | null;
  attemptsCount: number;
}

export interface ReportPropertyRow {
  propertyId: number;
  propertyName: string;
  totalCobrado: number;
  cobradoCount: number;
  pendienteCount: number;
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
    pendienteCount: number;
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
  landlordId: number;
  tenantId: number | null;
  paymentAttemptId: number | null;
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
  landlordId: number;
  landlordName: string;
}

export type DatasetCaseSource = "complete" | "review";

export interface DatasetCase {
  id: number;
  attemptId: number;
  methodUsed: string;
  rawText: string | null;
  originalExtraction: ExtractionFields;
  correctedValues: ExtractionFields;
  correctedFields: string[]; // subset de keys que realmente cambiaron
  source: DatasetCaseSource;
  createdAt: string;
}

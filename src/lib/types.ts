export type AccountType = "CLABE" | "CARD" | "PHONE";
export type PaymentStatus = "Pagado" | "Pendiente" | "Vencido" | "Revisión";

export type AttemptStatus =
  | "PENDING"
  | "VERIFIED"
  | "REJECTED"
  | "INTRABANK_OK"
  | "INTRABANK_REJECTED"
  | "ERROR"
  | "ABANDONED";

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
  | "ERROR";

export interface Landlord {
  id: number;
  name: string;
  email: string;
  phone: string;
  isActive: boolean;
  createdAt: string;
  ownerBank?: string;
  beneficiaryAccount?: string;
  beneficiaryAccountType?: string;
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
}

export interface TenantWithStatus extends Tenant {
  paymentStatus: PaymentStatus;
  lastPaymentDate: string | null;
  reminderSent: boolean;
}

export interface PaymentEvent {
  id: number;
  attemptId: number;
  event: EventType;
  data?: Record<string, unknown>;
  createdAt: string;
}

export interface PaymentAttempt {
  id: number;
  tenantPhone: string;
  tenantId?: number;
  status: AttemptStatus;
  verifiedOnFirstTry: boolean;
  ocrData?: Record<string, unknown>;
  cepResponse?: Record<string, unknown>;
  createdAt: string;
  completedAt?: string;
  events: PaymentEvent[];
  tenant?: Tenant;
}

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
  botConnected: boolean;
  autoRemindersEnabled: boolean;
  defaultReminderDays: number;
  notifyOnPayment: boolean;
  notifyOnOverdue: boolean;
}

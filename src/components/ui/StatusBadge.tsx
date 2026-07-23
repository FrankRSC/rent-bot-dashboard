import { cn } from "@/lib/utils";
import type { PaymentStatus, AttemptStatus } from "@/lib/types";

export const PAYMENT_STATUS_CLS: Record<PaymentStatus, string> = {
  Pagado:    "bg-emerald-50 border-emerald-200 text-emerald-700",
  Parcial:   "bg-sky-50     border-sky-200     text-sky-700",
  Pendiente: "bg-amber-50   border-amber-200   text-amber-600",
  Vencido:   "bg-red-50     border-red-200     text-red-600",
  Revisión:  "bg-purple-50  border-purple-200  text-purple-600",
};

export const PAYMENT_STATUS_DOT: Record<PaymentStatus, string> = {
  Pagado:    "bg-emerald-500",
  Parcial:   "bg-sky-400 animate-pulse",
  Pendiente: "bg-amber-400 animate-pulse",
  Vencido:   "bg-red-500 animate-pulse",
  Revisión:  "bg-purple-500",
};

export const ATTEMPT_STATUS_META: Record<AttemptStatus, { label: string; cls: string }> = {
  VERIFIED:           { label: "Verificado",           cls: "bg-emerald-50 border-emerald-200 text-emerald-700" },
  INTRABANK_OK:       { label: "Intrabancario OK",      cls: "bg-emerald-50 border-emerald-200 text-emerald-700" },
  MANUAL_VERIFIED:    { label: "Pagado (manual)",       cls: "bg-emerald-50 border-emerald-200 text-emerald-700" },
  PENDING:            { label: "Pendiente",             cls: "bg-amber-50   border-amber-200   text-amber-600"  },
  PARTIAL:            { label: "Abono",                 cls: "bg-amber-100  border-amber-300   text-amber-700"  },
  REJECTED:           { label: "Revisión",              cls: "bg-purple-50  border-purple-200  text-purple-600" },
  INTRABANK_REJECTED: { label: "Intrabancario Fallido", cls: "bg-red-50     border-red-200     text-red-600"   },
  ERROR:              { label: "Error",                 cls: "bg-red-50     border-red-200     text-red-600"   },
  ABANDONED:          { label: "Abandonado",            cls: "bg-slate-100  border-slate-200   text-slate-500" },
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const cls = PAYMENT_STATUS_CLS[status];
  const dot = PAYMENT_STATUS_DOT[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 border text-[11px] font-semibold px-2.5 py-[3px] rounded-full whitespace-nowrap", cls)}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dot)} />
      {status}
    </span>
  );
}

export function AttemptStatusBadge({ status }: { status: AttemptStatus }) {
  const { label, cls } = ATTEMPT_STATUS_META[status] ?? { label: status, cls: "bg-slate-100 border-slate-200 text-slate-500" };
  return (
    <span className={cn("inline-flex items-center border text-[11px] font-semibold px-2.5 py-[3px] rounded-full whitespace-nowrap", cls)}>
      {label}
    </span>
  );
}

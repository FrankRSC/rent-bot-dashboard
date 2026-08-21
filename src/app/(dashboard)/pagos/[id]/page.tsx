"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, ShieldCheck, ShieldX, Image as ImageIcon, FileText, ScanLine, HelpCircle, Check, Globe, AlertCircle, Clock, AlertTriangle, HandCoins, Upload, UserCheck } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import * as api from "@/lib/api";
import type { PaymentAttempt, PeriodBalance, EventType, ManualPaymentMethod } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AttemptStatusBadge } from "@/components/ui/StatusBadge";
import { fieldLabel } from "@/lib/field-labels";

type EventMeta = { icon: React.ElementType; color: string; label: string };

function getEventMeta(event: EventType): EventMeta {
  const map: Record<EventType, EventMeta> = {
    MEDIA_RECEIVED:     { icon: ImageIcon,   color: "text-blue-600 bg-blue-50",      label: "Imagen recibida" },
    TEXT_WITH_DATA:     { icon: FileText,    color: "text-blue-600 bg-blue-50",      label: "Texto con datos" },
    OCR_SUCCESS:        { icon: ScanLine,    color: "text-[#2952F3] bg-[#eef1fd]",   label: "Datos extraídos" },
    OCR_FAILED:         { icon: AlertCircle, color: "text-red-600 bg-red-50",        label: "Error al leer comprobante" },
    FIELD_REQUESTED:    { icon: HelpCircle,  color: "text-amber-600 bg-amber-50",    label: "Dato solicitado al inquilino" },
    FIELD_PROVIDED:     { icon: Check,       color: "text-amber-700 bg-amber-50",    label: "Dato proporcionado" },
    CEP_CALLED:         { icon: Globe,       color: "text-purple-600 bg-purple-50",  label: "Verificación automática" },
    CEP_GEMINI_RETRY:   { icon: Globe,       color: "text-purple-600 bg-purple-50",  label: "Reintento de verificación" },
    VERIFIED:           { icon: ShieldCheck, color: "text-[#047857] bg-[#ecfdf5]",   label: "Verificado ✓" },
    REJECTED:           { icon: ShieldX,     color: "text-purple-600 bg-purple-50",  label: "Revisión" },
    ERROR:              { icon: AlertCircle, color: "text-red-600 bg-red-50",        label: "Error" },
    MANUAL_REGISTERED:  { icon: HandCoins,   color: "text-[#2952F3] bg-[#eef1fd]",   label: "Pago registrado a mano" },
    RECEIPT_UPLOADED:   { icon: Upload,      color: "text-blue-600 bg-blue-50",      label: "Comprobante subido desde el panel" },
    MANUAL_REVIEW:      { icon: UserCheck,   color: "text-purple-600 bg-purple-50",  label: "Revisión manual del arrendador" },
  };
  return map[event] ?? { icon: Clock, color: "text-slate-400 bg-slate-100", label: event };
}


// Detalles internos/de diagnóstico sin valor para el arrendador — nunca se muestran,
// ni con etiqueta traducida (ej. "Método de OCR: OCR_SPACE" no le dice nada a nadie).
const HIDDEN_KEYS = new Set(["methodUsed", "mediaId", "messageId", "size", "verifiedOnFirstTry"]);

function isPrimitive(v: unknown): v is string | number | boolean {
  return v !== null && v !== undefined && v !== "" && typeof v !== "object";
}

function formatEventValue(key: string, value: string | number | boolean): string {
  if ((key === "amount" || key === "monto") && typeof value === "number")
    return formatMoney(value);
  if (key === "paymentDate" && typeof value === "string")
    return formatDay(value);
  if (key === "paymentMethod" && typeof value === "string")
    return METHOD_LABELS[value as ManualPaymentMethod] ?? value;
  if (key === "field" && typeof value === "string")
    return fieldLabel(value);
  if (key === "isIntrabancario")
    return value ? "Mismo banco" : "Entre bancos distintos";
  // `expected`/`provided` llegan como dígitos crudos sin enmascarar (a diferencia de `account`,
  // que ya viene "****XXXX") — se antepone **** para que se vea consistente en la UI
  // (confirmado con el backend, rent-collector-sync.md 2026-08-05T02:15).
  if ((key === "expected" || key === "provided") && typeof value === "string" && !value.startsWith("*"))
    return `****${value}`;
  return String(value);
}

function DataSection({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(
    ([key, v]) => isPrimitive(v) && !HIDDEN_KEYS.has(key)
  );
  if (!entries.length) return null;
  return (
    <div className="divide-y divide-slate-100 rounded-xl border border-slate-200/80 overflow-hidden">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-start gap-3 px-4 py-2.5 bg-white">
          <span className="text-[12px] text-slate-400 min-w-[140px] shrink-0">{fieldLabel(key)}</span>
          <span className="text-[13px] font-medium text-[#0B1426] break-all">
            {formatEventValue(key, value as string | number | boolean)}
          </span>
        </div>
      ))}
    </div>
  );
}

const METHOD_LABELS: Record<ManualPaymentMethod, string> = {
  EFECTIVO:      "Efectivo",
  TRANSFERENCIA: "Transferencia",
  DEPOSITO:      "Depósito",
  OTRO:          "Otro",
};

const formatMoney = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

/** `YYYY-MM-DD` → fecha local sin corrimiento por zona horaria. */
const formatDay = (isoDay: string) =>
  format(new Date(`${isoDay}T00:00:00`), "dd 'de' MMMM yyyy", { locale: es });

function ImageViewer({ attemptId }: { attemptId: string }) {
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorKind, setErrorKind] = useState<"not_found" | "error" | null>(null);

  const handleOpen = async () => {
    setOpen(true);
    if (src) return;
    setLoading(true);
    setErrorKind(null);
    try {
      const res = await fetch(`/api/payments/${attemptId}/image`);
      if (res.status === 404) { setErrorKind("not_found"); return; }
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      setMimeType(blob.type);
      setSrc(URL.createObjectURL(blob));
    } catch {
      setErrorKind("error");
    } finally {
      setLoading(false);
    }
  };

  const isPdf = mimeType === "application/pdf";

  return (
    <>
      <button
        onClick={handleOpen}
        className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-[#2952F3] hover:underline font-medium"
      >
        <ImageIcon className="w-3.5 h-3.5" /> Ver comprobante
      </button>
      {open && (
        <Dialog open onOpenChange={() => setOpen(false)}>
          <DialogContent className={isPdf ? "max-w-2xl" : "max-w-lg"}>
            <DialogHeader><DialogTitle>Comprobante de pago</DialogTitle></DialogHeader>
            <div className="overflow-y-auto flex-1 min-h-0 px-4 pb-4 flex items-center justify-center">
              {loading && <p className="text-[13px] text-slate-400">Cargando comprobante…</p>}
              {errorKind === "not_found" && (
                <p className="text-[13px] text-slate-400">Este pago no tiene comprobante guardado.</p>
              )}
              {errorKind === "error" && (
                <p className="text-[13px] text-red-500">No se pudo cargar el comprobante.</p>
              )}
              {src && isPdf && (
                <iframe
                  src={src}
                  title="Comprobante de pago"
                  className="w-full h-[60dvh] rounded-xl border border-slate-200"
                />
              )}
              {src && !isPdf && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="Comprobante de pago" className="max-w-full max-h-[70dvh] object-contain rounded-xl border border-slate-200" />
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function ReviewDialog({
  attempt, action, onClose, onDone,
}: {
  attempt: PaymentAttempt;
  action: "APPROVE" | "REJECT";
  onClose: () => void;
  onDone: (updated: PaymentAttempt) => void;
}) {
  const isApprove = action === "APPROVE";
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [billingPeriod, setBillingPeriod] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedAmount = amount.trim() ? parseFloat(amount) : undefined;
  const invalidAmount = parsedAmount !== undefined && (!Number.isFinite(parsedAmount) || parsedAmount <= 0);

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await api.reviewAttempt(attempt.id, {
        action,
        note: note.trim() || undefined,
        ...(isApprove && parsedAmount !== undefined ? { amount: parsedAmount } : {}),
        ...(isApprove && billingPeriod.trim() ? { billingPeriod: billingPeriod.trim() } : {}),
      });
      onDone(res.attempt);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isApprove ? "Aprobar intento" : "Rechazar intento"}</DialogTitle>
          <DialogDescription>
            {isApprove
              ? <>El intento <span className="font-semibold">#{attempt.id}</span> se marcará como <span className="font-semibold text-emerald-700">Pagado (manual)</span>.</>
              : <>El intento <span className="font-semibold">#{attempt.id}</span> se marcará como <span className="font-semibold text-red-600">rechazado</span>.</>}
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 min-h-0 px-4 py-2 space-y-4">
          {isApprove && (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Monto <span className="text-slate-400 font-normal">(opcional, corrige el detectado)</span></label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={String(attempt.amount ?? attempt.ocrData?.monto ?? "0.00")}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Periodo <span className="text-slate-400 font-normal">(YYYY-MM, opcional)</span></label>
                <Input
                  placeholder={attempt.billingPeriod ?? format(new Date(attempt.createdAt), "yyyy-MM")}
                  value={billingPeriod}
                  onChange={(e) => setBillingPeriod(e.target.value)}
                />
              </div>
            </>
          )}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nota <span className="text-slate-400 font-normal">(opcional)</span></label>
            <Input
              placeholder="Confirmado en el estado de cuenta"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          {invalidAmount && (
            <p className="text-[12px] text-amber-600">El monto debe ser un número mayor a 0.</p>
          )}
          {error && (
            <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || invalidAmount}
            variant={isApprove ? "default" : "destructive"}
            className={isApprove ? "bg-emerald-600 hover:bg-emerald-700 text-white" : undefined}
          >
            {saving ? (isApprove ? "Aprobando..." : "Rechazando...") : (isApprove ? "Aprobar" : "Rechazar")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PaymentDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [attempt, setAttempt] = useState<PaymentAttempt | null>(null);
  const [balance, setBalance] = useState<PeriodBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewAction, setReviewAction] = useState<"APPROVE" | "REJECT" | null>(null);

  useEffect(() => {
    if (!id) return;
    api.getPaymentById(id)
      .then(setAttempt)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  // Para PARTIAL y MANUAL_VERIFIED obtenemos el balance del periodo.
  useEffect(() => {
    if (!attempt || (attempt.status !== "PARTIAL" && attempt.status !== "MANUAL_VERIFIED") || !attempt.tenantId) return;
    const period =
      attempt.billingPeriod ??
      `${new Date(attempt.createdAt).getFullYear()}-${String(new Date(attempt.createdAt).getMonth() + 1).padStart(2, "0")}`;
    api.getPeriodBalance(attempt.tenantId, period).then(setBalance).catch(() => {});
  }, [attempt]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-40 bg-slate-100 rounded-2xl" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-52 bg-slate-100 rounded-2xl" />
          <div className="h-52 bg-slate-100 rounded-2xl" />
        </div>
        <div className="h-72 bg-slate-100 rounded-2xl" />
      </div>
    );
  }

  if (error || !attempt) {
    const is404 = error?.startsWith("404");
    const is403 = error?.startsWith("403");
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-amber-500" />
        </div>
        <p className="text-[15px] font-semibold text-[#0B1426]">
          {is404 ? "Pago no encontrado" : is403 ? "Sin acceso" : "Algo salió mal"}
        </p>
        <p className="text-[13px] text-slate-400">
          {is404
            ? "Este intento de pago no existe o fue eliminado."
            : is403
            ? "No tienes permiso para ver este pago."
            : "No se pudieron cargar los datos. Intenta de nuevo."}
        </p>
        <Link href="/pagos">
          <Button variant="outline" size="sm">Volver a Pagos</Button>
        </Link>
      </div>
    );
  }

  const events = attempt.events ?? [];
  const isVerified = attempt.status === "VERIFIED" || attempt.status === "MANUAL_VERIFIED";
  const isPartialManual = attempt.status === "MANUAL_VERIFIED" && balance != null && (balance.remaining ?? 0) > 0;

  // Acciones de revisión (override del arrendador, docs/CONTRATOS_API.md §2.7)
  const canApprove = !isVerified;
  const canReject = attempt.status !== "REJECTED";

  const manualRows: Array<[string, string]> = attempt.source === "MANUAL"
    ? ([
        attempt.amount != null ? ["Monto", formatMoney(attempt.amount)] : null,
        attempt.paymentMethod ? ["Método de pago", METHOD_LABELS[attempt.paymentMethod]] : null,
        attempt.paymentDate ? ["Fecha de pago", formatDay(attempt.paymentDate)] : null,
        attempt.billingPeriod ? ["Periodo", attempt.billingPeriod] : null,
        attempt.note ? ["Nota", attempt.note] : null,
      ].filter(Boolean) as Array<[string, string]>)
    : [];

  return (
    <div className="space-y-5">

      {/* Hero */}
      <div
        className="bg-white rounded-2xl overflow-hidden border border-slate-200/80"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
      >
        <div className="px-4 pt-4 pb-5 sm:px-6 sm:pt-5 sm:pb-6">
          <div className="flex items-start gap-3 mb-5">
            <Link href="/pagos">
              <button className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors mt-0.5 shrink-0">
                <ArrowLeft className="w-4 h-4 text-slate-600" />
              </button>
            </Link>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-slate-400 uppercase tracking-widest font-semibold mb-1">Intento de pago</p>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-[22px] font-bold text-[#0B1426] leading-tight">#{attempt.id}</h1>
                {isPartialManual
                  ? <span className="inline-flex items-center border text-[11px] font-semibold px-2.5 py-[3px] rounded-full whitespace-nowrap bg-amber-100 border-amber-300 text-amber-700">Abono (manual)</span>
                  : <AttemptStatusBadge status={attempt.status} />
                }
                {attempt.verifiedOnFirstTry && (
                  <span className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold px-2.5 py-[3px] rounded-full">
                    <ShieldCheck className="w-3 h-3" /> Verificado a la primera
                  </span>
                )}
              </div>
              <p className="text-[13px] text-slate-400 mt-1.5 font-mono">{attempt.tenantPhone}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-[11px] text-slate-400 uppercase tracking-widest font-semibold mb-1">Recibido</p>
              <p className="text-[14px] font-semibold text-[#0B1426]">
                {format(new Date(attempt.createdAt), "dd 'de' MMMM yyyy", { locale: es })}
              </p>
              <p className="text-[12px] text-slate-400 mt-0.5 font-mono">
                {format(new Date(attempt.createdAt), "HH:mm:ss")}
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-[11px] text-slate-400 uppercase tracking-widest font-semibold mb-1">Resultado</p>
              <p className={cn("text-[14px] font-semibold", isVerified ? "text-emerald-600" : "text-slate-400")}>
                {isVerified ? "Comprobante válido" : "Sin verificar"}
              </p>
              <p className="text-[12px] text-slate-400 mt-0.5">{events.length} evento{events.length !== 1 ? "s" : ""}</p>
            </div>
          </div>

          {(canApprove || canReject) && (
            <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-slate-100">
              <p className="text-[11px] text-slate-400 uppercase tracking-widest font-semibold mr-auto">Revisión</p>
              {canApprove && (
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setReviewAction("APPROVE")}>
                  <ShieldCheck className="w-3.5 h-3.5" /> Aprobar
                </Button>
              )}
              {canReject && (
                <Button size="sm" variant="destructive" onClick={() => setReviewAction("REJECT")}>
                  <ShieldX className="w-3.5 h-3.5" /> Rechazar
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Balance del periodo — PARTIAL y MANUAL_VERIFIED parcial */}
      {(attempt.status === "PARTIAL" || isPartialManual) && balance && (
        <div
          className="bg-white rounded-2xl border border-slate-200/80 p-5"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-sky-50 flex items-center justify-center shrink-0">
              <HandCoins className="w-3.5 h-3.5 text-sky-600" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-[#0B1426]">Saldo del periodo · {balance.period}</p>
              <p className="text-[11px] text-slate-400">Este intento es un abono — se acumula con otros pagos del mes</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-end justify-between text-[13px]">
              <span className="text-slate-500">Pagado</span>
              <span className="font-bold text-[#0B1426]">
                {formatMoney(balance.paid)}
                {balance.expected != null && (
                  <span className="text-slate-400 font-normal"> de {formatMoney(balance.expected)}</span>
                )}
              </span>
            </div>
            {balance.expected != null && balance.expected > 0 && (
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-sky-400 transition-all duration-700"
                  style={{ width: `${Math.min(100, Math.round((balance.paid / balance.expected) * 100))}%` }}
                />
              </div>
            )}
            {balance.remaining != null && balance.remaining > 0 && (
              <p className="text-[12px] text-amber-600 font-medium">
                Faltan {formatMoney(balance.remaining)} para completar la renta
              </p>
            )}
          </div>
        </div>
      )}

      {/* Datos capturados a mano (source MANUAL) */}
      {attempt.source === "MANUAL" && (
        <div
          className="bg-white rounded-2xl border border-slate-200/80 p-5"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-[#eef1fd] flex items-center justify-center shrink-0">
              <HandCoins className="w-3.5 h-3.5 text-[#2952F3]" />
            </div>
            <p className="text-[13px] font-semibold text-[#0B1426]">Registro manual</p>
          </div>
          {manualRows.length > 0 ? (
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200/80 overflow-hidden">
              {manualRows.map(([label, value]) => (
                <div key={label} className="flex items-start gap-3 px-4 py-2.5 bg-white">
                  <span className="text-[12px] text-slate-400 min-w-[140px] shrink-0">{label}</span>
                  <span className="text-[13px] font-medium text-[#0B1426] break-all">{value}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-slate-400">Sin datos capturados</p>
          )}
        </div>
      )}

      {/* Datos del comprobante + línea de tiempo en dos columnas */}
      <div className={cn(
        "grid gap-4 items-start",
        (attempt.ocrData || attempt.cepResponse) ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
      )}>
        {/* Columna izquierda: OCR + CEP apilados */}
        {(attempt.ocrData || attempt.cepResponse) && (
          <div className="space-y-4">
            {attempt.ocrData && (
              <div
                className="bg-white rounded-2xl border border-slate-200/80 p-5"
                style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-[#eef1fd] flex items-center justify-center shrink-0">
                    <ScanLine className="w-3.5 h-3.5 text-[#2952F3]" />
                  </div>
                  <p className="text-[13px] font-semibold text-[#0B1426]">Datos del comprobante</p>
                </div>
                <DataSection data={attempt.ocrData} />
              </div>
            )}
            {attempt.cepResponse && (
              <div
                className="bg-white rounded-2xl border border-slate-200/80 p-5"
                style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-[#ecfdf5] flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#047857]" />
                  </div>
                  <p className="text-[13px] font-semibold text-[#0B1426]">Verificación de transferencia</p>
                </div>
                <DataSection data={attempt.cepResponse} />
              </div>
            )}
          </div>
        )}

        {/* Columna derecha: línea de tiempo */}
        <div
          className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
        >
          <div className="px-4 sm:px-6 py-4 border-b border-slate-100">
            <p className="text-[14px] font-semibold text-[#0B1426]">Línea de tiempo</p>
            <p className="text-[12px] text-slate-400 mt-0.5">{events.length} evento{events.length !== 1 ? "s" : ""} registrado{events.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="p-4 sm:p-6">
            {events.length === 0 ? (
              <p className="text-[13px] text-slate-400 text-center py-4">Sin eventos registrados</p>
            ) : (
              <div className="relative">
                <div className="absolute left-5 top-5 bottom-5 w-px bg-slate-100" />
                <div className="space-y-1">
                  {events.map((ev, i) => {
                    const meta = getEventMeta(ev.event);
                    const Icon = meta.icon;
                    const isLast = i === events.length - 1;
                    return (
                      <div key={ev.id} className="relative flex gap-4">
                        <div className={cn("relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center", meta.color)}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className={cn("flex-1 pb-4", isLast && "pb-0")}>
                          <div className="flex items-center justify-between gap-2 pt-2.5">
                            <span className="text-[13px] font-semibold text-[#0B1426]">{meta.label}</span>
                            <span className="text-[11px] text-slate-400 tabular-nums shrink-0 font-mono">
                              {format(new Date(ev.createdAt), "HH:mm:ss")}
                            </span>
                          </div>
                          {ev.event === "MEDIA_RECEIVED" && (
                            attempt.imageMediaId
                              ? <ImageViewer attemptId={attempt.id} />
                              : <p className="mt-1.5 text-[11px] text-slate-400">Imagen no disponible (pago de prueba)</p>
                          )}
                          {ev.data && Object.keys(ev.data).length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {Object.entries(ev.data)
                                .filter(([key, v]) => {
                                  if (!isPrimitive(v) || HIDDEN_KEYS.has(key)) return false;
                                  // `error` es diagnóstico interno (puede venir en inglés, de una
                                  // librería externa) — cuando el evento ya trae `reason` en español
                                  // para el mismo caso, se prioriza y se oculta `error` (recomendación
                                  // del backend, rent-collector-sync.md 2026-08-05T01:55).
                                  if (key === "error" && isPrimitive(ev.data?.reason)) return false;
                                  return true;
                                })
                                .map(([key, value]) => (
                                  <span key={key} className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-600 rounded-md px-2 py-0.5">
                                    <span className="text-slate-400">{fieldLabel(key)}:</span> {formatEventValue(key, value as string | number | boolean)}
                                  </span>
                                ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {reviewAction && (
        <ReviewDialog
          key={reviewAction}
          attempt={attempt}
          action={reviewAction}
          onClose={() => setReviewAction(null)}
          onDone={(updated) =>
            setAttempt((prev) =>
              prev
                ? {
                    ...prev,
                    ...updated,
                    // La respuesta del review puede venir sin relaciones: conserva las locales.
                    events: updated.events?.length ? updated.events : prev.events,
                    tenant: updated.tenant ?? prev.tenant,
                  }
                : updated
            )
          }
        />
      )}
    </div>
  );
}

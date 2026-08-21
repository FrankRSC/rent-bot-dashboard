"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ScanLine, CheckCircle2, AlertCircle, XCircle, Loader2, Upload, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useStore } from "@/store/useStore";
import * as api from "@/lib/api";
import { cn, formatCurrency } from "@/lib/utils";
import { fieldLabel } from "@/lib/field-labels";
import type {
  ManualPaymentMethod,
  OcrData,
  PeriodBalance,
  ReceiptFields,
  ReceiptValidationResult,
  Tenant,
} from "@/lib/types";

// ── Constants ─────────────────────────────────────────────────────────────────

// Solo lo que este formulario dice distinto al catálogo compartido: en un input
// conviene aclarar la moneda. El resto sale de @/lib/field-labels.
const FIELD_LABELS: Record<string, string> = {
  monto: "Monto (MXN)",
};

const FIELD_ORDER = ["monto", "fecha", "billingPeriod", "claveRastreo", "bancoEmisor"];

const METHOD_OPTIONS: Array<{ value: ManualPaymentMethod; label: string }> = [
  { value: "EFECTIVO",      label: "Efectivo" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
  { value: "DEPOSITO",      label: "Depósito" },
  { value: "OTRO",          label: "Otro" },
];

const todayISO  = () => new Date().toISOString().slice(0, 10);
const currentYM = () => todayISO().slice(0, 7);

function tenantDefaultPeriod(tenant: Tenant): string {
  const now = currentYM();
  if (!tenant.lastPaymentDate) return now;
  const lastPaidMonth = tenant.lastPaymentDate.slice(0, 7);
  if (lastPaidMonth >= now) {
    const [y, m] = now.split("-").map(Number);
    return m === 12
      ? `${y + 1}-01`
      : `${y}-${String(m + 1).padStart(2, "0")}`;
  }
  return now;
}

// ── OCR helpers ───────────────────────────────────────────────────────────────

function extractOcrToFields(data: OcrData): Record<string, string> {
  const out: Record<string, string> = {};
  if (data.monto != null)        out.monto         = String(data.monto);
  if (data.fecha)                out.fecha         = data.fecha;
  if (data.bancoEmisor)          out.bancoEmisor   = data.bancoEmisor;
  if (data.claveRastreo)         out.claveRastreo  = data.claveRastreo;
  if (data.referencia)           out.referencia    = data.referencia;
  return out;
}

function toReceiptFields(values: Record<string, string>): ReceiptFields {
  const fields: Record<string, string | number> = {};
  Object.entries(values).forEach(([k, v]) => {
    const t = v.trim();
    if (t) fields[k] = k === "monto" ? parseFloat(t) : t;
  });
  return fields as ReceiptFields;
}

// ── Success panel ─────────────────────────────────────────────────────────────

function SuccessPanel({ balance }: { balance: PeriodBalance }) {
  const pagado = balance.status === "PAGADO";
  return (
    <div className="py-6 text-center space-y-3">
      <div className={cn(
        "w-12 h-12 rounded-full mx-auto flex items-center justify-center",
        pagado ? "bg-emerald-50" : "bg-amber-50"
      )}>
        {pagado
          ? <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          : <Clock className="w-6 h-6 text-amber-500" />
        }
      </div>
      <div>
        <p className="text-[15px] font-semibold text-[#0B1426]">
          {pagado ? "Renta del periodo cubierta" : "Abono registrado"}
        </p>
        <p className="text-[13px] text-slate-500 mt-0.5">
          {balance.tenantName} · periodo {balance.period}
        </p>
      </div>
      {pagado && balance.expected != null && (
        <p className="text-[13px] text-emerald-600 font-medium">
          {formatCurrency(balance.expected)}
        </p>
      )}
      {!pagado && balance.remaining != null && balance.remaining > 0 && (
        <p className="text-[13px] text-amber-600 font-medium">
          Restan {formatCurrency(balance.remaining)}
        </p>
      )}
    </div>
  );
}

// ── Dialog ────────────────────────────────────────────────────────────────────

type Phase = "idle" | "processing" | "ocr_review" | "manual" | "complete" | "error";

export function PaymentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { allTenants, fetchPayments, fetchAllTenants } = useStore();

  // Shared
  const [phase,    setPhase]   = useState<Phase>("idle");
  const [tenantId, setTenantId]= useState("");
  const [error,    setError]   = useState<string | null>(null);
  const [balance,  setBalance] = useState<PeriodBalance | null>(null);
  const [busy,     setBusy]    = useState(false);

  // OCR
  const [file,      setFile]     = useState<File | null>(null);
  const [ocrResult, setOcrResult]= useState<ReceiptValidationResult | null>(null);
  const [ocrFields, setOcrFields]= useState<Record<string, string>>({});

  // Manual
  const [amount,        setAmount]        = useState("");
  const [method,        setMethod]        = useState<ManualPaymentMethod>("EFECTIVO");
  const [paymentDate,   setPaymentDate]   = useState(todayISO());
  const [billingPeriod, setBillingPeriod] = useState(currentYM());
  const [note,          setNote]          = useState("");
  const [balanceHint,   setBalanceHint]   = useState<PeriodBalance | null>(null);

  const ocrBillingPeriod = ocrFields.billingPeriod ?? "";

  // Month options: 3 months back → 2 months forward (6 total)
  const periodOptions = useMemo(() => {
    const MES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    const [y, m] = currentYM().split("-").map(Number);
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(y, m - 1 + (i - 2), 1);
      const yy = d.getFullYear();
      const mm = d.getMonth() + 1;
      return {
        value: `${yy}-${String(mm).padStart(2, "0")}`,
        label: `${MES[d.getMonth()]} ${yy}`,
      };
    });
  }, []);

  // Fetch balance hint in manual and ocr_review modes to detect already-paid periods.
  // No se limpia el hint de forma síncrona aquí: `hint` (más abajo) ya lo descarta
  // en render si no corresponde al inquilino y periodo activos.
  useEffect(() => {
    const period = phase === "manual" ? billingPeriod : ocrBillingPeriod;
    if ((phase !== "manual" && phase !== "ocr_review") || !tenantId || !/^\d{4}-\d{2}$/.test(period)) {
      return;
    }
    let cancelled = false;
    api.getPeriodBalance(tenantId, period)
      .then((b) => { if (!cancelled) setBalanceHint(b); })
      .catch(() => { if (!cancelled) setBalanceHint(null); });
    return () => { cancelled = true; };
  }, [phase, tenantId, billingPeriod, ocrBillingPeriod]);

  const reset = () => {
    setPhase("idle");
    setTenantId("");
    setError(null);
    setBalance(null);
    setBusy(false);
    setFile(null);
    setOcrResult(null);
    setOcrFields({});
    setAmount("");
    setMethod("EFECTIVO");
    setPaymentDate(todayISO());
    setBillingPeriod(currentYM());
    setNote("");
    setBalanceHint(null);
  };

  const handleClose = () => {
    if (phase === "processing" || busy) return;
    reset();
    onClose();
  };

  // ── OCR path ──────────────────────────────────────────────────────────────

  const applyOcrResult = async (r: ReceiptValidationResult) => {
    setOcrResult(r);
    const extracted = "data" in r && r.data ? extractOcrToFields(r.data) : {};
    if (!extracted.billingPeriod) {
      const tenant = allTenants.find((t) => String(t.id) === tenantId);
      extracted.billingPeriod = tenant ? tenantDefaultPeriod(tenant) : currentYM();
    }
    setOcrFields(extracted);
    if (r.status === "VERIFIED") {
      await Promise.all([fetchPayments(), fetchAllTenants()]);
      setBalance(r.balance);
      setPhase("complete");
    } else if (r.status === "INCOMPLETE" || r.status === "REJECTED" || r.status === "ERROR") {
      setPhase("ocr_review");
    } else {
      setPhase("error");
    }
  };

  const runOcr = async (tid: string, f: File) => {
    setPhase("processing");
    setError(null);
    try {
      await applyOcrResult(await api.uploadReceipt(tid, f));
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  };

  const handleFileChange = (f: File) => {
    setFile(f);
    if (tenantId) runOcr(tenantId, f);
  };

  const handleTenantChange = (id: string | null) => {
    if (!id) return;
    setTenantId(id);
    setError(null);
    if (file) runOcr(id, file);
  };

  const isRejected    = ocrResult?.status === "REJECTED" || ocrResult?.status === "ERROR";
  const missingFields = ocrResult?.status === "INCOMPLETE" ? ocrResult.missingFields : [];
  const missingFilled = isRejected || (missingFields.length > 0 && missingFields.every((f) => (ocrFields[f] ?? "").trim() !== ""));
  const setOcrField   = (key: string, val: string) => setOcrFields((p) => ({ ...p, [key]: val }));

  const handleOcrConfirm = async () => {
    if (!ocrResult || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (ocrResult.status === "INCOMPLETE") {
        await applyOcrResult(
          await api.completeReceiptValidation(ocrResult.attemptId, toReceiptFields(ocrFields))
        );
      } else {
        // REJECTED / ERROR → aprobación manual del arrendador
        const { balance: b } = await api.reviewAttempt(ocrResult.attemptId, {
          action: "APPROVE",
          billingPeriod: ocrFields.billingPeriod || undefined,
        });
        await Promise.all([fetchPayments(), fetchAllTenants()]);
        setBalance(b ?? null);
        setPhase("complete");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // ── Manual path ───────────────────────────────────────────────────────────

  const handleManualClick = () => {
    if (!tenantId) { setError("Selecciona primero un inquilino."); return; }
    setError(null);
    const tenant = allTenants.find((t) => String(t.id) === tenantId);
    setBillingPeriod(tenant ? tenantDefaultPeriod(tenant) : currentYM());
    setPhase("manual");
  };

  const amountNum      = parseFloat(amount);
  const activePeriod   = phase === "manual" ? billingPeriod : ocrBillingPeriod;
  const hint           = balanceHint &&
    String(balanceHint.tenantId) === tenantId &&
    balanceHint.period === activePeriod ? balanceHint : null;
  const periodAlreadyPaid = hint?.status === "PAGADO";
  const canSubmitManual= !!tenantId && !Number.isNaN(amountNum) && amountNum > 0 && !busy && !periodAlreadyPaid;

  const handleManualSubmit = async () => {
    if (!canSubmitManual) return;
    setBusy(true);
    setError(null);
    try {
      const { balance: b } = await api.registerManualPayment({
        tenantId,
        amount:        amountNum,
        paymentMethod: method,
        paymentDate:   paymentDate || undefined,
        billingPeriod: /^\d{4}-\d{2}$/.test(billingPeriod) ? billingPeriod : undefined,
        note:          note.trim() || undefined,
      });
      setBalance(b);
      await Promise.all([fetchPayments(), fetchAllTenants()]);
      setPhase("complete");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // ── Tenant name helper ────────────────────────────────────────────────────

  const tenantName = allTenants.find((t) => String(t.id) === tenantId)?.name ?? "";

  const TITLES: Record<Phase, string> = {
    idle:       "Registrar pago",
    processing: "Registrar pago",
    ocr_review: "Revisar comprobante",
    manual:     "Registrar pago",
    complete:   "Pago registrado",
    error:      "Registrar pago",
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{TITLES[phase]}</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 min-h-0 px-4 pb-2">

          {/* ── Idle: elegir comprobante o a mano ── */}
          {phase === "idle" && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-[#0B1426]">Inquilino</label>
                <Select value={tenantId} onValueChange={handleTenantChange}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar inquilino" /></SelectTrigger>
                  <SelectContent>
                    {allTenants.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <label
                htmlFor="pd-file"
                className={cn(
                  "flex flex-col items-center justify-center gap-2.5 border-2 border-dashed rounded-xl px-4 py-7 cursor-pointer transition-colors select-none",
                  file
                    ? "border-[#2952F3]/50 bg-[#eef1fd]/60"
                    : "border-slate-200 hover:border-[#2952F3]/40 hover:bg-[#eef1fd]/30"
                )}
              >
                {file ? (
                  <>
                    <ScanLine className="w-5 h-5 text-[#2952F3]" />
                    <span className="text-[13px] text-[#2952F3] font-medium text-center break-all leading-tight">
                      {file.name}
                    </span>
                    {!tenantId && (
                      <span className="text-[12px] text-slate-400">Selecciona el inquilino para analizar</span>
                    )}
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5 text-slate-400" />
                    <span className="text-[13px] text-slate-600 font-medium">Adjuntar comprobante</span>
                    <span className="text-[12px] text-slate-400">Los datos se detectan automáticamente</span>
                  </>
                )}
              </label>
              <input
                id="pd-file"
                type="file"
                accept="image/*,.pdf"
                className="sr-only"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileChange(f); }}
              />

              <div className="flex items-center gap-3">
                <div className="h-px bg-slate-200 flex-1" />
                <span className="text-[12px] text-slate-400">o</span>
                <div className="h-px bg-slate-200 flex-1" />
              </div>

              <button
                onClick={handleManualClick}
                className="w-full h-9 text-[13px] font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Ingresar datos a mano
              </button>

              {error && <p className="text-[12px] text-red-600">{error}</p>}
            </div>
          )}

          {/* ── Analizando con OCR ── */}
          {phase === "processing" && (
            <div className="py-8 flex flex-col items-center gap-3 text-center">
              <div className="w-14 h-14 rounded-full bg-[#eef1fd] flex items-center justify-center">
                <Loader2 className="w-7 h-7 text-[#2952F3] animate-spin" />
              </div>
              <p className="text-[15px] font-semibold text-[#0B1426]">Analizando comprobante…</p>
              <p className="text-[12px] text-slate-400 max-w-[200px] leading-relaxed">
                Los datos del comprobante se detectan y verifican automáticamente
              </p>
            </div>
          )}

          {/* ── Revisión: incompleto / rechazado / error parcial ── */}
          {phase === "ocr_review" && (ocrResult?.status === "INCOMPLETE" || ocrResult?.status === "REJECTED" || ocrResult?.status === "ERROR") && (
            <div className="py-2 space-y-3">
              {isRejected ? (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                  <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-[12px] text-red-700 leading-snug">
                    {(ocrResult?.status === "REJECTED" || ocrResult?.status === "ERROR") && ocrResult.message
                      ? ocrResult.message
                      : "No se pudo validar el comprobante automáticamente."}{" "}
                    Revisa los datos y decide si apruebas el pago a mano.
                  </p>
                </div>
              ) : (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[12px] text-amber-700 leading-snug">
                    Se detectaron los datos del comprobante. Completa los campos marcados y confirma.
                  </p>
                </div>
              )}
              <div className="space-y-3">
                {ocrResult?.status === "ERROR" && ocrResult.data?.cuentaDestino && (
                  // Solo para ERROR: el mensaje ("no se pudo leer la cuenta destino") no trae
                  // la cuenta esperada, a diferencia de REJECTED cuyo mensaje ya incluye ambos
                  // valores enmascarados inline. `data.cuentaDestino` es la cuenta esperada/
                  // registrada del tenant (con su fallback al arrendador); `data.ocrCuentaDestino`
                  // es lo que el OCR leyó del comprobante — aquí siempre viene vacío cuando cae
                  // en este ERROR específico (confirmado con el backend, rent-collector-sync.md
                  // 2026-08-04T22:35), por eso no se muestra como campo aparte.
                  <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                    <p className="text-[12px] text-slate-600 leading-snug font-mono">
                      Esperábamos: {ocrResult.data.cuentaDestino} · El comprobante decía: {ocrResult.data.ocrCuentaDestino || "—"}
                    </p>
                  </div>
                )}
                {FIELD_ORDER.map((key) => {
                  const isMissing = missingFields.includes(key);
                  const val = ocrFields[key] ?? "";
                  if (!isRejected && !isMissing && !val) return null;
                  return (
                    <div key={key} className="space-y-1.5">
                      <label className="text-[13px] font-medium flex items-center justify-between gap-2">
                        <span>{fieldLabel(key, FIELD_LABELS)}</span>
                        {isMissing && (
                          <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-px shrink-0">
                            Requerido
                          </span>
                        )}
                      </label>
                      {key === "billingPeriod" ? (
                        <Select value={val} onValueChange={(v) => { if (v) setOcrField(key, v); }}>
                          <SelectTrigger className={cn("h-9", isMissing && !val && "border-amber-300 focus-visible:ring-amber-200")}>
                            <SelectValue placeholder="Seleccionar periodo" />
                          </SelectTrigger>
                          <SelectContent>
                            {periodOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          type={key === "monto" ? "number" : key === "fecha" ? "date" : "text"}
                          value={val}
                          onChange={(e) => setOcrField(key, e.target.value)}
                          className={cn("h-9", isMissing && !val && "border-amber-300 focus-visible:ring-amber-200")}
                          placeholder={isMissing ? "Requerido" : undefined}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              {periodAlreadyPaid && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <p className="text-[12px] text-emerald-700 font-medium">
                    El periodo {ocrBillingPeriod} ya está cubierto para este inquilino.
                  </p>
                </div>
              )}
              {error && (
                <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
              )}
            </div>
          )}

          {/* ── Formulario manual ── */}
          {phase === "manual" && (
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between">
                <p className="text-[13px] text-slate-500">
                  Pago para: <span className="font-semibold text-[#0B1426]">{tenantName}</span>
                </p>
                <button onClick={() => { setPhase("idle"); setError(null); }} className="text-[12px] text-[#2952F3] hover:underline">
                  Cambiar
                </button>
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium">Monto (MXN)</label>
                <Input
                  type="number" min="0" step="0.01" placeholder="0.00"
                  value={amount} onChange={(e) => setAmount(e.target.value)}
                />
                {amount !== "" && (Number.isNaN(amountNum) || amountNum <= 0) && (
                  <p className="text-[12px] text-red-600">El monto debe ser mayor a 0.</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium">Método de pago</label>
                <Select value={method} onValueChange={(v) => setMethod((v as ManualPaymentMethod) ?? "EFECTIVO")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {METHOD_OPTIONS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium">Fecha</label>
                <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium">Periodo de renta</label>
                <Select value={billingPeriod} onValueChange={(v) => { if (v) setBillingPeriod(v); }}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar periodo" /></SelectTrigger>
                  <SelectContent>
                    {periodOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {hint && (
                hint.status === "PAGADO" ? (
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <p className="text-[12px] text-emerald-700 font-medium">
                      Este periodo ya está cubierto{hint.expected != null ? ` (${formatCurrency(hint.expected)})` : ""}
                    </p>
                  </div>
                ) : hint.remaining != null && hint.remaining > 0 ? (
                  <p className="text-[12px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    Pendiente del periodo: <span className="font-semibold text-[#0B1426]">{formatCurrency(hint.remaining)}</span>
                  </p>
                ) : null
              )}
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium">Nota (opcional)</label>
                <Input placeholder="Ej. Pagó en efectivo el día 5" value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              {error && (
                <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
              )}
            </div>
          )}

          {/* ── Éxito ── */}
          {phase === "complete" && (
            balance ? <SuccessPanel balance={balance} /> : (
              <div className="py-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center bg-emerald-50">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
                <p className="text-[15px] font-semibold text-[#0B1426]">Pago registrado</p>
              </div>
            )
          )}

          {/* ── Error / rechazo ── */}
          {phase === "error" && (
            <div className="py-2">
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 space-y-1.5">
                <p className="flex items-center gap-2 text-[14px] font-semibold text-red-600">
                  {ocrResult?.status === "REJECTED"
                    ? <XCircle className="w-4 h-4 shrink-0" />
                    : <AlertCircle className="w-4 h-4 shrink-0" />}
                  {ocrResult?.status === "REJECTED" ? "Comprobante rechazado" : "No se pudo procesar"}
                </p>
                <p className="text-[13px] text-red-600">
                  {ocrResult && "message" in ocrResult
                    ? String(ocrResult.message)
                    : error ?? "Ocurrió un error al procesar."}
                </p>
              </div>
            </div>
          )}

        </div>

        {/* ── Footer ── */}
        <DialogFooter>
          {phase === "idle" && (
            <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          )}
          {phase === "processing" && (
            <Button variant="outline" disabled>Cancelar</Button>
          )}
          {phase === "ocr_review" && (
            <>
              <Button variant="outline" onClick={handleClose} disabled={busy}>Cerrar</Button>
              <Button
                onClick={handleOcrConfirm}
                disabled={!missingFilled || busy || periodAlreadyPaid}
                className="bg-[#2952F3] hover:bg-[#1e3fd4]"
              >
                {busy
                  ? (isRejected ? "Aprobando…" : "Validando…")
                  : (isRejected ? "Aprobar igualmente" : "Confirmar datos")
                }
              </Button>
            </>
          )}
          {phase === "manual" && (
            <>
              <Button variant="outline" onClick={handleClose} disabled={busy}>Cancelar</Button>
              <Button
                onClick={handleManualSubmit}
                disabled={!canSubmitManual}
                className="bg-[#2952F3] hover:bg-[#1e3fd4]"
              >
                {busy ? "Registrando…" : "Registrar pago"}
              </Button>
            </>
          )}
          {phase === "complete" && (
            <Button onClick={handleClose} className="bg-[#2952F3] hover:bg-[#1e3fd4]">Cerrar</Button>
          )}
          {phase === "error" && (
            <>
              <Button variant="outline" onClick={handleClose}>Cerrar</Button>
              <Button
                onClick={() => { setPhase("idle"); setOcrResult(null); setError(null); setFile(null); }}
                className="bg-[#2952F3] hover:bg-[#1e3fd4]"
              >
                Reintentar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

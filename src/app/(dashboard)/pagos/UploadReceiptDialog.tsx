"use client";

import { useState } from "react";
import { ScanLine, CheckCircle2, AlertCircle, XCircle, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useStore } from "@/store/useStore";
import * as api from "@/lib/api";
import { cn, formatCurrency } from "@/lib/utils";
import { fieldLabel } from "@/lib/field-labels";
import type { PeriodBalance, ReceiptFields, ReceiptValidationResult } from "@/lib/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

// Solo lo que este formulario dice distinto al catálogo compartido: en un input
// conviene aclarar la moneda. El resto sale de @/lib/field-labels.
const FIELD_LABELS: Record<string, string> = {
  monto: "Monto (MXN)",
};

const FIELD_ORDER = ["monto", "fecha", "billingPeriod", "claveRastreo", "bancoEmisor", "bancoReceptor", "cuentaDestino"];

// Maps named OcrData fields (typed) to ReceiptFields keys used in the completion form.
function extractOcrToFields(data: import("@/lib/types").OcrData): Record<string, string> {
  const out: Record<string, string> = {};
  if (data.monto != null)         out.monto         = String(data.monto);
  if (data.fecha)                 out.fecha         = data.fecha;
  if (data.bancoEmisor)           out.bancoEmisor   = data.bancoEmisor;
  if (data.bancoReceptor)         out.bancoReceptor = data.bancoReceptor;
  if (data.claveRastreo)          out.claveRastreo  = data.claveRastreo;
  if (data.cuentaDestino)         out.cuentaDestino = data.cuentaDestino;
  if (data.referencia)            out.referencia    = data.referencia;
  return out;
}

function toReceiptFields(values: Record<string, string>): ReceiptFields {
  const fields: Record<string, string | number> = {};
  Object.entries(values).forEach(([key, value]) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    fields[key] = key === "monto" ? parseFloat(trimmed) : trimmed;
  });
  return fields as ReceiptFields;
}

function BalanceLine({ balance }: { balance: PeriodBalance }) {
  if (balance.status === "PAGADO") {
    return <p className="text-[13px] text-emerald-700 font-medium">Renta del periodo {balance.period} cubierta ({formatCurrency(balance.paid)}).</p>;
  }
  if (balance.status === "PARCIAL") {
    return (
      <p className="text-[13px] text-emerald-700">
        Abono aplicado al periodo {balance.period}.{" "}
        {balance.remaining != null && <span className="font-medium">Restan {formatCurrency(balance.remaining)}.</span>}
      </p>
    );
  }
  return <p className="text-[13px] text-emerald-700">Periodo {balance.period}: {formatCurrency(balance.paid)} abonados.</p>;
}

// ── Dialog ────────────────────────────────────────────────────────────────────

type Phase = "idle" | "processing" | "review" | "complete" | "error";

export function UploadReceiptDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { allTenants, fetchPayments, fetchAllTenants } = useStore();

  const [phase, setPhase] = useState<Phase>("idle");
  const [tenantId, setTenantId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ReceiptValidationResult | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setPhase("idle");
    setTenantId("");
    setFile(null);
    setResult(null);
    setFields({});
    setCompleting(false);
    setError(null);
  };

  const handleClose = () => {
    if (phase === "processing" || completing) return;
    reset();
    onClose();
  };

  // Pre-llena `fields` con lo que el OCR extrajo del comprobante.
  const applyResult = async (r: ReceiptValidationResult) => {
    setResult(r);

    setFields("data" in r && r.data ? extractOcrToFields(r.data) : {});

    if (r.status === "VERIFIED") {
      await Promise.all([fetchPayments(), fetchAllTenants()]);
      setPhase("complete");
    } else if (r.status === "INCOMPLETE") {
      setPhase("review");
    } else {
      setPhase("error");
    }
  };

  const runOcr = async (tid: string, f: File) => {
    setPhase("processing");
    setError(null);
    setResult(null);
    setFields({});
    try {
      const r = await api.uploadReceipt(tid, f);
      await applyResult(r);
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
    if (file) runOcr(id, file);
  };

  const handleComplete = async () => {
    if (!result || result.status !== "INCOMPLETE" || completing) return;
    setCompleting(true);
    setError(null);
    try {
      const r = await api.completeReceiptValidation(result.attemptId, toReceiptFields(fields));
      await applyResult(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCompleting(false);
    }
  };

  const handleRetry = () => {
    setFile(null);
    setResult(null);
    setFields({});
    setError(null);
    setPhase("idle");
  };

  const missingFields = result?.status === "INCOMPLETE" ? result.missingFields : [];
  const missingComplete = missingFields.length > 0 && missingFields.every(f => (fields[f] ?? "").trim() !== "");

  const setField = (key: string, value: string) =>
    setFields(prev => ({ ...prev, [key]: value }));

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Subir comprobante</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 min-h-0 px-4 pb-2">

          {/* ── OCR en proceso ── */}
          {phase === "processing" && (
            <div className="py-8 flex flex-col items-center gap-3 text-center">
              <div className="w-14 h-14 rounded-full bg-[#eef1fd] flex items-center justify-center">
                <Loader2 className="w-7 h-7 text-[#2952F3] animate-spin" />
              </div>
              <p className="text-[15px] font-semibold text-[#0B1426]">Analizando comprobante…</p>
              <p className="text-[12px] text-slate-400 leading-relaxed max-w-[200px]">
                El sistema extrae los datos con OCR y verifica el pago en Banxico
              </p>
            </div>
          )}

          {/* ── Verificado ── */}
          {phase === "complete" && result?.status === "VERIFIED" && (
            <div className="py-2 space-y-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 space-y-2">
                <p className="flex items-center gap-2 text-[14px] font-semibold text-emerald-700">
                  <CheckCircle2 className="w-4 h-4 shrink-0" /> Comprobante verificado
                </p>
                {result.data.monto != null && (
                  <p className="text-[13px] text-emerald-700">
                    Monto: <span className="font-semibold tabular-nums">{formatCurrency(Number(result.data.monto))}</span>
                  </p>
                )}
                {result.data.fecha && (
                  <p className="text-[13px] text-emerald-700">Fecha: {result.data.fecha}</p>
                )}
                {result.data.bancoEmisor && (
                  <p className="text-[13px] text-emerald-700">Banco: {result.data.bancoEmisor}</p>
                )}
                <div className="pt-1 border-t border-emerald-100">
                  <BalanceLine balance={result.balance} />
                </div>
              </div>
            </div>
          )}

          {/* ── INCOMPLETE: campos extraídos pre-llenados + faltantes ── */}
          {phase === "review" && result?.status === "INCOMPLETE" && (
            <div className="py-2 space-y-3">
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[12px] text-amber-700 leading-snug">
                  OCR extrajo los datos del comprobante. Completa los campos marcados y confirma.
                </p>
              </div>
              <div className="space-y-3">
                {FIELD_ORDER.map(key => {
                  const isMissing = missingFields.includes(key);
                  const val = fields[key] ?? "";
                  // Mostrar solo campos que OCR encontró o que son obligatorios
                  if (!isMissing && !val) return null;
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
                      <Input
                        type={key === "monto" ? "number" : key === "fecha" ? "date" : key === "billingPeriod" ? "month" : "text"}
                        value={val}
                        onChange={e => setField(key, e.target.value)}
                        className={cn(
                          "h-9",
                          isMissing && !val ? "border-amber-300 focus-visible:ring-amber-200" : ""
                        )}
                        placeholder={isMissing ? "Requerido" : undefined}
                      />
                    </div>
                  );
                })}
              </div>
              {error && (
                <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
              )}
            </div>
          )}

          {/* ── Rechazo / error técnico ── */}
          {phase === "error" && (
            <div className="py-2 space-y-3">
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 space-y-1.5">
                <p className="flex items-center gap-2 text-[14px] font-semibold text-red-600">
                  {result?.status === "REJECTED"
                    ? <XCircle className="w-4 h-4 shrink-0" />
                    : <AlertCircle className="w-4 h-4 shrink-0" />}
                  {result?.status === "REJECTED" ? "Comprobante rechazado" : "No se pudo procesar"}
                </p>
                <p className="text-[13px] text-red-600">
                  {result && "message" in result
                    ? String(result.message)
                    : error ?? "Error al procesar el comprobante."}
                </p>
              </div>
            </div>
          )}

          {/* ── Formulario inicial ── */}
          {phase === "idle" && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-[#0B1426]">Inquilino</label>
                <Select value={tenantId} onValueChange={handleTenantChange}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar inquilino" /></SelectTrigger>
                  <SelectContent>
                    {allTenants.map(t => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-[#0B1426]">Comprobante</label>
                <label
                  htmlFor="receipt-file"
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
                      <span className="text-[13px] text-slate-600 font-medium">Seleccionar imagen o PDF</span>
                      <span className="text-[12px] text-slate-400">
                        El OCR extrae los datos automáticamente
                      </span>
                    </>
                  )}
                </label>
                <input
                  id="receipt-file"
                  type="file"
                  accept="image/*,.pdf"
                  className="sr-only"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) handleFileChange(f);
                  }}
                />
              </div>
            </div>
          )}

        </div>

        <DialogFooter>
          {phase === "complete" && (
            <Button onClick={handleClose} className="bg-[#2952F3] hover:bg-[#1e3fd4]">Cerrar</Button>
          )}
          {phase === "review" && (
            <>
              <Button variant="outline" onClick={handleClose} disabled={completing}>Cerrar</Button>
              <Button
                onClick={handleComplete}
                disabled={!missingComplete || completing}
                className="bg-[#2952F3] hover:bg-[#1e3fd4]"
              >
                {completing ? "Validando…" : "Confirmar datos"}
              </Button>
            </>
          )}
          {phase === "error" && (
            <>
              <Button variant="outline" onClick={handleClose}>Cerrar</Button>
              <Button onClick={handleRetry} className="bg-[#2952F3] hover:bg-[#1e3fd4]">Reintentar</Button>
            </>
          )}
          {phase === "idle" && (
            <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          )}
          {phase === "processing" && (
            <Button variant="outline" disabled>Cancelar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

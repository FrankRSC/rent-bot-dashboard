"use client";

import { useState, type ComponentProps } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useStore } from "@/store/useStore";
import * as api from "@/lib/api";
import { cn, formatCurrency } from "@/lib/utils";
import type { PeriodBalance, ReceiptFields, ReceiptValidationResult } from "@/lib/types";

// Labels en español para los campos de ReceiptFields (overrides y missingFields).
const FIELD_LABELS: Record<string, string> = {
  claveRastreo: "Clave de rastreo",
  referencia: "Referencia",
  monto: "Monto (MXN)",
  bancoEmisor: "Banco emisor",
  bancoReceptor: "Banco receptor",
  cuentaDestino: "Cuenta destino",
  fecha: "Fecha de la operación",
  billingPeriod: "Periodo (YYYY-MM)",
};

const fieldLabel = (f: string) => FIELD_LABELS[f] ?? f;

/** Convierte los valores capturados (strings) al shape de ReceiptFields. */
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

export function UploadReceiptDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { allTenants, fetchPayments, fetchAllTenants } = useStore();

  const [tenantId, setTenantId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [showOverrides, setShowOverrides] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [missingValues, setMissingValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ReceiptValidationResult | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTenantId("");
    setFile(null);
    setShowOverrides(false);
    setOverrides({});
    setMissingValues({});
    setResult(null);
    setError(null);
  };

  const handleClose = () => {
    if (sending) return;
    reset();
    onClose();
  };

  const applyResult = async (r: ReceiptValidationResult) => {
    setResult(r);
    setMissingValues({});
    if (r.status === "VERIFIED" || r.status === "INTRABANK_OK") {
      await Promise.all([fetchPayments(), fetchAllTenants()]);
    }
  };

  const handleUpload = async () => {
    if (!tenantId || !file || sending) return;
    setSending(true);
    setError(null);
    try {
      const r = await api.uploadReceipt(parseInt(tenantId, 10), file, toReceiptFields(overrides));
      await applyResult(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const handleComplete = async () => {
    if (!result || result.status !== "INCOMPLETE" || sending) return;
    setSending(true);
    setError(null);
    try {
      const r = await api.completeReceiptValidation(result.attemptId, toReceiptFields(missingValues));
      await applyResult(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  // Reintentar tras un rechazo o error técnico: vuelve al formulario inicial
  // conservando inquilino y archivo seleccionados.
  const handleRetry = () => {
    setResult(null);
    setError(null);
  };

  const setOverride = (key: string, value: string) =>
    setOverrides((prev) => ({ ...prev, [key]: value }));

  const overrideInput = (key: string, props?: ComponentProps<typeof Input>) => (
    <div key={key} className="space-y-1.5">
      <label className="text-[13px] font-medium">{fieldLabel(key)}</label>
      <Input value={overrides[key] ?? ""} onChange={(e) => setOverride(key, e.target.value)} {...props} />
    </div>
  );

  const isSuccess = result?.status === "VERIFIED" || result?.status === "INTRABANK_OK";
  const isRejection = result?.status === "REJECTED" || result?.status === "INTRABANK_REJECTED" || result?.status === "ERROR";
  const missingComplete =
    result?.status === "INCOMPLETE" &&
    result.missingFields.every((f) => (missingValues[f] ?? "").trim() !== "");

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Subir comprobante</DialogTitle></DialogHeader>

        <div className="overflow-y-auto flex-1 min-h-0 px-4 pb-2">

          {/* ── Éxito: VERIFIED / INTRABANK_OK ── */}
          {isSuccess && result && (result.status === "VERIFIED" || result.status === "INTRABANK_OK") && (
            <div className="py-2 space-y-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 space-y-1.5">
                <p className="flex items-center gap-2 text-[14px] font-semibold text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" /> Comprobante verificado
                </p>
                {result.data.monto != null && (
                  <p className="text-[13px] text-emerald-700">
                    Monto detectado: <span className="font-semibold">{formatCurrency(Number(result.data.monto))}</span>
                  </p>
                )}
                <BalanceLine balance={result.balance} />
              </div>
            </div>
          )}

          {/* ── INCOMPLETE: pedir solo los campos faltantes ── */}
          {result?.status === "INCOMPLETE" && (
            <div className="py-2 space-y-4">
              <p className="text-[13px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                El comprobante quedó pendiente: faltan datos para validarlo. Completa los campos y reenvía (no hace falta volver a subir el archivo).
              </p>
              {result.missingFields.map((f) => (
                <div key={f} className="space-y-1.5">
                  <label className="text-[13px] font-medium">{fieldLabel(f)}</label>
                  <Input
                    type={f === "monto" ? "number" : f === "fecha" ? "date" : f === "billingPeriod" ? "month" : "text"}
                    value={missingValues[f] ?? ""}
                    onChange={(e) => setMissingValues((prev) => ({ ...prev, [f]: e.target.value }))}
                  />
                </div>
              ))}
              {error && (
                <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
              )}
            </div>
          )}

          {/* ── Rechazo / error técnico ── */}
          {isRejection && result && "message" in result && (
            <div className="py-2 space-y-3">
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 space-y-1.5">
                <p className="flex items-center gap-2 text-[14px] font-semibold text-red-600">
                  {result.status === "ERROR" ? <AlertCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {result.status === "ERROR" ? "No se pudo validar el comprobante" : "Comprobante rechazado"}
                </p>
                <p className="text-[13px] text-red-600">{result.message}</p>
              </div>
            </div>
          )}

          {/* ── Formulario inicial ── */}
          {!result && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Inquilino</label>
                <Select value={tenantId} onValueChange={(v) => setTenantId(v ?? "")}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar inquilino" /></SelectTrigger>
                  <SelectContent>
                    {allTenants.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Comprobante (imagen o PDF)</label>
                <Input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>

              {/* Sección colapsable de overrides del OCR */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowOverrides((s) => !s)}
                  className="w-full flex items-center justify-between px-3 py-2 text-[13px] font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  Datos del comprobante (opcional)
                  <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", showOverrides && "rotate-180")} />
                </button>
                {showOverrides && (
                  <div className="p-3 space-y-3">
                    <p className="text-[12px] text-slate-400">
                      Si los capturas, estos datos sobreescriben lo que detecte el OCR.
                    </p>
                    {overrideInput("claveRastreo", { placeholder: "Ej. MBAN01002505..." })}
                    {overrideInput("monto", { type: "number", min: "0", step: "0.01", placeholder: "0.00" })}
                    {overrideInput("bancoEmisor", { placeholder: "Ej. BBVA" })}
                    {overrideInput("fecha", { type: "date" })}
                    {overrideInput("billingPeriod", { type: "month" })}
                  </div>
                )}
              </div>

              {error && (
                <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
              )}
            </div>
          )}

        </div>

        <DialogFooter>
          {isSuccess && (
            <Button onClick={handleClose} className="bg-[#2952F3] hover:bg-[#1e3fd4]">Cerrar</Button>
          )}
          {result?.status === "INCOMPLETE" && (
            <>
              <Button variant="outline" onClick={handleClose} disabled={sending}>Cerrar</Button>
              <Button onClick={handleComplete} disabled={!missingComplete || sending} className="bg-[#2952F3] hover:bg-[#1e3fd4]">
                {sending ? "Validando..." : "Reenviar datos"}
              </Button>
            </>
          )}
          {isRejection && (
            <>
              <Button variant="outline" onClick={handleClose}>Cerrar</Button>
              <Button onClick={handleRetry} className="bg-[#2952F3] hover:bg-[#1e3fd4]">Reintentar</Button>
            </>
          )}
          {!result && (
            <>
              <Button variant="outline" onClick={handleClose} disabled={sending}>Cancelar</Button>
              <Button onClick={handleUpload} disabled={!tenantId || !file || sending} className="bg-[#2952F3] hover:bg-[#1e3fd4]">
                {sending ? "Validando..." : "Subir y validar"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useStore } from "@/store/useStore";
import * as api from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import type { ManualPaymentMethod, PeriodBalance } from "@/lib/types";

const METHOD_OPTIONS: Array<{ value: ManualPaymentMethod; label: string }> = [
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
  { value: "DEPOSITO", label: "Depósito" },
  { value: "OTRO", label: "Otro" },
];

const todayISO = () => new Date().toISOString().slice(0, 10);
const currentYM = () => todayISO().slice(0, 7);

/** Resumen que se muestra tras registrar el pago, según el saldo del periodo. */
function SuccessSummary({ balance }: { balance: PeriodBalance }) {
  const pagado = balance.status === "PAGADO";
  return (
    <div className="py-4 text-center space-y-2">
      {pagado ? (
        <CheckCircle2 className="w-9 h-9 text-emerald-500 mx-auto" />
      ) : (
        <Clock className="w-9 h-9 text-amber-500 mx-auto" />
      )}
      <p className="text-[14px] font-semibold text-[#0B1426]">
        {pagado ? "Renta del periodo cubierta" : "Abono registrado"}
      </p>
      <p className="text-[13px] text-slate-500">
        {balance.tenantName} · periodo {balance.period}
      </p>
      {!pagado && balance.remaining != null && balance.remaining > 0 && (
        <p className="text-[13px] text-amber-600 font-medium">
          Restan {formatCurrency(balance.remaining)}
        </p>
      )}
      {pagado && (
        <p className="text-[13px] text-emerald-600 font-medium">
          Pagado {formatCurrency(balance.paid)}
          {balance.expected != null ? ` de ${formatCurrency(balance.expected)}` : ""}
        </p>
      )}
    </div>
  );
}

export function ManualPaymentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { allTenants, fetchPayments, fetchAllTenants } = useStore();

  const [tenantId, setTenantId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<ManualPaymentMethod>("EFECTIVO");
  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [billingPeriod, setBillingPeriod] = useState(currentYM());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balanceHint, setBalanceHint] = useState<PeriodBalance | null>(null);
  const [result, setResult] = useState<PeriodBalance | null>(null);

  const reset = () => {
    setTenantId("");
    setAmount("");
    setMethod("EFECTIVO");
    setPaymentDate(todayISO());
    setBillingPeriod(currentYM());
    setNote("");
    setError(null);
    setBalanceHint(null);
    setResult(null);
  };

  const handleClose = () => {
    if (saving) return;
    reset();
    onClose();
  };

  // Ayuda contextual: saldo restante del periodo para el inquilino elegido.
  // Si la consulta falla, se omite la ayuda sin bloquear el registro.
  useEffect(() => {
    if (!open || !tenantId || !/^\d{4}-\d{2}$/.test(billingPeriod)) return;
    let cancelled = false;
    api
      .getPeriodBalance(tenantId, billingPeriod)
      .then((b) => {
        if (!cancelled) setBalanceHint(b);
      })
      .catch(() => {
        // Ayuda opcional: sin saldo disponible no se muestra nada.
        if (!cancelled) setBalanceHint(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, tenantId, billingPeriod]);

  // La ayuda solo aplica si corresponde a la selección actual (evita mostrar
  // el saldo de otro inquilino/periodo mientras llega la respuesta nueva).
  const hint =
    balanceHint &&
    String(balanceHint.tenantId) === tenantId &&
    balanceHint.period === billingPeriod
      ? balanceHint
      : null;

  const amountNum = parseFloat(amount);
  const canSubmit = !!tenantId && !Number.isNaN(amountNum) && amountNum > 0 && !saving;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const { balance } = await api.registerManualPayment({
        tenantId,
        amount: amountNum,
        paymentMethod: method,
        paymentDate: paymentDate || undefined,
        billingPeriod: /^\d{4}-\d{2}$/.test(billingPeriod) ? billingPeriod : undefined,
        note: note.trim() || undefined,
      });
      setResult(balance);
      await Promise.all([fetchPayments(), fetchAllTenants()]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Registrar pago</DialogTitle></DialogHeader>

        <div className="overflow-y-auto flex-1 min-h-0 px-4 pb-2">
        {result ? (
          <SuccessSummary balance={result} />
        ) : (
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
              <label className="text-sm font-medium">Monto (MXN)</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {amount !== "" && (Number.isNaN(amountNum) || amountNum <= 0) && (
                <p className="text-[12px] text-red-600">El monto debe ser mayor a 0.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Método de pago</label>
              <Select value={method} onValueChange={(v) => setMethod((v as ManualPaymentMethod) ?? "EFECTIVO")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHOD_OPTIONS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Fecha de pago</label>
                <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Periodo</label>
                <Input type="month" value={billingPeriod} onChange={(e) => setBillingPeriod(e.target.value)} />
              </div>
            </div>
            {hint && hint.remaining != null && (
              <p className="text-[12px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                Restante del periodo: <span className="font-semibold text-[#0B1426]">{formatCurrency(hint.remaining)}</span>
              </p>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nota (opcional)</label>
              <Input
                placeholder="Ej. Pagó en efectivo el día 5"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            {error && (
              <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}
          </div>
        )}
        </div>

        <DialogFooter>
          {result ? (
            <Button onClick={handleClose} className="bg-[#2952F3] hover:bg-[#1e3fd4]">Cerrar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose} disabled={saving}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={!canSubmit} className="bg-[#2952F3] hover:bg-[#1e3fd4]">
                {saving ? "Registrando..." : "Registrar pago"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

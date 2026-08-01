"use client";

import { useState, useEffect } from "react";

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  CLABE: "CLABE (18 dígitos)",
  CARD: "Tarjeta de débito (16 dígitos)",
  PHONE: "Número de teléfono (10 dígitos)",
};
import { useParams, notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, Plus, Pencil, Trash2, CheckCircle2, Bell, BellOff, Save, X, CalendarDays, Banknote, Users, Building2, AlertTriangle, FileText } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useStore } from "@/store/useStore";
import { cn, formatPhone, formatCurrency } from "@/lib/utils";
import type { AccountType, TenantWithStatus } from "@/lib/types";
import { PaymentStatusBadge } from "@/components/ui/StatusBadge";
import * as api from "@/lib/api";

// ── Helpers ───────────────────────────────────────────────────────────────────
function apiError(err: unknown): string {
  if (!(err instanceof Error)) return "Error al guardar";
  const body = err.message.replace(/^\d+:\s*/, "");
  try {
    const p = JSON.parse(body) as { message?: unknown };
    const m = p.message;
    if (Array.isArray(m)) return (m as string[]).join(", ");
    if (typeof m === "string") return m;
  } catch { /* fall through */ }
  return "Error al guardar. Inténtalo de nuevo.";
}

// ── Vigencia de contrato y ajuste de renta (§2.3 CONTRATOS_API.md) ───────────
type ContractValues = {
  contractStartDate: string;
  contractEndDate: string;
  nextMonthlyAmount: string;
  adjustmentDate: string;
};

function ContractFields({ values, onChange }: { values: ContractValues; onChange: (patch: Partial<ContractValues>) => void }) {
  return (
    <div className="space-y-3 pt-1 border-t">
      <p className="text-xs text-slate-400 flex items-center gap-1.5">
        <CalendarDays className="w-3.5 h-3.5" /> Vigencia de contrato y ajuste de renta (opcional)
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Inicio de vigencia</label>
          <Input type="date" value={values.contractStartDate} onChange={(e) => onChange({ contractStartDate: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Fin de vigencia</label>
          <Input type="date" value={values.contractEndDate} onChange={(e) => onChange({ contractEndDate: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Renta tras ajuste</label>
          <Input type="number" placeholder="$0.00" value={values.nextMonthlyAmount} onChange={(e) => onChange({ nextMonthlyAmount: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Fecha de ajuste</label>
          <Input type="date" value={values.adjustmentDate} onChange={(e) => onChange({ adjustmentDate: e.target.value })} />
        </div>
      </div>
      <p className="text-[11px] text-slate-400 leading-snug">
        Fuera de la vigencia, el bot rechaza los comprobantes del inquilino. La renta tras ajuste aplica desde la fecha indicada.
      </p>
    </div>
  );
}

function AddTenantDialog({ open, propertyId, onClose }: { open: boolean; propertyId: number; onClose: () => void }) {
  const { createTenant } = useStore();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    paymentDay: "",
    monthlyAmount: "",
    destinationAccount: "",
    destinationAccountType: "CLABE" as AccountType,
    contractStartDate: "",
    contractEndDate: "",
    nextMonthlyAmount: "",
    adjustmentDate: "",
  });

  const handleSubmit = async () => {
    if (!form.name || !form.phone) return;
    setSaving(true);
    setSaveError(null);
    try {
      await createTenant(propertyId, {
        name: form.name,
        phone: form.phone,
        paymentDay: form.paymentDay ? parseInt(form.paymentDay) : undefined,
        monthlyAmount: form.monthlyAmount ? parseFloat(form.monthlyAmount) : undefined,
        destinationAccount: form.destinationAccount || undefined,
        destinationAccountType: form.destinationAccount ? form.destinationAccountType : undefined,
        contractStartDate: form.contractStartDate || undefined,
        contractEndDate: form.contractEndDate || undefined,
        nextMonthlyAmount: form.nextMonthlyAmount ? parseFloat(form.nextMonthlyAmount) : undefined,
        adjustmentDate: form.adjustmentDate || undefined,
      });
      onClose();
      setForm({ name: "", phone: "", paymentDay: "", monthlyAmount: "", destinationAccount: "", destinationAccountType: "CLABE", contractStartDate: "", contractEndDate: "", nextMonthlyAmount: "", adjustmentDate: "" });
    } catch (err) {
      setSaveError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Agregar inquilino</DialogTitle></DialogHeader>
        <div className="space-y-4 px-4 py-3 overflow-y-auto">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nombre completo</label>
            <Input placeholder="Nombre del inquilino" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Teléfono WhatsApp (52XXXXXXXXXX)</label>
            <Input placeholder="5215512345678" inputMode="tel" maxLength={13} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 13) })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Día de pago</label>
              <Input type="number" min={1} max={31} placeholder="1-31" value={form.paymentDay} onChange={(e) => setForm({ ...form, paymentDay: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Renta mensual</label>
              <Input type="number" placeholder="$0.00" value={form.monthlyAmount} onChange={(e) => setForm({ ...form, monthlyAmount: e.target.value })} />
            </div>
          </div>
          <div className="space-y-3 pt-1 border-t">
            <p className="text-xs text-slate-400">Cuenta destino individual (opcional — sobreescribe la del arrendador)</p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tipo de cuenta</label>
              <Select value={form.destinationAccountType} onValueChange={(v) => setForm({ ...form, destinationAccountType: (v ?? "CLABE") as AccountType })}>
                <SelectTrigger>
                  <SelectValue>{ACCOUNT_TYPE_LABEL[form.destinationAccountType] ?? form.destinationAccountType}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLABE">CLABE (18 dígitos)</SelectItem>
                  <SelectItem value="CARD">Tarjeta de débito (16 dígitos)</SelectItem>
                  <SelectItem value="PHONE">Número de teléfono (10 dígitos)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Número de cuenta</label>
              <Input placeholder="Dejar vacío para usar cuenta del arrendador" value={form.destinationAccount} onChange={(e) => setForm({ ...form, destinationAccount: e.target.value })} />
            </div>
          </div>
          <ContractFields values={form} onChange={(patch) => setForm({ ...form, ...patch })} />
          {saveError && <p className="text-xs text-red-600">{saveError}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving} className="bg-[#2952F3] hover:bg-[#1e3fd4]">
            {saving ? "Guardando..." : "Agregar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditTenantDialog({ tenant, onClose }: { tenant: TenantWithStatus; onClose: () => void }) {
  const { updateTenant } = useStore();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: tenant.name,
    phone: tenant.phone,
    paymentDay: tenant.paymentDay ? String(tenant.paymentDay) : "",
    monthlyAmount: tenant.monthlyAmount ? String(tenant.monthlyAmount) : "",
    destinationAccount: tenant.destinationAccount ?? "",
    destinationAccountType: (tenant.destinationAccountType ?? "CLABE") as AccountType,
    rfc: tenant.rfc ?? "",
    contractStartDate: tenant.contractStartDate ?? "",
    contractEndDate: tenant.contractEndDate ?? "",
    nextMonthlyAmount: tenant.nextMonthlyAmount != null ? String(tenant.nextMonthlyAmount) : "",
    adjustmentDate: tenant.adjustmentDate ?? "",
  });

  const handleSubmit = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await updateTenant(tenant.id, {
        name: form.name,
        phone: form.phone,
        paymentDay: form.paymentDay ? parseInt(form.paymentDay) : undefined,
        monthlyAmount: form.monthlyAmount ? parseFloat(form.monthlyAmount) : undefined,
        destinationAccount: form.destinationAccount || undefined,
        destinationAccountType: form.destinationAccount ? form.destinationAccountType : undefined,
        contractStartDate: form.contractStartDate || undefined,
        contractEndDate: form.contractEndDate || undefined,
        nextMonthlyAmount: form.nextMonthlyAmount ? parseFloat(form.nextMonthlyAmount) : undefined,
        adjustmentDate: form.adjustmentDate || undefined,
      });
      if (form.rfc !== (tenant.rfc ?? "")) {
        await api.updateTenantFiscal(tenant.id, { rfc: form.rfc || undefined });
      }
      onClose();
    } catch (err) {
      setSaveError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Editar inquilino</DialogTitle></DialogHeader>
        <div className="space-y-4 px-4 py-3 overflow-y-auto">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nombre completo</label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Teléfono WhatsApp (52XXXXXXXXXX)</label>
            <Input inputMode="tel" maxLength={13} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 13) })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Día de pago</label>
              <Input type="number" min={1} max={31} placeholder="1-31" value={form.paymentDay} onChange={(e) => setForm({ ...form, paymentDay: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Renta mensual</label>
              <Input type="number" placeholder="$0.00" value={form.monthlyAmount} onChange={(e) => setForm({ ...form, monthlyAmount: e.target.value })} />
            </div>
          </div>
          <div className="space-y-3 pt-1 border-t">
            <p className="text-xs text-slate-400">Cuenta destino individual (opcional)</p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tipo de cuenta</label>
              <Select value={form.destinationAccountType} onValueChange={(v) => setForm({ ...form, destinationAccountType: (v ?? "CLABE") as AccountType })}>
                <SelectTrigger>
                  <SelectValue>{ACCOUNT_TYPE_LABEL[form.destinationAccountType] ?? form.destinationAccountType}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLABE">CLABE (18 dígitos)</SelectItem>
                  <SelectItem value="CARD">Tarjeta de débito (16 dígitos)</SelectItem>
                  <SelectItem value="PHONE">Número de teléfono (10 dígitos)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Número de cuenta</label>
              <Input placeholder="Dejar vacío para usar cuenta del arrendador" value={form.destinationAccount} onChange={(e) => setForm({ ...form, destinationAccount: e.target.value })} />
            </div>
          </div>
          <ContractFields values={form} onChange={(patch) => setForm({ ...form, ...patch })} />
          <div className="space-y-1.5 pt-1 border-t">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              RFC (opcional, para facturación)
            </label>
            <Input placeholder="XAXX010101000" value={form.rfc} onChange={(e) => { setForm({ ...form, rfc: e.target.value }); setSaveError(null); }} className="font-mono" />
          </div>
          {saveError && <p className="text-xs text-red-600">{saveError}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving} className="bg-[#2952F3] hover:bg-[#1e3fd4]">
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Estado de vigencia derivado de las fechas del contrato (comparación lexicográfica
// de strings YYYY-MM-DD). Fuera de rango → el bot rechaza los comprobantes (§2.3).
function contractInfo(t: TenantWithStatus) {
  const today = new Date().toISOString().slice(0, 10);
  const hasVigencia = !!(t.contractStartDate || t.contractEndDate);
  const outOfRange =
    (!!t.contractStartDate && today < t.contractStartDate) ||
    (!!t.contractEndDate && today > t.contractEndDate);
  const hasAdjustment = t.nextMonthlyAmount != null && !!t.adjustmentDate;
  return { hasVigencia, outOfRange, hasAdjustment };
}

const fmtDay = (d: string) => format(new Date(d + "T12:00:00"), "dd/MM/yy");

export default function PropertyDetailPage() {
  const params = useParams();
  const id = parseInt(params.id as string, 10);
  const { properties, tenantsWithStatus, tenantsState, updateProperty, removeTenant, fetchTenantsForProperty } = useStore();

  const property = properties.find((p) => p.id === id);
  const propertyTenants = tenantsWithStatus.filter((t) => t.propertyId === id);

  const [editing, setEditing] = useState(false);
  const [addTenantOpen, setAddTenantOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<TenantWithStatus | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: property?.name ?? "" });

  useEffect(() => {
    if (!isNaN(id)) fetchTenantsForProperty(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!property) {
    if (properties.length > 0) notFound();
    return <div className="flex items-center justify-center py-16"><div className="h-8 w-48 bg-slate-100 rounded animate-pulse" /></div>;
  }

  const handleSave = async () => {
    await updateProperty(id, { name: editForm.name });
    setEditing(false);
  };

  const handleDelete = async (tenantId: number) => {
    setDeletingId(tenantId);
    try { await removeTenant(tenantId); } finally { setDeletingId(null); }
  };

  const paidCount = propertyTenants.filter((t) => t.paymentStatus === "Pagado").length;
  const monthlyTotal = propertyTenants.reduce((s, t) => s + (t.monthlyAmount ? Number(t.monthlyAmount) : 0), 0);
  const hasAlert = propertyTenants.some((t) => t.paymentStatus === "Vencido" || t.paymentStatus === "Revisión");

  return (
    <div className="space-y-5">

      {/* Hero */}
      <div
        className="bg-white rounded-2xl overflow-hidden border border-slate-200/80"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
      >
        <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-5 sm:pb-6">
          <div className="flex items-start justify-between gap-2 mb-5">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Link href="/propiedades">
                <button className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors shrink-0">
                  <ArrowLeft className="w-4 h-4 text-slate-600" />
                </button>
              </Link>
              <div className="min-w-0">
                {!editing ? (
                  <>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <p className="text-[11px] text-slate-400 uppercase tracking-widest font-semibold">Propiedad</p>
                    </div>
                    <h1 className="text-[22px] font-bold text-[#0B1426] mt-0.5 leading-tight truncate">{property.name}</h1>
                  </>
                ) : (
                  <div className="mt-1">
                    <Input
                      value={editForm.name}
                      onChange={(e) => setEditForm({ name: e.target.value })}
                      className="h-9 w-full sm:w-56"
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              {!editing ? (
                <button
                  onClick={() => { setEditForm({ name: property.name }); setEditing(true); }}
                  className="flex items-center gap-1.5 h-8 px-2 sm:px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[12px] font-medium transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Editar</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setEditing(false)}
                    className="flex items-center gap-1.5 h-8 px-2 sm:px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[12px] font-medium transition-colors"
                  >
                    <X className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Cancelar</span>
                  </button>
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-1.5 h-8 px-2 sm:px-3 rounded-lg bg-[#2952F3] hover:bg-[#1e3fd4] text-white text-[12px] font-medium transition-colors"
                  >
                    <Save className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Guardar</span>
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-xl px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <p className="text-[11px] text-slate-400 uppercase tracking-widest font-semibold">Inquilinos</p>
              </div>
              <p className="text-[22px] font-bold text-[#0B1426] leading-none">{propertyTenants.length}</p>
              <p className="text-[12px] text-slate-400 mt-1">{paidCount} al corriente</p>
            </div>
            <div className="bg-slate-50 rounded-xl px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Banknote className="w-3.5 h-3.5 text-slate-400" />
                <p className="text-[11px] text-slate-400 uppercase tracking-widest font-semibold">Renta mensual</p>
              </div>
              <p className="text-[22px] font-bold text-[#0B1426] leading-none tabular-nums">
                {monthlyTotal > 0 ? formatCurrency(monthlyTotal).replace(/\.\d+$/, "") : "—"}
              </p>
              <p className="text-[12px] text-slate-400 mt-1">esperado por mes</p>
            </div>
            <div className="bg-slate-50 rounded-xl px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                <p className="text-[11px] text-slate-400 uppercase tracking-widest font-semibold">Estado</p>
              </div>
              <p className={cn("text-[22px] font-bold leading-none",
                hasAlert ? "text-red-600"
                : paidCount === propertyTenants.length && propertyTenants.length > 0 ? "text-emerald-600"
                : "text-amber-600"
              )}>
                {hasAlert ? "Alertas" : paidCount === propertyTenants.length && propertyTenants.length > 0 ? "Al día" : "Pendiente"}
              </p>
              <p className="text-[12px] text-slate-400 mt-1">
                {hasAlert ? "requiere atención" : "sin urgencias"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tenants header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[16px] font-semibold text-[#0B1426]">Inquilinos</h2>
          <p className="text-[12px] text-slate-400 mt-0.5">{propertyTenants.length} registrado{propertyTenants.length !== 1 ? "s" : ""}</p>
        </div>
        <Button size="sm" className="bg-[#2952F3] hover:bg-[#1e3fd4] gap-1.5 shrink-0" onClick={() => setAddTenantOpen(true)}>
          <Plus className="w-4 h-4" /> Agregar inquilino
        </Button>
      </div>

      {tenantsState.error && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-[13px] text-amber-800 font-medium">Algo salió mal al cargar los datos. Intenta de nuevo.</p>
        </div>
      )}

      {propertyTenants.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-slate-200/80 text-center"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
        >
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
            <Users className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-[15px] font-semibold text-[#0B1426]">Sin inquilinos</p>
          <p className="text-[13px] text-slate-400 mt-1 mb-5">Agrega el primer inquilino a esta propiedad</p>
          <Button size="sm" className="bg-[#2952F3] hover:bg-[#1e3fd4] gap-1.5" onClick={() => setAddTenantOpen(true)}>
            <Plus className="w-4 h-4" /> Agregar inquilino
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {propertyTenants.map((tenant) => {
            const initials = tenant.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
            const contract = contractInfo(tenant);
            return (
              <div
                key={tenant.id}
                className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden"
                style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
              >
                <div className={cn("h-1",
                  tenant.paymentStatus === "Pagado" ? "bg-emerald-500"
                  : tenant.paymentStatus === "Vencido" ? "bg-red-400"
                  : tenant.paymentStatus === "Revisión" ? "bg-purple-400"
                  : "bg-amber-400"
                )} />

                <div className="p-5 flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-[#eef1fd] flex items-center justify-center text-sm font-bold text-[#2952F3] shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-[#0B1426] truncate">{tenant.name}</p>
                        <p className="text-[12px] text-slate-400 font-mono mt-0.5">{formatPhone(tenant.phone)}</p>
                      </div>
                    </div>
                    <PaymentStatusBadge status={tenant.paymentStatus} />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-slate-50 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <CalendarDays className="w-3 h-3 text-slate-400" />
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">Día de pago</p>
                      </div>
                      <p className="text-[14px] font-semibold text-[#0B1426]">
                        {tenant.paymentDay ? `Día ${tenant.paymentDay}` : "—"}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Banknote className="w-3 h-3 text-slate-400" />
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">Renta</p>
                      </div>
                      <p className="text-[14px] font-semibold text-[#0B1426]">
                        {tenant.monthlyAmount ? `$${Number(tenant.monthlyAmount).toLocaleString("es-MX")}` : "—"}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <CheckCircle2 className="w-3 h-3 text-slate-400" />
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">Último pago</p>
                      </div>
                      <p className="text-[14px] font-semibold text-[#0B1426]">
                        {tenant.lastPaymentDate
                          ? format(new Date(tenant.lastPaymentDate + "T12:00:00"), "dd/MM/yyyy")
                          : "—"}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        {tenant.reminderSent
                          ? <Bell className="w-3 h-3 text-[#2952F3]" />
                          : <BellOff className="w-3 h-3 text-slate-400" />}
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">Recordatorio</p>
                      </div>
                      <p className={cn("text-[14px] font-semibold", tenant.reminderSent ? "text-[#2952F3]" : "text-slate-400")}>
                        {tenant.reminderSent ? "Enviado" : "No enviado"}
                      </p>
                    </div>
                  </div>

                  {(contract.hasVigencia || contract.hasAdjustment) && (
                    <div className="flex flex-col gap-1.5">
                      {contract.hasVigencia && (
                        <div className="flex items-center justify-between gap-2 bg-slate-50 rounded-xl px-3 py-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <CalendarDays className="w-3 h-3 text-slate-400 shrink-0" />
                            <p className="text-[11px] text-slate-500 truncate tabular-nums">
                              {tenant.contractStartDate ? fmtDay(tenant.contractStartDate) : "—"}
                              {" – "}
                              {tenant.contractEndDate ? fmtDay(tenant.contractEndDate) : "—"}
                            </p>
                          </div>
                          {contract.outOfRange ? (
                            <span className="text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-[2px] shrink-0 whitespace-nowrap">Fuera de vigencia</span>
                          ) : (
                            <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-[2px] shrink-0 whitespace-nowrap">Vigente</span>
                          )}
                        </div>
                      )}
                      {contract.hasAdjustment && (
                        <div className="flex items-center gap-1.5 px-1">
                          <Banknote className="w-3 h-3 text-slate-400 shrink-0" />
                          <p className="text-[11px] text-slate-500 truncate">
                            Ajuste a ${Number(tenant.nextMonthlyAmount).toLocaleString("es-MX")} desde {tenant.adjustmentDate ? fmtDay(tenant.adjustmentDate) : "—"}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="pt-1 border-t border-slate-100 flex justify-between">
                    <button
                      className="flex items-center gap-1 text-[12px] text-slate-500 hover:text-[#2952F3] font-medium px-2 py-1 rounded-lg hover:bg-[#eef1fd] transition-colors"
                      onClick={() => setEditingTenant(tenant)}
                    >
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </button>
                    <button
                      className="flex items-center gap-1 text-[12px] text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                      onClick={() => setConfirmDeleteId(tenant.id)}
                      disabled={deletingId === tenant.id}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {deletingId === tenant.id ? "Eliminando..." : "Eliminar"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AddTenantDialog open={addTenantOpen} propertyId={id} onClose={() => setAddTenantOpen(false)} />
      {editingTenant && (
        <EditTenantDialog tenant={editingTenant} onClose={() => setEditingTenant(null)} />
      )}

      <Dialog open={confirmDeleteId !== null} onOpenChange={() => setConfirmDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Eliminar inquilino?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500 px-4 py-2">
            Esta acción eliminará al inquilino de la propiedad. No se puede deshacer.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={deletingId !== null}
              onClick={async () => {
                if (confirmDeleteId === null) return;
                await handleDelete(confirmDeleteId);
                setConfirmDeleteId(null);
              }}
            >
              {deletingId !== null ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Building2, ChevronRight, CheckCircle2, Clock, AlertCircle, Users, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useStore } from "@/store/useStore";
import { ApiErrorState } from "@/components/layout/ApiErrorState";
import { cn, formatCurrency } from "@/lib/utils";
import type { PaymentStatus } from "@/lib/types";

function StatusDot({ status }: { status: PaymentStatus }) {
  if (status === "Pagado")    return <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />;
  if (status === "Vencido")   return <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 animate-pulse" />;
  if (status === "Revisión")  return <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />;
  return <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 animate-pulse" />;
}

function StatusPill({ status }: { status: PaymentStatus }) {
  const map: Record<PaymentStatus, string> = {
    Pagado:    "bg-emerald-50 border-emerald-200 text-emerald-700",
    Pendiente: "bg-amber-50 border-amber-200 text-amber-600",
    Vencido:   "bg-red-50 border-red-200 text-red-600",
    Revisión:  "bg-purple-50 border-purple-200 text-purple-600",
  };
  return (
    <span className={cn("inline-flex items-center gap-1.5 border text-[11px] font-semibold px-2.5 py-[3px] rounded-full whitespace-nowrap", map[status])}>
      <StatusDot status={status} />
      {status}
    </span>
  );
}

function NewPropertyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { createProperty } = useStore();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try { await createProperty({ name: name.trim() }); onClose(); setName(""); }
    catch { /* silenciado */ }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Nueva propiedad</DialogTitle></DialogHeader>
        <div className="py-2 space-y-1.5">
          <label className="text-sm font-medium">Nombre</label>
          <Input
            placeholder="Ej. Departamento 201"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving || !name.trim()} className="bg-[#2952F3] hover:bg-[#1e3fd4]">
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PropiedadesPage() {
  const { properties, tenantsWithStatus, propertiesState, fetchProperties, fetchTenants } = useStore();
  const [dialogOpen, setDialogOpen] = useState(false);

  const totalRenta = tenantsWithStatus.reduce(
    (s, t) => s + (t.monthlyAmount ? Number(t.monthlyAmount) : 0), 0
  );
  const cobradoCount = tenantsWithStatus.filter((t) => t.paymentStatus === "Pagado").length;
  const alertCount = tenantsWithStatus.filter(
    (t) => t.paymentStatus === "Vencido" || t.paymentStatus === "Revisión"
  ).length;

  if (propertiesState.loading) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="h-8 w-40 bg-slate-100 rounded animate-pulse" />
          <div className="h-9 w-36 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-44 bg-slate-100 rounded-2xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (propertiesState.error) {
    return <ApiErrorState onRetry={() => fetchProperties().then(() => fetchTenants())} />;
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[#0B1426] tracking-tight">Propiedades</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {properties.length} propiedad{properties.length !== 1 ? "es" : ""} registrada{properties.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="bg-[#2952F3] hover:bg-[#1e3fd4] gap-2">
          <Plus className="w-4 h-4" /> Nueva propiedad
        </Button>
      </div>

      {/* Stats strip */}
      {properties.length > 0 && (
        <div
          className="bg-white rounded-2xl border border-slate-200/80 grid grid-cols-3 overflow-hidden"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
        >
          <div className="px-6 py-4 border-r border-slate-100">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-1.5">Inquilinos</p>
            <p className="text-[24px] font-bold text-[#0B1426] leading-none">{tenantsWithStatus.length}</p>
            <p className="text-[12px] text-slate-400 mt-1">
              {cobradoCount} al corriente
            </p>
          </div>
          <div className="px-6 py-4 border-r border-slate-100">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-1.5">Renta mensual</p>
            <p className="text-[24px] font-bold text-[#0B1426] leading-none tabular-nums">
              {formatCurrency(totalRenta).replace(/\.\d+$/, "")}
            </p>
            <p className="text-[12px] text-slate-400 mt-1">esperado por mes</p>
          </div>
          <div className="px-6 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-1.5">Alertas</p>
            <p className={cn("text-[24px] font-bold leading-none", alertCount > 0 ? "text-red-500" : "text-emerald-600")}>
              {alertCount}
            </p>
            <p className="text-[12px] text-slate-400 mt-1">
              {alertCount === 0 ? "Sin pendientes" : "requieren atención"}
            </p>
          </div>
        </div>
      )}

      {/* Property grid */}
      {properties.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200/80 text-center"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
        >
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <Building2 className="w-7 h-7 text-slate-400" />
          </div>
          <p className="text-[15px] font-semibold text-[#0B1426]">Sin propiedades aún</p>
          <p className="text-sm text-slate-400 mt-1 mb-5">Agrega tu primera propiedad para comenzar</p>
          <Button onClick={() => setDialogOpen(true)} className="bg-[#2952F3] hover:bg-[#1e3fd4] gap-2">
            <Plus className="w-4 h-4" /> Nueva propiedad
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {properties.map((property) => {
            const tenants = tenantsWithStatus.filter((t) => t.propertyId === property.id);
            const monthlyTotal = tenants.reduce((s, t) => s + (t.monthlyAmount ? Number(t.monthlyAmount) : 0), 0);
            const hasAlert = tenants.some((t) => t.paymentStatus === "Vencido" || t.paymentStatus === "Revisión");
            const allPaid = tenants.length > 0 && tenants.every((t) => t.paymentStatus === "Pagado");

            return (
              <Link key={property.id} href={`/propiedades/${property.id}`}>
                <div
                  className={cn(
                    "bg-white rounded-2xl border overflow-hidden transition-all duration-200 hover:-translate-y-0.5 cursor-pointer group",
                    hasAlert ? "border-red-200/60" : "border-slate-200/80"
                  )}
                  style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
                >
                  {/* Card header */}
                  <div className={cn(
                    "h-1.5",
                    allPaid ? "bg-emerald-500" : hasAlert ? "bg-red-400" : "bg-amber-400"
                  )} />

                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2 mb-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-[#eef1fd] flex items-center justify-center shrink-0">
                          <Building2 className="w-5 h-5 text-[#2952F3]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[15px] font-semibold text-[#0B1426] truncate leading-tight">
                            {property.name}
                          </p>
                          <p className="text-[12px] text-slate-400 mt-0.5">
                            {tenants.length} inquilino{tenants.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 mt-0.5 group-hover:text-[#2952F3] transition-colors" />
                    </div>

                    {tenants.length === 0 ? (
                      <p className="text-[13px] text-slate-400 italic">Sin inquilino asignado</p>
                    ) : (
                      <div className="space-y-2.5">
                        {tenants.slice(0, 2).map((t) => (
                          <div key={t.id} className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0">
                                {t.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                              </div>
                              <span className="text-[13px] text-slate-600 font-medium truncate">{t.name}</span>
                            </div>
                            <StatusPill status={t.paymentStatus} />
                          </div>
                        ))}
                        {tenants.length > 2 && (
                          <p className="text-[11px] text-slate-400">+{tenants.length - 2} más</p>
                        )}
                      </div>
                    )}

                    {monthlyTotal > 0 && (
                      <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Banknote className="w-3.5 h-3.5" />
                          <span className="text-[12px]">Renta mensual</span>
                        </div>
                        <span className="text-[13px] font-bold text-[#0B1426] tabular-nums">
                          {formatCurrency(monthlyTotal)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <NewPropertyDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}

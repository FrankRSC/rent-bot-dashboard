"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Building2, ChevronRight, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useStore } from "@/store/useStore";
import { ApiErrorState } from "@/components/layout/ApiErrorState";
import { cn, formatCurrency, isDelinquent } from "@/lib/utils";
import { PaymentStatusBadge } from "@/components/ui/StatusBadge";
import type { Property, Tenant, TenantWithStatus } from "@/lib/types";

function toTenantsWithStatus(tenants: Tenant[]): TenantWithStatus[] {
  return tenants.map((t) => ({
    ...t,
    paymentStatus: t.paymentStatus ?? "Vigente",
    lastPaymentDate: t.lastPaymentDate ?? null,
    reminderSent: false,
  }));
}

function NewPropertyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { createProperty } = useStore();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(false);
    try { await createProperty({ name: name.trim() }); onClose(); setName(""); }
    catch { setError(true); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Nueva propiedad</DialogTitle></DialogHeader>
        <div className="px-4 py-2 space-y-1.5">
          <label className="text-[13px] font-medium text-[#0B1426]">Nombre</label>
          <Input
            placeholder="Ej. Departamento 201"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            autoFocus
          />
          {error && <p className="text-red-600 text-[12px]">No se pudo crear la propiedad. Intenta de nuevo.</p>}
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

// ── Tarjeta de propiedad ──────────────────────────────────────────────────────

interface PropertyCardProps {
  property: Property;
  tenants: TenantWithStatus[];
}

function PropertyCard({ property, tenants }: PropertyCardProps) {
  const monthlyTotal = tenants.reduce((s, t) => s + (t.monthlyAmount ? Number(t.monthlyAmount) : 0), 0);
  const hasAlert = tenants.some((t) => isDelinquent(t.paymentStatus) || t.paymentStatus === "Revisión");
  const allPaid = tenants.length > 0 && tenants.every((t) => t.paymentStatus === "Pagado");

  const statusBar = allPaid
    ? "bg-emerald-500"
    : hasAlert
    ? "bg-red-400"
    : tenants.length > 0
    ? "bg-amber-400"
    : "bg-slate-200";

  return (
    <Link href={`/propiedades/${property.id}`}>
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden hover:border-[#2952F3]/40 hover:shadow-md transition-all duration-150 cursor-pointer group" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.04)" }}>

        {/* Status line — thin top strip, semaphore color */}
        <div className={cn("h-[3px]", statusBar)} />

        <div className="p-4 flex flex-col gap-4">

          {/* Property header */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4 text-slate-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-[#0B1426] truncate leading-tight">{property.name}</p>
                <p className="text-[12px] text-slate-500 mt-0.5">
                  {tenants.length} inquilino{tenants.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 group-hover:text-[#2952F3] transition-colors" />
          </div>

          {/* Tenant list */}
          {tenants.length === 0 ? (
            <p className="text-[13px] text-slate-400 italic">Sin inquilino asignado</p>
          ) : (
            <div className="space-y-2">
              {tenants.slice(0, 3).map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-5 h-5 rounded-full bg-[#eef1fd] flex items-center justify-center text-[10px] font-bold text-[#2952F3] shrink-0">
                      {t.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                    </div>
                    <span className="text-[13px] text-slate-600 truncate">{t.name}</span>
                  </div>
                  <PaymentStatusBadge status={t.paymentStatus} />
                </div>
              ))}
              {tenants.length > 3 && (
                <p className="text-[11px] text-slate-400 pl-7">+{tenants.length - 3} más</p>
              )}
            </div>
          )}

          {/* Rent footer */}
          {monthlyTotal > 0 && (
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
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
}

// ── Vista principal ───────────────────────────────────────────────────────────

interface PropiedadesViewProps {
  initialProperties: Property[] | null;
  initialTenants: Tenant[] | null;
}

export function PropiedadesView({ initialProperties, initialTenants }: PropiedadesViewProps) {
  const { properties: storeProperties, tenantsWithStatus: storeTenants, propertiesState, fetchProperties, fetchAllTenants } = useStore();
  const [dialogOpen, setDialogOpen] = useState(false);

  const properties = storeProperties.length > 0 ? storeProperties : (initialProperties ?? []);
  const tenantsWithStatus = storeTenants.length > 0
    ? storeTenants
    : toTenantsWithStatus(initialTenants ?? []);

  const totalRenta = tenantsWithStatus.reduce(
    (s, t) => s + (t.monthlyAmount ? Number(t.monthlyAmount) : 0), 0
  );
  const cobradoCount = tenantsWithStatus.filter((t) => t.paymentStatus === "Pagado").length;
  const alertCount = tenantsWithStatus.filter(
    (t) => isDelinquent(t.paymentStatus) || t.paymentStatus === "Revisión"
  ).length;

  if (propertiesState.loading) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="h-8 w-40 bg-slate-100 rounded animate-pulse" />
          <div className="h-9 w-36 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-[72px] bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-44 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (propertiesState.error) {
    return <ApiErrorState onRetry={() => { fetchProperties(); fetchAllTenants(); }} />;
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-[#0B1426] tracking-tight">Propiedades</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            {properties.length} propiedad{properties.length !== 1 ? "es" : ""} registrada{properties.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="bg-[#2952F3] hover:bg-[#1e3fd4] gap-2 shrink-0">
          <Plus className="w-4 h-4" /> Nueva propiedad
        </Button>
      </div>

      {/* Stats strip */}
      {properties.length > 0 && (
        <div
          className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden grid grid-cols-3 divide-x divide-slate-100"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
        >
          <div className="px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-1.5">Inquilinos</p>
            <p className="text-[22px] font-bold text-[#0B1426] tabular-nums leading-none mb-1">
              {tenantsWithStatus.length}
            </p>
            <p className="text-[11px] text-[#2952F3] font-medium">
              {cobradoCount} al corriente
            </p>
          </div>
          <div className="px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-1.5">Renta esperada</p>
            <p className="text-[22px] font-bold text-[#0B1426] tabular-nums leading-none mb-1">
              {totalRenta > 0 ? formatCurrency(totalRenta).replace(/\.\d+$/, "") : "—"}
            </p>
            <p className="text-[11px] text-slate-400 font-medium">por mes</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-1.5">Alertas</p>
            <p className={cn(
              "text-[22px] font-bold tabular-nums leading-none mb-1",
              alertCount > 0 ? "text-red-600" : "text-emerald-600"
            )}>
              {alertCount}
            </p>
            <p className="text-[11px] text-slate-400 font-medium">
              {alertCount === 0 ? "sin incidencias" : `vencido${alertCount !== 1 ? "s" : ""} o revisión`}
            </p>
          </div>
        </div>
      )}

      {/* Property grid */}
      {properties.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200/80 text-center" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}>
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-4">
            <Building2 className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-[15px] font-semibold text-[#0B1426]">Sin propiedades aún</p>
          <p className="text-[13px] text-slate-500 mt-1 mb-5">Agrega tu primera propiedad para comenzar</p>
          <Button onClick={() => setDialogOpen(true)} className="bg-[#2952F3] hover:bg-[#1e3fd4] gap-2">
            <Plus className="w-4 h-4" /> Nueva propiedad
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {properties.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              tenants={tenantsWithStatus.filter((t) => t.propertyId === property.id)}
            />
          ))}
        </div>
      )}

      <NewPropertyDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}

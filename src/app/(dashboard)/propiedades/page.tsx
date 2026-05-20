"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Building2, Users, ChevronRight, CheckCircle2, X } from "lucide-react";
import { ApiErrorState } from "@/components/layout/ApiErrorState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useStore } from "@/store/useStore";
import type { PaymentStatus } from "@/lib/types";

function TenantStatusBadge({ status }: { status: PaymentStatus }) {
  if (status === "Pagado") return <Badge className="bg-[#d1fae5] text-[#065f46] hover:bg-[#d1fae5] border-[#6ee7b7] text-xs"><CheckCircle2 className="w-3 h-3 mr-1" />Pagado</Badge>;
  if (status === "Vencido") return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-red-200 text-xs"><X className="w-3 h-3 mr-1" />Vencido</Badge>;
  if (status === "Revisión") return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 border-purple-200 text-xs">Revisión</Badge>;
  return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200 text-xs">Pendiente</Badge>;
}

function NewPropertyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { createProperty } = useStore();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createProperty({ name: name.trim() });
      onClose();
      setName("");
    } catch {
      // silenciado
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Nueva propiedad</DialogTitle></DialogHeader>
        <div className="py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nombre de la propiedad</label>
            <Input placeholder="Ej. Departamento 201" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving || !name.trim()} className="bg-[#2952F3] hover:bg-[#1e3fd4]">
            {saving ? "Guardando..." : "Guardar propiedad"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PropiedadesPage() {
  const { properties, tenantsWithStatus, propertiesState, fetchProperties, fetchTenants } = useStore();
  const [dialogOpen, setDialogOpen] = useState(false);

  const getPropertyTenant = (propertyId: number) =>
    tenantsWithStatus.find((t) => t.propertyId === propertyId) ?? null;

  if (propertiesState.loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-40 bg-slate-100 rounded animate-pulse" />
          <div className="h-9 w-36 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => <div key={i} className="h-36 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (propertiesState.error) {
    return <ApiErrorState onRetry={() => fetchProperties().then(() => fetchTenants())} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Propiedades</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{properties.length} propiedades registradas</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="bg-[#2952F3] hover:bg-[#1e3fd4]">
          <Plus className="w-4 h-4 mr-2" />
          Nueva propiedad
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {properties.map((property) => {
          const tenant = getPropertyTenant(property.id);
          return (
            <Link key={property.id} href={`/propiedades/${property.id}`}>
              <Card className="border shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="bg-[#eef1fd] p-2 rounded-lg shrink-0">
                        <Building2 className="w-5 h-5 text-[#2952F3]" />
                      </div>
                      <CardTitle className="text-base font-semibold leading-tight">{property.name}</CardTitle>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                    {tenant ? (
                      <>
                        <span className="font-medium text-slate-700 truncate">{tenant.name}</span>
                        <span className="ml-auto shrink-0"><TenantStatusBadge status={tenant.paymentStatus} /></span>
                      </>
                    ) : (
                      <span className="text-muted-foreground italic">Sin inquilino</span>
                    )}
                  </div>
                  {tenant?.monthlyAmount ? (
                    <div className="text-xs text-muted-foreground">
                      Renta mensual: <span className="font-semibold text-slate-700">${Number(tenant.monthlyAmount).toLocaleString("es-MX")}</span>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <NewPropertyDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}

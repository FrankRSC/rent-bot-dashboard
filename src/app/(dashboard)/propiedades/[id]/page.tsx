"use client";

import { useState, useEffect } from "react";

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  CLABE: "CLABE (18 dígitos)",
  CARD: "Tarjeta de débito (16 dígitos)",
  PHONE: "Número de teléfono (10 dígitos)",
};
import { useParams, notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, Plus, Pencil, Trash2, CheckCircle2, Bell, BellOff, Save, X, AlertCircle, CalendarDays, Banknote } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useStore } from "@/store/useStore";
import { formatPhone } from "@/lib/utils";
import type { AccountType, PaymentStatus } from "@/lib/types";

function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  if (status === "Pagado") return <Badge className="bg-[#d1fae5] text-[#065f46] hover:bg-[#d1fae5] border-[#6ee7b7]"><CheckCircle2 className="w-3 h-3 mr-1" />Pagado</Badge>;
  if (status === "Vencido") return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-red-200"><X className="w-3 h-3 mr-1" />Vencido</Badge>;
  if (status === "Revisión") return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 border-purple-200">Revisión</Badge>;
  return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">Pendiente</Badge>;
}

function AddTenantDialog({ open, propertyId, onClose }: { open: boolean; propertyId: number; onClose: () => void }) {
  const { createTenant } = useStore();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    paymentDay: "",
    monthlyAmount: "",
    destinationAccount: "",
    destinationAccountType: "CLABE" as AccountType,
  });

  const handleSubmit = async () => {
    if (!form.name || !form.phone) return;
    setSaving(true);
    try {
      await createTenant(propertyId, {
        name: form.name,
        phone: form.phone,
        paymentDay: form.paymentDay ? parseInt(form.paymentDay) : undefined,
        monthlyAmount: form.monthlyAmount ? parseFloat(form.monthlyAmount) : undefined,
        destinationAccount: form.destinationAccount || undefined,
        destinationAccountType: form.destinationAccount ? form.destinationAccountType : undefined,
      });
      onClose();
      setForm({ name: "", phone: "", paymentDay: "", monthlyAmount: "", destinationAccount: "", destinationAccountType: "CLABE" });
    } catch {
      // silenciado
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Agregar inquilino</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nombre completo</label>
            <Input placeholder="Nombre del inquilino" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Teléfono WhatsApp (52XXXXXXXXXX)</label>
            <Input placeholder="5215512345678" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
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
            <p className="text-xs text-muted-foreground">Cuenta destino individual (opcional — sobreescribe la del arrendador)</p>
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

export default function PropertyDetailPage() {
  const params = useParams();
  const id = parseInt(params.id as string, 10);
  const { properties, tenantsWithStatus, tenantsState, updateProperty, removeTenant, fetchTenantsForProperty } = useStore();

  const property = properties.find((p) => p.id === id);
  const propertyTenants = tenantsWithStatus.filter((t) => t.propertyId === id);

  const [editing, setEditing] = useState(false);
  const [addTenantOpen, setAddTenantOpen] = useState(false);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/propiedades">
          <Button variant="ghost" size="icon" className="shrink-0"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-slate-900 truncate">{property.name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {propertyTenants.length === 0 ? "Sin inquilino asignado" : propertyTenants[0].name}
          </p>
        </div>
        {!editing ? (
          <Button variant="outline" size="sm" onClick={() => { setEditForm({ name: property.name }); setEditing(true); }}>
            <Pencil className="w-4 h-4 mr-1.5" />Editar
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancelar</Button>
            <Button size="sm" className="bg-[#2952F3] hover:bg-[#1e3fd4]" onClick={handleSave}><Save className="w-4 h-4 mr-1.5" />Guardar</Button>
          </div>
        )}
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-base">Información de la propiedad</CardTitle></CardHeader>
        <CardContent>
          {editing ? (
            <div className="max-w-xs">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nombre</label>
                <Input value={editForm.name} onChange={(e) => setEditForm({ name: e.target.value })} />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">La cuenta destino se configura en el perfil del arrendador.</p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#0B1426]">
            Inquilinos
            <span className="ml-2 text-sm font-normal text-slate-400">({propertyTenants.length})</span>
          </h2>
          <Button size="sm" className="bg-[#2952F3] hover:bg-[#1e3fd4]" onClick={() => setAddTenantOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />Agregar inquilino
          </Button>
        </div>

        {tenantsState.error && (
          <div className="flex items-center gap-2 px-4 py-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0" />{tenantsState.error}
          </div>
        )}

        {propertyTenants.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-12 bg-white rounded-2xl border border-slate-200/80 text-center"
            style={{ boxShadow: "0 2px 8px -2px rgba(0,0,0,0.06)" }}
          >
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <Plus className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-600">Sin inquilinos</p>
            <p className="text-xs text-slate-400 mt-0.5">Agrega el primer inquilino a esta propiedad</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {propertyTenants.map((tenant) => {
              const initials = tenant.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
              return (
                <div
                  key={tenant.id}
                  className="bg-white rounded-2xl border border-slate-200/80 p-5 flex flex-col gap-4"
                  style={{ boxShadow: "0 2px 8px -2px rgba(0,0,0,0.06)" }}
                >
                  {/* Header: avatar + name + status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-[#eef1fd] flex items-center justify-center text-sm font-bold text-[#2952F3] shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#0B1426] truncate">{tenant.name}</p>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">{formatPhone(tenant.phone)}</p>
                      </div>
                    </div>
                    <PaymentStatusBadge status={tenant.paymentStatus} />
                  </div>

                  {/* Details */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide">Día de pago</p>
                        <p className="text-sm font-medium text-[#0B1426]">
                          {tenant.paymentDay ? `Día ${tenant.paymentDay}` : "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Banknote className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide">Renta</p>
                        <p className="text-sm font-medium text-[#0B1426]">
                          {tenant.monthlyAmount ? `$${Number(tenant.monthlyAmount).toLocaleString("es-MX")}` : "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide">Último pago</p>
                        <p className="text-sm font-medium text-[#0B1426]">
                          {tenant.lastPaymentDate
                            ? format(new Date(tenant.lastPaymentDate + "T12:00:00"), "dd/MM/yyyy")
                            : "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {tenant.reminderSent
                        ? <Bell className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        : <BellOff className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide">Recordatorio</p>
                        <p className={`text-sm font-medium ${tenant.reminderSent ? "text-blue-600" : "text-slate-400"}`}>
                          {tenant.reminderSent ? "Enviado" : "No enviado"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Footer: delete */}
                  <div className="pt-1 border-t border-slate-100 flex justify-end">
                    <Button
                      variant="ghost" size="sm"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 text-xs h-7 px-2"
                      onClick={() => setConfirmDeleteId(tenant.id)}
                      disabled={deletingId === tenant.id}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      {deletingId === tenant.id ? "Eliminando..." : "Eliminar"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AddTenantDialog open={addTenantOpen} propertyId={id} onClose={() => setAddTenantOpen(false)} />

      <Dialog open={confirmDeleteId !== null} onOpenChange={() => setConfirmDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Eliminar inquilino?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta acción eliminará al inquilino de la propiedad. No se puede deshacer.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>
              Cancelar
            </Button>
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

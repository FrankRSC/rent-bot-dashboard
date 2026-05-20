"use client";

import { useState, useEffect } from "react";
import { Pencil, Save, X, Wifi, WifiOff, Bell, BellOff, CheckCircle2, CreditCard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatAccount } from "@/lib/utils";
import type { AccountType } from "@/lib/types";
import { useStore } from "@/store/useStore";
import * as api from "@/lib/api";

const LANDLORD_ID = parseInt(process.env.NEXT_PUBLIC_LANDLORD_ID ?? "1", 10);

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  CLABE: "CLABE (18 dígitos)",
  CARD: "Tarjeta de débito (16 dígitos)",
  PHONE: "Número de teléfono (10 dígitos)",
};

export default function ConfiguracionPage() {
  const { settings, updateSettings } = useStore();
  const [editingProfile, setEditingProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileForm, setProfileForm] = useState({
    landlordName: settings.landlordName,
    email: settings.email,
    phone: settings.phone,
    ownerBank: settings.ownerBank,
    beneficiaryAccount: settings.beneficiaryAccount,
    beneficiaryAccountType: (settings.beneficiaryAccountType || "CLABE") as AccountType,
  });

  useEffect(() => {
    api.getLandlord(LANDLORD_ID).then((landlord) => {
      updateSettings({
        landlordName: landlord.name,
        email: landlord.email,
        phone: landlord.phone ?? "",
        ownerBank: landlord.ownerBank ?? "",
        beneficiaryAccount: landlord.beneficiaryAccount ?? "",
        beneficiaryAccountType: landlord.beneficiaryAccountType ?? "CLABE",
      });
      setProfileForm({
        landlordName: landlord.name,
        email: landlord.email,
        phone: landlord.phone ?? "",
        ownerBank: landlord.ownerBank ?? "",
        beneficiaryAccount: landlord.beneficiaryAccount ?? "",
        beneficiaryAccountType: (landlord.beneficiaryAccountType ?? "CLABE") as AccountType,
      });
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initials = settings.landlordName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await api.updateLandlord(LANDLORD_ID, {
        name: profileForm.landlordName,
        email: profileForm.email,
        phone: profileForm.phone,
        ownerBank: profileForm.ownerBank,
        beneficiaryAccount: profileForm.beneficiaryAccount,
        beneficiaryAccountType: profileForm.beneficiaryAccountType,
      });
      updateSettings(profileForm);
      setEditingProfile(false);
    } catch {
      // silenciado — agregar toast en el futuro
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configuración</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Gestiona tu perfil y preferencias del sistema
        </p>
      </div>

      {/* Perfil */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Perfil del arrendador</CardTitle>
          {!editingProfile ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setProfileForm({
                  landlordName: settings.landlordName,
                  email: settings.email,
                  phone: settings.phone,
                  ownerBank: settings.ownerBank,
                  beneficiaryAccount: settings.beneficiaryAccount,
                  beneficiaryAccountType: (settings.beneficiaryAccountType || "CLABE") as AccountType,
                });
                setEditingProfile(true);
              }}
            >
              <Pencil className="w-3.5 h-3.5 mr-1.5" />
              Editar
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditingProfile(false)} disabled={saving}>
                <X className="w-3.5 h-3.5 mr-1" />
                Cancelar
              </Button>
              <Button size="sm" className="bg-[#2952F3] hover:bg-[#1e3fd4]" onClick={handleSaveProfile} disabled={saving}>
                <Save className="w-3.5 h-3.5 mr-1" />
                {saving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="w-14 h-14">
              <AvatarFallback className="bg-[#2952F3] text-white text-lg font-bold">
                {initials || "?"}
              </AvatarFallback>
            </Avatar>
            {!editingProfile && (
              <div>
                <p className="font-semibold text-slate-900">{settings.landlordName || "—"}</p>
                <p className="text-sm text-muted-foreground">{settings.email}</p>
                <p className="text-sm text-muted-foreground">{settings.phone}</p>
              </div>
            )}
          </div>
          {!editingProfile && settings.beneficiaryAccount && (
            <div className="flex items-center gap-3 pt-2 border-t">
              <div className="bg-slate-100 p-1.5 rounded-md shrink-0">
                <CreditCard className="w-4 h-4 text-slate-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{settings.ownerBank} · {ACCOUNT_TYPE_LABEL[settings.beneficiaryAccountType] ?? settings.beneficiaryAccountType}</p>
                <p className="font-mono text-sm tracking-wider">{formatAccount(settings.beneficiaryAccount, (settings.beneficiaryAccountType || "CLABE") as AccountType)}</p>
              </div>
            </div>
          )}
          {editingProfile && (
            <div className="grid grid-cols-1 gap-4 pt-1">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nombre completo</label>
                <Input value={profileForm.landlordName} onChange={(e) => setProfileForm({ ...profileForm, landlordName: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Correo electrónico</label>
                <Input type="email" value={profileForm.email} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Teléfono (52XXXXXXXXXX)</label>
                <Input value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} />
              </div>
              <div className="pt-1 border-t">
                <p className="text-sm font-medium mb-3">Cuenta destino para pagos</p>
                <div className="grid grid-cols-1 gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Banco receptor</label>
                      <Input placeholder="Ej. BBVA" value={profileForm.ownerBank} onChange={(e) => setProfileForm({ ...profileForm, ownerBank: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Tipo de cuenta</label>
                      <Select value={profileForm.beneficiaryAccountType} onValueChange={(v) => setProfileForm({ ...profileForm, beneficiaryAccountType: (v ?? "CLABE") as AccountType })}>
                        <SelectTrigger>
                          <SelectValue>{ACCOUNT_TYPE_LABEL[profileForm.beneficiaryAccountType] ?? profileForm.beneficiaryAccountType}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CLABE">CLABE (18 dígitos)</SelectItem>
                          <SelectItem value="CARD">Tarjeta de débito (16 dígitos)</SelectItem>
                          <SelectItem value="PHONE">Número de teléfono (10 dígitos)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Número de cuenta / CLABE</label>
                    <Input
                      placeholder={profileForm.beneficiaryAccountType === "CLABE" ? "18 dígitos" : profileForm.beneficiaryAccountType === "CARD" ? "16 dígitos" : "10 dígitos"}
                      value={profileForm.beneficiaryAccount}
                      onChange={(e) => setProfileForm({ ...profileForm, beneficiaryAccount: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bot WhatsApp */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Conexión con bot de WhatsApp</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${settings.botConnected ? "bg-[#047857] animate-pulse" : "bg-slate-300"}`} />
              <div>
                <p className="text-sm font-medium">{settings.botConnected ? "Bot en línea" : "Bot desconectado"}</p>
                <p className="text-xs text-muted-foreground">
                  {settings.botConnected ? "Recibiendo y procesando mensajes" : "El bot no está respondiendo mensajes"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className={settings.botConnected ? "border-[#6ee7b7] text-[#047857]" : "border-slate-300 text-slate-500"}>
                {settings.botConnected ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
                {settings.botConnected ? "Conectado" : "Desconectado"}
              </Badge>
              <Switch checked={settings.botConnected} onCheckedChange={(checked) => updateSettings({ botConnected: checked })} />
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            <p className="font-medium mb-0.5">Validación en tiempo real</p>
            <p className="text-xs text-amber-700">
              Los comprobantes son verificados directamente con Banxico. El proceso es automático.
            </p>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Notificaciones */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Preferencias de notificación</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: "notifyOnPayment" as const, icon: CheckCircle2, label: "Notificar al recibir pago", desc: "Recibe una notificación cuando un inquilino pague su renta" },
            { key: "notifyOnOverdue" as const, icon: BellOff, label: "Notificar pagos vencidos", desc: "Recibe alertas cuando un pago esté vencido" },
            { key: "autoRemindersEnabled" as const, icon: Bell, label: "Recordatorios automáticos", desc: "El bot enviará recordatorios de pago automáticamente por WhatsApp" },
          ].map(({ key, icon: Icon, label, desc }) => (
            <div key={key} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-slate-100 p-1.5 rounded-md">
                  <Icon className="w-4 h-4 text-slate-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
              <Switch checked={settings[key] as boolean} onCheckedChange={(checked) => updateSettings({ [key]: checked })} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

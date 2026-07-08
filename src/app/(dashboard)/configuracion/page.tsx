"use client";

import { useState, useEffect } from "react";
import { Pencil, Save, X, Wifi, WifiOff, Bell, BellOff, CheckCircle2, CreditCard, User, Settings2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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

function SectionHeader({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
      <div className="w-8 h-8 rounded-xl bg-[#eef1fd] flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-[#2952F3]" />
      </div>
      <div>
        <p className="text-[14px] font-semibold text-[#0B1426]">{title}</p>
        {subtitle && <p className="text-[12px] text-slate-400">{subtitle}</p>}
      </div>
    </div>
  );
}

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

  const [editingFiscal, setEditingFiscal] = useState(false);
  const [savingFiscal, setSavingFiscal] = useState(false);
  const [fiscalForm, setFiscalForm] = useState({
    rfc: settings.rfc,
    fiscalName: settings.fiscalName,
    zipCode: settings.zipCode,
    taxRegime: settings.taxRegime,
  });

  useEffect(() => {
    api.getLandlord(LANDLORD_ID).then((landlord) => {
      const data = {
        landlordName: landlord.name,
        email: landlord.email,
        phone: landlord.phone ?? "",
        ownerBank: landlord.ownerBank ?? "",
        beneficiaryAccount: landlord.beneficiaryAccount ?? "",
        beneficiaryAccountType: (landlord.beneficiaryAccountType ?? "CLABE") as AccountType,
        rfc: landlord.rfc ?? "",
        fiscalName: landlord.fiscalName ?? "",
        zipCode: landlord.zipCode ?? "",
        taxRegime: landlord.taxRegime ?? "",
        facturasEnabled: landlord.facturasEnabled ?? false,
      };
      updateSettings(data);
      setProfileForm({
        landlordName: data.landlordName,
        email: data.email,
        phone: data.phone,
        ownerBank: data.ownerBank,
        beneficiaryAccount: data.beneficiaryAccount,
        beneficiaryAccountType: data.beneficiaryAccountType,
      });
      setFiscalForm({
        rfc: data.rfc,
        fiscalName: data.fiscalName,
        zipCode: data.zipCode,
        taxRegime: data.taxRegime,
      });
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initials = settings.landlordName.split(" ").slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase();

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
    } catch { /* silenciado */ }
    finally { setSaving(false); }
  };

  const handleSaveFiscal = async () => {
    setSavingFiscal(true);
    try {
      await api.updateLandlordFiscal(LANDLORD_ID, {
        rfc: fiscalForm.rfc,
        taxRegime: fiscalForm.taxRegime,
        zipCode: fiscalForm.zipCode,
        fiscalName: fiscalForm.fiscalName || undefined,
      });
      updateSettings(fiscalForm);
      setEditingFiscal(false);
    } catch { /* silenciado */ }
    finally { setSavingFiscal(false); }
  };

  return (
    <div className="space-y-5 max-w-2xl">

      {/* Header */}
      <div>
        <h1 className="text-[22px] font-bold text-[#0B1426] tracking-tight">Configuración</h1>
        <p className="text-sm text-slate-400 mt-0.5">Gestiona tu perfil y preferencias del sistema</p>
      </div>

      {/* Perfil */}
      <div
        className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#eef1fd] flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-[#2952F3]" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-[#0B1426]">Perfil del arrendador</p>
              <p className="text-[12px] text-slate-400">Información personal y cuenta de cobro</p>
            </div>
          </div>
          {!editingProfile ? (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
              setProfileForm({
                landlordName: settings.landlordName, email: settings.email, phone: settings.phone,
                ownerBank: settings.ownerBank, beneficiaryAccount: settings.beneficiaryAccount,
                beneficiaryAccountType: (settings.beneficiaryAccountType || "CLABE") as AccountType,
              });
              setEditingProfile(true);
            }}>
              <Pencil className="w-3.5 h-3.5" /> Editar
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditingProfile(false)} disabled={saving}>
                <X className="w-3.5 h-3.5 mr-1" /> Cancelar
              </Button>
              <Button size="sm" className="bg-[#2952F3] hover:bg-[#1e3fd4] gap-1.5" onClick={handleSaveProfile} disabled={saving}>
                <Save className="w-3.5 h-3.5" /> {saving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          )}
        </div>

        <div className="p-6">
          {!editingProfile ? (
            <div className="space-y-5">
              {/* Avatar + info */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-[#2952F3] flex items-center justify-center text-white text-lg font-bold shrink-0">
                  {initials || "?"}
                </div>
                <div>
                  <p className="text-[16px] font-semibold text-[#0B1426]">{settings.landlordName || "—"}</p>
                  <p className="text-[13px] text-slate-400">{settings.email}</p>
                  {settings.phone && <p className="text-[13px] text-slate-400">{settings.phone}</p>}
                </div>
              </div>

              {settings.beneficiaryAccount && (
                <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                    <CreditCard className="w-4 h-4 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400 mb-0.5">
                      {settings.ownerBank || "Banco"} · {ACCOUNT_TYPE_LABEL[settings.beneficiaryAccountType] ?? settings.beneficiaryAccountType}
                    </p>
                    <p className="font-mono text-[14px] font-medium text-[#0B1426] tracking-wider">
                      {formatAccount(settings.beneficiaryAccount, (settings.beneficiaryAccountType || "CLABE") as AccountType)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-slate-700">Nombre completo</label>
                  <Input value={profileForm.landlordName} onChange={(e) => setProfileForm({ ...profileForm, landlordName: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-slate-700">Correo electrónico</label>
                  <Input type="email" value={profileForm.email} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-slate-700">Teléfono (52XXXXXXXXXX)</label>
                  <Input value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} />
                </div>
              </div>
              <div className="pt-4 border-t border-slate-100">
                <p className="text-[13px] font-semibold text-[#0B1426] mb-3">Cuenta destino para cobros</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-medium text-slate-700">Banco receptor</label>
                    <Input placeholder="Ej. BBVA" value={profileForm.ownerBank} onChange={(e) => setProfileForm({ ...profileForm, ownerBank: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-medium text-slate-700">Tipo de cuenta</label>
                    <Select value={profileForm.beneficiaryAccountType} onValueChange={(v) => setProfileForm({ ...profileForm, beneficiaryAccountType: (v ?? "CLABE") as AccountType })}>
                      <SelectTrigger><SelectValue>{ACCOUNT_TYPE_LABEL[profileForm.beneficiaryAccountType]}</SelectValue></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CLABE">CLABE (18 dígitos)</SelectItem>
                        <SelectItem value="CARD">Tarjeta de débito (16 dígitos)</SelectItem>
                        <SelectItem value="PHONE">Número de teléfono (10 dígitos)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-[13px] font-medium text-slate-700">Número de cuenta</label>
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
        </div>
      </div>

      {/* Bot WhatsApp */}
      <div
        className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
      >
        <SectionHeader icon={Wifi} title="Bot de WhatsApp" subtitle="Conexión y estado del servicio de cobro automático" />
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${settings.botConnected ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`} />
              <div>
                <p className="text-[14px] font-medium text-[#0B1426]">{settings.botConnected ? "Bot en línea" : "Bot desconectado"}</p>
                <p className="text-[12px] text-slate-400">{settings.botConnected ? "Recibiendo y procesando mensajes" : "El bot no está respondiendo"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-1.5 border text-[11px] font-semibold px-2.5 py-1 rounded-full ${settings.botConnected ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-slate-100 border-slate-200 text-slate-500"}`}>
                {settings.botConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {settings.botConnected ? "Conectado" : "Desconectado"}
              </span>
              <Switch checked={settings.botConnected} onCheckedChange={(c) => updateSettings({ botConnected: c })} />
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-[13px] font-semibold text-amber-800 mb-0.5">Validación en tiempo real</p>
            <p className="text-[12px] text-amber-700">Los comprobantes se verifican directamente con Banxico de forma automática.</p>
          </div>
        </div>
      </div>

      {/* Notificaciones */}
      <div
        className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
      >
        <SectionHeader icon={Settings2} title="Notificaciones y recordatorios" />
        <div className="divide-y divide-slate-100">
          {[
            { key: "notifyOnPayment" as const, icon: CheckCircle2, label: "Notificar al recibir pago", desc: "Alerta cuando un inquilino pague su renta" },
            { key: "notifyOnOverdue" as const, icon: BellOff, label: "Notificar pagos vencidos", desc: "Alerta cuando un pago esté vencido" },
            { key: "autoRemindersEnabled" as const, icon: Bell, label: "Recordatorios automáticos", desc: "El bot enviará recordatorios por WhatsApp automáticamente" },
          ].map(({ key, icon: Icon, label, desc }) => (
            <div key={key} className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-slate-500" />
                </div>
                <div>
                  <p className="text-[14px] font-medium text-[#0B1426]">{label}</p>
                  <p className="text-[12px] text-slate-400">{desc}</p>
                </div>
              </div>
              <Switch checked={settings[key] as boolean} onCheckedChange={(c) => updateSettings({ [key]: c })} />
            </div>
          ))}
        </div>
      </div>

      {/* Datos fiscales */}
      <div
        className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#eef1fd] flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-[#2952F3]" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-[#0B1426]">Datos fiscales para facturación</p>
              <p className="text-[12px] text-slate-400">RFC y régimen fiscal del arrendador (CFDI 4.0)</p>
            </div>
          </div>
          {!editingFiscal ? (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
              setFiscalForm({ rfc: settings.rfc, fiscalName: settings.fiscalName, zipCode: settings.zipCode, taxRegime: settings.taxRegime });
              setEditingFiscal(true);
            }}>
              <Pencil className="w-3.5 h-3.5" /> Editar
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditingFiscal(false)} disabled={savingFiscal}>
                <X className="w-3.5 h-3.5 mr-1" /> Cancelar
              </Button>
              <Button size="sm" className="bg-[#2952F3] hover:bg-[#1e3fd4] gap-1.5" onClick={handleSaveFiscal} disabled={savingFiscal}>
                <Save className="w-3.5 h-3.5" /> {savingFiscal ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between px-6 py-3 bg-slate-50/60 border-b border-slate-100">
          <div>
            <p className="text-[13px] font-medium text-[#0B1426]">Módulo de facturación activo</p>
            <p className="text-[12px] text-slate-400">Muestra la sección Facturas en el menú lateral</p>
          </div>
          <Switch
            checked={settings.facturasEnabled}
            onCheckedChange={async (c) => {
              updateSettings({ facturasEnabled: c });
              await api.updateLandlord(LANDLORD_ID, { facturasEnabled: c }).catch(() => {
                updateSettings({ facturasEnabled: !c });
              });
            }}
          />
        </div>
        <div className="p-6">
          {!editingFiscal ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] text-slate-400 mb-0.5 uppercase tracking-wide font-semibold">RFC</p>
                <p className="text-[14px] font-mono font-medium text-[#0B1426]">{settings.rfc || "—"}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-400 mb-0.5 uppercase tracking-wide font-semibold">Nombre fiscal</p>
                <p className="text-[14px] font-medium text-[#0B1426]">{settings.fiscalName || "—"}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-400 mb-0.5 uppercase tracking-wide font-semibold">Código postal</p>
                <p className="text-[14px] font-medium text-[#0B1426]">{settings.zipCode || "—"}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-400 mb-0.5 uppercase tracking-wide font-semibold">Régimen fiscal</p>
                <p className="text-[14px] font-medium text-[#0B1426]">{settings.taxRegime || "—"}</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-slate-700">RFC</label>
                <Input placeholder="XAXX010101000" value={fiscalForm.rfc} onChange={(e) => setFiscalForm({ ...fiscalForm, rfc: e.target.value })} className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-slate-700">Nombre fiscal</label>
                <Input placeholder="Como aparece ante el SAT" value={fiscalForm.fiscalName} onChange={(e) => setFiscalForm({ ...fiscalForm, fiscalName: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-slate-700">Código postal</label>
                <Input placeholder="5 dígitos" value={fiscalForm.zipCode} onChange={(e) => setFiscalForm({ ...fiscalForm, zipCode: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-slate-700">Régimen fiscal</label>
                <Input placeholder="Ej. 621 - Actividades Empresariales" value={fiscalForm.taxRegime} onChange={(e) => setFiscalForm({ ...fiscalForm, taxRegime: e.target.value })} />
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

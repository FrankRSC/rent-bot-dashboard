"use client";

import { useState, useEffect, useMemo } from "react";
import { Pencil, Save, X, Wifi, WifiOff, Bell, BellOff, CheckCircle2, CreditCard, User, Settings2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { formatAccount, cn } from "@/lib/utils";
import type { AccountType } from "@/lib/types";
import { useStore } from "@/store/useStore";
import * as api from "@/lib/api";

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  CLABE: "CLABE (18 dígitos)",
  CARD: "Tarjeta de débito (16 dígitos)",
  PHONE: "Número de teléfono (10 dígitos)",
};

const SAVE_ERROR_MESSAGE = "No se pudo guardar. Verifica tu conexión e intenta de nuevo.";

const SECTIONS = [
  { id: "perfil",         label: "Perfil" },
  { id: "bot",            label: "Bot" },
  { id: "notificaciones", label: "Notificaciones" },
  { id: "fiscal",         label: "Datos fiscales" },
];

// ─── Small helpers ────────────────────────────────────────────────────────────

type SectionStatus = "complete" | "incomplete" | "info";

function dotClass(s: SectionStatus) {
  return s === "complete" ? "bg-emerald-500"
    : s === "incomplete"  ? "bg-amber-400"
    : "bg-slate-300 animate-pulse";
}

function InlineError({ message }: { message: string }) {
  return <p className="text-red-600 text-[12px]">{message}</p>;
}

const BOT_STATUS_UI = {
  checking: {
    dot: "bg-slate-300 animate-pulse",
    title: "Verificando…",
    desc: "Comprobando la conexión con el bot",
    pill: "bg-slate-100 border-slate-200 text-slate-500",
    pillLabel: "Verificando",
    icon: Wifi,
  },
  online: {
    dot: "bg-emerald-500 animate-pulse",
    title: "Bot en línea",
    desc: "Recibiendo y procesando mensajes",
    pill: "bg-emerald-50 border-emerald-200 text-emerald-700",
    pillLabel: "Conectado",
    icon: Wifi,
  },
  offline: {
    dot: "bg-red-400",
    title: "Bot desconectado",
    desc: "El bot no está respondiendo",
    pill: "bg-red-50 border-red-200 text-red-600",
    pillLabel: "Desconectado",
    icon: WifiOff,
  },
} as const;

function BotStatusIndicator({ status }: { status: keyof typeof BOT_STATUS_UI }) {
  const ui = BOT_STATUS_UI[status];
  const Icon = ui.icon;
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${ui.dot}`} />
        <div>
          <p className="text-[14px] font-medium text-[#0B1426]">{ui.title}</p>
          <p className="text-[12px] text-slate-500">{ui.desc}</p>
        </div>
      </div>
      <span className={`inline-flex items-center gap-1.5 border text-[11px] font-semibold px-2.5 py-1 rounded-full ${ui.pill}`}>
        <Icon className="w-3 h-3" />
        {ui.pillLabel}
      </span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConfiguracionPage() {
  const { settings, updateSettings, landlordId, botStatus } = useStore();
  const [activeSection, setActiveSection] = useState("perfil");
  const [editingProfile, setEditingProfile] = useState(false);
  const [saving, setSaving]                 = useState(false);
  const [loadError, setLoadError]           = useState(false);
  const [profileError, setProfileError]     = useState(false);
  const [fiscalError, setFiscalError]       = useState(false);
  const [notifError, setNotifError]         = useState(false);

  const [profileForm, setProfileForm] = useState({
    landlordName: settings.landlordName,
    email: settings.email,
    phone: settings.phone,
    ownerBank: settings.ownerBank,
    beneficiaryAccount: settings.beneficiaryAccount,
    beneficiaryAccountType: (settings.beneficiaryAccountType || "CLABE") as AccountType,
  });

  const [editingFiscal, setEditingFiscal] = useState(false);
  const [savingFiscal, setSavingFiscal]   = useState(false);
  const [fiscalForm, setFiscalForm] = useState({
    rfc: settings.rfc,
    fiscalName: settings.fiscalName,
    zipCode: settings.zipCode,
    taxRegime: settings.taxRegime,
  });

  // ── Section completeness ───────────────────────────────────────────────────

  const sectionStatus = useMemo((): Record<string, SectionStatus> => ({
    perfil:         settings.landlordName && settings.email ? "complete" : "incomplete",
    bot:            botStatus === "online" ? "complete" : botStatus === "offline" ? "incomplete" : "info",
    notificaciones: "complete",
    fiscal:         settings.rfc ? "complete" : "incomplete",
  }), [settings.landlordName, settings.email, settings.rfc, botStatus]);

  // ── Data load ──────────────────────────────────────────────────────────────

  useEffect(() => {
    api.getLandlord(landlordId).then((landlord) => {
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
        autoRemindersEnabled: landlord.autoRemindersEnabled,
        defaultReminderDays: landlord.defaultReminderDays,
        notifyOnPayment: landlord.notifyOnPayment,
        notifyOnOverdue: landlord.notifyOnOverdue,
      };
      updateSettings(data);
      setProfileForm({
        landlordName: data.landlordName, email: data.email, phone: data.phone,
        ownerBank: data.ownerBank, beneficiaryAccount: data.beneficiaryAccount,
        beneficiaryAccountType: data.beneficiaryAccountType,
      });
      setFiscalForm({ rfc: data.rfc, fiscalName: data.fiscalName, zipCode: data.zipCode, taxRegime: data.taxRegime });
      setLoadError(false);
    }).catch(() => setLoadError(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landlordId]);

  const initials = settings.landlordName.split(" ").slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase();

  type NotifKey = "notifyOnPayment" | "notifyOnOverdue" | "autoRemindersEnabled";

  const saveNotifPref = async (key: NotifKey, value: boolean) => {
    updateSettings({ [key]: value } as Partial<Record<NotifKey, boolean>>);
    setNotifError(false);
    try {
      await api.updateLandlord(landlordId, { [key]: value } as Partial<Record<NotifKey, boolean>>);
    } catch {
      updateSettings({ [key]: !value } as Partial<Record<NotifKey, boolean>>);
      setNotifError(true);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await api.updateLandlord(landlordId, {
        name: profileForm.landlordName, email: profileForm.email, phone: profileForm.phone,
        ownerBank: profileForm.ownerBank, beneficiaryAccount: profileForm.beneficiaryAccount,
        beneficiaryAccountType: profileForm.beneficiaryAccountType,
      });
      updateSettings(profileForm);
      setEditingProfile(false);
      setProfileError(false);
    } catch {
      setProfileError(true);
    } finally { setSaving(false); }
  };

  const handleSaveFiscal = async () => {
    setSavingFiscal(true);
    try {
      await api.updateLandlordFiscal(landlordId, {
        rfc: fiscalForm.rfc, taxRegime: fiscalForm.taxRegime,
        zipCode: fiscalForm.zipCode, fiscalName: fiscalForm.fiscalName || undefined,
      });
      updateSettings(fiscalForm);
      setEditingFiscal(false);
      setFiscalError(false);
    } catch {
      setFiscalError(true);
    } finally { setSavingFiscal(false); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const cardShadow = { boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" };

  return (
    <div className="flex gap-6 items-start">

      {/* ── Nav sidebar ────────────────────────────────────────────────────── */}
      <aside className="w-44 shrink-0 sticky top-6 self-start bg-white rounded-2xl border border-slate-200/80 overflow-hidden" style={cardShadow}>
        <div className="px-4 py-3 border-b border-slate-100">
          <h1 className="text-[13px] font-semibold text-[#0B1426]">Configuración</h1>
        </div>
        <nav className="p-2 space-y-0.5">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-colors w-full text-left",
                activeSection === s.id
                  ? "bg-[#eef1fd] text-[#2952F3]"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              )}
            >
              <span className={cn("w-2 h-2 rounded-full shrink-0", dotClass(sectionStatus[s.id] ?? "info"))} />
              {s.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* ── Active card ─────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 max-w-2xl">

        {loadError && (
          <p className="text-red-600 text-[12px] mb-4">
            No se pudo cargar tu información. Verifica tu conexión e intenta de nuevo.
          </p>
        )}

        {/* ── Perfil ─────────────────────────────────────────────────────── */}
        {activeSection === "perfil" && (
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden" style={cardShadow}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#eef1fd] flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-[#2952F3]" />
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-[#0B1426]">Perfil del arrendador</p>
                  <p className="text-[12px] text-slate-500">Información personal y cuenta de cobro</p>
                </div>
              </div>
              {!editingProfile ? (
                <Button variant="outline" size="sm" className="gap-1.5 self-end sm:self-auto" onClick={() => {
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
                <div className="flex gap-2 self-end sm:self-auto">
                  <Button variant="outline" size="sm" onClick={() => { setEditingProfile(false); setProfileError(false); }} disabled={saving}>
                    <X className="w-3.5 h-3.5 mr-1" /> Cancelar
                  </Button>
                  <Button size="sm" className="bg-[#2952F3] hover:bg-[#1e3fd4] gap-1.5" onClick={handleSaveProfile} disabled={saving}>
                    <Save className="w-3.5 h-3.5" /> {saving ? "Guardando..." : "Guardar"}
                  </Button>
                </div>
              )}
            </div>
            {profileError && <div className="px-6 pt-3"><InlineError message={SAVE_ERROR_MESSAGE} /></div>}
            <div className="p-6">
              {!editingProfile ? (
                <div className="space-y-5">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-[#2952F3] flex items-center justify-center text-white text-lg font-bold shrink-0">
                      {initials || "?"}
                    </div>
                    <div>
                      <p className="text-[16px] font-semibold text-[#0B1426]">{settings.landlordName || "—"}</p>
                      <p className="text-[13px] text-slate-500">{settings.email}</p>
                      {settings.phone && <p className="text-[13px] text-slate-500">{settings.phone}</p>}
                    </div>
                  </div>
                  {settings.beneficiaryAccount && (
                    <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                        <CreditCard className="w-4 h-4 text-slate-500" />
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500 mb-0.5">
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
                      <Input inputMode="tel" maxLength={13} value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value.replace(/\D/g, "").slice(0, 13) })} />
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
        )}

        {/* ── Bot ────────────────────────────────────────────────────────── */}
        {activeSection === "bot" && (
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden" style={cardShadow}>
            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-[#eef1fd] flex items-center justify-center shrink-0">
                <Wifi className="w-4 h-4 text-[#2952F3]" />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-[#0B1426]">Bot de WhatsApp</p>
                <p className="text-[12px] text-slate-500">Conexión y estado del servicio de cobro automático</p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <BotStatusIndicator status={botStatus} />
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-[13px] font-semibold text-amber-800 mb-0.5">Validación en tiempo real</p>
                <p className="text-[12px] text-amber-700">Los comprobantes se verifican de forma automática y en tiempo real.</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Notificaciones ─────────────────────────────────────────────── */}
        {activeSection === "notificaciones" && (
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden" style={cardShadow}>
            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-[#eef1fd] flex items-center justify-center shrink-0">
                <Settings2 className="w-4 h-4 text-[#2952F3]" />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-[#0B1426]">Notificaciones y recordatorios</p>
                <p className="text-[12px] text-slate-500">El bot aplica estas preferencias en sus envíos automáticos</p>
              </div>
            </div>
            {notifError && <div className="px-6 pt-3"><InlineError message={SAVE_ERROR_MESSAGE} /></div>}
            <div className="divide-y divide-slate-100">
              {[
                { key: "notifyOnPayment"      as const, icon: CheckCircle2, label: "Notificar al recibir pago",   desc: "Alerta cuando un inquilino pague su renta" },
                { key: "notifyOnOverdue"      as const, icon: BellOff,      label: "Notificar pagos vencidos",    desc: "Alerta cuando un pago esté vencido" },
                { key: "autoRemindersEnabled" as const, icon: Bell,         label: "Recordatorios automáticos",   desc: "El bot enviará recordatorios por WhatsApp automáticamente" },
              ].map(({ key, icon: Icon, label, desc }) => (
                <div key={key} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-[14px] font-medium text-[#0B1426]">{label}</p>
                      <p className="text-[12px] text-slate-500">{desc}</p>
                    </div>
                  </div>
                  <Switch checked={settings[key]} onCheckedChange={(c) => saveNotifPref(key, c)} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Datos fiscales ─────────────────────────────────────────────── */}
        {activeSection === "fiscal" && (
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden" style={cardShadow}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#eef1fd] flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-[#2952F3]" />
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-[#0B1426]">Datos fiscales para facturación</p>
                  <p className="text-[12px] text-slate-500">RFC y régimen fiscal del arrendador (CFDI 4.0)</p>
                </div>
              </div>
              {!editingFiscal ? (
                <Button variant="outline" size="sm" className="gap-1.5 self-end sm:self-auto" onClick={() => {
                  setFiscalForm({ rfc: settings.rfc, fiscalName: settings.fiscalName, zipCode: settings.zipCode, taxRegime: settings.taxRegime });
                  setEditingFiscal(true);
                }}>
                  <Pencil className="w-3.5 h-3.5" /> Editar
                </Button>
              ) : (
                <div className="flex gap-2 self-end sm:self-auto">
                  <Button variant="outline" size="sm" onClick={() => { setEditingFiscal(false); setFiscalError(false); }} disabled={savingFiscal}>
                    <X className="w-3.5 h-3.5 mr-1" /> Cancelar
                  </Button>
                  <Button size="sm" className="bg-[#2952F3] hover:bg-[#1e3fd4] gap-1.5" onClick={handleSaveFiscal} disabled={savingFiscal}>
                    <Save className="w-3.5 h-3.5" /> {savingFiscal ? "Guardando..." : "Guardar"}
                  </Button>
                </div>
              )}
            </div>
            {fiscalError && <div className="px-6 py-3"><InlineError message={SAVE_ERROR_MESSAGE} /></div>}
            <div className="flex items-center justify-between px-6 py-3 bg-slate-50/60 border-b border-slate-100">
              <div>
                <p className="text-[13px] font-medium text-[#0B1426]">Módulo de facturación activo</p>
                <p className="text-[12px] text-slate-500">Muestra la sección Facturas en el menú lateral</p>
              </div>
              <Switch
                checked={settings.facturasEnabled}
                onCheckedChange={async (c) => {
                  updateSettings({ facturasEnabled: c });
                  await api.updateLandlord(landlordId, { facturasEnabled: c }).catch(() => {
                    updateSettings({ facturasEnabled: !c });
                  });
                }}
              />
            </div>
            <div className="p-6">
              {!editingFiscal ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: "RFC", value: settings.rfc, mono: true },
                    { label: "Nombre fiscal", value: settings.fiscalName },
                    { label: "Código postal", value: settings.zipCode },
                    { label: "Régimen fiscal", value: settings.taxRegime },
                  ].map(({ label, value, mono }) => (
                    <div key={label}>
                      <p className="text-[11px] text-slate-500 mb-0.5 uppercase tracking-wide font-semibold">{label}</p>
                      <p className={cn("text-[14px] font-medium text-[#0B1426]", mono && "font-mono")}>{value || "—"}</p>
                    </div>
                  ))}
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
                    <Input placeholder="5 dígitos" inputMode="numeric" maxLength={5} value={fiscalForm.zipCode} onChange={(e) => setFiscalForm({ ...fiscalForm, zipCode: e.target.value.replace(/\D/g, "") })} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-medium text-slate-700">Régimen fiscal</label>
                    <Input placeholder="Ej. 621 - Actividades Empresariales" value={fiscalForm.taxRegime} onChange={(e) => setFiscalForm({ ...fiscalForm, taxRegime: e.target.value })} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

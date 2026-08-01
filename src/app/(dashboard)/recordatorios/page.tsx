"use client";

import { useEffect, useState } from "react";
import { format, addDays, setDate } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle2, BellOff, Loader2, Bell, Users, Clock, Send } from "lucide-react";
import { ApiErrorState } from "@/components/layout/ApiErrorState";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useStore } from "@/store/useStore";
import * as api from "@/lib/api";
import { cn } from "@/lib/utils";

function getNextReminder(paymentDay: number, daysBefore: number): string {
  const today = new Date();
  const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const paymentDate = setDate(currentMonth, paymentDay);
  const reminderDate = addDays(paymentDate, -daysBefore);

  if (reminderDate <= today) {
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const nextPaymentDate = setDate(nextMonth, paymentDay);
    const nextReminderDate = addDays(nextPaymentDate, -daysBefore);
    return format(nextReminderDate, "dd/MM/yyyy");
  }
  return format(reminderDate, "dd/MM/yyyy");
}

export default function RecordatoriosPage() {
  const {
    tenantsWithStatus, properties, settings, landlordId,
    sendReminder, updateSettings, fetchProperties, fetchAllTenants, fetchPayments,
    tenantsState, propertiesState,
  } = useStore();

  // Envío por inquilino: loading + error inline junto al botón de cada fila.
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});

  // Preferencias (autoRemindersEnabled / defaultReminderDays): optimista con
  // rollback, mismo patrón que facturasEnabled en Configuración.
  const [prefsError, setPrefsError] = useState(false);
  const [daysDraft, setDaysDraft] = useState<string | null>(null);

  const handleSend = async (tenantId: number) => {
    setSendingId(tenantId);
    setRowErrors((prev) => ({ ...prev, [tenantId]: "" }));
    try {
      await sendReminder(tenantId);
    } catch {
      setRowErrors((prev) => ({
        ...prev,
        [tenantId]: "No se pudo enviar. Intenta de nuevo.",
      }));
    } finally {
      setSendingId(null);
    }
  };

  const saveAutoReminders = async (enabled: boolean) => {
    updateSettings({ autoRemindersEnabled: enabled });
    setPrefsError(false);
    try {
      await api.updateLandlord(landlordId, { autoRemindersEnabled: enabled });
    } catch {
      updateSettings({ autoRemindersEnabled: !enabled });
      setPrefsError(true);
    }
  };

  const saveReminderDays = async (days: number) => {
    const previous = settings.defaultReminderDays;
    const clamped = Math.min(28, Math.max(0, Math.round(days)));
    updateSettings({ defaultReminderDays: clamped });
    setPrefsError(false);
    try {
      await api.updateLandlord(landlordId, { defaultReminderDays: clamped });
    } catch {
      updateSettings({ defaultReminderDays: previous });
      setPrefsError(true);
    }
  };

  useEffect(() => {
    if (!properties.length) {
      fetchProperties();
      fetchAllTenants();
      fetchPayments();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const now = new Date();
  const currentMonthLabel = format(now, "MMMM yyyy", { locale: es });
  const currentMonthLabelCap = currentMonthLabel.charAt(0).toUpperCase() + currentMonthLabel.slice(1);

  const tenantRows = tenantsWithStatus.map((t) => {
    const property = properties.find((p) => p.id === t.propertyId);
    const paymentDay = t.paymentDay ?? 1;
    const daysBefore = settings.defaultReminderDays;
    return {
      ...t,
      propertyName: property?.name ?? "—",
      paymentDay,
      daysBefore,
      nextReminder: getNextReminder(paymentDay, daysBefore),
    };
  });

  const sentCount = tenantsWithStatus.filter((t) => t.reminderSent).length;
  const pendingReminderCount = tenantsWithStatus.filter(
    (t) => !t.reminderSent && t.paymentStatus !== "Pagado"
  ).length;

  const isLoading = propertiesState.loading || tenantsState.loading;
  const loadError = propertiesState.error || tenantsState.error;

  if (loadError) {
    return (
      <ApiErrorState
        onRetry={() => {
          fetchProperties();
          fetchAllTenants();
        }}
      />
    );
  }

  return (
    <div className="space-y-5">

      {/* Hero */}
      <div
        className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
      >
        <div className="px-6 pt-5 pb-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-[22px] font-bold text-[#0B1426] tracking-tight">Recordatorios</h1>
              <p className="text-[13px] text-slate-400 mt-0.5">{currentMonthLabelCap}</p>
              <p className="text-[12px] text-slate-400 mt-1.5">
                &quot;Enviar ahora&quot; manda el recordatorio al momento por WhatsApp. El bot además envía automáticos según estas preferencias (aviso anticipado, día de pago y atrasos).
              </p>
            </div>
            {isLoading && <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                <p className="text-[11px] text-slate-400 uppercase tracking-widest font-semibold">Enviados</p>
              </div>
              <p className="text-[24px] font-bold text-[#0B1426] leading-none">{sentCount}</p>
              <p className="text-[12px] text-slate-400 mt-1">este mes</p>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <p className="text-[11px] text-slate-400 uppercase tracking-widest font-semibold">Pendientes</p>
              </div>
              <p className={cn("text-[24px] font-bold leading-none", pendingReminderCount > 0 ? "text-amber-500" : "text-[#0B1426]")}>
                {pendingReminderCount}
              </p>
              <p className="text-[12px] text-slate-400 mt-1">por enviar</p>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <p className="text-[11px] text-slate-400 uppercase tracking-widest font-semibold">Total</p>
              </div>
              <p className="text-[24px] font-bold text-[#0B1426] leading-none">{tenantsWithStatus.length}</p>
              <p className="text-[12px] text-slate-400 mt-1">inquilinos</p>
            </div>
          </div>

          {/* Settings row */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center justify-between flex-1 gap-4">
              <div>
                <p className="text-[13px] font-semibold text-[#0B1426]">Recordatorios automáticos</p>
                <p className="text-[12px] text-slate-400 mt-0.5">Si lo apagas, el bot no enviará recordatorios automáticos a tus inquilinos</p>
              </div>
              <Switch
                checked={settings.autoRemindersEnabled}
                onCheckedChange={saveAutoReminders}
              />
            </div>
            <div className="hidden sm:block h-8 w-px bg-slate-200" />
            <div className="flex items-center gap-3 shrink-0">
              <p className="text-[13px] text-slate-500 whitespace-nowrap">Días de anticipación</p>
              <Input
                type="number"
                min={0}
                max={28}
                className="w-16 h-8 text-center text-[13px]"
                value={daysDraft ?? String(settings.defaultReminderDays)}
                onChange={(e) => setDaysDraft(e.target.value)}
                onBlur={() => {
                  if (daysDraft === null) return;
                  const n = Number(daysDraft);
                  setDaysDraft(null);
                  if (!Number.isNaN(n) && n !== settings.defaultReminderDays) {
                    saveReminderDays(n);
                  }
                }}
              />
            </div>
          </div>
          {prefsError && (
            <p className="text-red-600 text-[12px] mt-2">
              No se pudo guardar la preferencia. Verifica tu conexión e intenta de nuevo.
            </p>
          )}
        </div>
      </div>

      {/* Tabla de inquilinos */}
      <div
        className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
      >
        <div className="px-6 py-4 border-b border-slate-100">
          <p className="text-[14px] font-semibold text-[#0B1426]">Estado de recordatorios — {currentMonthLabelCap}</p>
        </div>

        {tenantRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            {isLoading
              ? <Loader2 className="w-6 h-6 text-slate-300 animate-spin mb-2" />
              : <Bell className="w-7 h-7 text-slate-300 mb-2" />}
            <p className="text-[13px] text-slate-400">
              {isLoading ? "Cargando inquilinos…" : "No hay inquilinos registrados"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[780px]">
              <div className="grid grid-cols-[1fr_110px_80px_70px_110px_100px_130px] gap-x-3 px-6 py-2.5 border-b border-slate-100 bg-slate-50/50">
                {["Nombre", "Propiedad", "Día pago", "Anticip.", "Próx. recordatorio", "Estado", "Acción"].map((h) => (
                  <p key={h} className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">{h}</p>
                ))}
              </div>
              <div className="divide-y divide-slate-100">
                {tenantRows.map((row) => (
                  <div key={row.id} className="grid grid-cols-[1fr_110px_80px_70px_110px_100px_130px] gap-x-3 items-center px-6 py-3.5">
                    <p className="text-[13px] font-medium text-[#0B1426] truncate">{row.name}</p>
                    <p className="text-[12px] text-slate-400 truncate">{row.propertyName}</p>
                    <div>
                      <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5 whitespace-nowrap">
                        Día {row.paymentDay}
                      </span>
                    </div>
                    <p className="text-[12px] text-slate-500">{row.daysBefore}d</p>
                    <p className="text-[12px] text-slate-500 font-mono">{row.nextReminder}</p>
                    <div>
                      {row.reminderSent ? (
                        <>
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">
                            <CheckCircle2 className="w-3 h-3" /> Enviado
                          </span>
                          {row.lastReminderAt && (
                            <p className="text-[10px] text-slate-400 mt-1">
                              {format(new Date(row.lastReminderAt), "dd/MM HH:mm")}
                            </p>
                          )}
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5">
                          <BellOff className="w-3 h-3" /> No enviado
                        </span>
                      )}
                    </div>
                    <div>
                      <button
                        className={cn(
                          "inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap",
                          row.paymentStatus === "Pagado" || sendingId === row.id
                            ? "text-slate-300 cursor-not-allowed"
                            : "text-[#2952F3] hover:bg-[#eef1fd]"
                        )}
                        disabled={row.paymentStatus === "Pagado" || sendingId === row.id}
                        onClick={() => handleSend(row.id)}
                      >
                        {sendingId === row.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Send className="w-3.5 h-3.5" />}
                        {sendingId === row.id
                          ? "Enviando…"
                          : row.reminderSent ? "Reenviar" : "Enviar ahora"}
                      </button>
                      {rowErrors[row.id] && (
                        <p className="text-[10px] text-red-600 mt-0.5">{rowErrors[row.id]}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

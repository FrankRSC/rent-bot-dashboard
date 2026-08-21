"use client";

import { useEffect, useRef, useState } from "react";
import { format, addDays, setDate, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle2, BellOff, Loader2, Bell, Users, Clock, Send, CalendarClock } from "lucide-react";
import { ApiErrorState } from "@/components/layout/ApiErrorState";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useStore } from "@/store/useStore";
import * as api from "@/lib/api";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDaysUntilReminder(paymentDay: number, daysBefore: number): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  let reminderDate = addDays(setDate(currentMonth, paymentDay), -daysBefore);
  if (reminderDate <= today) {
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    reminderDate = addDays(setDate(nextMonth, paymentDay), -daysBefore);
  }
  return differenceInDays(reminderDate, today);
}

function NextReminderChip({ days }: { days: number }) {
  const base = "inline-flex text-[11px] font-semibold rounded-full px-2 py-0.5 whitespace-nowrap border";
  if (days === 0) return (
    <span className={cn(base, "font-bold text-amber-700 bg-amber-100 border-amber-200")}>hoy</span>
  );
  if (days <= 3) return (
    <span className={cn(base, "text-amber-700 bg-amber-50 border-amber-100")}>en {days}d</span>
  );
  return (
    <span className={cn(base, "text-slate-600 bg-slate-100 border-slate-200")}>en {days}d</span>
  );
}

// ─── Count-up ─────────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(target);
  const prevRef = useRef(target);

  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = target;
    if (from === target) return;
    let rafId: number;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (progress < 1) rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [target, duration]);

  return value;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RecordatoriosPage() {
  const {
    tenantsWithStatus, properties, settings, landlordId,
    sendReminder, updateSettings, fetchProperties, fetchAllTenants, fetchPayments,
    tenantsState, propertiesState,
  } = useStore();

  const [sendingId, setSendingId]   = useState<string | null>(null);
  const [rowErrors, setRowErrors]   = useState<Record<string, string>>({});
  const [justSentIds, setJustSentIds] = useState<Set<string>>(new Set());
  const [prefsError, setPrefsError] = useState(false);
  const [daysDraft, setDaysDraft]   = useState<string | null>(null);

  const handleSend = async (tenantId: string) => {
    setSendingId(tenantId);
    setRowErrors((prev) => ({ ...prev, [tenantId]: "" }));
    try {
      await sendReminder(tenantId);
      setJustSentIds((prev) => new Set(prev).add(tenantId));
      setTimeout(() => {
        setJustSentIds((prev) => { const n = new Set(prev); n.delete(tenantId); return n; });
      }, 1500);
    } catch {
      setRowErrors((prev) => ({ ...prev, [tenantId]: "No se pudo enviar. Intenta de nuevo." }));
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
  const currentMonthLabelCap = format(now, "MMMM yyyy", { locale: es })
    .replace(/^\w/, (c) => c.toUpperCase());

  const sentCount          = tenantsWithStatus.filter((t) => t.reminderSent).length;
  const pendingCount       = tenantsWithStatus.filter((t) => !t.reminderSent && t.paymentStatus !== "Pagado").length;
  const total              = tenantsWithStatus.length;
  const pct                = total > 0 ? sentCount / total : 0;
  const animatedSentCount  = useCountUp(sentCount);

  const tenantRows = tenantsWithStatus
    .map((t) => {
      const property = properties.find((p) => p.id === t.propertyId);
      const paymentDay = t.paymentDay ?? 1;
      return {
        ...t,
        propertyName: property?.name ?? "—",
        paymentDay,
        daysUntil: getDaysUntilReminder(paymentDay, settings.defaultReminderDays),
      };
    })
    .sort((a, b) => {
      const aScore = a.paymentStatus === "Pagado" ? 999 : a.reminderSent ? 500 : a.daysUntil;
      const bScore = b.paymentStatus === "Pagado" ? 999 : b.reminderSent ? 500 : b.daysUntil;
      return aScore - bScore;
    });

  const isLoading = propertiesState.loading || tenantsState.loading;
  const loadError = propertiesState.error || tenantsState.error;

  if (loadError) {
    return <ApiErrorState onRetry={() => { fetchProperties(); fetchAllTenants(); }} />;
  }

  return (
    <>
      <style>{`
        @keyframes rowFlash {
          0%   { background-color: rgb(167 243 208 / 0.5); }
          100% { background-color: transparent; }
        }
        @keyframes buttonPop {
          0%   { transform: scale(0.88); }
          60%  { transform: scale(1.05); }
          100% { transform: scale(1.00); }
        }
      `}</style>

      <div className="space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[22px] font-bold text-[#0B1426] tracking-tight">Recordatorios</h1>
            <p className="text-sm text-slate-500 mt-0.5">{currentMonthLabelCap}</p>
          </div>
          {isLoading && <Loader2 className="w-5 h-5 text-slate-300 animate-spin shrink-0" />}
        </div>

        {/* Hero card */}
        <div
          className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
        >
          <div className="px-6 pt-5 pb-5 space-y-4">

            {/* Stats chips — number inline with label, no kicker */}
            <div className="flex flex-wrap gap-2.5">
              <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <span className="text-[15px] font-bold text-emerald-700 tabular-nums leading-none">{animatedSentCount}</span>
                <span className="text-[13px] text-emerald-600">enviado{sentCount !== 1 ? "s" : ""}</span>
              </div>

              <div className={cn(
                "flex items-center gap-2.5 rounded-xl px-4 py-2.5 border",
                pendingCount > 0 ? "bg-amber-50 border-amber-100" : "bg-slate-50 border-slate-100"
              )}>
                <div className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                  pendingCount > 0 ? "bg-amber-100" : "bg-slate-100"
                )}>
                  <Clock className={cn("w-3.5 h-3.5", pendingCount > 0 ? "text-amber-600" : "text-slate-500")} />
                </div>
                <span className={cn(
                  "text-[15px] font-bold tabular-nums leading-none",
                  pendingCount > 0 ? "text-amber-700" : "text-[#0B1426]"
                )}>{pendingCount}</span>
                <span className={cn("text-[13px]", pendingCount > 0 ? "text-amber-600" : "text-slate-500")}>
                  pendiente{pendingCount !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="flex items-center gap-2.5 bg-[#eef1fd] border border-[#d5dcfb] rounded-xl px-4 py-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#d5dcfb] flex items-center justify-center shrink-0">
                  <Users className="w-3.5 h-3.5 text-[#2952F3]" />
                </div>
                <span className="text-[15px] font-bold text-[#0B1426] tabular-nums leading-none">{total}</span>
                <span className="text-[13px] text-[#4a6af0]">inquilino{total !== 1 ? "s" : ""}</span>
              </div>
            </div>

            {/* Progress bar */}
            {total > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[12px] text-slate-500">Recordatorios enviados este mes</p>
                  <p className="text-[12px] font-semibold text-slate-600 tabular-nums">
                    {animatedSentCount} de {total}
                  </p>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full w-full rounded-full bg-emerald-500 origin-left"
                    style={{
                      transform: `scaleX(${pct})`,
                      transition: "transform 1.2s cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                  />
                </div>
              </div>
            )}

            {/* Settings */}
            <div className="bg-slate-50 border border-slate-100 rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center justify-between flex-1 gap-4">
                <div>
                  <p className="text-[13px] font-semibold text-[#0B1426]">Recordatorios automáticos</p>
                  <p className="text-[12px] text-slate-500 mt-0.5">
                    El bot envía recordatorios automáticos a tus inquilinos
                  </p>
                </div>
                <Switch checked={settings.autoRemindersEnabled} onCheckedChange={saveAutoReminders} />
              </div>
              <div className="hidden sm:block h-8 w-px bg-slate-200" />
              <div className="flex items-center gap-3 shrink-0">
                <p className="text-[13px] text-slate-500 whitespace-nowrap">Días de anticipación</p>
                <Input
                  type="number" min={0} max={28}
                  className="w-16 h-8 text-center text-[13px]"
                  value={daysDraft ?? String(settings.defaultReminderDays)}
                  onChange={(e) => setDaysDraft(e.target.value)}
                  onBlur={() => {
                    if (daysDraft === null) return;
                    const n = Number(daysDraft);
                    setDaysDraft(null);
                    if (!Number.isNaN(n) && n !== settings.defaultReminderDays) saveReminderDays(n);
                  }}
                />
              </div>
            </div>

            {prefsError && (
              <p className="text-red-600 text-[12px]">
                No se pudo guardar la preferencia. Verifica tu conexión e intenta de nuevo.
              </p>
            )}
          </div>
        </div>

        {/* Table card */}
        <div
          className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
        >
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#eef1fd] flex items-center justify-center shrink-0">
              <CalendarClock className="w-3.5 h-3.5 text-[#2952F3]" />
            </div>
            <p className="text-[14px] font-semibold text-[#0B1426]">
              Estado de recordatorios — {currentMonthLabelCap}
            </p>
          </div>

          {tenantRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              {isLoading
                ? <Loader2 className="w-6 h-6 text-slate-300 animate-spin mb-2" />
                : <Bell className="w-7 h-7 text-slate-300 mb-2" />
              }
              <p className="text-[13px] text-slate-500">
                {isLoading ? "Cargando inquilinos…" : "No hay inquilinos registrados"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[700px]">

                {/* Column headers */}
                <div className="grid grid-cols-[1fr_120px_70px_82px_106px_130px] gap-x-3 px-6 py-2.5 border-b border-slate-100 bg-slate-50/50">
                  {["Nombre", "Propiedad", "Día", "Próximo", "Estado", "Acción"].map((h) => (
                    <p key={h} className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.08em]">{h}</p>
                  ))}
                </div>

                {/* Rows */}
                <div className="divide-y divide-slate-100">
                  {tenantRows.map((row) => {
                    const isJustSent = justSentIds.has(row.id);
                    const isPaid     = row.paymentStatus === "Pagado";
                    const isSending  = sendingId === row.id;

                    return (
                      <div
                        key={row.id}
                        className={cn(
                          "grid grid-cols-[1fr_120px_70px_82px_106px_130px] gap-x-3 items-center px-6 py-3.5",
                          !isJustSent && (
                            row.reminderSent
                              ? "bg-emerald-50/30 hover:bg-emerald-50/50"
                              : isPaid
                              ? "hover:bg-slate-50/50"
                              : "bg-amber-50/20 hover:bg-amber-50/40"
                          ),
                        )}
                        style={isJustSent
                          ? { animation: "rowFlash 1.5s cubic-bezier(0.16,1,0.3,1) forwards" }
                          : undefined
                        }
                      >
                        {/* Name */}
                        <p className="text-[13px] font-semibold text-[#0B1426] truncate">{row.name}</p>

                        {/* Property */}
                        <p className="text-[12px] text-slate-500 truncate">{row.propertyName}</p>

                        {/* Payment day */}
                        <div>
                          <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5 whitespace-nowrap">
                            Día {row.paymentDay}
                          </span>
                        </div>

                        {/* Next reminder chip */}
                        <div>
                          {isPaid ? (
                            <span className="text-[12px] text-slate-300">—</span>
                          ) : row.reminderSent ? (
                            <span className="text-[11px] text-slate-500">en {row.daysUntil}d</span>
                          ) : (
                            <NextReminderChip days={row.daysUntil} />
                          )}
                        </div>

                        {/* Status */}
                        <div>
                          {row.reminderSent ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                              <CheckCircle2 className="w-3 h-3" /> Enviado
                            </span>
                          ) : isPaid ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5">
                              Pagado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5">
                              <BellOff className="w-3 h-3" /> No enviado
                            </span>
                          )}
                        </div>

                        {/* Action */}
                        <div>
                          <button
                            disabled={isPaid || isSending}
                            onClick={() => handleSend(row.id)}
                            className={cn(
                              "inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap",
                              isPaid || isSending
                                ? "text-slate-300 cursor-not-allowed"
                                : isJustSent
                                ? "text-emerald-700 bg-emerald-100"
                                : "text-[#2952F3] hover:bg-[#eef1fd]"
                            )}
                            style={isJustSent
                              ? { animation: "buttonPop 0.35s cubic-bezier(0.16,1,0.3,1) forwards" }
                              : undefined
                            }
                          >
                            {isSending ? (
                              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enviando…</>
                            ) : isJustSent ? (
                              <><CheckCircle2 className="w-3.5 h-3.5" /> ¡Enviado!</>
                            ) : row.reminderSent ? (
                              <><Send className="w-3.5 h-3.5" /> Reenviar</>
                            ) : (
                              <><Send className="w-3.5 h-3.5" /> Enviar ahora</>
                            )}
                          </button>
                          {rowErrors[row.id] && (
                            <p className="text-[10px] text-red-600 mt-0.5">{rowErrors[row.id]}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

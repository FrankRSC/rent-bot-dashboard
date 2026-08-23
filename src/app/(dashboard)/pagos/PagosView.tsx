"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Download, ExternalLink, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/store/useStore";
import { ApiErrorState } from "@/components/layout/ApiErrorState";
import { attemptAmount, cn, formatCurrency } from "@/lib/utils";
import type { AttemptStatus, PaymentAttempt } from "@/lib/types";
import { AttemptStatusBadge } from "@/components/ui/StatusBadge";
import { PaymentDialog } from "./PaymentDialog";

// ── Helpers ────────────────────────────────────────────────────────────────────

function isCobrado(s: AttemptStatus)   { return s === "VERIFIED" || s === "MANUAL_VERIFIED"; }
function isPendiente(s: AttemptStatus) { return s === "PENDING"  || s === "PARTIAL"; }

type StatusGroupKey = "cobrado" | "pendiente" | "rechazado" | "revision";

function statusGroup(s: AttemptStatus): StatusGroupKey {
  if (isCobrado(s))                      return "cobrado";
  if (isPendiente(s))                    return "pendiente";
  if (s === "REVIEW")                    return "revision";
  return "rechazado"; // REJECTED, ERROR, ABANDONED
}

function exportarCSV(
  rows: PaymentAttempt[],
  tenantMap: Map<string, { name: string; propertyId: string }>,
  propertyMap: Map<string, string>
) {
  const headers = ["Inquilino", "Propiedad", "Monto", "Fecha", "Clave", "Banco", "Estado"];
  const data = rows.map((a) => {
    const ti   = tenantMap.get(a.tenantPhone);
    const prop = ti ? (propertyMap.get(ti.propertyId) ?? "—") : "—";
    const name = ti?.name ?? a.tenantPhone;
    const amount = attemptAmount(a);
    return [name, prop, amount.toString(), format(new Date(a.createdAt), "dd/MM/yyyy HH:mm"), (a.ocrData?.claveRastreo as string) ?? "—", (a.ocrData?.bancoEmisor as string) ?? "—", a.status];
  });
  const csv = [headers, ...data].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `pagos-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ── Count-up ──────────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 700) {
  const [value, setValue] = useState(target);
  const prevRef = useRef(target);
  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = target;
    if (from === target) return;
    let rafId: number;
    const t0 = performance.now();
    const animate = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      setValue(Math.round(from + (target - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [target, duration]);
  return value;
}

// ── View ───────────────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { value: "todos",     label: "Todos" },
  { value: "cobrado",   label: "Cobrado" },
  { value: "pendiente", label: "Pendiente" },
  { value: "rechazado", label: "Rechazado" },
  { value: "revision",  label: "Revisión" },
] as const;

type StatusTab = typeof STATUS_TABS[number]["value"];

export function PagosView({ initialPayments }: { initialPayments: PaymentAttempt[] | null }) {
  const { payments: storePayments, allTenants, properties, paymentsState, fetchPayments } = useStore();

  const [filterProperty, setFilterProperty] = useState("todos");
  const [filterMonth,    setFilterMonth]    = useState(() => format(new Date(), "yyyy-MM"));
  const [activeTab,      setActiveTab]      = useState<StatusTab>("todos");
  const [filterGen,      setFilterGen]      = useState(0);
  const [paymentOpen,    setPaymentOpen]    = useState(false);

  const MONTHS = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      return {
        value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: format(d, "MMMM yyyy", { locale: es }),
      };
    });
  }, []);

  const payments = useMemo(
    () => storePayments.length > 0 ? storePayments : (initialPayments ?? []),
    [storePayments, initialPayments]
  );

  const tenantMap = useMemo(() => {
    const m = new Map<string, { name: string; propertyId: string }>();
    allTenants.forEach((t) => m.set(t.phone, { name: t.name, propertyId: t.propertyId }));
    return m;
  }, [allTenants]);

  const propertyMap = useMemo(() => {
    const m = new Map<string, string>();
    properties.forEach((p) => m.set(p.id, p.name));
    return m;
  }, [properties]);

  // Pre-filter by month + property (base for tab counts AND final list)
  const baseFiltered = useMemo(() =>
    payments.filter((a) => {
      if (!a.createdAt.startsWith(filterMonth)) return false;
      if (filterProperty !== "todos") {
        const ti   = tenantMap.get(a.tenantPhone);
        const prop = ti ? (propertyMap.get(ti.propertyId) ?? "") : "";
        if (prop !== filterProperty) return false;
      }
      return true;
    }),
    [payments, tenantMap, propertyMap, filterProperty, filterMonth]
  );

  const tabCounts = useMemo(() => ({
    todos:     baseFiltered.length,
    cobrado:   baseFiltered.filter((a) => statusGroup(a.status) === "cobrado").length,
    pendiente: baseFiltered.filter((a) => statusGroup(a.status) === "pendiente").length,
    rechazado: baseFiltered.filter((a) => statusGroup(a.status) === "rechazado").length,
    revision:  baseFiltered.filter((a) => statusGroup(a.status) === "revision").length,
  }), [baseFiltered]);

  const filtered = useMemo(() =>
    activeTab === "todos"
      ? baseFiltered
      : baseFiltered.filter((a) => statusGroup(a.status) === (activeTab as StatusGroupKey)),
    [baseFiltered, activeTab]
  );

  const totalCobrado = baseFiltered.filter((a) => isCobrado(a.status))
    .reduce((s, a) => s + attemptAmount(a), 0);
  const animatedTotal = useCountUp(totalCobrado);

  const handleMonthChange    = (v: string | null) => { setFilterMonth(v ?? format(new Date(), "yyyy-MM")); setFilterGen((g) => g + 1); };
  const handlePropertyChange = (v: string | null) => { setFilterProperty(v ?? "todos"); setFilterGen((g) => g + 1); };

  const currentMonthLabel = useMemo(() => {
    const found = MONTHS.find((m) => m.value === filterMonth);
    return found?.label ?? filterMonth;
  }, [filterMonth, MONTHS]);

  if (paymentsState.error) return <ApiErrorState onRetry={fetchPayments} />;

  const showPropertyFilter = properties.length > 1;

  return (
    <>
      <style>{`
        @keyframes rowFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="space-y-4">

        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-[22px] font-bold text-[#0B1426] tracking-tight">Pagos</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">{currentMonthLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost" size="sm"
              className="gap-1.5 text-slate-500 hover:text-slate-700"
              onClick={() => exportarCSV(filtered, tenantMap, propertyMap)}
              disabled={filtered.length === 0}
            >
              <Download className="w-3.5 h-3.5" /> Exportar
            </Button>
            <Button
              size="sm"
              className="bg-[#2952F3] hover:bg-[#1e3fd4] gap-1.5"
              onClick={() => setPaymentOpen(true)}
            >
              <Plus className="w-3.5 h-3.5" /> Registrar pago
            </Button>
          </div>
        </div>

        {/* ── KPI strip ───────────────────────────────────────────────────────── */}
        <div
          className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden grid grid-cols-3 divide-x divide-slate-100"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
        >
          <div className="px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-1.5">Cobrado del mes</p>
            <p className="text-[22px] font-bold text-[#0B1426] tabular-nums leading-none mb-1">
              {formatCurrency(animatedTotal).replace(/\.\d+$/, "")}
            </p>
            <p className="text-[11px] text-emerald-600 font-medium">
              {tabCounts.cobrado} pago{tabCounts.cobrado !== 1 ? "s" : ""} verificado{tabCounts.cobrado !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-1.5">Pendiente</p>
            <p className="text-[22px] font-bold text-[#0B1426] tabular-nums leading-none mb-1">
              {tabCounts.pendiente}
            </p>
            <p className="text-[11px] text-amber-500 font-medium">
              pago{tabCounts.pendiente !== 1 ? "s" : ""} por resolver
            </p>
          </div>
          <div className="px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-1.5">En revisión</p>
            <p className={cn(
              "text-[22px] font-bold tabular-nums leading-none mb-1",
              tabCounts.revision > 0 ? "text-amber-600" : "text-[#0B1426]"
            )}>
              {tabCounts.revision}
            </p>
            <p className="text-[11px] text-slate-400 font-medium">
              {tabCounts.revision === 0 ? "sin incidencias" : "requiere atención"}
            </p>
          </div>
        </div>

        {/* ── Lista ───────────────────────────────────────────────────────────── */}
        <div
          className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
        >

          {/* Controles: mes + propiedad + pestañas */}
          <div className="px-4 pt-3.5 pb-3 border-b border-slate-100 space-y-3">

            {/* Fila superior: selectores */}
            <div className="flex flex-wrap items-center gap-2">
              <Select value={filterMonth} onValueChange={handleMonthChange}>
                <SelectTrigger className="h-8 w-44 text-[13px] border-slate-200 bg-white font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {showPropertyFilter && (
                <Select value={filterProperty} onValueChange={handlePropertyChange}>
                  <SelectTrigger className="h-8 w-44 text-[13px] border-slate-200 bg-white">
                    <SelectValue placeholder="Todas las propiedades" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas las propiedades</SelectItem>
                    {properties.map((p) => (
                      <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <span className="ml-auto text-[12px] text-slate-400">
                {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Pestañas de estado */}
            <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 w-fit">
              {STATUS_TABS.map((tab) => {
                const count = tabCounts[tab.value];
                const isActive = activeTab === tab.value;
                return (
                  <button
                    key={tab.value}
                    onClick={() => { setActiveTab(tab.value); setFilterGen((g) => g + 1); }}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all",
                      isActive
                        ? "bg-white text-[#0B1426] shadow-sm"
                        : "text-slate-500 hover:text-[#0B1426]"
                    )}
                  >
                    {tab.label}
                    <span className={cn(
                      "text-[11px] font-semibold px-1.5 py-px rounded-full min-w-[20px] text-center",
                      isActive
                        ? "bg-slate-100 text-slate-600"
                        : "text-slate-400"
                    )}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Encabezados de columna — solo desktop */}
          <div className="hidden sm:grid grid-cols-[1fr_130px_100px_110px_40px] px-4 py-2.5 border-b border-slate-100 bg-slate-50/40">
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Inquilino</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Estado</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 text-right pr-4">Monto</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 text-right pr-4">Fecha</span>
            <span />
          </div>

          {/* Filas */}
          {paymentsState.loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3 px-4 py-4 border-b border-slate-50 last:border-0">
                <div className="w-8 h-8 bg-slate-100 rounded-full animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-slate-100 rounded animate-pulse w-36" />
                  <div className="h-3   bg-slate-50  rounded animate-pulse w-24" />
                </div>
                <div className="h-6 bg-slate-100 rounded-full animate-pulse w-20" />
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <p className="text-[15px] font-semibold text-slate-400">Sin pagos</p>
              <p className="text-[13px] text-slate-400 mt-1">
                {activeTab !== "todos"
                  ? `No hay pagos con estado "${STATUS_TABS.find(t => t.value === activeTab)?.label}"`
                  : "No se registraron pagos en este periodo"}
              </p>
              {activeTab !== "todos" && (
                <button
                  onClick={() => setActiveTab("todos")}
                  className="text-[13px] text-[#2952F3] hover:underline mt-2"
                >
                  Ver todos los pagos
                </button>
              )}
            </div>
          ) : filtered.map((attempt, i) => {
            const ti       = tenantMap.get(attempt.tenantPhone);
            const propName = ti ? (propertyMap.get(ti.propertyId) ?? "—") : "—";
            const amount   = attemptAmount(attempt);
            const isManual = attempt.source === "MANUAL";
            const name     = ti?.name ?? attempt.tenantPhone;
            const ini      = name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();

            return (
              <Link
                key={`${filterGen}-${attempt.id}`}
                href={`/pagos/${attempt.id}`}
                className="block border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors cursor-pointer"
                style={{ animation: `rowFadeIn 260ms cubic-bezier(0.16,1,0.3,1) ${Math.min(i, 10) * 25}ms both` }}
              >
                {/* Mobile */}
                <div className="flex items-center gap-3 px-4 py-3.5 sm:hidden">
                  <div className="w-9 h-9 rounded-full bg-[#eef1fd] flex items-center justify-center text-[11px] font-bold text-[#2952F3] shrink-0">
                    {ini}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="text-[14px] font-semibold text-[#0B1426] truncate">{name}</p>
                      {isManual && (
                        <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 border border-slate-200 px-1.5 py-px rounded-full shrink-0">
                          Manual
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <AttemptStatusBadge status={attempt.status} />
                      <span className="text-[11px] text-slate-400">{propName}</span>
                      <span className="text-[11px] text-slate-300">·</span>
                      <span className="text-[11px] text-slate-400 tabular-nums">
                        {format(new Date(attempt.createdAt), "dd/MM/yy")}
                      </span>
                    </div>
                  </div>
                  <p className="text-[14px] font-bold text-[#0B1426] tabular-nums shrink-0">
                    {amount > 0 ? formatCurrency(amount) : "—"}
                  </p>
                </div>

                {/* Desktop */}
                <div className="hidden sm:grid grid-cols-[1fr_130px_100px_110px_40px] items-center px-4 py-3.5">
                  {/* Inquilino */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[#eef1fd] flex items-center justify-center text-[11px] font-bold text-[#2952F3] shrink-0">
                      {ini}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="text-[13px] font-semibold text-[#0B1426] truncate">{name}</p>
                        {isManual && (
                          <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 border border-slate-200 px-1.5 py-px rounded-full shrink-0 whitespace-nowrap">
                            Manual
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate">{propName}</p>
                    </div>
                  </div>
                  {/* Estado — antes que el monto */}
                  <div>
                    <AttemptStatusBadge status={attempt.status} />
                  </div>
                  {/* Monto */}
                  <p className="text-[13px] font-semibold text-[#0B1426] text-right tabular-nums pr-4">
                    {amount > 0 ? formatCurrency(amount) : "—"}
                  </p>
                  {/* Fecha */}
                  <p className="text-[12px] text-slate-500 text-right pr-4 tabular-nums">
                    {format(new Date(attempt.createdAt), "d MMM", { locale: es })}
                  </p>
                  {/* Detalle */}
                  <div className="flex justify-center">
                    <div
                      aria-hidden="true"
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}

          {/* Footer */}
          {filtered.length > 0 && !paymentsState.loading && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
              <span className="text-[12px] text-slate-400">
                {filtered.length} movimiento{filtered.length !== 1 ? "s" : ""}
              </span>
              <span className="text-[13px] font-bold text-[#0B1426] tabular-nums">
                Cobrado · {formatCurrency(animatedTotal)}
              </span>
            </div>
          )}
        </div>

      </div>

      <PaymentDialog open={paymentOpen} onClose={() => setPaymentOpen(false)} />
    </>
  );
}

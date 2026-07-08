"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { cn, formatCurrency } from "@/lib/utils";
import { useStore } from "@/store/useStore";
import { ApiErrorState } from "@/components/layout/ApiErrorState";
import { ArrowRight, Send, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, ResponsiveContainer, Tooltip,
} from "recharts";
import type { PaymentStatus } from "@/lib/types";
import { PaymentStatusBadge } from "@/components/ui/StatusBadge";

// ─── Constants ────────────────────────────────────────────────────────────────

const PERIODS = ["Mayo 26", "Abril", "Marzo", "YTD"] as const;
type Period = (typeof PERIODS)[number];

const MONTH_LABELS = ["E","F","M","A","M","J","J","A","S","O","N","D"];
const WEEK_DAYS = ["L","M","M","J","V","S","D"];

const monthlyData = [
  { m: "E", v: 42000 }, { m: "F", v: 55000 }, { m: "M", v: 62000 },
  { m: "A", v: 65000 }, { m: "M", v: 64800, current: true },
  { m: "J", v: 0 }, { m: "J", v: 0 }, { m: "A", v: 0 },
  { m: "S", v: 0 }, { m: "O", v: 0 }, { m: "N", v: 0 }, { m: "D", v: 0 },
];

const STATUS_ORDER: Record<PaymentStatus, number> = {
  Vencido: 0, Revisión: 1, Pendiente: 2, Pagado: 3,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildCalendar(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDay + 6) % 7;
  const cells: (number | null)[] = Array(startOffset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CollectionRing({ percent }: { percent: number }) {
  const r = 44;
  const sw = 7;
  const nr = r - sw / 2;
  const c = 2 * Math.PI * nr;
  const offset = c - (Math.min(percent, 100) / 100) * c;
  return (
    <div className="relative flex items-center justify-center w-[110px] h-[110px] shrink-0">
      <svg width="110" height="110" viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="50" cy="50" r={nr} fill="none" stroke="#f1f5f9" strokeWidth={sw} />
        <circle
          cx="50" cy="50" r={nr} fill="none"
          stroke="#10b981" strokeWidth={sw}
          strokeDasharray={c} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(.4,0,.2,1)" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="text-[24px] font-bold text-[#0B1426] leading-none tracking-tight">{percent}%</span>
        <span className="text-[10px] text-slate-400 font-medium mt-0.5 tracking-wide">COBRADO</span>
      </div>
    </div>
  );
}


// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [activePeriod, setActivePeriod] = useState<Period>("Mayo 26");
  const {
    payments, tenantsWithStatus, properties,
    propertiesState, paymentsState,
    fetchProperties, fetchTenants, fetchPayments, fetchAllTenants,
  } = useStore();

  const now = new Date();
  const calendar = buildCalendar(now.getFullYear(), now.getMonth());
  const today = now.getDate();
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const thisMonthPayments = payments.filter((a) => a.createdAt.startsWith(currentYM));

  const cobradoThisMonth = thisMonthPayments.filter(
    (a) => a.status === "VERIFIED" || a.status === "INTRABANK_OK"
  );

  const totalCobrado = cobradoThisMonth.reduce(
    (s, a) => s + Number(a.ocrData?.monto ?? a.cepResponse?.monto ?? 0), 0
  );

  const cobradoCount  = tenantsWithStatus.filter((t) => t.paymentStatus === "Pagado").length;
  const pendienteCount = tenantsWithStatus.filter((t) => t.paymentStatus === "Pendiente").length;
  const vencidoCount  = tenantsWithStatus.filter((t) => t.paymentStatus === "Vencido").length;
  const revisionCount = tenantsWithStatus.filter((t) => t.paymentStatus === "Revisión").length;
  const totalTenants  = tenantsWithStatus.length;
  const paidPercent   = totalTenants > 0 ? Math.round((cobradoCount / totalTenants) * 100) : 0;

  const totalExpected = tenantsWithStatus.reduce(
    (s, t) => s + (t.monthlyAmount ? Number(t.monthlyAmount) : 0), 0
  );

  const paidDays = new Set(cobradoThisMonth.map((a) => new Date(a.createdAt).getDate()));

  const sortedTenants = useMemo(() =>
    [...tenantsWithStatus].sort(
      (a, b) => STATUS_ORDER[a.paymentStatus] - STATUS_ORDER[b.paymentStatus]
    ),
  [tenantsWithStatus]);

  const nextDueLabel = useMemo(() => {
    const days = tenantsWithStatus
      .filter((t) => t.paymentStatus !== "Pagado" && t.paymentDay)
      .map((t) => t.paymentDay as number)
      .sort((a, b) => a - b);
    if (!days.length) return "—";
    const target = new Date(now.getFullYear(), now.getMonth(), days[0]);
    if (target <= now) target.setMonth(target.getMonth() + 1);
    return target.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
  }, [tenantsWithStatus, now]);

  const monthLabel = now.toLocaleDateString("es-MX", { month: "long", year: "numeric" });

  const hasError = !!(propertiesState.error || paymentsState.error);
  const handleRetry = () => {
    fetchPayments(); fetchAllTenants(); fetchProperties().then(() => fetchTenants());
  };

  if (hasError) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80">
        <ApiErrorState onRetry={handleRetry} />
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <div
        className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
      >

        {/* Top bar */}
        <div className="flex items-center justify-between px-6 pt-5 pb-0">
          <div className="flex items-center gap-3">
            <p className="text-[13px] font-semibold text-slate-600 capitalize">{monthLabel}</p>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              En vivo
            </span>
          </div>
          <div className="flex items-center gap-0.5 bg-slate-100 border border-slate-200 rounded-xl p-1">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setActivePeriod(p)}
                className={cn(
                  "px-3 py-1 text-[12px] font-semibold rounded-lg transition-all whitespace-nowrap",
                  activePeriod === p ? "bg-[#2952F3] text-white" : "text-slate-500 hover:text-slate-700"
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 px-6 py-6">

          {/* Left: Big number */}
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400 mb-2">
              Cobrado del mes
            </p>
            <div className="flex items-baseline gap-1 tabular-nums">
              <span className="text-[42px] sm:text-[52px] font-bold text-[#0B1426] leading-none tracking-tight">
                {formatCurrency(totalCobrado).replace(/\.\d+$/, "")}
              </span>
              <span className="text-[20px] font-light text-slate-400 leading-none">
                {formatCurrency(totalCobrado).match(/\.\d+$/)?.[0] ?? ""}
              </span>
            </div>
            {totalExpected > 0 && (
              <p className="text-[13px] text-slate-400 mt-1.5">
                de{" "}
                <span className="text-slate-600 font-medium">
                  {formatCurrency(totalExpected)}
                </span>{" "}
                esperado este mes
              </p>
            )}

            {/* Progress bar */}
            <div className="mt-4 space-y-1.5">
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-1000"
                  style={{ width: `${paidPercent}%` }}
                />
              </div>
              <div className="flex gap-4 text-[12px]">
                {cobradoCount > 0 && (
                  <span className="text-emerald-600 font-medium">
                    {cobradoCount} cobrado{cobradoCount !== 1 ? "s" : ""}
                  </span>
                )}
                {pendienteCount > 0 && (
                  <span className="text-amber-500 font-medium">
                    {pendienteCount} pendiente{pendienteCount !== 1 ? "s" : ""}
                  </span>
                )}
                {vencidoCount > 0 && (
                  <span className="text-red-500 font-medium">
                    {vencidoCount} vencido{vencidoCount !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Center: Ring */}
          <CollectionRing percent={paidPercent} />

          {/* Right: Mini stats */}
          <div className="hidden sm:flex flex-col gap-4 pl-4 border-l border-slate-100 min-w-[140px]">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 mb-1">
                Contratos
              </p>
              <p className="text-[22px] font-bold text-[#0B1426] leading-none">{totalTenants}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">activos este mes</p>
            </div>
            <div className="w-full h-px bg-slate-100" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 mb-1">
                Próximo vence
              </p>
              <p className="text-[22px] font-bold text-[#2952F3] leading-none capitalize">
                {nextDueLabel}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">recordatorio activo</p>
            </div>
          </div>

        </div>
      </div>

      {/* ── Contenido ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-5">

        {/* Estado de contratos */}
        <div
          className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div>
              <h2 className="text-[14px] font-semibold text-[#0B1426]">Estado de contratos</h2>
              <p className="text-[12px] text-slate-400 mt-0.5 capitalize">{monthLabel}</p>
            </div>
            <div className="flex items-center gap-2">
              {vencidoCount > 0 && (
                <span className="inline-flex items-center gap-1 bg-red-50 border border-red-200 text-red-600 text-[11px] font-semibold px-2.5 py-1 rounded-full">
                  <AlertCircle className="w-3 h-3" /> {vencidoCount} vencido{vencidoCount !== 1 ? "s" : ""}
                </span>
              )}
              {revisionCount > 0 && (
                <span className="inline-flex items-center gap-1 bg-purple-50 border border-purple-200 text-purple-600 text-[11px] font-semibold px-2.5 py-1 rounded-full">
                  {revisionCount} en revisión
                </span>
              )}
              <Link
                href="/recordatorios"
                className="flex items-center gap-1 text-[12px] font-semibold text-[#2952F3] hover:text-[#1e3fd4] transition-colors shrink-0"
              >
                Recordatorios <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Column labels */}
          <div className="hidden sm:grid grid-cols-[1fr_130px_110px_80px] items-center px-6 py-2.5 border-b border-slate-100 bg-slate-50/60">
            {["Inquilino · Propiedad", "Renta mensual", "Estado", "Acción"].map((h, i) => (
              <span
                key={i}
                className={cn(
                  "text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400",
                  i === 1 && "text-right",
                  i === 2 && "text-center",
                  i === 3 && "text-center",
                )}
              >
                {h}
              </span>
            ))}
          </div>

          {/* Tenant rows */}
          {sortedTenants.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-[13px] text-slate-400">No hay contratos registrados</p>
              <Link
                href="/propiedades"
                className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-[#2952F3]"
              >
                Agregar propiedad <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : sortedTenants.map((tenant) => {
            const property = properties.find((p) => p.id === tenant.propertyId);
            const ini = initials(tenant.name);
            const isUrgent = tenant.paymentStatus === "Vencido" || tenant.paymentStatus === "Revisión";

            return (
              <div
                key={tenant.id}
                className={cn(
                  "border-b border-slate-50 last:border-0 transition-colors",
                  isUrgent ? "hover:bg-red-50/30" : "hover:bg-slate-50/60"
                )}
              >
                {/* Mobile */}
                <div className="flex items-center gap-3 px-4 py-3.5 sm:hidden">
                  <div className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0",
                    tenant.paymentStatus === "Pagado" ? "bg-emerald-50 text-emerald-700" :
                    tenant.paymentStatus === "Vencido" ? "bg-red-50 text-red-600" :
                    "bg-[#eef1fd] text-[#2952F3]"
                  )}>
                    {ini}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#0B1426] truncate">{tenant.name}</p>
                    <p className="text-[11px] text-slate-400">{property?.name ?? "—"}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {tenant.monthlyAmount && (
                      <span className="text-[13px] font-semibold text-[#0B1426] tabular-nums">
                        {formatCurrency(Number(tenant.monthlyAmount))}
                      </span>
                    )}
                    <PaymentStatusBadge status={tenant.paymentStatus} />
                  </div>
                </div>

                {/* Desktop */}
                <div className="hidden sm:grid grid-cols-[1fr_130px_110px_80px] items-center px-6 py-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0",
                      tenant.paymentStatus === "Pagado" ? "bg-emerald-50 text-emerald-700" :
                      tenant.paymentStatus === "Vencido" ? "bg-red-50 text-red-600" :
                      "bg-[#eef1fd] text-[#2952F3]"
                    )}>
                      {ini}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-[#0B1426] truncate">{tenant.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {property?.name ?? "—"}{tenant.paymentDay ? ` · Día ${tenant.paymentDay}` : ""}
                      </p>
                    </div>
                  </div>
                  <span className="text-[13px] font-semibold text-[#0B1426] text-right tabular-nums">
                    {tenant.monthlyAmount ? formatCurrency(Number(tenant.monthlyAmount)) : "—"}
                  </span>
                  <div className="flex justify-center">
                    <PaymentStatusBadge status={tenant.paymentStatus} />
                  </div>
                  <div className="flex justify-center">
                    {tenant.paymentStatus !== "Pagado" && (
                      <Link href="/recordatorios">
                        <button className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-[#2952F3] hover:bg-[#eef1fd] transition-colors">
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Footer */}
          {sortedTenants.length > 0 && (
            <div className="flex items-center justify-between px-6 py-3.5 bg-slate-50/60 border-t border-slate-100">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-[12px] text-emerald-600 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {cobradoCount} pagado{cobradoCount !== 1 ? "s" : ""}
                </span>
                {(pendienteCount + vencidoCount) > 0 && (
                  <span className="text-[12px] text-slate-400">
                    · {pendienteCount + vencidoCount} pendiente{(pendienteCount + vencidoCount) !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <span className="text-[13px] font-bold text-[#0B1426] tabular-nums">
                {formatCurrency(totalCobrado)}
              </span>
            </div>
          )}
        </div>

        {/* Columna derecha */}
        <div className="flex flex-col gap-5">

          {/* Gráfica */}
          <div
            className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden"
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-[14px] font-semibold text-[#0B1426]">Cobranza mensual</h2>
              <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                2026
              </span>
            </div>
            <div className="px-3 pt-5 pb-3">
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={monthlyData} barCategoryGap="34%" margin={{ top: 0, right: 4, left: 4, bottom: 0 }}>
                  <XAxis dataKey="m" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                  <Tooltip
                    formatter={(v) => [formatCurrency(Number(v ?? 0)), "Cobrado"]}
                    contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #e2e8f0", boxShadow: "0 8px 24px rgba(0,0,0,0.08)", padding: "6px 12px" }}
                    cursor={{ fill: "#f8fafc", radius: 4 }}
                  />
                  <Bar
                    dataKey="v"
                    maxBarSize={16}
                    minPointSize={4}
                    shape={(props: { x?: number; y?: number; width?: number; height?: number; payload?: { current?: boolean; v: number } }) => {
                      const { x = 0, y = 0, width = 0, height = 0, payload } = props;
                      const fill = payload?.current ? "#10b981" : (payload?.v ?? 0) > 0 ? "#2952F3" : "#f1f5f9";
                      return <rect x={x} y={y} width={Math.max(0, width)} height={Math.max(0, height)} fill={fill} rx={3} ry={3} />;
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Calendario */}
          <div
            className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden flex-1"
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
          >
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-[#0B1426]">Pagos del mes</h2>
              <span className="text-[12px] text-slate-400 capitalize">
                {now.toLocaleDateString("es-MX", { month: "short" })}
              </span>
            </div>
            <div className="px-4 pt-3 pb-4">
              <div className="grid grid-cols-7 mb-2">
                {WEEK_DAYS.map((d, i) => (
                  <div key={i} className="text-center text-[10px] font-bold tracking-wider text-slate-300 py-1">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {calendar.map((day, i) => {
                  if (day === null) return <div key={i} />;
                  const isPaid  = paidDays.has(day);
                  const isToday = day === today;
                  return (
                    <div
                      key={i}
                      className={cn(
                        "aspect-square flex items-center justify-center text-[11px] font-medium rounded-lg select-none transition-all",
                        isPaid  && "bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold",
                        !isPaid && !isToday && "text-slate-400 hover:bg-slate-100",
                        isToday && "ring-2 ring-[#2952F3] ring-offset-1 bg-[#2952F3]/5 font-bold text-[#2952F3]"
                      )}
                    >
                      {day}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-50 border border-emerald-200" />
                  <span className="text-[11px] text-slate-400">Pago recibido</span>
                </div>
                <div className="flex items-center gap-1.5 ml-auto">
                  <span className="w-2.5 h-2.5 rounded-sm border-2 border-[#2952F3]" />
                  <span className="text-[11px] text-slate-400">Hoy</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import { useStore } from "@/store/useStore";
import { ApiErrorState } from "@/components/layout/ApiErrorState";
import {
  BarChart,
  Bar,
  XAxis,
  Cell,
  ResponsiveContainer,
} from "recharts";

// ─── Constants ────────────────────────────────────────────────────────────────

const PERIODS = ["MAYO 2026", "ABRIL", "MARZO", "YTD"] as const;
type Period = (typeof PERIODS)[number];

const WEEK_DAYS = ["L", "M", "M", "J", "V", "S", "D"];

const monthlyData = [
  { month: "E", value: 42000 },
  { month: "F", value: 55000 },
  { month: "M", value: 62000 },
  { month: "A", value: 65000 },
  { month: "M", value: 64800, current: true },
  { month: "J", value: 0 },
  { month: "J", value: 0 },
  { month: "A", value: 0 },
  { month: "S", value: 0 },
  { month: "O", value: 0 },
  { month: "N", value: 0 },
  { month: "D", value: 0 },
];

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

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
      {children}
    </span>
  );
}

function MetricValue({ amount }: { amount: number }) {
  const formatted = formatCurrency(amount);
  const dot = formatted.lastIndexOf(".");
  const main = formatted.slice(0, dot);
  const cents = formatted.slice(dot);
  return (
    <span className="inline-flex items-baseline gap-[1px]">
      <span className="text-[22px] sm:text-[30px] font-bold tracking-tight leading-none text-[#0B1426]">
        {main}
      </span>
      <span className="text-[14px] sm:text-[18px] font-light leading-none text-slate-400">{cents}</span>
    </span>
  );
}

function StatusBadge({ status }: { status: "cobrado" | "pendiente" | "rechazado" }) {
  if (status === "cobrado") {
    return (
      <span className="inline-flex items-center gap-1 bg-[#ecfdf5] border border-[#6ee7b7] text-[#047857] text-[11px] font-semibold px-2.5 py-[3px] rounded-full whitespace-nowrap">
        <svg width="9" height="9" viewBox="0 0 9 9" fill="none" className="shrink-0">
          <path d="M1.5 4.5L3.5 6.5L7.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Cobrado
      </span>
    );
  }
  if (status === "pendiente") {
    return (
      <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-600 text-[11px] font-semibold px-2.5 py-[3px] rounded-full whitespace-nowrap">
        <span className="text-[13px] leading-none">≈</span>
        Pendiente
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 bg-purple-50 border border-purple-200 text-purple-600 text-[11px] font-semibold px-2.5 py-[3px] rounded-full whitespace-nowrap">
      <svg width="9" height="9" viewBox="0 0 9 9" fill="none" className="shrink-0">
        <path d="M2 2L7 7M7 2L2 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      Revisión
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [activePeriod, setActivePeriod] = useState<Period>("MAYO 2026");
  const { payments, tenantsWithStatus, allTenants, properties, propertiesState, paymentsState, fetchProperties, fetchTenants, fetchPayments, fetchAllTenants } = useStore();

  const now = new Date();
  const calendar = buildCalendar(now.getFullYear(), now.getMonth());
  const today = now.getDate();

  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const thisMonthPayments = payments.filter((a) => a.createdAt.startsWith(currentYM));

  const movimientos = useMemo(() => {
    return payments.slice(0, 10).map((attempt) => {
      const tenant = allTenants.find((t) => t.phone === attempt.tenantPhone);
      const property = tenant ? properties.find((p) => p.id === tenant.propertyId) : undefined;
      const isCobrado = attempt.status === "VERIFIED" || attempt.status === "INTRABANK_OK";
      const isPending = attempt.status === "PENDING";
      const date = new Date(attempt.createdAt);
      return {
        day: `${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1).toString().padStart(2, "0")}`,
        tenant: tenant?.name ?? attempt.tenantPhone,
        property: property?.name ?? "—",
        amount: Number(attempt.ocrData?.monto ?? attempt.cepResponse?.monto ?? 0),
        status: (isCobrado ? "cobrado" : isPending ? "pendiente" : "rechazado") as "cobrado" | "pendiente" | "rechazado",
      };
    });
  }, [payments, allTenants, properties]);

  const cobradoThisMonth = thisMonthPayments.filter((a) => a.status === "VERIFIED" || a.status === "INTRABANK_OK");
  const pendienteCount = tenantsWithStatus.filter((t) => t.paymentStatus === "Pendiente" || t.paymentStatus === "Revisión").length;
  const vencidoCount = tenantsWithStatus.filter((t) => t.paymentStatus === "Vencido").length;

  const paidDays = new Set(cobradoThisMonth.map((a) => new Date(a.createdAt).getDate()));
  const pendingDays = new Set<number>();

  const totalCobrado = cobradoThisMonth.reduce(
    (s, a) => s + Number(a.ocrData?.monto ?? a.cepResponse?.monto ?? 0), 0
  );

  const pendingOcrByPhone = new Map<string, number>();
  thisMonthPayments
    .filter((a) => a.status === "PENDING")
    .forEach((a) => {
      if (!pendingOcrByPhone.has(a.tenantPhone)) {
        pendingOcrByPhone.set(a.tenantPhone, Number(a.ocrData?.monto ?? 0));
      }
    });

  const totalPendiente = tenantsWithStatus
    .filter((t) => t.paymentStatus === "Pendiente" || t.paymentStatus === "Vencido" || t.paymentStatus === "Revisión")
    .reduce((s, t) => {
      const amount = t.monthlyAmount
        ? Number(t.monthlyAmount)
        : (pendingOcrByPhone.get(t.phone) ?? 0);
      return s + amount;
    }, 0);

  const totalAll = movimientos.reduce((s, m) => s + m.amount, 0);
  const cobradoCount = tenantsWithStatus.filter((t) => t.paymentStatus === "Pagado").length;

  const hasError = !!(propertiesState.error || paymentsState.error);

  const handleRetry = () => {
    fetchPayments();
    fetchAllTenants();
    fetchProperties().then(() => fetchTenants());
  };

  if (hasError) {
    return (
      <div
        className="bg-white rounded-2xl overflow-hidden border border-slate-200/80"
        style={{ boxShadow: "0 2px 8px -2px rgba(0,0,0,0.06), 0 4px 20px -4px rgba(0,0,0,0.06)" }}
      >
        <ApiErrorState onRetry={handleRetry} />
      </div>
    );
  }

  return (
    <div
      className="bg-white rounded-2xl overflow-hidden border border-slate-200/80"
      style={{ boxShadow: "0 2px 8px -2px rgba(0,0,0,0.06), 0 4px 20px -4px rgba(0,0,0,0.06)" }}
    >
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-8 py-4 sm:py-5 gap-2 sm:gap-0">
        <div className="flex items-center gap-3">
          <h1 className="text-[15px] font-semibold text-[#0B1426] tracking-tight">
            Resumen de cobranza
          </h1>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#047857] bg-[#ecfdf5] border border-[#6ee7b7] px-2.5 py-1 rounded-full">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34d399] opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#047857]" />
            </span>
            EN VIVO
          </span>
        </div>
        <nav className="flex items-center gap-0.5 overflow-x-auto pb-0.5 sm:pb-0">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setActivePeriod(p)}
              className={cn(
                "px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-all duration-150 whitespace-nowrap shrink-0",
                activePeriod === p
                  ? "border border-slate-300 bg-white text-[#0B1426] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                  : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
              )}
            >
              {p}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Metric Cards ──────────────────────────────────────────────── */}
      <div className="border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4">

        <div className="px-4 sm:px-8 py-5 sm:py-6 border-r border-b sm:border-b-0 border-slate-100">
          <SectionLabel>Cobrado del mes</SectionLabel>
          <div className="mt-2.5">
            <MetricValue amount={totalCobrado} />
          </div>
          <p className="mt-2 text-[12px] font-medium text-[#047857]">
            ↑ {cobradoCount} de {tenantsWithStatus.length} contratos
          </p>
        </div>

        <div className="px-4 sm:px-8 py-5 sm:py-6 border-b sm:border-b-0 sm:border-r border-slate-100">
          <SectionLabel>Pendiente</SectionLabel>
          <div className="mt-2.5">
            <MetricValue amount={totalPendiente} />
          </div>
          <p className="mt-2 text-[12px] font-medium text-amber-500">
            {pendienteCount} pendiente{pendienteCount !== 1 ? "s" : ""}
            {vencidoCount > 0 && (
              <span className="text-red-500 ml-1">· {vencidoCount} vencido{vencidoCount !== 1 ? "s" : ""}</span>
            )}
          </p>
        </div>

        <div className="px-4 sm:px-8 py-5 sm:py-6 border-r border-slate-100">
          <SectionLabel>Validación más rápida</SectionLabel>
          <div className="mt-2.5">
            <span className="text-[22px] sm:text-[30px] font-bold tracking-tight leading-none text-[#0B1426]">
              1.8s
            </span>
          </div>
          <p className="mt-2 text-[12px] font-medium text-slate-400">Polanco 12B</p>
        </div>

        <div className="px-4 sm:px-8 py-5 sm:py-6">
          <SectionLabel>Próximo vencimiento</SectionLabel>
          <div className="mt-2.5">
            <span className="text-[22px] sm:text-[30px] font-bold tracking-tight leading-none text-blue-600">
              01 jun
            </span>
          </div>
          <p className="mt-2 text-[12px] font-medium text-slate-400">Recordatorio programado</p>
        </div>

      </div>

      {/* ── Main Content ──────────────────────────────────────────────── */}
      <div className="border-t border-slate-100 grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4 sm:gap-5 p-4 sm:p-5">

        {/* Left — Movements table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">

          {/* Table header bar */}
          <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-100 bg-slate-50/60">
            <SectionLabel>Movimientos recientes</SectionLabel>
            <SectionLabel>{cobradoCount} / {tenantsWithStatus.length} Contratos</SectionLabel>
          </div>

          {/* Column labels — hidden on mobile */}
          <div className="hidden sm:grid grid-cols-[64px_1fr_140px_120px] px-5 py-2.5 border-b border-slate-100">
            <SectionLabel>Fecha</SectionLabel>
            <SectionLabel>Inquilino · Propiedad</SectionLabel>
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400 text-right">
              Monto
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400 text-right">
              Estado
            </span>
          </div>

          {/* Rows */}
          {movimientos.length === 0 ? (
            <div className="px-5 py-10 text-center text-[13px] text-slate-400">
              No hay movimientos registrados
            </div>
          ) : movimientos.map((row, i) => (
            <div
              key={i}
              className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70 transition-colors cursor-default"
            >
              {/* Mobile layout */}
              <div className="flex items-center justify-between px-4 py-3.5 sm:hidden">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-[11px] text-slate-400 font-medium tabular-nums shrink-0">{row.day}</span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[#0B1426] leading-tight truncate">{row.tenant}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 truncate">{row.property}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0 ml-3">
                  <span className="text-[12px] font-semibold text-[#0B1426] tabular-nums">{formatCurrency(row.amount)}</span>
                  <StatusBadge status={row.status} />
                </div>
              </div>
              {/* Desktop layout */}
              <div className="hidden sm:grid grid-cols-[64px_1fr_140px_120px] items-center px-5 py-4">
                <span className="text-[12px] text-slate-400 font-medium tabular-nums">{row.day}</span>
                <div>
                  <p className="text-[13px] font-semibold text-[#0B1426] leading-tight">{row.tenant}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{row.property}</p>
                </div>
                <span className="text-[13px] font-semibold text-[#0B1426] text-right tabular-nums">
                  {formatCurrency(row.amount)}
                </span>
                <div className="flex items-center justify-end">
                  <StatusBadge status={row.status} />
                </div>
              </div>
            </div>
          ))}

          {/* Footer */}
          <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 bg-slate-50/60 border-t border-slate-100">
            <SectionLabel>{tenantsWithStatus.length} Contrato{tenantsWithStatus.length !== 1 ? "s" : ""} activo{tenantsWithStatus.length !== 1 ? "s" : ""}</SectionLabel>
            <span className="text-[13px] font-semibold text-slate-700 tabular-nums">
              Total · {formatCurrency(totalAll)}
            </span>
          </div>

        </div>

        {/* Right — Chart + Calendar */}
        <div className="flex flex-col gap-4 sm:gap-5">

          {/* Bar chart */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-100 bg-slate-50/60">
              <SectionLabel>Cobranza por mes</SectionLabel>
              <SectionLabel>2026 YTD</SectionLabel>
            </div>
            <div className="px-3 pt-4 pb-2">
              <ResponsiveContainer width="100%" height={128}>
                <BarChart
                  data={monthlyData}
                  barCategoryGap="30%"
                  margin={{ top: 0, right: 4, left: 4, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="blueBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4f76e8" />
                      <stop offset="100%" stopColor="#c7d2fe" />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 10, fill: "#94a3b8", fontFamily: "var(--font-inter)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={20} minPointSize={4}>
                    {monthlyData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={
                          entry.current
                            ? "#059669"
                            : entry.value > 0
                            ? "url(#blueBar)"
                            : "#f1f5f9"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Calendar */}
          <div className="border border-slate-200 rounded-xl overflow-hidden flex-1">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-100 bg-slate-50/60">
              <SectionLabel>Vencimientos del mes</SectionLabel>
              <span className="hidden sm:inline"><SectionLabel>Recordatorios automáticos</SectionLabel></span>
            </div>
            <div className="px-4 py-3">

              <div className="grid grid-cols-7 mb-1.5">
                {WEEK_DAYS.map((d, i) => (
                  <div key={i} className="text-center text-[10px] font-bold tracking-widest text-slate-300 py-1">
                    {d}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {calendar.map((day, i) => {
                  if (day === null) return <div key={i} />;
                  const isPaid    = paidDays.has(day);
                  const isPending = pendingDays.has(day);
                  const isToday   = day === today;
                  return (
                    <div
                      key={i}
                      className={cn(
                        "aspect-square flex items-center justify-center text-[11px] font-medium rounded-lg select-none transition-colors",
                        isPaid    && "bg-[#ecfdf5] border border-[#a7f3d0] text-[#047857] font-semibold",
                        isPending && "bg-amber-50 border border-amber-100 text-amber-600 font-semibold",
                        !isPaid && !isPending && !isToday && "text-slate-500 hover:bg-slate-100 cursor-pointer",
                        isToday   && "ring-2 ring-[#2952F3] ring-offset-1 bg-white font-bold text-[#0B1426]"
                      )}
                    >
                      {day}
                    </div>
                  );
                })}
              </div>

            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

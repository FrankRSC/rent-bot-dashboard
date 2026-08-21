"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn, formatCurrency } from "@/lib/utils";
import { useStore } from "@/store/useStore";
import { ApiErrorState } from "@/components/layout/ApiErrorState";
import { ArrowRight } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell,
} from "recharts";
import type { Tenant, PaymentAttempt, PaymentStatus, Property, TenantWithStatus } from "@/lib/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_LABELS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const MONTH_SHORT  = ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function reminderSentThisMonth(lastReminderAt?: string | null): boolean {
  if (!lastReminderAt) return false;
  const sent = new Date(lastReminderAt);
  const now  = new Date();
  return sent.getFullYear() === now.getFullYear() && sent.getMonth() === now.getMonth();
}

function toTenantsWithStatus(tenants: Tenant[]): TenantWithStatus[] {
  return tenants.map((t) => ({
    ...t,
    paymentStatus: t.paymentStatus ?? "Vigente",
    lastPaymentDate: t.lastPaymentDate ?? null,
    reminderSent: reminderSentThisMonth(t.lastReminderAt),
  }));
}

// ─── Status badge (movimientos) ───────────────────────────────────────────────

/**
 * Variante compacta del badge de estado para la tabla de movimientos.
 *
 * `status` se tipa como `PaymentStatus` y no como `string` a propósito: venía
 * suelto y por eso el compilador no avisó cuando la escala pasó a tres plazos
 * — `Atrasado` caía al genérico y se pintaba con una etiqueta que ya no existe.
 */
const MOVIMIENTO_BADGE: Record<PaymentStatus, { label: string; cls: string }> = {
  Pagado:   { label: "Cobrado",    cls: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  Parcial:  { label: "~ Parcial",  cls: "bg-blue-50    text-blue-700    border-blue-100"    },
  Vigente:  { label: "En plazo",   cls: "bg-slate-50   text-slate-600   border-slate-200"   },
  Atrasado: { label: "⚠ Atrasado", cls: "bg-amber-50   text-amber-700   border-amber-100"   },
  Vencido:  { label: "⚠ Vencido",  cls: "bg-red-50     text-red-700     border-red-100"     },
  Revisión: { label: "Revisión",   cls: "bg-purple-50  text-purple-700  border-purple-100"  },
};

function MovimientosBadge({ status }: { status: PaymentStatus }) {
  const { label, cls } = MOVIMIENTO_BADGE[status];
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full border", cls)}>
      {status === "Pagado" && (
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
          <path d="M1.5 4L3 5.5L6.5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {label}
    </span>
  );
}

// ─── Calendar grid ────────────────────────────────────────────────────────────

function CalendarGrid({ tenants, now }: { tenants: TenantWithStatus[]; now: Date }) {
  const year  = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow    = new Date(year, month, 1).getDay();
  const offset      = firstDow === 0 ? 6 : firstDow - 1; // Monday-first

  const dayMap = new Map<number, "paid" | "pending">();
  tenants.forEach((t) => {
    if (!t.paymentDay) return;
    const d = Number(t.paymentDay);
    const s = t.paymentStatus === "Pagado" ? "paid" : "pending";
    if (!dayMap.has(d)) dayMap.set(d, s);
    else if (dayMap.get(d) === "paid" && s === "pending") dayMap.set(d, "pending");
  });

  const cells: (number | null)[] = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div>
      <div className="grid grid-cols-7 mb-0.5">
        {["L", "M", "M", "J", "V", "S", "D"].map((h, i) => (
          <div key={i} className="text-center text-[10px] font-bold text-slate-300 uppercase py-1">
            {h}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-[3px]">
        {cells.map((day, i) =>
          day === null ? (
            <div key={`e${i}`} />
          ) : (
            <div
              key={day}
              // El anillo de "hoy" se superpone al color de estado en vez de
              // reemplazarlo: si hoy vence un pago, ambos datos deben verse.
              aria-label={
                dayMap.get(day) === "paid"   ? `${day}: cobrado`
                : dayMap.get(day) === "pending" ? `${day}: pendiente`
                : String(day)
              }
              className={cn(
                "aspect-square flex items-center justify-center rounded-md text-[10px] transition-colors",
                dayMap.get(day) === "paid"
                  ? "bg-emerald-100 text-emerald-700 font-medium"
                  : dayMap.get(day) === "pending"
                  ? "bg-amber-100 text-amber-700 font-medium"
                  : "text-slate-400",
                day === today && "ring-[1.5px] ring-[#2952F3] font-bold",
                day === today && !dayMap.has(day) && "text-[#2952F3]"
              )}
            >
              {day}
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface DashboardViewProps {
  initialTenants: Tenant[] | null;
  initialPayments: PaymentAttempt[] | null;
  initialProperties: Property[] | null;
}

interface MovimientoRow {
  key: string;
  day: number | null;
  tenantName: string;
  propertyName: string;
  amount: number;
  status: PaymentStatus;
  monthIdx?: number;
}

// ─── View ─────────────────────────────────────────────────────────────────────

export function DashboardView({ initialTenants, initialPayments, initialProperties }: DashboardViewProps) {
  const {
    payments: storePayments,
    tenantsWithStatus: storeTenantsWithStatus,
    properties: storeProperties,
    propertiesState, paymentsState,
    fetchProperties, fetchPayments, fetchAllTenants,
  } = useStore();

  const [selectedPeriod, setSelectedPeriod] = useState(0);

  // Memoizados a propósito: sin esto cada render crea arrays nuevos y todos los
  // useMemo que dependen de ellos (movimientosRows incluido) se recalculan siempre.
  const properties = useMemo(
    () => (storeProperties.length > 0 ? storeProperties : (initialProperties ?? [])),
    [storeProperties, initialProperties]
  );
  const tenantsWithStatus = useMemo(
    () => (storeTenantsWithStatus.length > 0
      ? storeTenantsWithStatus
      : toTenantsWithStatus(initialTenants ?? [])),
    [storeTenantsWithStatus, initialTenants]
  );

  const ownTenantIds = useMemo(
    () => new Set(tenantsWithStatus.map((t) => String(t.id))),
    [tenantsWithStatus]
  );
  const payments = useMemo(() => {
    const raw = storePayments.length > 0 ? storePayments : (initialPayments ?? []);
    if (ownTenantIds.size === 0) return [];
    return raw.filter((p) => p.tenantId != null && ownTenantIds.has(String(p.tenantId)));
  }, [storePayments, initialPayments, ownTenantIds]);

  const now       = useMemo(() => new Date(), []);
  const today     = now.getDate();
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // ── Period tabs ────────────────────────────────────────────────────────────

  const periods = useMemo(() => {
    const m0 = now.getMonth();
    const y0 = now.getFullYear();
    const result: { label: string; ym: string | null; ytd: boolean }[] = [
      { label: `${MONTH_SHORT[m0]} ${y0}`, ym: currentYM, ytd: false },
    ];
    for (let back = 1; back <= 2; back++) {
      const m  = ((m0 - back) % 12 + 12) % 12;
      const y  = m0 - back < 0 ? y0 - 1 : y0;
      result.push({ label: MONTH_SHORT[m], ym: `${y}-${String(m + 1).padStart(2, "0")}`, ytd: false });
    }
    result.push({ label: "YTD", ym: null, ytd: true });
    return result;
  }, [now, currentYM]);

  // ── Current-period aggregations ────────────────────────────────────────────

  const cobradoThisMonth = payments.filter((a) =>
    a.createdAt.startsWith(currentYM) &&
    (a.status === "VERIFIED" || a.status === "MANUAL_VERIFIED")
  );
  // El fallback a `amount` es obligatorio: los pagos registrados a mano no tienen
  // ocrData ni cepResponse (types.ts §PaymentAttempt.amount). Sin él este KPI
  // contradice a PagosView y a la gráfica de barras.
  const totalCobrado = cobradoThisMonth.reduce(
    (s, a) => s + Number(a.ocrData?.monto ?? a.cepResponse?.monto ?? a.amount ?? 0), 0
  );

  const cobradoCount   = tenantsWithStatus.filter((t) => t.paymentStatus === "Pagado").length;
  const porCobrarCount = tenantsWithStatus.filter((t) => t.paymentStatus !== "Pagado").length;
  const totalTenants  = tenantsWithStatus.length;
  const totalExpected = tenantsWithStatus.reduce((s, t) => s + (t.monthlyAmount ? Number(t.monthlyAmount) : 0), 0);

  const paidThisPeriodByTenant = useMemo(() => {
    const map = new Map<string, number>();
    payments
      .filter((a) =>
        a.createdAt.startsWith(currentYM) &&
        (a.status === "VERIFIED" || a.status === "MANUAL_VERIFIED" || a.status === "PARTIAL")
      )
      .forEach((a) => {
        if (a.tenantId == null) return;
        const tid = String(a.tenantId);
        const amt = Number(a.ocrData?.monto ?? a.cepResponse?.monto ?? a.amount ?? 0);
        map.set(tid, (map.get(tid) ?? 0) + amt);
      });
    return map;
  }, [payments, currentYM]);

  /**
   * "Por cobrar" = todo el que no esté `Pagado`, sin importar el plazo, igual que
   * `summary.totalPendiente` del backend. Antes excluía a los morosos, así que el
   * número BAJABA justo cuando peor iba la cobranza.
   *
   * Diferencia deliberada con el backend: aquí sí se resta lo ya abonado, así que
   * un pago parcial reduce el pendiente. El suyo suma el `monthlyAmount` completo.
   */
  const totalPorCobrar = tenantsWithStatus
    .filter((t) => t.paymentStatus !== "Pagado")
    .reduce((s, t) => {
      const expected  = t.monthlyAmount ? Number(t.monthlyAmount) : 0;
      const paidSoFar = paidThisPeriodByTenant.get(String(t.id)) ?? 0;
      return s + Math.max(expected - paidSoFar, 0);
    }, 0);

  // ── Upcoming / next due ────────────────────────────────────────────────────

  const daysInCurrentMonth = useMemo(
    () => new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
    [now]
  );

  const upcomingPayments = useMemo(() => {
    return tenantsWithStatus
      .filter((t) => t.paymentStatus !== "Pagado" && t.paymentDay != null)
      .map((t) => {
        const day = Number(t.paymentDay);
        const diff = day - today;
        const daysUntil = diff >= 0 ? diff : diff + daysInCurrentMonth;
        return { tenant: t, daysUntil, dueDay: day };
      })
      .sort((a, b) => a.daysUntil - b.daysUntil);
  }, [tenantsWithStatus, today, daysInCurrentMonth]);

  const nextDue = upcomingPayments[0];
  const nextDueLabel = useMemo(() => {
    if (!nextDue) return null;
    const d = new Date(now);
    d.setDate(d.getDate() + nextDue.daysUntil);
    return `${String(d.getDate()).padStart(2, "0")} ${MONTH_LABELS[d.getMonth()].toLowerCase()}`;
  }, [nextDue, now]);
  const nextDueProperty = nextDue
    ? (properties.find((p) => p.id === nextDue.tenant.propertyId)?.name ?? nextDue.tenant.name)
    : null;

  // ── Bar chart (YTD, 12 bars) ───────────────────────────────────────────────

  const monthlyData = useMemo(() => {
    const year = now.getFullYear();
    return MONTH_LABELS.map((m, idx) => {
      const ym = `${year}-${String(idx + 1).padStart(2, "0")}`;
      const v  = payments
        .filter((a) =>
          a.createdAt.startsWith(ym) &&
          (a.status === "VERIFIED" || a.status === "MANUAL_VERIFIED")
        )
        .reduce((s, a) => s + Number(a.ocrData?.monto ?? a.cepResponse?.monto ?? a.amount ?? 0), 0);
      return { m, v, idx };
    });
  }, [payments, now]);

  // ── Movimientos rows ───────────────────────────────────────────────────────

  const movimientosRows = useMemo((): MovimientoRow[] => {
    const period = periods[selectedPeriod];

    if (selectedPeriod === 0) {
      return tenantsWithStatus
        .map((t): MovimientoRow => {
          const property = properties.find((p) => p.id === t.propertyId);
          const verified = payments.find((p) =>
            String(p.tenantId) === String(t.id) &&
            p.createdAt.startsWith(currentYM) &&
            (p.status === "VERIFIED" || p.status === "MANUAL_VERIFIED" || p.status === "PARTIAL")
          );
          const amount = verified
            ? Number(verified.ocrData?.monto ?? verified.cepResponse?.monto ?? verified.amount ?? t.monthlyAmount ?? 0)
            : Number(t.monthlyAmount ?? 0);
          const day = verified
            ? new Date(verified.createdAt).getDate()
            : t.paymentDay ? Number(t.paymentDay) : null;
          return {
            key: t.id,
            day,
            tenantName: t.name,
            propertyName: property?.name ?? "—",
            amount,
            status: t.paymentStatus,
          };
        })
        .sort((a, b) => {
          const da = a.day ?? 99;
          const db = b.day ?? 99;
          return da !== db ? da - db : a.tenantName.localeCompare(b.tenantName, "es");
        });
    }

    if (period.ytd) {
      const yearPfx = `${now.getFullYear()}-`;
      return payments
        .filter((p) =>
          p.createdAt.startsWith(yearPfx) &&
          (p.status === "VERIFIED" || p.status === "MANUAL_VERIFIED")
        )
        .map((p): MovimientoRow => {
          const tenant   = tenantsWithStatus.find((t) => String(t.id) === String(p.tenantId));
          const property = tenant ? properties.find((pr) => pr.id === tenant.propertyId) : null;
          const d = new Date(p.createdAt);
          return {
            key: p.id,
            day: d.getDate(),
            tenantName: tenant?.name ?? "—",
            propertyName: property?.name ?? "—",
            amount: Number(p.ocrData?.monto ?? p.cepResponse?.monto ?? p.amount ?? 0),
            status: "Pagado",
            monthIdx: d.getMonth(),
          };
        })
        .sort((a, b) => {
          const ma = a.monthIdx ?? 0;
          const mb = b.monthIdx ?? 0;
          return ma !== mb ? ma - mb : (a.day ?? 0) - (b.day ?? 0);
        });
    }

    return payments
      .filter((p) =>
        period.ym != null &&
        p.createdAt.startsWith(period.ym) &&
        (p.status === "VERIFIED" || p.status === "MANUAL_VERIFIED")
      )
      .map((p): MovimientoRow => {
        const tenant   = tenantsWithStatus.find((t) => String(t.id) === String(p.tenantId));
        const property = tenant ? properties.find((pr) => pr.id === tenant.propertyId) : null;
        return {
          key: p.id,
          day: new Date(p.createdAt).getDate(),
          tenantName: tenant?.name ?? "—",
          propertyName: property?.name ?? "—",
          amount: Number(p.ocrData?.monto ?? p.cepResponse?.monto ?? p.amount ?? 0),
          status: "Pagado",
        };
      })
      .sort((a, b) => (a.day ?? 0) - (b.day ?? 0));
  }, [selectedPeriod, periods, tenantsWithStatus, properties, payments, currentYM, now]);

  const movimientosTotal = movimientosRows
    .filter((r) => r.status === "Pagado")
    .reduce((s, r) => s + r.amount, 0);

  // ── Error state ────────────────────────────────────────────────────────────

  const hasError = !!(propertiesState.error || paymentsState.error);
  if (hasError) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80">
        <ApiErrorState onRetry={() => { fetchPayments(); fetchAllTenants(); fetchProperties(); }} />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.06)" }}
    >

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100">
        <h1 className="text-[14px] sm:text-[15px] font-semibold text-[#0B1426]">
          Resumen de cobranza
        </h1>
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 shrink-0">
          {MONTH_SHORT[now.getMonth()]} {now.getFullYear()}
        </span>
      </div>

      {/* ── KPI bar ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border-b border-slate-100 divide-x divide-slate-100 divide-y lg:divide-y-0">

        <div className="px-5 sm:px-6 py-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-2">
            Cobrado del mes
          </p>
          <p className="text-[22px] sm:text-[26px] font-bold text-[#0B1426] tabular-nums leading-none mb-1.5">
            {formatCurrency(totalCobrado).replace(/\.\d+$/, "")}
          </p>
          <p className="text-[11px] text-[#2952F3] font-medium">
            ↑ {cobradoCount} de {totalTenants} contrato{totalTenants !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="px-5 sm:px-6 py-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-2">
            Por cobrar
          </p>
          <p className="text-[22px] sm:text-[26px] font-bold text-[#0B1426] tabular-nums leading-none mb-1.5">
            {formatCurrency(totalPorCobrar).replace(/\.\d+$/, "")}
          </p>
          {/* "sin pagar" y no "esperando": ahora incluye a los morosos, que no
              están esperando su fecha — ya se les pasó. */}
          <p className="text-[11px] text-amber-500 font-medium">
            {porCobrarCount} contrato{porCobrarCount !== 1 ? "s" : ""} · sin pagar
          </p>
        </div>

        <div className="px-5 sm:px-6 py-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-2">
            Por cobrar total
          </p>
          <p className="text-[22px] sm:text-[26px] font-bold text-[#0B1426] tabular-nums leading-none mb-1.5">
            {formatCurrency(totalExpected).replace(/\.\d+$/, "")}
          </p>
          <p className="text-[11px] text-slate-400 font-medium">
            {properties.length} propiedad{properties.length !== 1 ? "es" : ""} activa{properties.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="px-5 sm:px-6 py-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-2">
            Próximo vencimiento
          </p>
          {nextDueLabel ? (
            <>
              <p className="text-[22px] sm:text-[26px] font-bold text-[#2952F3] tabular-nums leading-none mb-1.5">
                {nextDueLabel}
              </p>
              <p className="text-[11px] text-[#2952F3] font-medium truncate">
                {nextDueProperty}
              </p>
            </>
          ) : (
            <>
              <p className="text-[22px] sm:text-[26px] font-bold text-slate-300 leading-none mb-1.5">
                —
              </p>
              <p className="text-[11px] text-slate-400 font-medium">Todos al corriente</p>
            </>
          )}
        </div>
      </div>

      {/* ── Main content ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px]">

        {/* ── Movimientos ───────────────────────────────────────────────────── */}
        <div className="overflow-hidden">

          <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-3 bg-slate-50/60 border-b border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 shrink-0">
              Movimientos
            </span>
            {/* Las pestañas viven aquí, no en el encabezado de la tarjeta: sólo
                filtran esta tabla. Los KPI de arriba son siempre del mes en curso. */}
            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden divide-x divide-slate-200 bg-white shrink-0">
              {periods.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedPeriod(i)}
                  aria-pressed={selectedPeriod === i}
                  className={cn(
                    "px-2.5 sm:px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-colors whitespace-nowrap",
                    selectedPeriod === i
                      ? "bg-[#0B1426] text-white"
                      : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {movimientosRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <p className="text-[13px] font-medium text-slate-400">Sin movimientos en este período</p>
              <p className="text-[11px] text-slate-300 mt-0.5">Los pagos verificados aparecerán aquí</p>
            </div>
          ) : (
            <>
              <div className="hidden sm:grid grid-cols-[52px_1fr_136px_116px] gap-0 border-b border-slate-100 px-6 py-2">
                {["DÍA", "INQUILINO · PROPIEDAD", "MONTO", "ESTADO"].map((h, i) => (
                  <span
                    key={i}
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400",
                      i === 2 && "text-right"
                    )}
                  >
                    {h}
                  </span>
                ))}
              </div>

              <div className="divide-y divide-slate-50">
                {movimientosRows.map((row) => (
                  <div key={row.key}>
                    {/* Desktop row */}
                    <div className="hidden sm:grid grid-cols-[52px_1fr_136px_116px] items-center px-6 py-3.5 hover:bg-slate-50/50 transition-colors">
                      <span className="text-[13px] font-bold text-slate-400 tabular-nums">
                        {row.day != null ? String(row.day).padStart(2, "0") : "—"}
                      </span>
                      <div className="min-w-0 pr-4">
                        <p className="text-[13px] font-semibold text-[#0B1426] truncate">{row.tenantName}</p>
                        <p className="text-[11px] text-slate-400 truncate">{row.propertyName}</p>
                      </div>
                      <span className="text-[13px] font-semibold text-[#0B1426] tabular-nums text-right">
                        {formatCurrency(row.amount).replace(/\.\d+$/, "")}
                      </span>
                      <div className="pl-2">
                        <MovimientosBadge status={row.status} />
                      </div>
                    </div>

                    {/* Mobile row */}
                    <div className="flex sm:hidden items-center gap-3 px-4 py-3.5">
                      <span className="text-[12px] font-bold text-slate-400 tabular-nums w-7 shrink-0">
                        {row.day != null ? String(row.day).padStart(2, "0") : "—"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-[#0B1426] truncate">{row.tenantName}</p>
                        <p className="text-[11px] text-slate-400 truncate">{row.propertyName}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[12px] font-bold text-[#0B1426] tabular-nums mb-0.5">
                          {formatCurrency(row.amount).replace(/\.\d+$/, "")}
                        </p>
                        <MovimientosBadge status={row.status} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between px-5 sm:px-6 py-3 border-t border-slate-100 bg-slate-50/40">
                <Link
                  href="/pagos"
                  className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 hover:text-[#2952F3] transition-colors"
                >
                  Ver todos los pagos
                  <ArrowRight className="w-2.5 h-2.5" />
                </Link>
                <span className="text-[11px] font-bold text-[#0B1426] tabular-nums">
                  TOTAL · {formatCurrency(movimientosTotal).replace(/\.\d+$/, "")}
                </span>
              </div>
            </>
          )}
        </div>

        {/* ── Right panel ───────────────────────────────────────────────────── */}
        <div className="border-t xl:border-t-0 xl:border-l border-slate-100 flex flex-col">

          {/* Bar chart */}
          <div className="p-5 border-b border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                Cobranza por mes
              </span>
              <span className="text-[10px] font-semibold text-slate-400">
                {now.getFullYear()} YTD
              </span>
            </div>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart
                data={monthlyData}
                barSize={13}
                margin={{ top: 4, right: 0, left: -24, bottom: 0 }}
              >
                <XAxis
                  dataKey="m"
                  tick={{ fontSize: 8, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide domain={[0, "auto"]} />
                <Tooltip
                  formatter={(v) => [formatCurrency(Number(v)), "Cobrado"]}
                  contentStyle={{
                    fontSize: 11,
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    padding: "4px 10px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  }}
                  cursor={{ fill: "#f8fafc" }}
                />
                <Bar dataKey="v" radius={[3, 3, 0, 0]}>
                  {monthlyData.map((entry) => (
                    <Cell
                      key={entry.idx}
                      fill={
                        entry.idx === now.getMonth()
                          ? "#10b981"
                          : entry.idx > now.getMonth()
                          ? "#e2e8f0"
                          : "#2952F3"
                      }
                      fillOpacity={
                        entry.idx > now.getMonth()
                          ? 1
                          : entry.idx === now.getMonth()
                          ? 1
                          : 0.55 + (entry.idx / Math.max(now.getMonth(), 1)) * 0.35
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Calendar */}
          <div className="p-5 flex-1">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                Vencimientos de {MONTH_LABELS[now.getMonth()].toLowerCase()}
              </span>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                Recordatorios automáticos
              </span>
            </div>
            <CalendarGrid tenants={tenantsWithStatus} now={now} />
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-emerald-100 border border-emerald-200" />
                <span className="text-[10px] text-slate-400">Cobrado</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-amber-100 border border-amber-200" />
                <span className="text-[10px] text-slate-400">Pendiente</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { format, parse, addMonths, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import {
  ChevronLeft, ChevronRight, CheckCircle2,
  Clock, AlertCircle, Building2, TrendingUp,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiErrorState } from "@/components/layout/ApiErrorState";
import {
  ComposedChart, Area, Bar, XAxis, YAxis,
  ResponsiveContainer, Tooltip, CartesianGrid, ReferenceLine,
} from "recharts";
import { formatCurrency, cn, isDelinquent } from "@/lib/utils";
import * as api from "@/lib/api";
import { useStore } from "@/store/useStore";
import type { LandlordReport, ReportPropertyRow, ReportTenantRow } from "@/lib/types";
import { PaymentStatusBadge } from "@/components/ui/StatusBadge";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toYM(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function shortMonth(ym: string) {
  return format(parse(ym, "yyyy-MM", new Date()), "MMM", { locale: es })
    .replace(".", "")
    .slice(0, 3)
    .toUpperCase();
}

// Mes y año completos (p. ej. "Agosto 2026") — usado donde el año no es obvio
// por el contexto (tooltip de la gráfica).
function monthYearLabel(ym: string) {
  const label = format(parse(ym, "yyyy-MM", new Date()), "MMMM yyyy", { locale: es });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function yearOf(ym: string) {
  return ym.slice(0, 4);
}

// ─── Month strip item ─────────────────────────────────────────────────────────

function MonthItem({
  ym, maxValue, value, isSelected, isDisabled, onClick,
}: {
  ym: string; maxValue: number; value: number;
  isSelected: boolean; isDisabled: boolean; onClick: () => void;
}) {
  const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;
  return (
    <button
      onClick={onClick}
      onMouseDown={(e) => e.preventDefault()}
      disabled={isDisabled}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors",
        isSelected ? "bg-[#eef1fd]" : "hover:bg-slate-50",
        isDisabled && "opacity-30 cursor-not-allowed",
      )}
    >
      <span className={cn(
        "text-[11px] font-bold uppercase tabular-nums shrink-0 w-8",
        isSelected ? "text-[#2952F3]" : "text-slate-500",
      )}>
        {shortMonth(ym)}
      </span>
      <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full", isSelected ? "bg-[#2952F3]" : "bg-slate-400")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </button>
  );
}

// ─── KPI chip ─────────────────────────────────────────────────────────────────

function KPIChip({
  icon, value, sub, color,
}: {
  icon: React.ReactNode;
  value: string;
  sub: string;
  color: "emerald" | "amber" | "red" | "blue" | "purple";
}) {
  const styles: Record<string, string> = {
    emerald: "bg-emerald-50 border-emerald-100",
    amber:   "bg-amber-50 border-amber-100",
    red:     "bg-red-50 border-red-100",
    blue:    "bg-[#eef1fd] border-[#d5dcfb]",
    purple:  "bg-slate-50 border-slate-100",
  };
  const textStyles: Record<string, string> = {
    emerald: "text-emerald-700",
    amber:   "text-amber-700",
    red:     "text-red-600",
    blue:    "text-[#2952F3]",
    purple:  "text-slate-600",
  };
  const iconStyles: Record<string, string> = {
    emerald: "bg-emerald-100",
    amber:   "bg-amber-100",
    red:     "bg-red-100",
    blue:    "bg-[#d5dcfb]",
    purple:  "bg-slate-200",
  };
  return (
    <div className={cn("flex items-center gap-3 border rounded-xl px-4 py-3 flex-1 sm:flex-none", styles[color])}>
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", iconStyles[color])}>
        {icon}
      </div>
      <div>
        <p className={cn("text-[15px] font-bold tabular-nums leading-tight", textStyles[color])}>{value}</p>
        <p className={cn("text-[12px] mt-0.5", color === "emerald" ? "text-emerald-600" : color === "amber" ? "text-amber-600" : color === "red" ? "text-red-500" : color === "blue" ? "text-[#4a6af0]" : "text-slate-500")}>{sub}</p>
      </div>
    </div>
  );
}

// ─── Property row ─────────────────────────────────────────────────────────────

function PropertyRow({ row }: { row: ReportPropertyRow }) {
  const pct = row.paidPercent ?? 0;
  const barColor = pct >= 75 ? "#059669" : pct >= 50 ? "#d97706" : "#dc2626";
  return (
    <div className={cn(
      "flex items-center gap-4 px-5 sm:px-6 py-3.5 border-b border-slate-50 last:border-0 transition-colors",
      row.vencidoCount > 0  ? "bg-red-50/20 hover:bg-red-50/30"    :
      row.pendienteCount > 0 ? "bg-amber-50/10 hover:bg-amber-50/20" :
      "hover:bg-slate-50/50"
    )}>
      <div className="w-8 h-8 rounded-lg bg-[#eef1fd] flex items-center justify-center shrink-0">
        <Building2 className="w-3.5 h-3.5 text-[#2952F3]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-[#0B1426] truncate">{row.propertyName}</p>
        <div className="flex items-center gap-3 mt-1.5">
          <div className="w-24 sm:w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden shrink-0">
            <div
              className="h-full w-full rounded-full origin-left"
              style={{ backgroundColor: barColor, transform: `scaleX(${pct / 100})` }}
            />
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            {row.cobradoCount > 0 && (
              <span className="text-emerald-600 font-medium flex items-center gap-0.5">
                <CheckCircle2 className="w-3 h-3" />{row.cobradoCount}
              </span>
            )}
            {row.pendienteCount > 0 && (
              <span className="text-amber-600 font-medium flex items-center gap-0.5">
                <Clock className="w-3 h-3" />{row.pendienteCount}
              </span>
            )}
            {row.vencidoCount > 0 && (
              <span className="text-red-500 font-medium flex items-center gap-0.5">
                <AlertCircle className="w-3 h-3" />{row.vencidoCount}
              </span>
            )}
            <span className="text-slate-500">{pct}%</span>
          </div>
        </div>
      </div>
      <p className="text-[13px] font-bold text-[#059669] tabular-nums shrink-0">
        {formatCurrency(row.totalCobrado).replace(/\.\d+$/, "")}
      </p>
    </div>
  );
}

// ─── Tenant row ───────────────────────────────────────────────────────────────

function TenantRow({ row }: { row: ReportTenantRow }) {
  // `isUrgent` cubre los dos estados de mora (`Atrasado` y `Vencido`): antes del
  // cambio de escala `"Vencido"` los englobaba a ambos.
  const isUrgent  = isDelinquent(row.paymentStatus);
  const isPending = row.paymentStatus === "Vigente" || row.paymentStatus === "Parcial";
  return (
    <div className={cn(
      "grid grid-cols-[1fr_80px_100px_100px] items-center gap-3 px-5 sm:px-6 py-3 border-b border-slate-50 last:border-0 transition-colors",
      isUrgent  ? "bg-red-50/20 hover:bg-red-50/30"    :
      isPending ? "bg-amber-50/10 hover:bg-amber-50/20" :
      "hover:bg-slate-50/50"
    )}>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-[#0B1426] truncate">{row.tenantName}</p>
        <p className="text-[11px] text-slate-500 truncate">{row.propertyName}</p>
      </div>
      <div><PaymentStatusBadge status={row.paymentStatus} /></div>
      <p className="text-[12px] text-slate-500 text-right">
        {row.lastVerifiedAt
          ? format(new Date(row.lastVerifiedAt), "dd/MM/yy")
          : "—"}
      </p>
      <p className={cn(
        "text-[13px] font-bold tabular-nums text-right",
        row.amountPaid != null ? "text-[#059669]" : "text-slate-400"
      )}>
        {row.amountPaid != null ? formatCurrency(Number(row.amountPaid)).replace(/\.\d+$/, "") : "—"}
      </p>
    </div>
  );
}

// ─── View ─────────────────────────────────────────────────────────────────────

export function ReportesView({
  initialReport,
  initialMonth,
}: {
  initialReport: LandlordReport | null;
  initialMonth: string;
}) {
  const landlordId = useStore((s) => s.landlordId);
  const currentYM  = toYM(new Date());
  const stripScrollRef = useRef<HTMLDivElement>(null);

  const [month, setMonth]     = useState(initialMonth);
  const [stripYear, setStripYear] = useState(() => yearOf(toYM(new Date())));
  const [result, setResult] = useState<
    { month: string; report: LandlordReport | null; error: string | null } | null
  >(initialReport ? { month: initialMonth, report: initialReport, error: null } : null);

  // Caché de las barras del strip: se llena una sola vez y ya no cambia, para que
  // al elegir otro mes las barras no se muevan. Declarado aquí (y no junto al
  // strip) porque `load` lo rellena cuando llega la respuesta del servidor.
  const [barCache, setBarCache] = useState<Map<string, number>>(() => {
    const m = new Map<string, number>();
    for (const t of (initialReport?.monthlyTrend ?? [])) m.set(t.month, t.totalCobrado);
    return m;
  });

  // Descarta respuestas de fetches viejos que resuelven después de uno más reciente
  // (evita quedar "atorado" con datos de un mes distinto al seleccionado)
  const requestIdRef = useRef(0);
  const isFirstRunRef = useRef(true);

  const load = useCallback((m: string) => {
    const requestId = ++requestIdRef.current;
    api.getLandlordReport(landlordId, m)
      .then((report) => {
        if (requestIdRef.current !== requestId) return;
        setResult({ month: m, report, error: null });
        // El caché de barras se llena una sola vez, aquí —donde llegan los datos—
        // y no en un efecto: así no dispara un render en cascada.
        setBarCache((prev) => {
          const trend = report?.monthlyTrend ?? [];
          if (prev.size > 0 || trend.length === 0) return prev;
          const next = new Map<string, number>();
          for (const t of trend) next.set(t.month, t.totalCobrado);
          return next;
        });
      })
      .catch((e: Error)  => { if (requestIdRef.current === requestId) setResult({ month: m, report: null, error: e.message }); });
  }, [landlordId]);

  // Fetch cuando cambia el mes (useEffect evita side-effects en render)
  useEffect(() => {
    if (isFirstRunRef.current) {
      isFirstRunRef.current = false;
      // Ya vino del servidor: no repetir el fetch inicial
      if (initialReport && month === initialMonth) return;
    }
    load(month);
  }, [month, load, initialReport, initialMonth]);

  const loading = result?.month !== month;
  // Reporte del mes seleccionado; null mientras carga
  const report  = result?.month === month ? result.report : null;
  const error   = result?.month === month ? result.error  : null;
  // Mantener datos previos visibles mientras carga el nuevo mes
  const displayReport = report ?? result?.report ?? null;

  // Navigation — cambia el mes; si cruza año, sincroniza el strip
  const handlePrev = () => {
    const d = parse(month, "yyyy-MM", new Date());
    const prev = toYM(subMonths(d, 1));
    setMonth(prev);
    if (yearOf(prev) !== stripYear) setStripYear(yearOf(prev));
  };
  const handleNext = () => {
    if (month >= currentYM) return;
    const d = parse(month, "yyyy-MM", new Date());
    const next = toYM(addMonths(d, 1));
    setMonth(next);
    if (yearOf(next) !== stripYear) setStripYear(yearOf(next));
  };

  const monthLabel = format(parse(month, "yyyy-MM", new Date()), "MMMM yyyy", { locale: es });
  const monthLabelCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  // Datos de display — del mes actual o del anterior mientras carga
  const summary      = displayReport?.summary;
  const byProperty   = displayReport?.byProperty ?? [];
  const byTenant     = displayReport?.byTenant ?? [];
  const monthlyTrend = useMemo(
    () => displayReport?.monthlyTrend ?? [],
    [displayReport]
  );

  const paidPercent = (summary && summary.totalTenants > 0)
    ? Math.round((summary.cobradoCount / summary.totalTenants) * 100)
    : 0;

  const trendData = useMemo(() =>
    monthlyTrend.map((t) => ({
      ...t,
      label: shortMonth(t.month),
      isSelected: t.month === month,
    })),
    [monthlyTrend, month]
  );

  const avgCobrado = useMemo(() => {
    const nonZero = trendData.filter((t) => t.totalCobrado > 0);
    return nonZero.length > 0
      ? nonZero.reduce((s, t) => s + t.totalCobrado, 0) / nonZero.length
      : 0;
  }, [trendData]);

  // ── Strip: SIEMPRE 12 meses fijos (enero–diciembre) del año seleccionado ──
  // El Select cambia el año → los 12 meses cambian de año pero no de posición.
  // Clic en un mes → solo se marca, el strip no se mueve ni crece.
  // Las barras usan `barCache` (declarado arriba), que se llena una vez y nunca cambia.

  // 12 meses fijos: siempre enero (01) → diciembre (12) del año del Select
  const stripMonths = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => {
      const m = `${stripYear}-${String(i + 1).padStart(2, "0")}`;
      return { month: m, totalCobrado: barCache.get(m) ?? 0 };
    }),
    [stripYear, barCache]
  );

  const maxCobrado = useMemo(() =>
    Math.max(...stripMonths.map((t) => t.totalCobrado), 1),
    [stripMonths]
  );

  // Años disponibles: siempre el actual y el anterior + cualquiera en el caché
  const availableYears = useMemo(() => {
    const cy = parseInt(currentYM.slice(0, 4), 10);
    const set = new Set<string>([String(cy), String(cy - 1)]);
    for (const m of barCache.keys()) set.add(m.slice(0, 4));
    return Array.from(set).sort().reverse();
  }, [barCache, currentYM]);

  // Cambiar el año: solo actualiza stripYear (el strip regenera sus 12 meses)
  const handleStripYearChange = (y: string | null) => {
    if (!y) return;
    setStripYear(y);
    if (stripScrollRef.current) stripScrollRef.current.scrollTop = 0;
  };

  if (error && !displayReport) {
    return <ApiErrorState onRetry={() => { setResult(null); load(month); }} />;
  }

  // Skeleton solo en carga inicial (sin ningún dato previo)
  if (!result && !displayReport) {
    return (
      <div className="flex gap-5 items-start animate-pulse">
        <div className="hidden xl:block w-44 shrink-0 h-[480px] bg-slate-100 rounded-2xl" />
        <div className="flex-1 space-y-5">
          <div className="h-[148px] bg-slate-100 rounded-2xl" />
          <div className="h-[240px] bg-slate-100 rounded-2xl" />
          <div className="h-[200px] bg-slate-100 rounded-2xl" />
          <div className="h-[240px] bg-slate-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-5 items-start">

      {/* ── Left month strip (xl+) ────────────────────────────────────────── */}
      <aside
        className="hidden xl:flex flex-col w-44 shrink-0 sticky top-6 self-start bg-white rounded-2xl border border-slate-200/80 overflow-hidden"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
      >
        {/* Header: Historial + selector de año */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100">
          <p className="text-[12px] font-semibold text-slate-500 flex-1">Historial</p>
          {availableYears.length > 0 && (
            <Select value={stripYear} onValueChange={handleStripYearChange}>
              <SelectTrigger className="h-7 w-20 text-[12px] border-slate-200 bg-white px-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((y) => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Lista de todos los meses */}
        <div ref={stripScrollRef} className="overflow-y-auto max-h-[70vh] p-2 space-y-0.5">
          {stripMonths.length === 0 && (
            <p className="text-[11px] text-slate-500 px-3 py-4 text-center">Sin datos</p>
          )}
          {stripMonths.map((t) => (
            <MonthItem
              key={t.month}
              ym={t.month}
              value={t.totalCobrado}
              maxValue={maxCobrado}
              isSelected={t.month === month}
              isDisabled={t.month > currentYM}
              onClick={() => setMonth(t.month)}
            />
          ))}
        </div>

        {/* Botón "Mes actual" cuando no estás en el mes actual */}
        {month !== currentYM && (
          <div className="p-2 border-t border-slate-100">
            <button
              onClick={() => setMonth(currentYM)}
              className="w-full text-[11px] font-semibold text-[#2952F3] hover:bg-[#eef1fd] py-1.5 rounded-lg transition-colors"
            >
              ← Mes actual
            </button>
          </div>
        )}
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-5">

        {/* Mobile navigator (hidden on xl+) */}
        <div className="xl:hidden flex items-center gap-3">
          <div
            className="flex items-center gap-1 bg-white border border-slate-200/80 rounded-xl p-1"
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
          >
            <button
              onClick={handlePrev}
              aria-label="Mes anterior"
              className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-[13px] font-semibold text-[#0B1426] capitalize min-w-[130px] text-center">
              {monthLabelCap}
            </span>
            <button
              onClick={handleNext}
              disabled={month >= currentYM}
              aria-label="Mes siguiente"
              className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          {month !== currentYM && (
            <button
              onClick={() => setMonth(currentYM)}
              className="text-[12px] font-semibold text-[#2952F3] hover:underline whitespace-nowrap"
            >
              Mes actual
            </button>
          )}
        </div>

        {/* ── KPI header ───────────────────────────────────────────────── */}
        <div
          className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
        >
          <div className="px-5 sm:px-6 pt-5 pb-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <h1 className="text-[22px] font-bold text-[#0B1426] tracking-tight capitalize">
                  {monthLabelCap}
                </h1>
                {loading && (
                  <div className="w-4 h-4 rounded-full border-2 border-slate-200 border-t-[#2952F3] animate-spin shrink-0 mt-1" />
                )}
              </div>
              {/* Desktop month nav inside header */}
              <div className="hidden xl:flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-xl p-1 shrink-0">
                <button
                  onClick={handlePrev}
                  aria-label="Mes anterior"
                  className="w-7 h-7 rounded-lg hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleNext}
                  disabled={month >= currentYM}
                  aria-label="Mes siguiente"
                  className="w-7 h-7 rounded-lg hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors disabled:opacity-30"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {summary ? (
              <div className="flex flex-wrap gap-3">
                <KPIChip
                  color="emerald"
                  icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                  value={formatCurrency(summary.totalCobrado).replace(/\.\d+$/, "")}
                  sub={`${summary.cobradoCount} recibido${summary.cobradoCount !== 1 ? "s" : ""}`}
                />
                {(summary.totalPendiente > 0 || summary.vencidoCount > 0) ? (
                  <KPIChip
                    color={summary.vencidoCount > 0 ? "red" : "amber"}
                    icon={summary.vencidoCount > 0
                      ? <AlertCircle className="w-4 h-4 text-red-500" />
                      : <Clock className="w-4 h-4 text-amber-600" />}
                    value={formatCurrency(summary.totalPendiente).replace(/\.\d+$/, "")}
                    sub={[
                      summary.pendienteCount > 0 && `${summary.pendienteCount} pendiente${summary.pendienteCount !== 1 ? "s" : ""}`,
                      summary.vencidoCount > 0   && `${summary.vencidoCount} vencido${summary.vencidoCount !== 1 ? "s" : ""}`,
                    ].filter(Boolean).join(" · ")}
                  />
                ) : (
                  <KPIChip
                    color="emerald"
                    icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                    value="Todo cobrado"
                    sub="sin pendientes"
                  />
                )}
                <KPIChip
                  color="blue"
                  icon={<TrendingUp className="w-4 h-4 text-[#2952F3]" />}
                  value={`${summary.cobradoCount}/${summary.totalTenants}`}
                  sub={`${paidPercent}% tasa de cobro`}
                />
              </div>
            ) : (
              <p className="text-[13px] text-slate-500">Sin datos para este mes</p>
            )}
          </div>
        </div>

        {/* ── Tendencia mensual (authored motion: chart animation) ─────── */}
        {trendData.length > 0 && (
          <div
            className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden"
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
          >
            <div className="flex items-center gap-2.5 px-5 sm:px-6 py-4 border-b border-slate-100">
              <div className="w-7 h-7 rounded-lg bg-[#eef1fd] flex items-center justify-center shrink-0">
                <TrendingUp className="w-3.5 h-3.5 text-[#2952F3]" />
              </div>
              <p className="text-[14px] font-semibold text-[#0B1426]">Tendencia mensual</p>
              <span className="ml-auto text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                clic en una barra para navegar
              </span>
            </div>
            <div className="px-2 pt-5 pb-3">
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={trendData} margin={{ top: 4, right: 16, left: 16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="trendArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#2952F3" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#2952F3" stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis hide />
                  <Tooltip
                    formatter={(value) => [formatCurrency(Number(value ?? 0)), "Cobrado"]}
                    labelFormatter={(_, payload) => {
                      const m = payload?.[0]?.payload?.month;
                      return m ? monthYearLabel(m) : "";
                    }}
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 10,
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                      padding: "6px 12px",
                    }}
                    cursor={{ fill: "#f8fafc" }}
                  />
                  {avgCobrado > 0 && (
                    <ReferenceLine
                      y={avgCobrado}
                      stroke="#cbd5e1"
                      strokeDasharray="4 3"
                      strokeWidth={1}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="totalCobrado"
                    stroke="none"
                    fill="url(#trendArea)"
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="totalCobrado"
                    maxBarSize={24}
                    isAnimationActive={true}
                    animationDuration={1200}
                    animationEasing="ease-out"
                    shape={(props: { x?: number; y?: number; width?: number; height?: number; payload?: { isSelected?: boolean; totalCobrado: number; month?: string } }) => {
                      const { x = 0, y = 0, width = 0, height = 0, payload } = props;
                      const fill = payload?.isSelected
                        ? "#10b981"
                        : (payload?.totalCobrado ?? 0) > 0 ? "#2952F3" : "#e2e8f0";
                      return (
                        <rect
                          x={x} y={y}
                          width={Math.max(0, width)}
                          height={Math.max(0, height)}
                          fill={fill}
                          rx={3} ry={3}
                          style={{ cursor: "pointer" }}
                          onClick={() => {
                            if (payload?.month) setMonth(payload.month);
                          }}
                        />
                      );
                    }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 px-5 sm:px-6 pb-4">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#2952F3] shrink-0" />
                <span className="text-[11px] text-slate-500">Meses anteriores</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-emerald-500 shrink-0" />
                <span className="text-[11px] text-slate-500">Mes seleccionado</span>
              </div>
              {avgCobrado > 0 && (
                <div className="flex items-center gap-1.5 ml-auto">
                  <span className="w-5 border-t border-dashed border-slate-400 shrink-0" />
                  <span className="text-[11px] text-slate-500">Promedio {formatCurrency(avgCobrado).replace(/\.\d+$/, "")}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Por propiedad ─────────────────────────────────────────────── */}
        <div
          className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
        >
          <div className="flex items-center gap-2.5 px-5 sm:px-6 py-4 border-b border-slate-100">
            <div className="w-7 h-7 rounded-lg bg-[#eef1fd] flex items-center justify-center shrink-0">
              <Building2 className="w-3.5 h-3.5 text-[#2952F3]" />
            </div>
            <p className="text-[14px] font-semibold text-[#0B1426]">Por propiedad</p>
            {byProperty.length > 0 && (
              <span className="ml-auto text-[12px] font-semibold text-slate-500">
                {byProperty.length} propiedad{byProperty.length !== 1 ? "es" : ""}
              </span>
            )}
          </div>
          {byProperty.length === 0 ? (
            <p className="text-[13px] text-slate-500 text-center py-10">Sin datos para este mes</p>
          ) : (
            byProperty.map((row) => <PropertyRow key={row.propertyId} row={row} />)
          )}
        </div>

        {/* ── Por inquilino ─────────────────────────────────────────────── */}
        <div
          className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
        >
          <div className="flex items-center gap-2.5 px-5 sm:px-6 py-4 border-b border-slate-100">
            <div className="w-7 h-7 rounded-lg bg-[#eef1fd] flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#2952F3]" />
            </div>
            <p className="text-[14px] font-semibold text-[#0B1426]">Por inquilino</p>
            {byTenant.length > 0 && (
              <span className="ml-auto text-[12px] font-semibold text-slate-500">
                {byTenant.length} contrato{byTenant.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          {byTenant.length === 0 ? (
            <p className="text-[13px] text-slate-500 text-center py-10">Sin datos para este mes</p>
          ) : (
            <>
              <div className="hidden sm:grid grid-cols-[1fr_80px_100px_100px] items-center gap-3 px-5 sm:px-6 py-2.5 border-b border-slate-100 bg-slate-50/60">
                {["Inquilino · Propiedad", "Estado", "Último pago", "Monto"].map((h, i) => (
                  <span
                    key={i}
                    className={cn(
                      "text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500",
                      i >= 2 && "text-right",
                    )}
                  >
                    {h}
                  </span>
                ))}
              </div>
              {byTenant.map((row) => <TenantRow key={row.tenantId} row={row} />)}
            </>
          )}
        </div>

      </div>
    </div>
  );
}

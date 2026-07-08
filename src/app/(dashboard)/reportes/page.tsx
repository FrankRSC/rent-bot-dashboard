"use client";

import { useState, useEffect, useCallback } from "react";
import { format, parse, addMonths, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, TrendingUp, Zap } from "lucide-react";
import { ApiErrorState } from "@/components/layout/ApiErrorState";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency, cn } from "@/lib/utils";
import * as api from "@/lib/api";
import type { LandlordReport, PaymentStatus } from "@/lib/types";
import { PaymentStatusBadge } from "@/components/ui/StatusBadge";

const LANDLORD_ID = parseInt(process.env.NEXT_PUBLIC_LANDLORD_ID ?? "1", 10);

function toYM(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function ProgressBar({ percent }: { percent: number }) {
  const color = percent >= 75 ? "#047857" : percent >= 50 ? "#d97706" : "#dc2626";
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, backgroundColor: color }} />
      </div>
      <span className="text-[11px] tabular-nums w-7 text-right font-medium" style={{ color }}>{percent}%</span>
    </div>
  );
}

export default function ReportesPage() {
  const currentYM = toYM(new Date());
  const [month, setMonth] = useState(currentYM);
  const [report, setReport] = useState<LandlordReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((m: string) => {
    setLoading(true);
    setError(null);
    api.getLandlordReport(LANDLORD_ID, m)
      .then(setReport)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(month); }, [month, load]);

  const handlePrev = () => {
    const d = parse(month, "yyyy-MM", new Date());
    setMonth(toYM(subMonths(d, 1)));
  };
  const handleNext = () => {
    if (month >= currentYM) return;
    const d = parse(month, "yyyy-MM", new Date());
    setMonth(toYM(addMonths(d, 1)));
  };

  const monthLabel = format(parse(month, "yyyy-MM", new Date()), "MMMM yyyy", { locale: es });
  const monthLabelCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-[210px] bg-slate-100 rounded-2xl" />
        <div className="h-[188px] bg-slate-100 rounded-2xl" />
        <div className="h-[200px] bg-slate-100 rounded-2xl" />
        <div className="h-[240px] bg-slate-100 rounded-2xl" />
      </div>
    );
  }

  if (error || !report) {
    return <ApiErrorState onRetry={() => load(month)} />;
  }

  const { summary, byProperty, byTenant, monthlyTrend } = report;
  const paidPercent = summary.totalTenants > 0
    ? Math.round((summary.cobradoCount / summary.totalTenants) * 100)
    : 0;
  const firstTryPercent = summary.cobradoCount > 0
    ? Math.round((summary.verifiedOnFirstTryCount / summary.cobradoCount) * 100)
    : 0;

  const trendData = monthlyTrend.map((t) => ({
    ...t,
    label: format(parse(t.month, "yyyy-MM", new Date()), "MMM", { locale: es }).replace(".", "").slice(0, 3).toUpperCase(),
    isCurrent: t.month === month,
  }));

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
              <h1 className="text-[22px] font-bold text-[#0B1426] tracking-tight">Reportes</h1>
              <p className="text-[13px] text-slate-400 mt-0.5 capitalize">{monthLabelCap}</p>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-xl p-1">
              <button
                onClick={handlePrev}
                className="w-8 h-8 rounded-lg hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 text-[13px] font-semibold text-[#0B1426] capitalize min-w-[130px] text-center">
                {monthLabelCap}
              </span>
              <button
                onClick={handleNext}
                disabled={month >= currentYM}
                className="w-8 h-8 rounded-lg hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
              <p className="text-[11px] text-slate-400 uppercase tracking-widest font-semibold mb-1.5">Cobrado del mes</p>
              <p className="text-[22px] font-bold text-emerald-600 leading-none tabular-nums">
                {formatCurrency(summary.totalCobrado).replace(/\.\d+$/, "")}
              </p>
              <p className="text-[12px] text-slate-400 mt-1">
                {summary.cobradoCount} pago{summary.cobradoCount !== 1 ? "s" : ""} recibido{summary.cobradoCount !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
              <p className="text-[11px] text-slate-400 uppercase tracking-widest font-semibold mb-1.5">Pendiente</p>
              <p className="text-[22px] font-bold text-amber-500 leading-none tabular-nums">
                {formatCurrency(summary.totalPendiente).replace(/\.\d+$/, "")}
              </p>
              <p className="text-[12px] text-slate-400 mt-1">
                {summary.pendienteCount > 0 ? `${summary.pendienteCount} pendiente${summary.pendienteCount !== 1 ? "s" : ""}` : ""}
                {summary.pendienteCount > 0 && summary.vencidoCount > 0 ? " · " : ""}
                {summary.vencidoCount > 0 ? `${summary.vencidoCount} vencido${summary.vencidoCount !== 1 ? "s" : ""}` : ""}
                {summary.pendienteCount === 0 && summary.vencidoCount === 0 ? "Todo cobrado" : ""}
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
              <p className="text-[11px] text-slate-400 uppercase tracking-widest font-semibold mb-1.5">Tasa de cobro</p>
              <p className="text-[22px] font-bold text-[#0B1426] leading-none">
                {summary.cobradoCount}
                <span className="text-slate-400 text-[16px]">/{summary.totalTenants}</span>
              </p>
              <p className="text-[12px] text-slate-400 mt-1">contratos · {paidPercent}% cobrado</p>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
              <p className="text-[11px] text-slate-400 uppercase tracking-widest font-semibold mb-1.5">1er intento</p>
              <div className="flex items-center gap-1.5">
                <Zap className="w-5 h-5 text-[#2952F3]" />
                <p className="text-[22px] font-bold text-[#0B1426] leading-none">{summary.verifiedOnFirstTryCount}</p>
              </div>
              <p className="text-[12px] text-slate-400 mt-1">{firstTryPercent}% de los cobros</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tendencia mensual */}
      <div
        className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#eef1fd] flex items-center justify-center shrink-0">
            <TrendingUp className="w-3.5 h-3.5 text-[#2952F3]" />
          </div>
          <p className="text-[14px] font-semibold text-[#0B1426]">Tendencia mensual</p>
        </div>
        <div className="p-6">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={trendData} barCategoryGap="30%" margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
              <YAxis hide />
              <Tooltip
                formatter={(value) => [formatCurrency(Number(value ?? 0)), "Cobrado"]}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                cursor={{ fill: "#f8fafc" }}
              />
              <Bar
                dataKey="totalCobrado"
                maxBarSize={28}
                minPointSize={4}
                shape={(props: { x?: number; y?: number; width?: number; height?: number; payload?: { isCurrent?: boolean; totalCobrado: number } }) => {
                  const { x = 0, y = 0, width = 0, height = 0, payload } = props;
                  const fill = payload?.isCurrent ? "#047857" : (payload?.totalCobrado ?? 0) > 0 ? "#2952F3" : "#e2e8f0";
                  return <rect x={x} y={y} width={Math.max(0, width)} height={Math.max(0, height)} fill={fill} rx={3} ry={3} />;
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Por propiedad */}
      <div
        className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
      >
        <div className="px-6 py-4 border-b border-slate-100">
          <p className="text-[14px] font-semibold text-[#0B1426]">Por propiedad</p>
        </div>
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto_160px] gap-x-4 px-6 py-2.5 border-b border-slate-100 bg-slate-50/50">
          {["Propiedad", "Cobrado", "Pagados", "Pendientes", "Vencidos", "% Cobro"].map((h) => (
            <p key={h} className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">{h}</p>
          ))}
        </div>
        <div className="divide-y divide-slate-100">
          {byProperty.map((row) => (
            <div key={row.propertyId} className="grid grid-cols-[1fr_auto_auto_auto_auto_160px] gap-x-4 items-center px-6 py-3.5">
              <p className="text-[13px] font-medium text-[#0B1426] truncate">{row.propertyName}</p>
              <p className="text-[13px] font-semibold text-[#047857] tabular-nums">{formatCurrency(row.totalCobrado)}</p>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 whitespace-nowrap">{row.cobradoCount} pag.</span>
              <span className={cn("text-[11px] font-semibold rounded-full px-2 py-0.5 whitespace-nowrap",
                row.pendienteCount > 0 ? "text-amber-700 bg-amber-50 border border-amber-200" : "text-slate-400"
              )}>{row.pendienteCount > 0 ? `${row.pendienteCount} pend.` : "—"}</span>
              <span className={cn("text-[11px] font-semibold rounded-full px-2 py-0.5 whitespace-nowrap",
                row.vencidoCount > 0 ? "text-red-700 bg-red-50 border border-red-200" : "text-slate-400"
              )}>{row.vencidoCount > 0 ? `${row.vencidoCount} venc.` : "—"}</span>
              <ProgressBar percent={row.paidPercent} />
            </div>
          ))}
          {byProperty.length === 0 && (
            <p className="text-[13px] text-slate-400 text-center py-8">Sin datos para este mes</p>
          )}
        </div>
      </div>

      {/* Por inquilino */}
      <div
        className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
      >
        <div className="px-6 py-4 border-b border-slate-100">
          <p className="text-[14px] font-semibold text-[#0B1426]">Por inquilino</p>
        </div>
        <div className="grid grid-cols-[1fr_110px_70px_110px_90px_90px_100px] gap-x-3 px-6 py-2.5 border-b border-slate-100 bg-slate-50/50">
          {["Inquilino", "Propiedad", "Día pago", "Renta mensual", "Estado", "Último pago", "Monto pagado"].map((h) => (
            <p key={h} className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">{h}</p>
          ))}
        </div>
        <div className="divide-y divide-slate-100">
          {byTenant.map((row) => (
            <div key={row.tenantId} className="grid grid-cols-[1fr_110px_70px_110px_90px_90px_100px] gap-x-3 items-center px-6 py-3">
              <p className="text-[13px] font-medium text-[#0B1426] truncate">{row.tenantName}</p>
              <p className="text-[12px] text-slate-400 truncate">{row.propertyName}</p>
              <p className="text-[12px] text-slate-500 text-center">{row.paymentDay ?? "—"}</p>
              <p className="text-[12px] font-medium text-[#0B1426] tabular-nums">
                {row.monthlyAmount ? formatCurrency(Number(row.monthlyAmount)) : "—"}
              </p>
              <div><PaymentStatusBadge status={row.paymentStatus} /></div>
              <p className="text-[12px] text-slate-400">
                {row.lastVerifiedAt ? format(new Date(row.lastVerifiedAt + ""), "dd/MM/yy") : "—"}
              </p>
              <p className="text-[12px] font-semibold text-[#047857] tabular-nums">
                {row.amountPaid != null ? formatCurrency(Number(row.amountPaid)) : "—"}
              </p>
            </div>
          ))}
          {byTenant.length === 0 && (
            <p className="text-[13px] text-slate-400 text-center py-8">Sin datos para este mes</p>
          )}
        </div>
      </div>
    </div>
  );
}

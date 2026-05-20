"use client";

import { useState, useEffect, useCallback } from "react";
import { format, parse, addMonths, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CheckCircle2, X, TrendingUp, Zap } from "lucide-react";
import { ApiErrorState } from "@/components/layout/ApiErrorState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/utils";
import * as api from "@/lib/api";
import type { LandlordReport, PaymentStatus } from "@/lib/types";

const LANDLORD_ID = parseInt(process.env.NEXT_PUBLIC_LANDLORD_ID ?? "1", 10);

function toYM(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function StatusBadge({ status }: { status: PaymentStatus }) {
  if (status === "Pagado")
    return <Badge className="bg-[#d1fae5] text-[#065f46] hover:bg-[#d1fae5] border-[#6ee7b7]"><CheckCircle2 className="w-3 h-3 mr-1" />Pagado</Badge>;
  if (status === "Vencido")
    return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-red-200"><X className="w-3 h-3 mr-1" />Vencido</Badge>;
  if (status === "Revisión")
    return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 border-purple-200">Revisión</Badge>;
  return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">Pendiente</Badge>;
}

function ProgressBar({ percent }: { percent: number }) {
  const color = percent >= 75 ? "#047857" : percent >= 50 ? "#d97706" : "#dc2626";
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs tabular-nums w-8 text-right" style={{ color }}>{percent}%</span>
    </div>
  );
}

function MonthLabel({ ym }: { ym: string }) {
  const d = parse(ym, "yyyy-MM", new Date());
  return <>{format(d, "MMM", { locale: es }).replace(".", "").slice(0, 3).toUpperCase()}</>;
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

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-slate-100 rounded" />
          <div className="h-9 w-48 bg-slate-100 rounded" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-28 bg-slate-100 rounded-xl" />)}
        </div>
        <div className="h-48 bg-slate-100 rounded-xl" />
        <div className="h-48 bg-slate-100 rounded-xl" />
        <div className="h-64 bg-slate-100 rounded-xl" />
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0B1426]">Reportes</h1>
          <p className="text-sm text-muted-foreground mt-0.5 capitalize">{monthLabel}</p>
        </div>
        <div className="flex items-center gap-1 border rounded-lg overflow-hidden">
          <Button variant="ghost" size="icon" className="rounded-none h-9 w-9" onClick={handlePrev}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="px-4 text-sm font-medium text-[#0B1426] capitalize min-w-[140px] text-center">
            {monthLabel}
          </span>
          <Button
            variant="ghost" size="icon"
            className="rounded-none h-9 w-9"
            onClick={handleNext}
            disabled={month >= currentYM}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardContent className="pt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cobrado del mes</p>
            <p className="text-2xl font-bold text-[#047857] mt-1.5">{formatCurrency(summary.totalCobrado)}</p>
            <p className="text-xs text-muted-foreground mt-1">{summary.cobradoCount} pago{summary.cobradoCount !== 1 ? "s" : ""} recibido{summary.cobradoCount !== 1 ? "s" : ""}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="pt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pendiente</p>
            <p className="text-2xl font-bold text-amber-600 mt-1.5">{formatCurrency(summary.totalPendiente)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.pendienteCount > 0 && <span>{summary.pendienteCount} pendiente{summary.pendienteCount !== 1 ? "s" : ""}</span>}
              {summary.pendienteCount > 0 && summary.vencidoCount > 0 && <span className="mx-1">·</span>}
              {summary.vencidoCount > 0 && <span className="text-red-500">{summary.vencidoCount} vencido{summary.vencidoCount !== 1 ? "s" : ""}</span>}
              {summary.pendienteCount === 0 && summary.vencidoCount === 0 && "Todo cobrado"}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="pt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tasa de cobro</p>
            <p className="text-2xl font-bold text-[#2952F3] mt-1.5">{summary.cobradoCount} de {summary.totalTenants}</p>
            <p className="text-xs text-muted-foreground mt-1">contratos · {paidPercent}% cobrado</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="pt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Verificados al 1er intento</p>
            <p className="text-2xl font-bold text-[#0B1426] mt-1.5 flex items-center gap-1.5">
              <Zap className="w-5 h-5 text-[#2952F3]" />
              {summary.verifiedOnFirstTryCount}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{firstTryPercent}% de los cobros</p>
          </CardContent>
        </Card>
      </div>

      {/* Tendencia mensual */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#2952F3]" />
            <CardTitle className="text-base">Tendencia mensual</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={trendData} barCategoryGap="30%" margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis hide />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), "Cobrado"]}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                cursor={{ fill: "#f1f5f9" }}
              />
              <Bar dataKey="totalCobrado" radius={[4, 4, 0, 0]} maxBarSize={28} minPointSize={4}>
                {trendData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.isCurrent ? "#047857" : entry.totalCobrado > 0 ? "#2952F3" : "#e2e8f0"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Por propiedad */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Por propiedad</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">Propiedad</TableHead>
                <TableHead className="text-right">Cobrado</TableHead>
                <TableHead className="text-center">Pagados</TableHead>
                <TableHead className="text-center">Pendientes</TableHead>
                <TableHead className="text-center">Vencidos</TableHead>
                <TableHead className="pr-6">% Cobro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byProperty.map((row) => (
                <TableRow key={row.propertyId}>
                  <TableCell className="pl-6 font-medium">{row.propertyName}</TableCell>
                  <TableCell className="text-right font-semibold text-[#047857]">
                    {formatCurrency(row.totalCobrado)}
                  </TableCell>
                  <TableCell className="text-center text-sm text-[#047857] font-medium">{row.cobradoCount}</TableCell>
                  <TableCell className="text-center text-sm text-amber-600 font-medium">{row.pendienteCount}</TableCell>
                  <TableCell className="text-center text-sm text-red-600 font-medium">{row.vencidoCount}</TableCell>
                  <TableCell className="pr-6">
                    <ProgressBar percent={row.paidPercent} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Por inquilino */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Por inquilino</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">Inquilino</TableHead>
                <TableHead>Propiedad</TableHead>
                <TableHead className="text-center">Día pago</TableHead>
                <TableHead className="text-right">Renta mensual</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Último pago</TableHead>
                <TableHead className="text-right">Monto pagado</TableHead>
                <TableHead className="text-center pr-6">Intentos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byTenant.map((row) => (
                <TableRow key={row.tenantId}>
                  <TableCell className="pl-6 font-medium">{row.tenantName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{row.propertyName}</TableCell>
                  <TableCell className="text-center text-sm">{row.paymentDay ?? "—"}</TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    {row.monthlyAmount ? formatCurrency(Number(row.monthlyAmount)) : "—"}
                  </TableCell>
                  <TableCell><StatusBadge status={row.paymentStatus} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.lastVerifiedAt
                      ? format(new Date(row.lastVerifiedAt + ""), "dd/MM/yyyy")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    {row.amountPaid != null ? formatCurrency(Number(row.amountPaid)) : "—"}
                  </TableCell>
                  <TableCell className="text-center text-sm pr-6">{row.attemptsCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

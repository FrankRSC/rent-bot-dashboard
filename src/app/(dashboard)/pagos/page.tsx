"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Download, ExternalLink, Search, SlidersHorizontal, CheckCircle2, Clock, XCircle, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/store/useStore";
import { ApiErrorState } from "@/components/layout/ApiErrorState";
import { cn, formatCurrency } from "@/lib/utils";
import type { AttemptStatus } from "@/lib/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS = [
  { value: "todos", label: "Todos los meses" },
  {
    value: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
    label: format(new Date(), "MMMM yyyy", { locale: es }),
  },
];

const STATUS_FILTER = [
  { value: "todos", label: "Todos los estados" },
  { value: "cobrado", label: "Cobrado" },
  { value: "pendiente", label: "Pendiente" },
  { value: "rechazado", label: "Revisión" },
];

function isCobrado(s: AttemptStatus) { return s === "VERIFIED" || s === "INTRABANK_OK"; }
function isPendiente(s: AttemptStatus) { return s === "PENDING"; }
function statusGroup(s: AttemptStatus): "cobrado" | "pendiente" | "rechazado" {
  if (isCobrado(s)) return "cobrado";
  if (isPendiente(s)) return "pendiente";
  return "rechazado";
}

function StatusPill({ status }: { status: AttemptStatus }) {
  const group = statusGroup(status);
  if (group === "cobrado")
    return (
      <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold px-2.5 py-[3px] rounded-full whitespace-nowrap">
        <CheckCircle2 className="w-3 h-3" /> Cobrado
      </span>
    );
  if (group === "pendiente")
    return (
      <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-semibold px-2.5 py-[3px] rounded-full whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" /> Pendiente
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 bg-red-50 border border-red-200 text-red-600 text-[11px] font-semibold px-2.5 py-[3px] rounded-full whitespace-nowrap">
      <XCircle className="w-3 h-3" />
      {status === "ABANDONED" ? "Abandonado" : "Revisión"}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PagosPage() {
  const { payments, allTenants, properties, paymentsState } = useStore();
  const [filterProperty, setFilterProperty] = useState("todos");
  const [filterMonth, setFilterMonth] = useState("todos");
  const [filterStatus, setFilterStatus] = useState("todos");

  const tenantMap = useMemo(() => {
    const m = new Map<string, { name: string; propertyId: number }>();
    allTenants.forEach((t) => m.set(t.phone, { name: t.name, propertyId: t.propertyId }));
    return m;
  }, [allTenants]);

  const propertyMap = useMemo(() => {
    const m = new Map<number, string>();
    properties.forEach((p) => m.set(p.id, p.name));
    return m;
  }, [properties]);

  const filtered = useMemo(() =>
    payments.filter((a) => {
      const ti = tenantMap.get(a.tenantPhone);
      const prop = ti ? (propertyMap.get(ti.propertyId) ?? "") : "";
      if (filterProperty !== "todos" && prop !== filterProperty) return false;
      if (filterMonth !== "todos" && !a.createdAt.startsWith(filterMonth)) return false;
      if (filterStatus !== "todos" && statusGroup(a.status) !== filterStatus) return false;
      return true;
    }),
  [payments, tenantMap, propertyMap, filterProperty, filterMonth, filterStatus]);

  const totalAmount    = filtered.filter((a) => isCobrado(a.status)).reduce((s, a) => s + Number(a.ocrData?.monto ?? a.cepResponse?.monto ?? 0), 0);
  const cobradoCount   = filtered.filter((a) => isCobrado(a.status)).length;
  const pendienteCount = filtered.filter((a) => isPendiente(a.status)).length;
  const rechazadoCount = filtered.filter((a) => statusGroup(a.status) === "rechazado").length;
  const hasActiveFilters = filterProperty !== "todos" || filterMonth !== "todos" || filterStatus !== "todos";
  const clearFilters = () => { setFilterProperty("todos"); setFilterMonth("todos"); setFilterStatus("todos"); };

  if (paymentsState.error) return <ApiErrorState onRetry={() => window.location.reload()} />;

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[#0B1426] tracking-tight">Seguimiento de pagos</h1>
          <p className="text-sm text-slate-400 mt-0.5">Comprobantes recibidos y verificados vía WhatsApp</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2 text-slate-600 border-slate-200">
          <Download className="w-4 h-4" /> Exportar
        </Button>
      </div>

      {/* Hero stats */}
      <div className="bg-[#0B1426] rounded-2xl overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-4">
          <div className="px-6 py-5 border-r border-b sm:border-b-0 border-white/[0.07]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">Total cobrado</p>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              </div>
            </div>
            <p className="text-[22px] font-bold text-white leading-none tabular-nums">{formatCurrency(totalAmount)}</p>
            <p className="text-[12px] text-slate-500 mt-1.5">{cobradoCount} verificado{cobradoCount !== 1 ? "s" : ""}</p>
          </div>
          <div className="px-6 py-5 border-b sm:border-b-0 sm:border-r border-white/[0.07]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">Cobrados</p>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              </div>
            </div>
            <p className="text-[28px] font-bold text-emerald-400 leading-none">{cobradoCount}</p>
            <p className="text-[12px] text-slate-500 mt-1.5">pagos verificados</p>
          </div>
          <div className="px-6 py-5 border-r border-white/[0.07]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">Pendientes</p>
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
              </div>
            </div>
            <p className="text-[28px] font-bold text-amber-400 leading-none">{pendienteCount}</p>
            <p className="text-[12px] text-slate-500 mt-1.5">en proceso</p>
          </div>
          <div className="px-6 py-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">Revisión</p>
              <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center">
                <XCircle className="w-3.5 h-3.5 text-red-400" />
              </div>
            </div>
            <p className="text-[28px] font-bold text-red-400 leading-none">{rechazadoCount}</p>
            <p className="text-[12px] text-slate-500 mt-1.5">no procesados</p>
          </div>
        </div>
      </div>

      {/* Table card */}
      <div
        className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
      >
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2.5 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
          <SlidersHorizontal className="w-4 h-4 text-slate-400 shrink-0" />
          <Select value={filterProperty} onValueChange={(v) => setFilterProperty(v ?? "todos")}>
            <SelectTrigger className="h-8 w-44 text-[13px] border-slate-200 bg-white">
              <SelectValue placeholder="Propiedad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas las propiedades</SelectItem>
              {properties.map((p) => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterMonth} onValueChange={(v) => setFilterMonth(v ?? "todos")}>
            <SelectTrigger className="h-8 w-40 text-[13px] border-slate-200 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v ?? "todos")}>
            <SelectTrigger className="h-8 w-40 text-[13px] border-slate-200 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTER.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="h-8 px-3 text-[13px] text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors">
              Limpiar
            </button>
          )}
          <span className="ml-auto text-[12px] text-slate-400 hidden sm:block">
            {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Column headers */}
        <div className="hidden sm:grid grid-cols-[1fr_140px_100px_160px_160px_110px_120px_48px] px-5 py-2.5 border-b border-slate-100 bg-slate-50/60">
          {["Inquilino", "Propiedad", "Monto", "Fecha", "Clave rastreo", "Banco", "Estado", ""].map((h, i) => (
            <span key={i} className={cn(
              "text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400",
              i >= 2 && i < 6 && "text-right pr-4",
              i === 6 && "text-right pr-2",
              i === 7 && "text-center",
            )}>{h}</span>
          ))}
        </div>

        {/* Rows */}
        {paymentsState.loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-3 px-5 py-4 border-b border-slate-50 last:border-0">
              <div className="w-8 h-8 bg-slate-100 rounded-full animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 bg-slate-100 rounded animate-pulse w-32" />
                <div className="h-3 bg-slate-50 rounded animate-pulse w-24" />
              </div>
              <div className="h-3.5 bg-slate-100 rounded animate-pulse w-20" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <Search className="w-8 h-8 text-slate-200" />
            <p className="text-[13px] text-slate-400">No hay pagos con los filtros seleccionados</p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-[13px] text-[#2952F3] hover:underline mt-1">
                Limpiar filtros
              </button>
            )}
          </div>
        ) : filtered.map((attempt) => {
          const ti = tenantMap.get(attempt.tenantPhone);
          const propName = ti ? (propertyMap.get(ti.propertyId) ?? "—") : "—";
          const amount = Number(attempt.ocrData?.monto ?? attempt.cepResponse?.monto ?? 0);
          const name = ti?.name ?? attempt.tenantPhone;
          const ini = name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();

          return (
            <div key={attempt.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors">
              {/* Mobile */}
              <div className="flex items-center justify-between px-4 py-3.5 sm:hidden">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[#eef1fd] flex items-center justify-center text-[11px] font-bold text-[#2952F3] shrink-0">{ini}</div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[#0B1426] truncate">{name}</p>
                    <p className="text-[11px] text-slate-400">{propName} · {format(new Date(attempt.createdAt), "dd/MM/yy")}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0 ml-3">
                  <span className="text-[13px] font-semibold text-[#0B1426] tabular-nums">{amount > 0 ? formatCurrency(amount) : "—"}</span>
                  <StatusPill status={attempt.status} />
                </div>
              </div>
              {/* Desktop */}
              <div className="hidden sm:grid grid-cols-[1fr_140px_100px_160px_160px_110px_120px_48px] items-center px-5 py-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[#eef1fd] flex items-center justify-center text-[11px] font-bold text-[#2952F3] shrink-0">{ini}</div>
                  <p className="text-[13px] font-semibold text-[#0B1426] truncate">{name}</p>
                </div>
                <p className="text-[13px] text-slate-500 truncate pr-4">{propName}</p>
                <p className="text-[13px] font-semibold text-[#0B1426] text-right tabular-nums pr-4">{amount > 0 ? formatCurrency(amount) : "—"}</p>
                <p className="text-[12px] text-slate-400 text-right pr-4 tabular-nums">{format(new Date(attempt.createdAt), "dd MMM yyyy · HH:mm", { locale: es })}</p>
                <p className="text-[11px] font-mono text-slate-400 text-right pr-4 truncate">{(attempt.ocrData?.claveRastreo as string) ?? "—"}</p>
                <p className="text-[12px] text-slate-400 text-right pr-4">{(attempt.ocrData?.bancoEmisor as string) ?? "—"}</p>
                <div className="flex justify-end"><StatusPill status={attempt.status} /></div>
                <div className="flex justify-center">
                  <Link href={`/pagos/${attempt.id}`}>
                    <button className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-[#2952F3] hover:bg-[#eef1fd] transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length > 0 && !paymentsState.loading && (
          <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50/60 border-t border-slate-100">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              {filtered.length} movimiento{filtered.length !== 1 ? "s" : ""}
            </span>
            <span className="text-[13px] font-bold text-[#0B1426] tabular-nums">
              Total cobrado · {formatCurrency(totalAmount)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

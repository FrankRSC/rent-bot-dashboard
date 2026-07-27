"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Users, Bot, HandCoins, LayoutDashboard } from "lucide-react";
import * as api from "@/lib/api";
import type { BusinessMetrics, BusinessMetricsLandlordDetail } from "@/lib/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function mxn(n: number) {
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
}

function pct(n: number) {
  return `${n.toFixed(1)} %`;
}

function rateColor(p: number) {
  if (p >= 80) return "#10b981";
  if (p >= 50) return "#f59e0b";
  return "#ef4444";
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, accent,
}: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <div
      className="bg-white rounded-2xl border border-slate-200/80 p-5 flex flex-col gap-1"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
    >
      <p className="text-[12px] font-medium text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-[28px] font-bold leading-none" style={{ color: accent }}>{value}</p>
      {sub && <p className="text-[12px] text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function LandlordRow({ d }: { d: BusinessMetricsLandlordDetail }) {
  const tasa = d.esperadoMes > 0 ? (d.cobradoMes / d.esperadoMes) * 100 : 0;
  const total30 = d.bot30d + d.manual30d;
  return (
    <tr className="hover:bg-slate-50/60 transition-colors">
      <td className="px-4 py-3">
        <span className="text-[13px] font-medium text-[#0B1426]">{d.landlordName}</span>
      </td>
      <td className="px-4 py-3 text-[13px] text-slate-500 tabular-nums text-right">{d.tenantCount}</td>
      <td className="px-4 py-3 text-[13px] text-slate-700 tabular-nums text-right">{mxn(d.esperadoMes)}</td>
      <td className="px-4 py-3 text-[13px] text-emerald-600 tabular-nums text-right">{mxn(d.cobradoMes)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 justify-end">
          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, tasa)}%`, backgroundColor: rateColor(tasa) }} />
          </div>
          <span className="text-[12px] font-medium tabular-nums w-12 text-right" style={{ color: rateColor(tasa) }}>
            {pct(tasa)}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        <span className={`inline-block w-2 h-2 rounded-full ${d.activoUltimos30Dias ? "bg-emerald-400" : "bg-slate-200"}`} />
      </td>
      <td className="px-4 py-3 text-[12px] text-slate-500 tabular-nums text-right">
        {total30 > 0 ? `${d.bot30d}B / ${d.manual30d}M` : "—"}
      </td>
    </tr>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function AdminHomePage() {
  const [data, setData] = useState<BusinessMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getBusinessMetrics()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#eef1fd] flex items-center justify-center">
          <LayoutDashboard className="w-5 h-5 text-[#2952F3]" />
        </div>
        <div>
          <h1 className="text-[20px] font-bold text-[#0B1426] leading-tight">Resumen global</h1>
          <p className="text-[13px] text-slate-400">
            {data ? `Periodo ${data.periodo}` : "Métricas de negocio del sistema"}
          </p>
        </div>
      </div>

      {/* Skeleton */}
      {loading && (
        <div className="space-y-4 animate-pulse">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-slate-100 rounded-2xl" />)}
          </div>
          <div className="h-48 bg-slate-100 rounded-2xl" />
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error.startsWith("403")
            ? "Sin acceso — esta sección es solo para administradores."
            : error.startsWith("503")
            ? "El backend no está disponible."
            : `Error al cargar las métricas (${error.split(":")[0]}).`}
        </p>
      )}

      {data && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <KpiCard
              label="Cobrado del mes"
              value={mxn(data.cobranza.cobrado)}
              sub={`de ${mxn(data.cobranza.esperado)} esperado`}
              accent="#10b981"
            />
            <KpiCard
              label="Tasa de cobranza"
              value={pct(data.cobranza.tasaCobranzaPct)}
              accent={rateColor(data.cobranza.tasaCobranzaPct)}
            />
            <KpiCard
              label="Arrendadores activos"
              value={String(data.arrendadores.activosUltimos30Dias)}
              sub={`de ${data.arrendadores.total} totales (últimos ${data.adopcionBot.ventanaDias}d)`}
              accent="#2952F3"
            />
            <KpiCard
              label="Adopción del bot"
              value={pct(data.adopcionBot.global.pctBotPct)}
              sub={`${data.adopcionBot.global.bot}B / ${data.adopcionBot.global.manual}M (${data.adopcionBot.ventanaDias}d)`}
              accent="#7c3aed"
            />
          </div>

          {/* Tabla arrendadores */}
          {data.arrendadores.detalle.length > 0 && (
            <div
              className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden"
              style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
            >
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-400" />
                <h2 className="text-[14px] font-semibold text-[#0B1426]">Por arrendador</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Arrendador</th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Inquilinos</th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Esperado</th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Cobrado</th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider pr-6">Tasa</th>
                      <th className="px-4 py-3 text-center text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Activo</th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Bot/Manual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.arrendadores.detalle.map((d) => (
                      <LandlordRow key={d.landlordId} d={d} />
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-slate-100 flex flex-wrap gap-4 text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" /> Tasa = cobrado ÷ esperado del mes en curso
                </span>
                <span className="flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5" /> B = pagos vía bot · M = pagos manuales (últimos {data.adopcionBot.ventanaDias}d)
                </span>
                <span className="flex items-center gap-1.5">
                  <HandCoins className="w-3.5 h-3.5" /> Activo = al menos 1 pago validado en los últimos {data.adopcionBot.ventanaDias}d
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

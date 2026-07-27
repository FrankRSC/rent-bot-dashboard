"use client";

import { useEffect, useState } from "react";
import { FlaskConical, CheckCircle2, XCircle, Bot, ScanText } from "lucide-react";
import * as api from "@/lib/api";
import type { OcrMetrics, OcrSummaryBucket, OcrMethodStat } from "@/lib/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(n: number) {
  return `${n.toFixed(1)} %`;
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function SummaryCard({
  label,
  icon: Icon,
  bucket,
  accentColor,
}: {
  label: string;
  icon: React.ElementType;
  bucket: OcrSummaryBucket;
  accentColor: string;
}) {
  const bar = Math.min(100, bucket.successRate);
  return (
    <div
      className="bg-white rounded-2xl border border-slate-200/80 p-5 flex flex-col gap-4"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${accentColor}18` }}
        >
          <Icon className="w-4 h-4" style={{ color: accentColor }} />
        </div>
        <span className="text-[13px] font-semibold text-[#0B1426]">{label}</span>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-[22px] font-bold text-[#0B1426] leading-none">{bucket.total}</p>
          <p className="text-[11px] text-slate-400 mt-1">Total</p>
        </div>
        <div>
          <p className="text-[22px] font-bold text-emerald-600 leading-none">{bucket.success}</p>
          <p className="text-[11px] text-slate-400 mt-1">Éxitos</p>
        </div>
        <div>
          <p className="text-[22px] font-bold leading-none" style={{ color: accentColor }}>
            {pct(bucket.successRate)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Tasa</p>
        </div>
      </div>

      {/* Barra de tasa */}
      <div className="space-y-1">
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${bar}%`, backgroundColor: accentColor }}
          />
        </div>
      </div>
    </div>
  );
}

function MethodRow({ row, rank }: { row: OcrMethodStat; rank: number }) {
  const bar = Math.min(100, row.successRate);
  const isLegacy = row.methodUsed === "SIN_DATO";
  return (
    <tr className="hover:bg-slate-50/50 transition-colors">
      <td className="px-4 py-3 text-[12px] text-slate-400 tabular-nums">{rank}</td>
      <td className="px-4 py-3">
        <span
          className={[
            "inline-flex items-center gap-1.5 text-[12px] font-medium px-2 py-0.5 rounded-md",
            isLegacy
              ? "bg-slate-100 text-slate-500"
              : "bg-[#eef1fd] text-[#2952F3]",
          ].join(" ")}
        >
          {row.methodUsed}
          {isLegacy && (
            <span className="text-[10px] font-normal text-slate-400">(sin registro)</span>
          )}
        </span>
      </td>
      <td className="px-4 py-3 text-[13px] text-slate-700 tabular-nums text-right">{row.total}</td>
      <td className="px-4 py-3 text-[13px] text-emerald-600 tabular-nums text-right">{row.success}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 justify-end">
          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${bar}%`,
                backgroundColor: bar >= 80 ? "#10b981" : bar >= 50 ? "#f59e0b" : "#ef4444",
              }}
            />
          </div>
          <span className="text-[12px] font-medium text-slate-600 tabular-nums w-14 text-right">
            {pct(row.successRate)}
          </span>
        </div>
      </td>
    </tr>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function MetricasOcrPage() {
  const [data, setData] = useState<OcrMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getOcrMetrics()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const isEmpty = data && data.byMethod.length === 0 && data.summary.ocrOnly.total === 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#eef1fd] flex items-center justify-center">
          <FlaskConical className="w-5 h-5 text-[#2952F3]" />
        </div>
        <div>
          <h1 className="text-[20px] font-bold text-[#0B1426] leading-tight">Métricas OCR</h1>
          <p className="text-[13px] text-slate-400">Rendimiento del pipeline de extracción de comprobantes</p>
        </div>
      </div>

      {/* Skeleton */}
      {loading && (
        <div className="space-y-4 animate-pulse">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="h-36 bg-slate-100 rounded-2xl" />
            <div className="h-36 bg-slate-100 rounded-2xl" />
          </div>
          <div className="h-40 bg-slate-100 rounded-2xl" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className="bg-white rounded-2xl border border-slate-200/80 p-6"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
        >
          <p className="text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error.startsWith("403")
              ? "Sin acceso — esta sección es solo para administradores."
              : error.startsWith("503")
              ? "El backend no está disponible. Asegúrate de que el servidor esté corriendo en :3001."
              : `Error al cargar las métricas (${error.split(":")[0]}). Revisa que el backend esté activo.`}
          </p>
        </div>
      )}

      {/* Sin datos */}
      {isEmpty && (
        <div
          className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
        >
          <p className="text-[13px] text-slate-400">
            Aún no hay intentos con datos OCR registrados.
          </p>
        </div>
      )}

      {/* Datos */}
      {data && !isEmpty && (
        <>
          {/* Tarjetas resumen */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SummaryCard
              label="Solo OCR (sin IA)"
              icon={ScanText}
              bucket={data.summary.ocrOnly}
              accentColor="#2952F3"
            />
            <SummaryCard
              label="Con IA (Gemini)"
              icon={Bot}
              bucket={data.summary.aiInvolved}
              accentColor="#7c3aed"
            />
          </div>

          {/* Desglose por método */}
          {data.byMethod.length > 0 && (
            <div
              className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden"
              style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
            >
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-[14px] font-semibold text-[#0B1426]">Desglose por método</h2>
                <p className="text-[12px] text-slate-400 mt-0.5">
                  Cada renglón corresponde a un método de extracción distinto
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider w-8">
                        #
                      </th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Método
                      </th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Total
                      </th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Éxitos
                      </th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider pr-6">
                        Tasa
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.byMethod.map((row, i) => (
                      <MethodRow key={row.methodUsed} row={row} rank={i + 1} />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Leyenda éxito */}
              <div className="px-5 py-3 border-t border-slate-100 flex flex-wrap gap-4">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-[11px] text-slate-500">Éxito = VERIFIED / INTRABANK_OK / MANUAL_VERIFIED</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5 text-slate-300" />
                  <span className="text-[11px] text-slate-500">
                    SIN_DATO = intentos anteriores a que se guardara el método
                  </span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

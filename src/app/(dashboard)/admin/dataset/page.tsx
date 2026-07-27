"use client";

import { useEffect, useState } from "react";
import { Database, ChevronDown, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import * as api from "@/lib/api";
import type { DatasetCase, ExtractionFields } from "@/lib/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

const FIELD_LABELS: Record<keyof ExtractionFields, string> = {
  fecha: "Fecha",
  monto: "Monto",
  methodUsed: "Método OCR",
  referencia: "Referencia",
  bancoEmisor: "Banco emisor",
  claveRastreo: "Clave rastreo",
  bancoReceptor: "Banco receptor",
  cuentaDestino: "Cuenta destino",
  isIntrabancario: "Intrabancario",
  ocrCuentaDestino: "Cuenta OCR",
};

function fieldLabel(key: string): string {
  return FIELD_LABELS[key as keyof ExtractionFields] ?? key;
}

function fieldValue(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "Sí" : "No";
  return String(val);
}

function sourceLabel(s: DatasetCase["source"]) {
  return s === "review" ? "Revisión manual" : "Completado";
}

function sourceBadge(s: DatasetCase["source"]) {
  const base = "inline-block px-2 py-0.5 rounded-md text-[11px] font-medium";
  return s === "review"
    ? `${base} bg-amber-50 text-amber-700`
    : `${base} bg-sky-50 text-sky-700`;
}

function formatDate(iso: string) {
  try {
    return format(new Date(iso), "d MMM yyyy HH:mm", { locale: es });
  } catch {
    return iso;
  }
}

// ── Fila expandible ───────────────────────────────────────────────────────────

function CaseRow({ c }: { c: DatasetCase }) {
  const [open, setOpen] = useState(false);
  const changed = c.correctedFields;

  return (
    <>
      <tr
        className="hover:bg-slate-50/60 transition-colors cursor-pointer"
        onClick={() => setOpen((o) => !o)}
      >
        <td className="px-4 py-3 text-[12px] text-slate-400 tabular-nums">{c.id}</td>
        <td className="px-4 py-3">
          <a
            href={`/pagos/${c.attemptId}`}
            className="text-[13px] text-[#2952F3] hover:underline font-medium"
            onClick={(e) => e.stopPropagation()}
          >
            #{c.attemptId}
          </a>
        </td>
        <td className="px-4 py-3">
          <span className="inline-flex items-center gap-1 text-[12px] font-medium bg-[#eef1fd] text-[#2952F3] px-2 py-0.5 rounded-md">
            {c.methodUsed}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-1">
            {changed.map((f) => (
              <span
                key={f}
                className="text-[11px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded"
              >
                {fieldLabel(f)}
              </span>
            ))}
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={sourceBadge(c.source)}>{sourceLabel(c.source)}</span>
        </td>
        <td className="px-4 py-3 text-[12px] text-slate-500 whitespace-nowrap">
          {formatDate(c.createdAt)}
        </td>
        <td className="px-3 py-3 text-slate-300">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </td>
      </tr>

      {open && (
        <tr className="bg-slate-50/70">
          <td colSpan={7} className="px-5 py-4">
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-[12px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      Campo
                    </th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      Original (OCR)
                    </th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      Corregido
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {changed.map((f) => {
                    const orig = c.originalExtraction[f as keyof ExtractionFields];
                    const corr = c.correctedValues[f as keyof ExtractionFields];
                    return (
                      <tr key={f} className="bg-amber-50/40">
                        <td className="px-4 py-2 font-medium text-slate-700">{fieldLabel(f)}</td>
                        <td className="px-4 py-2 text-red-600 line-through opacity-70">
                          {fieldValue(orig)}
                        </td>
                        <td className="px-4 py-2 text-emerald-700 font-medium">
                          {fieldValue(corr)}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Campos sin cambio (contexto) */}
                  {(Object.keys(FIELD_LABELS) as (keyof ExtractionFields)[])
                    .filter((k) => !changed.includes(k))
                    .filter((k) => {
                      const v = c.originalExtraction[k];
                      return v !== null && v !== undefined;
                    })
                    .map((f) => (
                      <tr key={f}>
                        <td className="px-4 py-2 text-slate-500">{fieldLabel(f)}</td>
                        <td className="px-4 py-2 text-slate-600" colSpan={2}>
                          {fieldValue(c.originalExtraction[f])}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function DatasetPage() {
  const [data, setData] = useState<DatasetCase[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getDatasetCases()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#eef1fd] flex items-center justify-center">
          <Database className="w-5 h-5 text-[#2952F3]" />
        </div>
        <div>
          <h1 className="text-[20px] font-bold text-[#0B1426] leading-tight">Dataset</h1>
          <p className="text-[13px] text-slate-400">
            Casos con correcciones humanas — usados para mejorar el pipeline OCR/IA
          </p>
        </div>
      </div>

      <div
        className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
      >
        {/* Skeleton */}
        {loading && (
          <div className="p-6 space-y-2 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-slate-100 rounded-lg" />
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-6">
            <p className="text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error.startsWith("403")
                ? "Sin acceso — esta sección es solo para administradores."
                : error.startsWith("503")
                ? "El backend no está disponible. Asegúrate de que el servidor esté corriendo en :3001."
                : `Error al cargar el dataset (${error.split(":")[0]}). Revisa que el backend esté activo.`}
            </p>
          </div>
        )}

        {/* Sin casos */}
        {data && data.length === 0 && (
          <div className="p-10 text-center">
            <Database className="w-8 h-8 text-slate-200 mx-auto mb-3" />
            <p className="text-[13px] text-slate-400">Sin casos en el dataset todavía.</p>
            <p className="text-[12px] text-slate-300 mt-1">
              Se agrega un caso cuando el arrendador corrige valores del OCR.
            </p>
          </div>
        )}

        {/* Tabla */}
        {data && data.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider w-8">
                      #
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Intento
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Método
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Campos corregidos
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Fuente
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map((c) => (
                    <CaseRow key={c.id} c={c} />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-slate-100 text-[12px] text-slate-400">
              {data.length} caso{data.length !== 1 ? "s" : ""} — haz clic en una fila para ver el
              diff de correcciones
            </div>
          </>
        )}
      </div>
    </div>
  );
}

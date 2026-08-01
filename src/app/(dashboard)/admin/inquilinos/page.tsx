"use client";

import { useEffect, useState } from "react";
import { Users, Search } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import * as api from "@/lib/api";
import type { AdminTenant } from "@/lib/types";
import { cn } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, string> = {
  Pagado: "bg-emerald-50 text-emerald-700",
  Parcial: "bg-amber-50 text-amber-700",
  Pendiente: "bg-slate-100 text-slate-600",
  Vencido: "bg-red-50 text-red-700",
  "Revisión": "bg-violet-50 text-violet-700",
};

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "d MMM yyyy", { locale: es });
  } catch {
    return iso;
  }
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function InquilinosAdminPage() {
  const [data, setData] = useState<AdminTenant[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    api
      .getAllTenantsAdmin()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = data
    ? data.filter((t) => {
        const q = query.toLowerCase();
        return (
          t.name.toLowerCase().includes(q) ||
          t.landlordName.toLowerCase().includes(q) ||
          t.phone.includes(q)
        );
      })
    : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#eef1fd] flex items-center justify-center">
          <Users className="w-5 h-5 text-[#2952F3]" />
        </div>
        <div>
          <h1 className="text-[20px] font-bold text-[#0B1426] leading-tight">Inquilinos</h1>
          <p className="text-[13px] text-slate-400">Todos los inquilinos de todos los arrendadores</p>
        </div>
      </div>

      {/* Buscador */}
      {data && data.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por nombre, arrendador o teléfono…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-[13px] bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2952F3]/20 focus:border-[#2952F3]"
          />
        </div>
      )}

      <div
        className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
      >
        {loading && (
          <div className="p-6 space-y-2 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-slate-100 rounded-lg" />
            ))}
          </div>
        )}

        {error && (
          <div className="p-6">
            <p className="text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error.startsWith("403")
                ? "Sin acceso — esta sección es solo para administradores."
                : error.startsWith("503")
                ? "El backend no está disponible. Asegúrate de que el servidor esté corriendo en :3001."
                : `Error al cargar inquilinos (${error.split(":")[0]}). Revisa que el backend esté activo.`}
            </p>
          </div>
        )}

        {data && data.length === 0 && (
          <div className="p-10 text-center">
            <p className="text-[13px] text-slate-400">No hay inquilinos registrados.</p>
          </div>
        )}

        {data && data.length > 0 && filtered.length === 0 && (
          <div className="p-10 text-center">
            <p className="text-[13px] text-slate-400">Sin resultados para &ldquo;{query}&rdquo;.</p>
          </div>
        )}

        {data && filtered.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Inquilino
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Arrendador
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Teléfono
                    </th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Renta
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Último pago
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-[#0B1426]">{t.name}</p>
                          {t.paymentDay && (
                            <p className="text-[11px] text-slate-400">Paga día {t.paymentDay}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[12px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded font-medium">
                          {t.landlordName}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-mono text-[12px]">
                        {t.phone.replace(/^52/, "+52 ")}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 tabular-nums">
                        {fmt(t.monthlyAmount)}
                      </td>
                      <td className="px-4 py-3">
                        {t.paymentStatus ? (
                          <span
                            className={cn(
                              "inline-block text-[11px] font-medium px-2 py-0.5 rounded-md",
                              STATUS_STYLE[t.paymentStatus] ?? "bg-slate-100 text-slate-600"
                            )}
                          >
                            {t.paymentStatus}
                          </span>
                        ) : (
                          <span className="text-[12px] text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-slate-500">
                        {fmtDate(t.lastPaymentDate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-slate-100 text-[12px] text-slate-400">
              {filtered.length === data.length
                ? `${data.length} inquilino${data.length !== 1 ? "s" : ""}`
                : `${filtered.length} de ${data.length} inquilinos`}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

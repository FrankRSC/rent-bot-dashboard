"use client";

import { useEffect, useState } from "react";
import { UserCog, LogIn, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import * as api from "@/lib/api";
import type { Landlord } from "@/lib/types";
import { useStore } from "@/store/useStore";

function formatDate(iso: string) {
  try {
    return format(new Date(iso), "d MMM yyyy", { locale: es });
  } catch {
    return iso;
  }
}

function ImpersonateButton({ landlord }: { landlord: Landlord }) {
  const { hydrateAuth } = useStore();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImpersonate = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.impersonateLandlord(landlord.id);
      await hydrateAuth(); // refleja impersonatedBy en el store antes de redirigir
      setDone(true);
      if (typeof window !== "undefined") window.location.href = "/dashboard";
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  };

  if (done) return <span className="text-[12px] text-emerald-600">Redirigiendo…</span>;

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleImpersonate}
        disabled={loading}
        className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[12px] font-medium bg-[#eef1fd] text-[#2952F3] hover:bg-[#dce4fd] transition-colors disabled:opacity-50 disabled:cursor-wait"
      >
        <LogIn className="w-3.5 h-3.5" />
        {loading ? "Entrando…" : "Entrar como"}
      </button>
      {error && (
        <span className="text-[11px] text-red-500">{error}</span>
      )}
    </div>
  );
}

export default function ArrendadoresPage() {
  const [data, setData] = useState<Landlord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getLandlords()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#eef1fd] flex items-center justify-center">
          <UserCog className="w-5 h-5 text-[#2952F3]" />
        </div>
        <div>
          <h1 className="text-[20px] font-bold text-[#0B1426] leading-tight">Arrendadores</h1>
          <p className="text-[13px] text-slate-400">Todos los arrendadores registrados en la plataforma</p>
        </div>
      </div>

      <div
        className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
      >
        {loading && (
          <div className="p-6 space-y-2 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 bg-slate-100 rounded-lg" />
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
                : `Error al cargar arrendadores (${error.split(":")[0]}). Revisa que el backend esté activo.`}
            </p>
          </div>
        )}

        {data && data.length === 0 && (
          <div className="p-10 text-center">
            <p className="text-[13px] text-slate-400">No hay arrendadores registrados.</p>
          </div>
        )}

        {data && data.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Nombre
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Teléfono
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Registro
                    </th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#eef1fd] flex items-center justify-center text-[11px] font-bold text-[#2952F3] shrink-0">
                            {l.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                          </div>
                          <span className="font-medium text-[#0B1426]">{l.name}</span>
                          {l.isAdmin && (
                            <span className="text-[10px] font-medium bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded">
                              Admin
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-mono text-[12px]">{l.email}</td>
                      <td className="px-4 py-3 text-slate-600 font-mono text-[12px]">{l.phone}</td>
                      <td className="px-4 py-3">
                        {l.isActive ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                            <CheckCircle2 className="w-3 h-3" /> Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                            <XCircle className="w-3 h-3" /> Inactivo
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-slate-500">
                        {formatDate(l.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!l.isAdmin && <ImpersonateButton landlord={l} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-slate-100 text-[12px] text-slate-400">
              {data.length} arrendador{data.length !== 1 ? "es" : ""} — sesiones de impersonación duran 2 h y quedan auditadas
            </div>
          </>
        )}
      </div>
    </div>
  );
}

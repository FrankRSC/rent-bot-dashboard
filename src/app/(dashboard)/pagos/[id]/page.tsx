"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, ShieldCheck, ShieldX, Image, FileText, ScanLine, HelpCircle, Check, Globe, AlertCircle, Clock, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import * as api from "@/lib/api";
import type { PaymentAttempt, AttemptStatus, EventType } from "@/lib/types";
import { cn } from "@/lib/utils";

function StatusPill({ status }: { status: AttemptStatus }) {
  const map: Record<AttemptStatus, { label: string; cls: string }> = {
    VERIFIED:           { label: "Verificado",           cls: "bg-emerald-50 border-emerald-200 text-emerald-700" },
    INTRABANK_OK:       { label: "Intrabancario OK",      cls: "bg-emerald-50 border-emerald-200 text-emerald-700" },
    PENDING:            { label: "Pendiente",             cls: "bg-amber-50 border-amber-200 text-amber-600" },
    REJECTED:           { label: "Revisión",              cls: "bg-purple-50 border-purple-200 text-purple-600" },
    INTRABANK_REJECTED: { label: "Intrabancario Fallido", cls: "bg-red-50 border-red-200 text-red-600" },
    ERROR:              { label: "Error",                 cls: "bg-red-50 border-red-200 text-red-600" },
    ABANDONED:          { label: "Abandonado",            cls: "bg-slate-100 border-slate-200 text-slate-600" },
  };
  const { label, cls } = map[status] ?? { label: status, cls: "bg-slate-100 border-slate-200 text-slate-600" };
  return (
    <span className={cn("inline-flex items-center border text-[11px] font-semibold px-2.5 py-[3px] rounded-full whitespace-nowrap", cls)}>
      {label}
    </span>
  );
}

type EventMeta = { icon: React.ElementType; color: string; label: string };

function getEventMeta(event: EventType): EventMeta {
  const map: Record<EventType, EventMeta> = {
    MEDIA_RECEIVED:     { icon: Image,       color: "text-blue-600 bg-blue-50",      label: "Imagen recibida" },
    TEXT_WITH_DATA:     { icon: FileText,    color: "text-blue-600 bg-blue-50",      label: "Texto con datos" },
    OCR_SUCCESS:        { icon: ScanLine,    color: "text-[#2952F3] bg-[#eef1fd]",   label: "Datos extraídos" },
    OCR_FAILED:         { icon: AlertCircle, color: "text-red-600 bg-red-50",        label: "Error al leer comprobante" },
    FIELD_REQUESTED:    { icon: HelpCircle,  color: "text-amber-600 bg-amber-50",    label: "Dato solicitado al inquilino" },
    FIELD_PROVIDED:     { icon: Check,       color: "text-amber-700 bg-amber-50",    label: "Dato proporcionado" },
    CEP_CALLED:         { icon: Globe,       color: "text-purple-600 bg-purple-50",  label: "Verificación con Banxico" },
    VERIFIED:           { icon: ShieldCheck, color: "text-[#047857] bg-[#ecfdf5]",   label: "Verificado ✓" },
    REJECTED:           { icon: ShieldX,     color: "text-purple-600 bg-purple-50",  label: "Revisión" },
    INTRABANK_OK:       { icon: ShieldCheck, color: "text-[#047857] bg-[#ecfdf5]",   label: "Intrabancario OK ✓" },
    INTRABANK_REJECTED: { icon: ShieldX,     color: "text-red-600 bg-red-50",        label: "Intrabancario Fallido" },
    ERROR:              { icon: AlertCircle, color: "text-red-600 bg-red-50",        label: "Error" },
  };
  return map[event] ?? { icon: Clock, color: "text-slate-400 bg-slate-100", label: event };
}

const KEY_LABELS: Record<string, string> = {
  monto:              "Monto",
  claveRastreo:       "Clave de rastreo",
  bancoEmisor:        "Banco emisor",
  bancoReceptor:      "Banco receptor",
  nombreBeneficiario: "Beneficiario",
  nombreOrdenante:    "Ordenante",
  concepto:           "Concepto",
  estadoOperacion:    "Estado",
  emisorNombre:       "Emisor",
  receptorNombre:     "Receptor",
  fechaOperacion:     "Fecha operación",
  sello:              "Sello digital",
  reason:             "Motivo",
  field:              "Campo",
  value:              "Valor",
  ocrMonto:           "Monto leído",
  cepMonto:           "Monto verificado",
};

function DataSection({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (!entries.length) return null;
  return (
    <div className="divide-y divide-slate-100 rounded-xl border border-slate-200/80 overflow-hidden">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-start gap-3 px-4 py-2.5 bg-white">
          <span className="text-[12px] text-slate-400 min-w-[140px] shrink-0">{KEY_LABELS[key] ?? key}</span>
          <span className="text-[13px] font-medium text-[#0B1426] break-all">{String(value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function PaymentDetailPage() {
  const params = useParams();
  const id = parseInt(params.id as string, 10);
  const [attempt, setAttempt] = useState<PaymentAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNaN(id)) return;
    setLoading(true);
    api.getPaymentById(id)
      .then(setAttempt)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-40 bg-slate-100 rounded-2xl" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-52 bg-slate-100 rounded-2xl" />
          <div className="h-52 bg-slate-100 rounded-2xl" />
        </div>
        <div className="h-72 bg-slate-100 rounded-2xl" />
      </div>
    );
  }

  if (error || !attempt) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-amber-500" />
        </div>
        <p className="text-[15px] font-semibold text-[#0B1426]">Algo salió mal</p>
        <p className="text-[13px] text-slate-400">No se pudieron cargar los datos. Intenta de nuevo.</p>
        <Link href="/pagos">
          <Button variant="outline" size="sm">Volver a Pagos</Button>
        </Link>
      </div>
    );
  }

  const events = attempt.events ?? [];
  const isVerified = attempt.status === "VERIFIED" || attempt.status === "INTRABANK_OK";

  return (
    <div className="space-y-5">

      {/* Hero */}
      <div
        className="bg-[#0B1426] rounded-2xl overflow-hidden"
        style={{ boxShadow: "0 4px 24px rgba(11,20,38,0.18)" }}
      >
        <div className="px-6 pt-5 pb-6">
          <div className="flex items-start gap-3 mb-5">
            <Link href="/pagos">
              <button className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors mt-0.5 shrink-0">
                <ArrowLeft className="w-4 h-4 text-white" />
              </button>
            </Link>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-white/40 uppercase tracking-widest font-semibold mb-1">Intento de pago</p>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-[22px] font-bold text-white leading-tight">#{attempt.id}</h1>
                <StatusPill status={attempt.status} />
                {attempt.verifiedOnFirstTry && (
                  <span className="inline-flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold px-2.5 py-[3px] rounded-full">
                    <ShieldCheck className="w-3 h-3" /> Verificado a la primera
                  </span>
                )}
              </div>
              <p className="text-[13px] text-white/40 mt-1.5 font-mono">{attempt.tenantPhone}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/5 rounded-xl px-4 py-3">
              <p className="text-[11px] text-white/40 uppercase tracking-widest font-semibold mb-1">Recibido</p>
              <p className="text-[14px] font-semibold text-white">
                {format(new Date(attempt.createdAt), "dd 'de' MMMM yyyy", { locale: es })}
              </p>
              <p className="text-[12px] text-white/40 mt-0.5 font-mono">
                {format(new Date(attempt.createdAt), "HH:mm:ss")}
              </p>
            </div>
            <div className="bg-white/5 rounded-xl px-4 py-3">
              <p className="text-[11px] text-white/40 uppercase tracking-widest font-semibold mb-1">Resultado</p>
              <p className={cn("text-[14px] font-semibold", isVerified ? "text-emerald-400" : "text-white/60")}>
                {isVerified ? "Comprobante válido" : "Sin verificar"}
              </p>
              <p className="text-[12px] text-white/40 mt-0.5">{events.length} evento{events.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
        </div>
      </div>

      {/* OCR + CEP */}
      {(attempt.ocrData || attempt.cepResponse) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {attempt.ocrData && (
            <div
              className="bg-white rounded-2xl border border-slate-200/80 p-5"
              style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-[#eef1fd] flex items-center justify-center shrink-0">
                  <ScanLine className="w-3.5 h-3.5 text-[#2952F3]" />
                </div>
                <p className="text-[13px] font-semibold text-[#0B1426]">Datos del comprobante</p>
              </div>
              <DataSection data={attempt.ocrData} />
            </div>
          )}
          {attempt.cepResponse && (
            <div
              className="bg-white rounded-2xl border border-slate-200/80 p-5"
              style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-[#ecfdf5] flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#047857]" />
                </div>
                <p className="text-[13px] font-semibold text-[#0B1426]">Verificación Banxico</p>
              </div>
              <DataSection data={attempt.cepResponse} />
            </div>
          )}
        </div>
      )}

      {/* Timeline */}
      <div
        className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
      >
        <div className="px-6 py-4 border-b border-slate-100">
          <p className="text-[14px] font-semibold text-[#0B1426]">Línea de tiempo</p>
          <p className="text-[12px] text-slate-400 mt-0.5">{events.length} evento{events.length !== 1 ? "s" : ""} registrado{events.length !== 1 ? "s" : ""}</p>
        </div>

        <div className="p-6">
          {events.length === 0 ? (
            <p className="text-[13px] text-slate-400 text-center py-4">Sin eventos registrados</p>
          ) : (
            <div className="relative">
              <div className="absolute left-5 top-5 bottom-5 w-px bg-slate-100" />
              <div className="space-y-1">
                {events.map((ev, i) => {
                  const meta = getEventMeta(ev.event);
                  const Icon = meta.icon;
                  const isLast = i === events.length - 1;
                  return (
                    <div key={ev.id} className="relative flex gap-4">
                      <div className={cn("relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center", meta.color)}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className={cn("flex-1 pb-4", isLast && "pb-0")}>
                        <div className="flex items-center justify-between gap-2 pt-2.5">
                          <span className="text-[13px] font-semibold text-[#0B1426]">{meta.label}</span>
                          <span className="text-[11px] text-slate-400 tabular-nums shrink-0 font-mono">
                            {format(new Date(ev.createdAt), "HH:mm:ss")}
                          </span>
                        </div>
                        {ev.data && Object.keys(ev.data).length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {Object.entries(ev.data)
                              .filter(([, v]) => v !== null && v !== undefined)
                              .map(([key, value]) => (
                                <span key={key} className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-600 rounded-md px-2 py-0.5">
                                  <span className="text-slate-400">{KEY_LABELS[key] ?? key}:</span> {String(value)}
                                </span>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

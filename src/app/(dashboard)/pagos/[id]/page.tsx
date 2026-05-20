"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, ShieldCheck, ShieldX, Image, FileText, ScanLine, HelpCircle, Check, Globe, AlertCircle, Clock } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import * as api from "@/lib/api";
import type { PaymentAttempt, AttemptStatus, EventType } from "@/lib/types";

function StatusBadge({ status }: { status: AttemptStatus }) {
  const map: Record<AttemptStatus, { label: string; className: string }> = {
    VERIFIED:             { label: "Verificado",          className: "bg-[#d1fae5] text-[#065f46] border-[#6ee7b7]" },
    INTRABANK_OK:         { label: "Intrabancario OK",     className: "bg-[#d1fae5] text-[#065f46] border-[#6ee7b7]" },
    PENDING:              { label: "Pendiente",            className: "bg-amber-100 text-amber-800 border-amber-200" },
    REJECTED:             { label: "Revisión",           className: "bg-purple-100 text-purple-800 border-purple-200" },
    INTRABANK_REJECTED:   { label: "Intrabancario Fallido",className: "bg-red-100 text-red-800 border-red-200" },
    ERROR:                { label: "Error",                className: "bg-red-100 text-red-800 border-red-200" },
    ABANDONED:            { label: "Abandonado",           className: "bg-slate-100 text-slate-600 border-slate-200" },
  };
  const { label, className } = map[status] ?? { label: status, className: "bg-slate-100 text-slate-600" };
  return <Badge className={`${className} hover:${className}`}>{label}</Badge>;
}

type EventMeta = { icon: React.ElementType; color: string; label: string };

function getEventMeta(event: EventType): EventMeta {
  const map: Record<EventType, EventMeta> = {
    MEDIA_RECEIVED:       { icon: Image,       color: "text-blue-500 bg-blue-50",    label: "Imagen recibida" },
    TEXT_WITH_DATA:       { icon: FileText,     color: "text-blue-500 bg-blue-50",    label: "Texto con datos" },
    OCR_SUCCESS:          { icon: ScanLine,     color: "text-[#2952F3] bg-[#eef1fd]", label: "Datos extraídos" },
    OCR_FAILED:           { icon: AlertCircle,  color: "text-red-500 bg-red-50",      label: "Error al leer comprobante" },
    FIELD_REQUESTED:      { icon: HelpCircle,   color: "text-amber-500 bg-amber-50",  label: "Dato solicitado al inquilino" },
    FIELD_PROVIDED:       { icon: Check,        color: "text-amber-600 bg-amber-50",  label: "Dato proporcionado" },
    CEP_CALLED:           { icon: Globe,        color: "text-purple-500 bg-purple-50",label: "Verificación con Banxico" },
    VERIFIED:             { icon: ShieldCheck,  color: "text-[#047857] bg-[#ecfdf5]",  label: "Verificado ✓" },
    REJECTED:             { icon: ShieldX,      color: "text-purple-500 bg-purple-50", label: "Revisión" },
    INTRABANK_OK:         { icon: ShieldCheck,  color: "text-[#047857] bg-[#ecfdf5]",  label: "Intrabancario OK ✓" },
    INTRABANK_REJECTED:   { icon: ShieldX,      color: "text-red-500 bg-red-50",      label: "Intrabancario Fallido" },
    ERROR:                { icon: AlertCircle,  color: "text-red-500 bg-red-50",      label: "Error" },
  };
  return map[event] ?? { icon: Clock, color: "text-slate-400 bg-slate-50", label: event };
}

const KEY_LABELS: Record<string, string> = {
  monto:               "Monto",
  claveRastreo:        "Clave de rastreo",
  bancoEmisor:         "Banco emisor",
  bancoReceptor:       "Banco receptor",
  nombreBeneficiario:  "Beneficiario",
  nombreOrdenante:     "Ordenante",
  concepto:            "Concepto",
  estadoOperacion:     "Estado",
  emisorNombre:        "Emisor",
  receptorNombre:      "Receptor",
  fechaOperacion:      "Fecha operación",
  sello:               "Sello digital",
  reason:              "Motivo",
  field:               "Campo",
  value:               "Valor",
  ocrMonto:            "Monto leído",
  cepMonto:            "Monto verificado",
};

function DataTable({ data, title }: { data: Record<string, unknown>; title: string }) {
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (!entries.length) return null;
  return (
    <div>
      {title && <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{title}</p>}
      <div className="rounded-lg border divide-y text-sm">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-start gap-3 px-3 py-2">
            <span className="text-muted-foreground min-w-[140px] text-xs">{KEY_LABELS[key] ?? key}</span>
            <span className="font-medium break-all">{String(value)}</span>
          </div>
        ))}
      </div>
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
        <div className="h-8 w-48 bg-slate-100 rounded" />
        <div className="h-32 bg-slate-100 rounded-xl" />
        <div className="h-64 bg-slate-100 rounded-xl" />
      </div>
    );
  }

  if (error || !attempt) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-sm text-muted-foreground">{error ?? "Intento no encontrado"}</p>
        <Link href="/pagos"><Button variant="outline" size="sm">Volver a Pagos</Button></Link>
      </div>
    );
  }

  const events = attempt.events ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/pagos">
          <Button variant="ghost" size="icon" className="shrink-0"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900">Intento #{attempt.id}</h1>
            <StatusBadge status={attempt.status} />
            {attempt.verifiedOnFirstTry && (
              <Badge className="bg-[#d1fae5] text-[#065f46] border-[#6ee7b7] hover:bg-[#d1fae5]">
                <ShieldCheck className="w-3 h-3 mr-1" />
                Verificado a la primera
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {attempt.tenantPhone} · {format(new Date(attempt.createdAt), "dd 'de' MMMM yyyy, HH:mm", { locale: es })}
          </p>
        </div>
      </div>

      {/* Extracted + verified data */}
      {(attempt.ocrData || attempt.cepResponse) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {attempt.ocrData && (
            <Card className="shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Datos del comprobante</CardTitle></CardHeader>
              <CardContent>
                <DataTable data={attempt.ocrData} title="" />
              </CardContent>
            </Card>
          )}
          {attempt.cepResponse && (
            <Card className="shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Verificación Banxico</CardTitle></CardHeader>
              <CardContent>
                <DataTable data={attempt.cepResponse} title="" />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Event timeline */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Línea de tiempo ({events.length} eventos)</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Sin eventos registrados</p>
          ) : (
            <div className="relative">
              <div className="absolute left-5 top-3 bottom-3 w-px bg-slate-200" />
              <div className="space-y-1">
                {events.map((ev, i) => {
                  const meta = getEventMeta(ev.event);
                  const Icon = meta.icon;
                  const isLast = i === events.length - 1;
                  return (
                    <div key={ev.id} className="relative flex gap-4 pl-0">
                      <div className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${meta.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className={`flex-1 pb-4 ${isLast ? "" : ""}`}>
                        <div className="flex items-center justify-between gap-2 pt-2.5">
                          <span className="text-sm font-semibold text-slate-800">{meta.label}</span>
                          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                            {format(new Date(ev.createdAt), "HH:mm:ss")}
                          </span>
                        </div>
                        {ev.data && Object.keys(ev.data).length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {Object.entries(ev.data)
                              .filter(([, v]) => v !== null && v !== undefined)
                              .map(([key, value]) => (
                                <span key={key} className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-600 rounded px-2 py-0.5">
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
        </CardContent>
      </Card>
    </div>
  );
}

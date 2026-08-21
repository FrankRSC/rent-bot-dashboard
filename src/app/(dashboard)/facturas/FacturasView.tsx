"use client";

import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Plus, FileText, XCircle, CheckCircle2, Clock, AlertCircle,
  Receipt, ExternalLink, Search, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useStore } from "@/store/useStore";
import { ApiErrorState } from "@/components/layout/ApiErrorState";
import { cn, formatCurrency } from "@/lib/utils";
import type { Factura, FacturaStatus } from "@/lib/types";

const currentYM = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tenantDisplayName(f: Factura): string {
  return f.tenant?.name ?? (f.tenantId !== null ? `Inquilino #${f.tenantId}` : "—");
}

function tenantInitials(name: string): string {
  return name.split(" ").slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase();
}

function statusDot(status: FacturaStatus): string {
  return status === "STAMPED"   ? "bg-emerald-500"
    : status === "DRAFT"        ? "bg-amber-400"
    : status === "ERROR"        ? "bg-red-400"
    : "bg-slate-300";
}

// ─── Status pill ──────────────────────────────────────────────────────────────

function FacturaStatusPill({ status }: { status: FacturaStatus }) {
  const map: Record<FacturaStatus, { cls: string; icon: React.ReactNode; label: string }> = {
    STAMPED:   { cls: "bg-emerald-50 border-emerald-200 text-emerald-700", icon: <CheckCircle2 className="w-3 h-3" />, label: "Timbrada" },
    DRAFT:     { cls: "bg-amber-50 border-amber-200 text-amber-700",       icon: <Clock className="w-3 h-3" />,       label: "Borrador" },
    CANCELLED: { cls: "bg-slate-100 border-slate-200 text-slate-500",      icon: <XCircle className="w-3 h-3" />,     label: "Cancelada" },
    ERROR:     { cls: "bg-red-50 border-red-200 text-red-600",             icon: <AlertCircle className="w-3 h-3" />, label: "Error" },
  };
  const { cls, icon, label } = map[status];
  return (
    <span className={cn("inline-flex items-center gap-1 border text-[11px] font-semibold px-2 py-[2px] rounded-full whitespace-nowrap", cls)}>
      {icon} {label}
    </span>
  );
}

// ─── Cancel Dialog ────────────────────────────────────────────────────────────

function CancelDialog({ facturaId, open, onClose }: { facturaId: string; open: boolean; onClose: () => void }) {
  const { cancelFactura } = useStore();
  const [motivo, setMotivo] = useState<"01" | "02" | "03" | "04">("02");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCancel = async () => {
    setSaving(true);
    setError(null);
    try {
      await cancelFactura(facturaId, { motivo });
      onClose();
    } catch (e) {
      setError((e as Error).message || "No se pudo cancelar la factura.");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xs">
        <DialogHeader><DialogTitle>Cancelar factura</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-[13px] text-slate-500">Selecciona el motivo de cancelación SAT:</p>
          <Select value={motivo} onValueChange={(v) => setMotivo(v as typeof motivo)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="01">01 – Emitido con errores con relación</SelectItem>
              <SelectItem value="02">02 – Emitido con errores sin relación</SelectItem>
              <SelectItem value="03">03 – No se llevó a cabo la operación</SelectItem>
              <SelectItem value="04">04 – Operación nominativa en factura global</SelectItem>
            </SelectContent>
          </Select>
          {error && <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cerrar</Button>
          <Button variant="destructive" onClick={handleCancel} disabled={saving}>
            {saving ? "Cancelando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Right panel — Issue form ─────────────────────────────────────────────────

function IssueForm({ onClose, onIssued }: { onClose: () => void; onIssued: () => void }) {
  const { allTenants, settings, issueFactura, landlordId } = useStore();
  const [tenantId, setTenantId] = useState("");
  const [billingPeriod, setBillingPeriod] = useState(currentYM);
  const [amount, setAmount] = useState("");
  const [concepto, setConcepto] = useState("Arrendamiento de inmueble");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const noRfc = !settings.rfc;

  const handleTenantChange = (v: string | null) => {
    const value = v ?? "";
    setTenantId(value);
    const tenant = allTenants.find((t) => t.id === value);
    if (tenant?.monthlyAmount) setAmount(String(tenant.monthlyAmount));
  };

  const handleSubmit = async () => {
    if (!tenantId) return;
    setSaving(true);
    setError(null);
    try {
      await issueFactura({
        landlordId,
        tenantId,
        billingPeriod: billingPeriod || undefined,
        amount: amount ? parseFloat(amount) : undefined,
        concepto: concepto || undefined,
      });
      onIssued();
    } catch (e) {
      setError((e as Error).message);
    } finally { setSaving(false); }
  };

  if (noRfc) {
    return (
      <div className="flex flex-col items-center justify-center text-center px-6 py-10 gap-3">
        <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center">
          <AlertCircle className="w-5 h-5 text-amber-500" />
        </div>
        <p className="text-[14px] font-semibold text-[#0B1426]">RFC no configurado</p>
        <p className="text-[13px] text-slate-500">
          Ve a <span className="font-medium text-[#2952F3]">Configuración → Datos fiscales</span> y agrega tu RFC antes de emitir facturas.
        </p>
        <Button variant="outline" size="sm" onClick={onClose} className="mt-1">Cerrar</Button>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4">
      <div className="space-y-1.5">
        <label className="text-[13px] font-medium text-slate-700">Inquilino</label>
        <Select value={tenantId} onValueChange={handleTenantChange}>
          <SelectTrigger><SelectValue placeholder="Seleccionar inquilino" /></SelectTrigger>
          <SelectContent>
            {allTenants.map((t) => (
              <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <label className="text-[13px] font-medium text-slate-700">Período (YYYY-MM)</label>
        <Input placeholder="2025-05" value={billingPeriod} onChange={(e) => setBillingPeriod(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <label className="text-[13px] font-medium text-slate-700">Monto</label>
        <Input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <label className="text-[13px] font-medium text-slate-700">Concepto</label>
        <Input value={concepto} onChange={(e) => setConcepto(e.target.value)} />
      </div>
      {error && <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button onClick={handleSubmit} disabled={saving || !tenantId} className="flex-1 bg-[#2952F3] hover:bg-[#1e3fd4]">
          {saving ? "Emitiendo…" : "Emitir factura"}
        </Button>
      </div>
    </div>
  );
}

// ─── Right panel — CFDI detail ────────────────────────────────────────────────

function FacturaDetail({
  factura,
  onCancel,
  onClose,
}: {
  factura: Factura;
  onCancel: (id: string) => void;
  onClose: () => void;
}) {
  const { settings } = useStore();
  const name = tenantDisplayName(factura);
  const ini  = tenantInitials(name);

  return (
    <div className="p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#eef1fd] flex items-center justify-center text-[12px] font-bold text-[#2952F3] shrink-0">
            {ini}
          </div>
          <div>
            <p className="text-[15px] font-bold text-[#0B1426]">{name}</p>
            <p className="text-[12px] text-slate-500">
              {factura.billingPeriod}
              {factura.concepto ? ` · ${factura.concepto}` : ""}
            </p>
          </div>
        </div>
        <FacturaStatusPill status={factura.status} />
      </div>

      {/* CFDI identifiers */}
      {(factura.uuidCfdi || settings.rfc) && (
        <div className="bg-slate-50 rounded-xl p-4 mb-5 space-y-3">
          {factura.uuidCfdi && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-0.5">UUID CFDI</p>
              <p className="font-mono text-[11px] text-[#0B1426] break-all leading-relaxed">{factura.uuidCfdi}</p>
            </div>
          )}
          {settings.rfc && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-0.5">RFC Emisor</p>
              <p className="font-mono text-[12px] text-[#0B1426]">{settings.rfc}</p>
            </div>
          )}
          {(factura.serie || factura.folio) && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-0.5">Serie / Folio</p>
              <p className="font-mono text-[12px] text-[#0B1426]">
                {[factura.serie, factura.folio].filter(Boolean).join(" · ")}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Amounts */}
      <div className="space-y-2 mb-5">
        <div className="flex justify-between items-center">
          <span className="text-[13px] text-slate-500">Subtotal</span>
          <span className="text-[13px] font-medium text-[#0B1426] tabular-nums">{formatCurrency(factura.subtotal)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[13px] text-slate-500">IVA 16%</span>
          <span className="text-[13px] text-slate-500 tabular-nums">
            {factura.iva > 0 ? formatCurrency(factura.iva) : "Exento"}
          </span>
        </div>
        <div className="flex justify-between items-center pt-3 border-t border-slate-100">
          <span className="text-[14px] font-semibold text-[#0B1426]">Total</span>
          <span className="text-[20px] font-bold text-[#0B1426] tabular-nums">{formatCurrency(factura.total)}</span>
        </div>
      </div>

      {/* Stamped date */}
      {factura.stampedAt && (
        <p className="text-[12px] text-slate-400 mb-5">
          Timbrada el {format(new Date(factura.stampedAt), "d 'de' MMMM yyyy", { locale: es })}
        </p>
      )}

      {/* Error message */}
      {factura.status === "ERROR" && factura.errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
          <p className="text-[12px] font-semibold text-red-700 mb-0.5">Error de timbrado</p>
          <p className="text-[11px] text-red-600">{factura.errorMessage}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2">
        {factura.status === "STAMPED" && factura.pdfUrl && (
          <a href={factura.pdfUrl} target="_blank" rel="noreferrer">
            <Button variant="outline" className="w-full gap-1.5">
              <ExternalLink className="w-3.5 h-3.5" /> Abrir PDF
            </Button>
          </a>
        )}
        {factura.status === "STAMPED" && (
          <Button
            variant="outline"
            onClick={() => onCancel(factura.id)}
            className="w-full gap-1.5 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
          >
            <XCircle className="w-3.5 h-3.5" /> Cancelar CFDI
          </Button>
        )}
      </div>

      {/* Close — mobile only */}
      <button
        onClick={onClose}
        className="lg:hidden mt-4 w-full text-center text-[13px] text-slate-500 py-1"
      >
        Cerrar
      </button>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface FacturasViewProps {
  initialFacturas: Factura[] | null;
}

// ─── View ─────────────────────────────────────────────────────────────────────

export function FacturasView({ initialFacturas }: FacturasViewProps) {
  const { facturas: storeFacturas, facturasState, fetchFacturas, settings } = useStore();

  const [selectedId,   setSelectedId]   = useState<string | null>(null);
  const [issueOpen,    setIssueOpen]     = useState(false);
  const [cancelTarget, setCancelTarget]  = useState<string | null>(null);
  const [filterPeriod, setFilterPeriod]  = useState("todos");
  const [searchQuery,  setSearchQuery]   = useState("");

  const facturas = useMemo(
    () => storeFacturas.length > 0 ? storeFacturas : (initialFacturas ?? []),
    [storeFacturas, initialFacturas]
  );

  useEffect(() => {
    if (settings.facturasEnabled) fetchFacturas();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.facturasEnabled]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return facturas
      .filter((f) => filterPeriod === "todos" || f.billingPeriod === filterPeriod)
      .filter((f) => {
        if (!q) return true;
        const name = tenantDisplayName(f).toLowerCase();
        return name.includes(q) || (f.uuidCfdi ?? "").toLowerCase().includes(q);
      });
  }, [facturas, filterPeriod, searchQuery]);

  const periods = useMemo(() => {
    const set = new Set(facturas.map((f) => f.billingPeriod));
    return Array.from(set).sort().reverse();
  }, [facturas]);

  // Se deriva de `filtered`, no de `facturas`: si el filtro esconde la factura
  // seleccionada el panel derecho se vacía solo, sin efecto ni setState en cascada.
  // Al limpiar el filtro la selección reaparece.
  const selectedFactura = useMemo(
    () => filtered.find((f) => f.id === selectedId) ?? null,
    [filtered, selectedId]
  );

  // ── Stats ────────────────────────────────────────────────────────────────

  const stampedCount  = facturas.filter((f) => f.status === "STAMPED").length;
  const totalStamped  = facturas.filter((f) => f.status === "STAMPED").reduce((s, f) => s + f.total, 0);
  const thisMonthCount = facturas.filter((f) => f.billingPeriod === currentYM).length;

  // ── Right panel mode ─────────────────────────────────────────────────────

  type RightMode = "issue" | "detail" | "empty";
  const rightMode: RightMode = issueOpen ? "issue" : selectedFactura ? "detail" : "empty";
  const rightKey = issueOpen ? "issue" : (selectedId ?? "empty");

  // ── Guards ───────────────────────────────────────────────────────────────

  if (!settings.facturasEnabled) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
          <Receipt className="w-6 h-6 text-slate-400" />
        </div>
        <p className="text-[16px] font-semibold text-[#0B1426]">Módulo de facturación desactivado</p>
        <p className="text-[13px] text-slate-500 max-w-xs">
          Actívalo desde{" "}
          <span className="font-medium text-[#2952F3]">Configuración → Datos fiscales</span>
          {" "}para comenzar a emitir CFDI 4.0.
        </p>
      </div>
    );
  }

  if (facturasState.error) return <ApiErrorState onRetry={fetchFacturas} />;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes panelFadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .panel-fade-in { animation: panelFadeIn 220ms cubic-bezier(0.16, 1, 0.3, 1) both; }
      `}</style>

      {/* Page header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[22px] font-bold text-[#0B1426] tracking-tight">Facturas</h1>
          <p className="text-sm text-slate-500 mt-0.5">CFDI 4.0 emitidos a inquilinos</p>
        </div>
        <Button
          size="sm"
          className="bg-[#2952F3] hover:bg-[#1e3fd4] gap-1.5"
          onClick={() => { setIssueOpen(true); setSelectedId(null); }}
        >
          <Plus className="w-4 h-4" /> Nueva factura
        </Button>
      </div>

      {/* Split layout */}
      <div className="flex flex-col lg:flex-row gap-4 items-start">

        {/* ── Left — list ─────────────────────────────────────────────── */}
        <div
          className="w-full lg:w-72 xl:w-80 lg:shrink-0 bg-white rounded-2xl border border-slate-200/80 overflow-hidden"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
        >
          {/* Stats chips */}
          <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {formatCurrency(totalStamped)}
            </span>
            <span className="text-slate-200">·</span>
            <span className="text-[12px] text-slate-500">{stampedCount} timbrada{stampedCount !== 1 ? "s" : ""}</span>
            <span className="text-slate-200">·</span>
            <span className="text-[12px] text-slate-500">{thisMonthCount} este mes</span>
            <span className="text-slate-200">·</span>
            <span className="text-[12px] text-slate-500">{facturas.length} total</span>
          </div>

          {/* Filter bar */}
          <div className="px-3 py-2.5 border-b border-slate-100 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <Input
                placeholder="Buscar inquilino…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 h-8 text-[13px]"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="w-3 h-3 text-slate-400" />
                </button>
              )}
            </div>
            <Select value={filterPeriod} onValueChange={(v) => setFilterPeriod(v ?? "todos")}>
              <SelectTrigger className="h-8 w-28 text-[12px] border-slate-200 shrink-0">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {periods.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* List */}
          <div className="max-h-[calc(100vh-17rem)] overflow-y-auto">
            {facturasState.loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-slate-50 last:border-0">
                  <div className="w-8 h-8 bg-slate-100 rounded-full animate-pulse shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-slate-100 rounded animate-pulse w-28" />
                    <div className="h-2.5 bg-slate-50 rounded animate-pulse w-20" />
                  </div>
                  <div className="h-3 bg-slate-100 rounded animate-pulse w-14" />
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Search className="w-7 h-7 text-slate-200" />
                <p className="text-[13px] text-slate-500">Sin resultados</p>
              </div>
            ) : (
              filtered.map((f) => {
                const name   = tenantDisplayName(f);
                const ini    = tenantInitials(name);
                const active = f.id === selectedId;
                return (
                  <button
                    key={f.id}
                    onClick={() => { setSelectedId(f.id); setIssueOpen(false); }}
                    className={cn(
                      "w-full text-left flex items-center gap-3 px-4 py-3 border-b border-slate-50 last:border-0 transition-colors",
                      active ? "bg-[#eef1fd]" : "hover:bg-slate-50/80"
                    )}
                  >
                    <div className="relative shrink-0">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0",
                        active ? "bg-[#2952F3] text-white" : "bg-[#eef1fd] text-[#2952F3]"
                      )}>
                        {ini}
                      </div>
                      <span className={cn("absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white", statusDot(f.status))} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-[13px] font-semibold truncate", active ? "text-[#2952F3]" : "text-[#0B1426]")}>
                        {name}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">{f.billingPeriod}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[13px] font-semibold text-[#0B1426] tabular-nums">{formatCurrency(f.total)}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer count */}
          {!facturasState.loading && filtered.length > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/60">
              <span className="text-[11px] text-slate-500">
                {filtered.length} factura{filtered.length !== 1 ? "s" : ""}
                {filterPeriod !== "todos" || searchQuery ? " · filtradas" : ""}
              </span>
            </div>
          )}
        </div>

        {/* ── Right — detail / form / empty ──────────────────────────── */}
        <div
          className={cn(
            "flex-1 w-full bg-white rounded-2xl border border-slate-200/80 overflow-hidden lg:sticky lg:top-6 lg:self-start",
            rightMode === "empty" && "hidden lg:block",
          )}
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
        >
          {/* Right panel header bar */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
            <p className="text-[13px] font-semibold text-[#0B1426]">
              {rightMode === "issue"  ? "Nueva factura"
               : rightMode === "detail" ? "Detalle CFDI"
               : "Detalle"}
            </p>
            {rightMode !== "empty" && (
              <button
                onClick={() => { setIssueOpen(false); setSelectedId(null); }}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Right panel content — keyed to animate on change */}
          <div key={rightKey} className="panel-fade-in">
            {rightMode === "issue" && (
              <IssueForm
                onClose={() => setIssueOpen(false)}
                onIssued={() => setIssueOpen(false)}
              />
            )}
            {rightMode === "detail" && selectedFactura && (
              <FacturaDetail
                factura={selectedFactura}
                onCancel={(id) => setCancelTarget(id)}
                onClose={() => setSelectedId(null)}
              />
            )}
            {rightMode === "empty" && (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6 gap-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-slate-300" />
                </div>
                <p className="text-[14px] font-semibold text-[#0B1426]">Selecciona una factura</p>
                <p className="text-[13px] text-slate-500 max-w-xs">
                  Toca cualquier registro para ver su detalle de CFDI, descargar el PDF o cancelarlo.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 mt-1"
                  onClick={() => { setIssueOpen(true); setSelectedId(null); }}
                >
                  <Plus className="w-3.5 h-3.5" /> Nueva factura
                </Button>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Cancel dialog */}
      {cancelTarget && (
        <CancelDialog
          facturaId={cancelTarget}
          open={true}
          onClose={() => setCancelTarget(null)}
        />
      )}
    </>
  );
}

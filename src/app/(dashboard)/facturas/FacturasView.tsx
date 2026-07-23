"use client";

import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Plus, FileText, XCircle, CheckCircle2, Clock, AlertCircle,
  Receipt, SlidersHorizontal, ExternalLink, Search,
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

function FacturaStatusPill({ status }: { status: FacturaStatus }) {
  const map: Record<FacturaStatus, { cls: string; icon: React.ReactNode; label: string }> = {
    STAMPED:   { cls: "bg-emerald-50 border-emerald-200 text-emerald-700", icon: <CheckCircle2 className="w-3 h-3" />, label: "Timbrada" },
    DRAFT:     { cls: "bg-amber-50 border-amber-200 text-amber-700",       icon: <Clock className="w-3 h-3" />,       label: "Borrador" },
    CANCELLED: { cls: "bg-slate-100 border-slate-200 text-slate-500",      icon: <XCircle className="w-3 h-3" />,    label: "Cancelada" },
    ERROR:     { cls: "bg-red-50 border-red-200 text-red-600",             icon: <AlertCircle className="w-3 h-3" />, label: "Error" },
  };
  const { cls, icon, label } = map[status];
  return (
    <span className={cn("inline-flex items-center gap-1 border text-[11px] font-semibold px-2.5 py-[3px] rounded-full whitespace-nowrap", cls)}>
      {icon} {label}
    </span>
  );
}

function IssueFacturaDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
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
    const tenant = allTenants.find((t) => t.id === parseInt(value));
    if (tenant?.monthlyAmount) setAmount(String(tenant.monthlyAmount));
  };

  const handleSubmit = async () => {
    if (!tenantId) return;
    setSaving(true);
    setError(null);
    try {
      await issueFactura({
        landlordId,
        tenantId: parseInt(tenantId),
        billingPeriod: billingPeriod || undefined,
        amount: amount ? parseFloat(amount) : undefined,
        concepto: concepto || undefined,
      });
      onClose();
      setTenantId("");
      setAmount("");
      setConcepto("Arrendamiento de inmueble");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Nueva factura</DialogTitle></DialogHeader>
        {noRfc ? (
          <div className="py-4 text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
            <p className="text-[14px] font-semibold text-[#0B1426]">RFC no configurado</p>
            <p className="text-[13px] text-slate-500">Ve a Configuración → Datos fiscales y agrega tu RFC antes de emitir facturas.</p>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Inquilino</label>
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
              <label className="text-sm font-medium">Período (YYYY-MM)</label>
              <Input placeholder="2025-05" value={billingPeriod} onChange={(e) => setBillingPeriod(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Monto</label>
              <Input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Concepto</label>
              <Input value={concepto} onChange={(e) => setConcepto(e.target.value)} />
            </div>
            {error && <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          {!noRfc && (
            <Button onClick={handleSubmit} disabled={saving || !tenantId} className="bg-[#2952F3] hover:bg-[#1e3fd4]">
              {saving ? "Emitiendo..." : "Emitir factura"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelDialog({
  facturaId, open, onClose,
}: { facturaId: string; open: boolean; onClose: () => void }) {
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
      setError((e as Error).message || "No se pudo cancelar la factura. Intenta de nuevo.");
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
              <SelectItem value="01">01 – Comprobante emitido con errores con relación</SelectItem>
              <SelectItem value="02">02 – Comprobante emitido con errores sin relación</SelectItem>
              <SelectItem value="03">03 – No se llevó a cabo la operación</SelectItem>
              <SelectItem value="04">04 – Operación nominativa relacionada en factura global</SelectItem>
            </SelectContent>
          </Select>
          {error && (
            <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="destructive" onClick={handleCancel} disabled={saving}>
            {saving ? "Cancelando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface FacturasViewProps {
  initialFacturas: Factura[] | null;
}

// ─── View ─────────────────────────────────────────────────────────────────────

export function FacturasView({ initialFacturas }: FacturasViewProps) {
  const { facturas: storeFacturas, facturasState, fetchFacturas, settings } = useStore();
  const [issueOpen, setIssueOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [filterPeriod, setFilterPeriod] = useState("todos");

  const facturas = useMemo(
    () => storeFacturas.length > 0 ? storeFacturas : (initialFacturas ?? []),
    [storeFacturas, initialFacturas]
  );

  useEffect(() => {
    if (settings.facturasEnabled) fetchFacturas();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.facturasEnabled]);

  const filtered = useMemo(() =>
    filterPeriod === "todos" ? facturas : facturas.filter((f) => f.billingPeriod === filterPeriod),
    [facturas, filterPeriod]
  );

  const periods = useMemo(() => {
    const set = new Set(facturas.map((f) => f.billingPeriod));
    return Array.from(set).sort().reverse();
  }, [facturas]);

  if (!settings.facturasEnabled) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
          <Receipt className="w-6 h-6 text-slate-400" />
        </div>
        <p className="text-[16px] font-semibold text-[#0B1426]">Módulo de facturación desactivado</p>
        <p className="text-[13px] text-slate-400 max-w-xs">
          Actívalo desde <span className="font-medium text-[#2952F3]">Configuración → Datos fiscales</span> para comenzar a emitir CFDI 4.0.
        </p>
      </div>
    );
  }

  const stampedCount = facturas.filter((f) => f.status === "STAMPED").length;
  const thisMonthCount = facturas.filter((f) => f.billingPeriod === currentYM).length;
  const totalStamped = facturas.filter((f) => f.status === "STAMPED").reduce((s, f) => s + Number(f.total), 0);

  if (facturasState.error) return <ApiErrorState onRetry={fetchFacturas} />;

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[#0B1426] tracking-tight">Facturas</h1>
          <p className="text-sm text-slate-400 mt-0.5">CFDI 4.0 emitidos a inquilinos</p>
        </div>
        <Button size="sm" className="bg-[#2952F3] hover:bg-[#1e3fd4] gap-1.5" onClick={() => setIssueOpen(true)}>
          <Plus className="w-4 h-4" /> Nueva factura
        </Button>
      </div>

      {/* Stats */}
      <div
        className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
      >
        <div className="grid grid-cols-3">
          <div className="px-6 py-5 border-r border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Total timbrado</p>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              </div>
            </div>
            <p className="text-[22px] font-bold text-[#0B1426] leading-none tabular-nums">{formatCurrency(totalStamped)}</p>
            <p className="text-[12px] text-slate-400 mt-1.5">{stampedCount} factura{stampedCount !== 1 ? "s" : ""} timbrada{stampedCount !== 1 ? "s" : ""}</p>
          </div>
          <div className="px-6 py-5 border-r border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Este mes</p>
              <div className="w-7 h-7 rounded-lg bg-[#eef1fd] flex items-center justify-center">
                <Receipt className="w-3.5 h-3.5 text-[#2952F3]" />
              </div>
            </div>
            <p className="text-[28px] font-bold text-[#2952F3] leading-none">{thisMonthCount}</p>
            <p className="text-[12px] text-slate-400 mt-1.5">emitidas en {format(new Date(), "MMMM", { locale: es })}</p>
          </div>
          <div className="px-6 py-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Total emitidas</p>
              <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
              </div>
            </div>
            <p className="text-[28px] font-bold text-[#0B1426] leading-none">{facturas.length}</p>
            <p className="text-[12px] text-slate-400 mt-1.5">en total</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div
        className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
      >
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2.5 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
          <SlidersHorizontal className="w-4 h-4 text-slate-400 shrink-0" />
          <Select value={filterPeriod} onValueChange={(v) => setFilterPeriod(v ?? "todos")}>
            <SelectTrigger className="h-8 w-44 text-[13px] border-slate-200 bg-white">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los períodos</SelectItem>
              {periods.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          {filterPeriod !== "todos" && (
            <button onClick={() => setFilterPeriod("todos")} className="h-8 px-3 text-[13px] text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors">
              Limpiar
            </button>
          )}
          <span className="ml-auto text-[12px] text-slate-400 hidden sm:block">
            {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Column headers */}
        <div className="hidden sm:grid grid-cols-[1fr_100px_100px_100px_120px_80px] px-5 py-2.5 border-b border-slate-100 bg-slate-50/60">
          {["Inquilino", "Período", "Total", "IVA", "Estado", ""].map((h, i) => (
            <span key={i} className={cn(
              "text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400",
              i >= 2 && i < 5 && "text-right pr-4",
            )}>{h}</span>
          ))}
        </div>

        {/* Rows */}
        {facturasState.loading ? (
          Array.from({ length: 5 }).map((_, i) => (
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
            <p className="text-[13px] text-slate-400">No hay facturas registradas</p>
            <button onClick={() => setIssueOpen(true)} className="text-[13px] text-[#2952F3] hover:underline mt-1">
              Emitir primera factura
            </button>
          </div>
        ) : filtered.map((f) => {
          const name = f.tenant?.name ?? `Inquilino #${f.tenantId}`;
          const ini = name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
          return (
            <div key={f.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors">
              {/* Mobile */}
              <div className="flex items-center justify-between px-4 py-3.5 sm:hidden">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[#eef1fd] flex items-center justify-center text-[11px] font-bold text-[#2952F3] shrink-0">{ini}</div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[#0B1426] truncate">{name}</p>
                    <p className="text-[11px] text-slate-400">{f.billingPeriod} · {formatCurrency(Number(f.total))}</p>
                  </div>
                </div>
                <FacturaStatusPill status={f.status} />
              </div>
              {/* Desktop */}
              <div className="hidden sm:grid grid-cols-[1fr_100px_100px_100px_120px_80px] items-center px-5 py-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[#eef1fd] flex items-center justify-center text-[11px] font-bold text-[#2952F3] shrink-0">{ini}</div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[#0B1426] truncate">{name}</p>
                    {f.uuidCfdi && <p className="text-[10px] font-mono text-slate-400 truncate">{f.uuidCfdi}</p>}
                  </div>
                </div>
                <p className="text-[13px] text-slate-500">{f.billingPeriod}</p>
                <p className="text-[13px] font-semibold text-[#0B1426] text-right tabular-nums pr-4">{formatCurrency(Number(f.total))}</p>
                <p className="text-[12px] text-slate-400 text-right pr-4 tabular-nums">{Number(f.iva) > 0 ? formatCurrency(Number(f.iva)) : "Exento"}</p>
                <div className="flex justify-end pr-4"><FacturaStatusPill status={f.status} /></div>
                <div className="flex items-center justify-center gap-1">
                  {f.status === "STAMPED" && f.pdfUrl && (
                    <a href={f.pdfUrl} target="_blank" rel="noreferrer">
                      <button className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-[#2952F3] hover:bg-[#eef1fd] transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </a>
                  )}
                  {f.status === "STAMPED" && (
                    <button
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      onClick={() => setCancelTarget(f.id)}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {f.status === "ERROR" && f.errorMessage && (
                    <span title={f.errorMessage}>
                      <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length > 0 && !facturasState.loading && (
          <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50/60 border-t border-slate-100">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              {filtered.length} factura{filtered.length !== 1 ? "s" : ""}
            </span>
            <span className="text-[13px] font-bold text-[#0B1426] tabular-nums">
              Total · {formatCurrency(filtered.filter((f) => f.status === "STAMPED").reduce((s, f) => s + Number(f.total), 0))}
            </span>
          </div>
        )}
      </div>

      <IssueFacturaDialog open={issueOpen} onClose={() => setIssueOpen(false)} />
      {cancelTarget && (
        <CancelDialog facturaId={cancelTarget} open={true} onClose={() => setCancelTarget(null)} />
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CreditCard, Banknote, Pencil, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as api from "@/lib/api";
import { apiError } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import type {
  Landlord,
  LandlordSubscription,
  Plan,
  SubscriptionPayment,
} from "@/lib/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

const CARD = "bg-white rounded-2xl border border-slate-200/80 overflow-hidden";
const CARD_SHADOW = {
  boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)",
};
const TH =
  "px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider";

const money = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0 });

/** Fechas del backend son "YYYY-MM-DD" (sin hora): parsearlas con `new Date()` las
 *  corre un día por zona horaria, así que se arma la fecha local a mano. */
function formatDay(ymd: string | null): string {
  if (!ymd) return "—";
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  return format(new Date(y, m - 1, d), "d MMM yyyy", { locale: es });
}

const todayISO = () => new Date().toISOString().slice(0, 10);

// ── Estado de la suscripción ─────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  ACTIVA: "text-emerald-700 bg-emerald-50",
  CORTESIA: "text-sky-700 bg-sky-50",
  VENCIDA: "text-red-700 bg-red-50",
  CANCELADA: "text-slate-500 bg-slate-100",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVA: "Activa",
  CORTESIA: "Cortesía",
  VENCIDA: "Vencida",
  CANCELADA: "Cancelada",
};

function StatusChip({ sub }: { sub: LandlordSubscription | undefined }) {
  if (!sub) {
    return (
      <span className="inline-flex items-center text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
        Sin plan
      </span>
    );
  }
  // `status` puede decir ACTIVA con la vigencia ya vencida hasta que corra el cron
  // del backend (1:00 UTC). Aquí sí lo mostramos tal cual porque es la pantalla del
  // admin —él necesita ver el dato crudo—, pero marcamos el desfase para que no lo
  // confunda con una suscripción sana.
  const expired = sub.currentPeriodEnd < todayISO();
  const stale = expired && (sub.status === "ACTIVA" || sub.status === "CORTESIA");
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          "inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-md",
          STATUS_STYLES[sub.status] ?? "text-slate-500 bg-slate-100"
        )}
      >
        {STATUS_LABELS[sub.status] ?? sub.status}
      </span>
      {stale && (
        <span
          className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded"
          title="La vigencia ya pasó. El backend lo marcará como vencida cuando corra el cron (1:00 UTC); el arrendador ya está bloqueado."
        >
          <AlertTriangle className="w-2.5 h-2.5" /> Vigencia pasada
        </span>
      )}
    </div>
  );
}

// ── Diálogo: asignar / cambiar plan ──────────────────────────────────────────

function AssignPlanDialog({
  landlord,
  subscription,
  tenantsUsed,
  plans,
  onClose,
  onSaved,
}: {
  landlord: Landlord;
  subscription: LandlordSubscription | undefined;
  /** null cuando el arrendador aún no tiene plan: el backend solo reporta
   *  `tenantsUsed` para los que ya tienen suscripción. */
  tenantsUsed: number | null;
  plans: Plan[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [contracted, setContracted] = useState(
    String(subscription?.contractedTenants ?? Math.max(tenantsUsed ?? 1, 1))
  );
  const [specialPlanId, setSpecialPlanId] = useState("");
  const [months, setMonths] = useState("1");
  const [notes, setNotes] = useState(subscription?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const n = parseInt(contracted, 10);
  const valid = Number.isFinite(n) && n > 0;

  // Precio estimado: réplica de la derivación de escalón del backend (gana el plan
  // activo cuyo rango contiene a `n`). Es una previsualización — el monto real lo
  // congela el backend al crear la suscripción.
  const preview = useMemo(() => {
    if (!valid) return null;
    if (specialPlanId) {
      const p = plans.find((x) => x.id === specialPlanId);
      return p ? { plan: p, total: n * p.pricePerTenant } : null;
    }
    const p = plans
      .filter((x) => x.isActive && n >= x.minTenants && (x.maxTenants == null || n <= x.maxTenants))
      .sort((a, b) => a.minTenants - b.minTenants)[0];
    return p ? { plan: p, total: n * p.pricePerTenant } : null;
  }, [valid, n, specialPlanId, plans]);

  // El backend acepta bajar el tope por debajo del uso a propósito (bajar de plan es
  // una negociación; no le da de baja inquilinos a nadie). No lo bloqueamos, pero el
  // admin debe saber que deja al arrendador sin poder agregar.
  const overCap = valid && tenantsUsed != null && n < tenantsUsed;

  const handleSave = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      await api.createSubscription({
        landlordId: landlord.id,
        contractedTenants: n,
        ...(specialPlanId ? { planId: specialPlanId } : {}),
        ...(months && parseInt(months, 10) > 1 ? { months: parseInt(months, 10) } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(apiError(e, "No se pudo guardar el plan."));
    } finally {
      setSaving(false);
    }
  };

  const inactivePlans = plans.filter((p) => !p.isActive);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {subscription ? "Cambiar plan" : "Asignar plan"} — {landlord.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 px-4 py-3">
          <div className="space-y-1.5">
            <label htmlFor="contracted" className="text-sm font-medium">
              Inquilinos contratados
            </label>
            <Input
              id="contracted"
              type="number"
              min={1}
              value={contracted}
              onChange={(e) => setContracted(e.target.value)}
            />
            <p className="text-[12px] text-slate-500">
              {tenantsUsed != null && (
                <>
                  Hoy usa <strong>{tenantsUsed}</strong> inquilino
                  {tenantsUsed !== 1 ? "s" : ""}.{" "}
                </>
              )}
              El escalón y el precio se derivan de este número.
            </p>
          </div>

          {overCap && (
            <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Quedará en {tenantsUsed}/{n}. Sus {tenantsUsed} inquilinos siguen operando
              completos, pero no podrá agregar nuevos hasta que baje del tope o lo amplíes.
            </p>
          )}

          {preview && (
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5">
              <p className="text-[12px] text-slate-500">{preview.plan.name}</p>
              <p className="text-[15px] font-bold text-[#0B1426] tabular-nums">
                {money(preview.total)}
                <span className="text-[12px] font-normal text-slate-500">
                  {" "}
                  / mes ({n} × {money(preview.plan.pricePerTenant)})
                </span>
              </p>
            </div>
          )}

          {inactivePlans.length > 0 && (
            <div className="space-y-1.5">
              <label htmlFor="special" className="text-sm font-medium">
                Plan especial <span className="font-normal text-slate-400">(opcional)</span>
              </label>
              <select
                id="special"
                value={specialPlanId}
                onChange={(e) => setSpecialPlanId(e.target.value)}
                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-[13px]"
              >
                <option value="">Derivar escalón automáticamente</option>
                {inactivePlans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {money(p.pricePerTenant)}/inquilino
                  </option>
                ))}
              </select>
              <p className="text-[12px] text-slate-500">
                Solo para tratos negociados (25+). Los planes del catálogo se aplican solos.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="months" className="text-sm font-medium">
                Meses de vigencia
              </label>
              <Input
                id="months"
                type="number"
                min={1}
                value={months}
                onChange={(e) => setMonths(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="notes" className="text-sm font-medium">
                Notas
              </label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>

          {subscription && (
            <p className="text-[12px] text-slate-500">
              Reemplaza el plan actual ({subscription.contractedTenants} inquilinos, vence{" "}
              {formatDay(subscription.currentPeriodEnd)}). El arrendador tiene una sola
              suscripción.
            </p>
          )}

          {error && (
            <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>
        <DialogFooter className="px-4 pb-4">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!valid || saving}>
            {saving ? "Guardando…" : subscription ? "Cambiar plan" : "Asignar plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Diálogo: capturar efectivo ───────────────────────────────────────────────

function RecordPaymentDialog({
  subscription,
  landlordName,
  onClose,
  onSaved,
}: {
  subscription: LandlordSubscription;
  landlordName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState(String(subscription.monthlyAmount));
  const [paidAt, setPaidAt] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<SubscriptionPayment[] | null>(null);

  useEffect(() => {
    api
      .getSubscriptionPayments(subscription.id)
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [subscription.id]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await api.recordSubscriptionPayment(subscription.id, {
        ...(amount ? { amount: parseFloat(amount) } : {}),
        paidAt,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(apiError(e, "No se pudo registrar el pago."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar efectivo — {landlordName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 px-4 py-3">
          <p className="text-[12px] text-slate-500">
            Un pago extiende la vigencia un mes. Si ya estaba vencida, el mes nuevo arranca en
            la fecha de pago (no cubre el hueco). No hay prorrateo ni pagos parciales.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="amount" className="text-sm font-medium">
                Monto recibido (MXN)
              </label>
              <Input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="paidAt" className="text-sm font-medium">
                Fecha de pago
              </label>
              <Input
                id="paidAt"
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
              />
            </div>
          </div>
          {/* `billingPeriod` lo deriva el backend del mes de `paidAt`: es el mes en que
              se RECIBIÓ el efectivo, no el periodo que cubre. Se dice explícito porque
              con fecha retroactiva los dos no coinciden. */}
          <p className="text-[12px] text-slate-500">
            Se registrará en el periodo contable <strong>{paidAt.slice(0, 7)}</strong> (el mes en
            que se recibió). La vigencia cubierta se actualiza aparte.
          </p>

          <div className="space-y-1.5">
            <label htmlFor="pnotes" className="text-sm font-medium">
              Notas
            </label>
            <Input
              id="pnotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcional — referencia, quién entregó…"
            />
          </div>

          {history && history.length > 0 && (
            <div className="border-t border-slate-100 pt-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-2">
                Pagos registrados
              </p>
              <ul className="space-y-1 max-h-32 overflow-y-auto">
                {history.map((p) => (
                  <li key={p.id} className="flex items-center justify-between text-[12px]">
                    <span className="text-slate-500">
                      {formatDay(p.paidAt)} · {p.billingPeriod}
                    </span>
                    <span className="font-medium text-[#0B1426] tabular-nums">
                      {money(p.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>
        <DialogFooter className="px-4 pb-4">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Registrando…" : "Registrar pago"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Diálogo: editar plan del catálogo ────────────────────────────────────────

function EditPlanDialog({
  plan,
  onClose,
  onSaved,
}: {
  plan: Plan;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [price, setPrice] = useState(String(plan.pricePerTenant));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    const value = parseFloat(price);
    if (!Number.isFinite(value) || value < 0 || saving) return;
    setSaving(true);
    setError(null);
    try {
      await api.updatePlan(plan.id, { pricePerTenant: value });
      onSaved();
      onClose();
    } catch (e) {
      setError(apiError(e, "No se pudo actualizar el plan."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{plan.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 px-4 py-3">
          <div className="space-y-1.5">
            <label htmlFor="price" className="text-sm font-medium">
              Precio por inquilino / mes (MXN)
            </label>
            <Input
              id="price"
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <p className="text-[12px] text-slate-500">
            Solo afecta a suscripciones nuevas: el monto de las existentes quedó congelado al
            contratarse.
          </p>
          {error && (
            <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>
        <DialogFooter className="px-4 pb-4">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Vista ────────────────────────────────────────────────────────────────────

export function PlanesView() {
  const [landlords, setLandlords] = useState<Landlord[]>([]);
  const [subs, setSubs] = useState<LandlordSubscription[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [assigning, setAssigning] = useState<Landlord | null>(null);
  const [charging, setCharging] = useState<LandlordSubscription | null>(null);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  // El error se limpia al llegar la respuesta, no de forma síncrona aquí: `load`
  // se llama desde un efecto y un setState directo en el cuerpo del efecto
  // dispara un render en cascada (regla react-hooks/set-state-in-effect).
  const load = useCallback(() => {
    Promise.all([api.getLandlords(), api.getSubscriptions(), api.getPlans(true)])
      .then(([ls, ss, ps]) => {
        setError(null);
        setLandlords(ls);
        setSubs(ss);
        setPlans(ps);
      })
      .catch((e) => setError(apiError(e, "No se pudieron cargar los planes.")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const subByLandlord = useMemo(() => {
    const m = new Map<string, LandlordSubscription>();
    for (const s of subs) m.set(s.landlordId, s);
    return m;
  }, [subs]);

  // `tenantsUsed` lo calcula el backend contando solo inquilinos vivos. Un
  // arrendador sin plan no aparece en el listado de suscripciones, así que su
  // consumo no se conoce desde aquí — se muestra "—" en vez de un 0 engañoso.
  const usedFor = (landlordId: string): number | null =>
    subByLandlord.get(landlordId)?.tenantsUsed ?? null;

  const rows = useMemo(
    () => landlords.filter((l) => !l.isAdmin),
    [landlords]
  );

  const mrr = useMemo(
    () =>
      subs
        .filter((s) => s.status === "ACTIVA")
        .reduce((sum, s) => sum + Number(s.monthlyAmount ?? 0), 0),
    [subs]
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#eef1fd] flex items-center justify-center">
          <CreditCard className="w-5 h-5 text-[#2952F3]" />
        </div>
        <div>
          <h1 className="text-[20px] font-bold text-[#0B1426] leading-tight">Planes</h1>
          <p className="text-[13px] text-slate-400">
            Suscripciones por inquilino — el cobro es en efectivo, fuera de la plataforma
          </p>
        </div>
        {mrr > 0 && (
          <div className="ml-auto text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
              Facturación activa
            </p>
            <p className="text-[22px] font-bold text-[#0B1426] tabular-nums">{money(mrr)}/mes</p>
          </div>
        )}
      </div>

      {error && (
        <p className="text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* ── Suscripciones ─────────────────────────────────────────────────── */}
      <div className={CARD} style={CARD_SHADOW}>
        <div className="px-5 py-3 bg-slate-50/60 border-b border-slate-100">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
            Arrendadores
          </span>
        </div>
        {loading ? (
          <div className="p-6 space-y-2 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-slate-100 rounded-lg" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-[13px] text-slate-400">No hay arrendadores registrados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className={TH}>Arrendador</th>
                  <th className={TH}>Plan</th>
                  <th className={TH}>Inquilinos</th>
                  <th className={TH}>Mensualidad</th>
                  <th className={TH}>Vigencia</th>
                  <th className={TH}>Estado</th>
                  <th className={cn(TH, "text-right")}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((l) => {
                  const sub = subByLandlord.get(l.id);
                  const used = usedFor(l.id);
                  const over = sub != null && used != null && used > sub.contractedTenants;
                  return (
                    <tr key={l.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-medium text-[#0B1426]">{l.name}</span>
                        <p className="text-[11px] text-slate-400 font-mono">{l.email}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{sub?.plan?.name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "tabular-nums font-medium",
                            over ? "text-amber-700" : "text-slate-600"
                          )}
                        >
                          {used ?? "—"}
                          {sub ? ` / ${sub.contractedTenants}` : ""}
                        </span>
                        {over && (
                          <p className="text-[11px] text-amber-700">Sobre el tope</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 tabular-nums">
                        {sub ? money(Number(sub.monthlyAmount)) : "—"}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-slate-500">
                        {sub ? formatDay(sub.currentPeriodEnd) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusChip sub={sub} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {sub && (
                            <button
                              onClick={() => setCharging(sub)}
                              className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[12px] font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                            >
                              <Banknote className="w-3.5 h-3.5" /> Efectivo
                            </button>
                          )}
                          <button
                            onClick={() => setAssigning(l)}
                            className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[12px] font-medium bg-[#eef1fd] text-[#2952F3] hover:bg-[#dce4fd] transition-colors"
                          >
                            {sub ? "Cambiar" : "Asignar plan"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-5 py-3 border-t border-slate-100 text-[12px] text-slate-400">
          Un arrendador sin plan asignado no se bloquea y no tiene tope de inquilinos.
        </div>
      </div>

      {/* ── Catálogo ──────────────────────────────────────────────────────── */}
      <div className={CARD} style={CARD_SHADOW}>
        <div className="px-5 py-3 bg-slate-50/60 border-b border-slate-100">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
            Catálogo de planes
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className={TH}>Escalón</th>
                <th className={TH}>Inquilinos</th>
                <th className={TH}>Precio / inquilino</th>
                <th className={TH}>Estado</th>
                <th className={cn(TH, "text-right")}>Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {plans.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-[#0B1426]">{p.name}</td>
                  <td className="px-4 py-3 text-slate-600 tabular-nums">
                    {p.minTenants}
                    {p.maxTenants == null ? " o más" : ` – ${p.maxTenants}`}
                  </td>
                  <td className="px-4 py-3 text-slate-600 tabular-nums">
                    {money(p.pricePerTenant)}
                  </td>
                  <td className="px-4 py-3">
                    {p.isActive ? (
                      <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                        Activo
                      </span>
                    ) : (
                      <span
                        className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md"
                        title="No entra en la derivación automática de escalón; se asigna a mano por trato especial."
                      >
                        Especial
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setEditingPlan(p)}
                      className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[12px] font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Precio
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-slate-100 text-[12px] text-slate-400">
          Cambiar un precio no requiere deploy y no altera suscripciones ya contratadas.
        </div>
      </div>

      {assigning && (
        <AssignPlanDialog
          landlord={assigning}
          subscription={subByLandlord.get(assigning.id)}
          tenantsUsed={usedFor(assigning.id)}
          plans={plans}
          onClose={() => setAssigning(null)}
          onSaved={load}
        />
      )}
      {charging && (
        <RecordPaymentDialog
          subscription={charging}
          landlordName={
            landlords.find((l) => l.id === charging.landlordId)?.name ?? "arrendador"
          }
          onClose={() => setCharging(null)}
          onSaved={load}
        />
      )}
      {editingPlan && (
        <EditPlanDialog
          plan={editingPlan}
          onClose={() => setEditingPlan(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

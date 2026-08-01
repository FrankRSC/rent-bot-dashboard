"use client";

import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  Building2, Users, CheckCircle2, ChevronRight, ChevronLeft, X, Loader2,
  Bell, BarChart2, MessageCircle, FileText, Settings, LayoutDashboard,
  ShieldCheck, HandCoins, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore } from "@/store/useStore";
import * as api from "@/lib/api";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "rc_onboarding_v1";

type WizardStep = "welcome" | "setup" | "tour-pagos" | "tour-reminders" | "tour-more" | "done";
const STEPS: WizardStep[] = ["welcome", "setup", "tour-pagos", "tour-reminders", "tour-more", "done"];

// ── Utilidades de presentación ─────────────────────────────────────────────────

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "rounded-full transition-all duration-300",
            i < current
              ? "w-2 h-2 bg-[#2952F3]/40"
              : i === current
              ? "w-6 h-2 bg-[#2952F3]"
              : "w-2 h-2 bg-slate-200"
          )}
        />
      ))}
    </div>
  );
}

function StepIcon({ icon: Icon, bg, color }: { icon: React.ElementType; bg: string; color: string }) {
  return (
    <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mb-5 shrink-0", bg)}>
      <Icon className={cn("w-8 h-8", color)} />
    </div>
  );
}

// ── Paso 1: Bienvenido ─────────────────────────────────────────────────────────

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col flex-1">
      <StepIcon icon={Building2} bg="bg-[#eef1fd]" color="text-[#2952F3]" />
      <h1 className="text-[26px] font-bold text-[#0B1426] leading-tight mb-3">
        Bienvenido a<br />Rent Collector
      </h1>
      <p className="text-[15px] text-slate-500 leading-relaxed mb-8">
        Todo lo que necesitas para cobrar rentas y dar seguimiento a tus inquilinos, desde WhatsApp hasta reportes.
      </p>

      <div className="space-y-3 mb-8">
        {[
          { icon: MessageCircle, color: "bg-blue-50 text-blue-600",     title: "Cobros desde WhatsApp",      desc: "Tu inquilino manda foto del comprobante y aparece aquí al instante, sin que hagas nada" },
          { icon: ShieldCheck,   color: "bg-emerald-50 text-emerald-600", title: "Sabes quién pagó de verdad", desc: "Cada pago se confirma automáticamente, sin que tengas que revisar tu cuenta bancaria" },
          { icon: Bell,          color: "bg-amber-50 text-amber-600",  title: "Sin perseguir a nadie",      desc: "El sistema avisa a quien no ha pagado antes y después del vencimiento, solo" },
          { icon: BarChart2,     color: "bg-purple-50 text-purple-600", title: "Todo en un lugar",           desc: "Ve cuánto cobró cada mes, quién debe y quién ya pagó, desde tu cel o computadora" },
        ].map(({ icon: Icon, color, title, desc }) => (
          <div key={title} className="flex items-start gap-3.5 bg-slate-50 rounded-2xl p-4">
            <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", color)}>
              <Icon className="w-4.5 h-4.5" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-[#0B1426]">{title}</p>
              <p className="text-[13px] text-slate-400 mt-0.5 leading-snug">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <Button
        className="w-full bg-[#2952F3] hover:bg-[#1e3fd4] h-12 text-[15px] font-semibold"
        onClick={onNext}
      >
        Configurar mi cuenta <ChevronRight className="w-4 h-4 ml-1" />
      </Button>
    </div>
  );
}

// ── Paso 2: Setup (propiedad + inquilino juntos) ───────────────────────────────

function SetupStep({
  propName, setPropName,
  tenantName, setTenantName,
  tenantPhone, setTenantPhone,
  amount, setAmount,
  day, setDay,
  onNext, onSkip, loading, error,
}: {
  propName: string; setPropName: (v: string) => void;
  tenantName: string; setTenantName: (v: string) => void;
  tenantPhone: string; setTenantPhone: (v: string) => void;
  amount: string; setAmount: (v: string) => void;
  day: string; setDay: (v: string) => void;
  onNext: () => void; onSkip: () => void;
  loading: boolean; error: string | null;
}) {
  const canSubmit = propName.trim() && tenantName.trim() && tenantPhone.trim() && !loading;
  return (
    <div className="flex flex-col flex-1">
      <StepIcon icon={Users} bg="bg-[#eef1fd]" color="text-[#2952F3]" />
      <h2 className="text-[22px] font-bold text-[#0B1426] leading-tight mb-1.5">
        Agrega tu primera propiedad e inquilino
      </h2>
      <p className="text-[14px] text-slate-400 mb-6 leading-relaxed">
        Una propiedad sin inquilino no sirve de mucho, así que los creamos juntos.
      </p>

      {/* Propiedad */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full bg-[#2952F3] text-white flex items-center justify-center text-[11px] font-bold shrink-0">1</div>
          <p className="text-[13px] font-semibold text-slate-500 uppercase tracking-wide">La propiedad</p>
        </div>
        <Input
          placeholder="Nombre de la propiedad — Ej. Roma 304, Casa Tlalpan…"
          value={propName}
          onChange={(e) => setPropName(e.target.value)}
          className="h-11 text-[15px]"
          autoFocus
        />
      </div>

      {/* Separador */}
      <div className="relative flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-slate-200" />
        <Building2 className="w-4 h-4 text-slate-300 shrink-0" />
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      {/* Inquilino */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full bg-[#2952F3] text-white flex items-center justify-center text-[11px] font-bold shrink-0">2</div>
          <p className="text-[13px] font-semibold text-slate-500 uppercase tracking-wide">El primer inquilino</p>
        </div>
        <div className="space-y-3">
          <Input
            placeholder="Nombre completo del inquilino"
            value={tenantName}
            onChange={(e) => setTenantName(e.target.value)}
            className="h-11 text-[15px]"
          />
          <div>
            <Input
              placeholder="Teléfono WhatsApp — Ej. 5215512345678"
              value={tenantPhone}
              onChange={(e) => setTenantPhone(e.target.value.replace(/\D/g, "").slice(0, 13))}
              inputMode="tel"
              maxLength={13}
              className="h-11 text-[15px] font-mono"
            />
            <p className="text-[11px] text-slate-400 mt-1">México: 521 + 10 dígitos. Puedes editarlo después.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] font-medium text-slate-500 mb-1 block">Renta mensual <span className="text-slate-400">(opcional)</span></label>
              <Input type="number" min="0" step="100" placeholder="$0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-10" inputMode="numeric" />
            </div>
            <div>
              <label className="text-[12px] font-medium text-slate-500 mb-1 block">Día de pago <span className="text-slate-400">(opcional)</span></label>
              <Input type="number" min="1" max="31" placeholder="1–31" value={day} onChange={(e) => setDay(e.target.value)} className="h-10" inputMode="numeric" />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      <div className="mt-auto flex flex-col gap-3">
        <Button
          className="w-full bg-[#2952F3] hover:bg-[#1e3fd4] h-12 text-[15px] font-semibold"
          onClick={onNext}
          disabled={!canSubmit}
        >
          {loading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <>Crear propiedad e inquilino <ChevronRight className="w-4 h-4 ml-1" /></>}
        </Button>
        <button onClick={onSkip} className="text-[13px] text-slate-400 hover:text-slate-600 transition-colors text-center py-1">
          Lo hago después, mostrar el tour
        </button>
      </div>
    </div>
  );
}

// ── Pasos de tour ─────────────────────────────────────────────────────────────

function TourPagosStep({ onNext, onPrev }: { onNext: () => void; onPrev: () => void }) {
  return (
    <div className="flex flex-col flex-1">
      <StepIcon icon={MessageCircle} bg="bg-blue-50" color="text-blue-600" />
      <h2 className="text-[22px] font-bold text-[#0B1426] leading-tight mb-2">Pagos y comprobantes</h2>
      <p className="text-[14px] text-slate-400 mb-6 leading-relaxed">
        Aquí vive el corazón del sistema. Cada comprobante que un inquilino envía por WhatsApp aparece aquí para que lo revises.
      </p>

      <div className="space-y-3 mb-8">
        {[
          { icon: MessageCircle, label: "El inquilino manda foto de su comprobante al bot de WhatsApp" },
          { icon: Zap,           label: "El bot lee el monto, banco y clave de rastreo con OCR automático" },
          { icon: ShieldCheck,   label: "Se verifica contra Banxico (CEP). Si coincide, queda como Verificado" },
          { icon: HandCoins,     label: "También puedes registrar pagos en efectivo o transferencia a mano" },
        ].map(({ icon: Icon, label }, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
              <Icon className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <p className="text-[14px] text-slate-600 leading-snug">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-slate-50 rounded-2xl px-4 py-3 mb-6 border border-slate-100">
        <p className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Estados de un pago</p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Verificado", color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
            { label: "Pendiente",  color: "text-amber-700 bg-amber-50 border-amber-200" },
            { label: "Revisión",   color: "text-purple-700 bg-purple-50 border-purple-200" },
            { label: "Rechazado",  color: "text-red-700 bg-red-50 border-red-200" },
          ].map(({ label, color }) => (
            <span key={label} className={cn("text-[11px] font-semibold rounded-full px-2.5 py-0.5 border", color)}>{label}</span>
          ))}
        </div>
      </div>

      <div className="mt-auto flex gap-3">
        <Button variant="outline" className="flex-1 h-11" onClick={onPrev}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
        </Button>
        <Button className="flex-1 h-11 bg-[#2952F3] hover:bg-[#1e3fd4] font-semibold" onClick={onNext}>
          Siguiente <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

function TourRemindersStep({ onNext, onPrev }: { onNext: () => void; onPrev: () => void }) {
  return (
    <div className="flex flex-col flex-1">
      <StepIcon icon={Bell} bg="bg-amber-50" color="text-amber-500" />
      <h2 className="text-[22px] font-bold text-[#0B1426] leading-tight mb-2">Recordatorios automáticos</h2>
      <p className="text-[14px] text-slate-400 mb-6 leading-relaxed">
        El bot avisa a tus inquilinos sin que tú tengas que hacer nada. Tú controlas cuándo y cómo.
      </p>

      <div className="space-y-4 mb-8">
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
          <p className="text-[13px] font-semibold text-amber-800 mb-2">¿Cuándo manda recordatorios?</p>
          <div className="space-y-2">
            {[
              "Antes del día de pago (configurable: 1–28 días de anticipación)",
              "El mismo día de vencimiento si aún no ha pagado",
              "Días después del vencimiento si sigue sin pagar",
            ].map((text, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="w-4 h-4 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">{i + 1}</div>
                <p className="text-[13px] text-amber-700 leading-snug">{text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {[
            { icon: Settings, text: "Configura los días de anticipación en Recordatorios → Ajustes" },
            { icon: Bell,     text: "Activa o desactiva los automáticos sin perder la configuración" },
            { icon: Users,    text: "También puedes enviar un recordatorio manual a cualquier inquilino" },
          ].map(({ icon: Icon, text }, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="w-3.5 h-3.5 text-slate-500" />
              </div>
              <p className="text-[14px] text-slate-600 leading-snug">{text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto flex gap-3">
        <Button variant="outline" className="flex-1 h-11" onClick={onPrev}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
        </Button>
        <Button className="flex-1 h-11 bg-[#2952F3] hover:bg-[#1e3fd4] font-semibold" onClick={onNext}>
          Siguiente <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

function TourMoreStep({ onNext, onPrev }: { onNext: () => void; onPrev: () => void }) {
  return (
    <div className="flex flex-col flex-1">
      <StepIcon icon={LayoutDashboard} bg="bg-[#eef1fd]" color="text-[#2952F3]" />
      <h2 className="text-[22px] font-bold text-[#0B1426] leading-tight mb-2">Todo el sistema de un vistazo</h2>
      <p className="text-[14px] text-slate-400 mb-6 leading-relaxed">
        Cada sección del menú lateral tiene su propósito. Aquí un mapa rápido.
      </p>

      <div className="space-y-2.5 mb-8">
        {[
          {
            icon: LayoutDashboard, color: "bg-[#eef1fd] text-[#2952F3]",
            section: "Dashboard",
            desc: "Resumen del mes: tasa de cobro, inquilinos al corriente y pendientes, tendencia mensual",
          },
          {
            icon: HandCoins, color: "bg-emerald-50 text-emerald-600",
            section: "Pagos",
            desc: "Historial completo de comprobantes. Filtra por estado, inquilino o periodo. Sube comprobantes manuales",
          },
          {
            icon: Bell, color: "bg-amber-50 text-amber-500",
            section: "Recordatorios",
            desc: "Ve quién ha recibido aviso este mes y envía recordatorios manuales al instante",
          },
          {
            icon: BarChart2, color: "bg-purple-50 text-purple-600",
            section: "Reportes",
            desc: "Análisis mensual por propiedad e inquilino. Navega meses anteriores para comparar",
          },
          {
            icon: FileText, color: "bg-blue-50 text-blue-600",
            section: "Facturas",
            desc: "Próximamente disponible en tu cuenta",
          },
          {
            icon: Settings, color: "bg-slate-100 text-slate-500",
            section: "Configuración",
            desc: "Datos bancarios, datos fiscales para facturas, notificaciones y gestión del bot",
          },
        ].map(({ icon: Icon, color, section, desc }) => (
          <div key={section} className="flex items-start gap-3 bg-slate-50 rounded-xl p-3">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5", color)}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[#0B1426]">{section}</p>
              <p className="text-[12px] text-slate-400 mt-0.5 leading-snug">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto flex gap-3">
        <Button variant="outline" className="flex-1 h-11" onClick={onPrev}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
        </Button>
        <Button className="flex-1 h-11 bg-[#2952F3] hover:bg-[#1e3fd4] font-semibold" onClick={onNext}>
          Ver resumen final <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// ── Paso final: ¡Listo! ────────────────────────────────────────────────────────

function DoneStep({
  propertyName, tenantName, onFinish,
}: {
  propertyName: string; tenantName: string; onFinish: () => void;
}) {
  return (
    <div className="flex flex-col flex-1 items-center text-center">
      <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mb-5">
        <CheckCircle2 className="w-10 h-10 text-emerald-500" />
      </div>
      <h2 className="text-[26px] font-bold text-[#0B1426] leading-tight mb-3">¡Todo listo!</h2>
      <p className="text-[15px] text-slate-500 leading-relaxed mb-6">
        Ya conoces el sistema.
        {propertyName && (
          <> Creaste <span className="font-semibold text-[#0B1426]">{propertyName}</span>
          {tenantName && <> con el inquilino <span className="font-semibold text-[#0B1426]">{tenantName}</span></>}.</>
        )}
      </p>

      <div className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-8 text-left">
        <p className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide mb-3">Tus próximos pasos</p>
        <div className="space-y-2.5">
          {[
            "Comparte el número de WhatsApp del bot con tus inquilinos",
            "Agrega más propiedades e inquilinos desde el menú de Propiedades",
            "Configura tus datos fiscales en Configuración para emitir facturas",
            "Ajusta los días de anticipación de recordatorios a tu gusto",
          ].map((text, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-[#2952F3] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{i + 1}</div>
              <p className="text-[13px] text-slate-600 leading-snug">{text}</p>
            </div>
          ))}
        </div>
      </div>

      <Button
        className="w-full bg-[#2952F3] hover:bg-[#1e3fd4] h-12 text-[15px] font-semibold"
        onClick={onFinish}
      >
        Ir al dashboard
      </Button>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────

export function OnboardingWizard() {
  const {
    properties, propertiesState, landlordId, isAdmin, impersonatedBy,
    fetchProperties, fetchAllTenants,
  } = useStore();

  // useSyncExternalStore garantiza que servidor y cliente arranquen con el mismo
  // valor (true = dismissed), evitando el hydration mismatch de typeof window.
  const storeDismissed = useSyncExternalStore(
    () => () => {},
    () => !!localStorage.getItem(STORAGE_KEY),
    () => true,
  );
  const [localDismissed, setLocalDismissed] = useState(false);
  const dismissed = storeDismissed || localDismissed;

  const [step, setStep] = useState<WizardStep>("welcome");
  const [createdPropertyName, setCreatedPropertyName] = useState("");
  const [createdTenantName, setCreatedTenantName] = useState("");

  // Formulario de setup (propiedad + inquilino combinados)
  const [propName, setPropName] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shouldShow =
    !dismissed &&
    !isAdmin &&
    !impersonatedBy &&
    !propertiesState.loading &&
    properties.length === 0;

  if (!shouldShow) return null;

  const dismiss = (completed = false) => {
    localStorage.setItem(STORAGE_KEY, completed ? "completed" : "skipped");
    setLocalDismissed(true);
  };

  const handleSetup = async () => {
    if (!propName.trim() || !tenantName.trim() || !tenantPhone.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const prop = await api.createProperty(landlordId, { name: propName.trim() });
      setCreatedPropertyName(prop.name);
      const amountNum = amount ? parseFloat(amount) : undefined;
      const dayNum = day ? parseInt(day, 10) : undefined;
      await api.createTenant(prop.id, {
        name: tenantName.trim(),
        phone: tenantPhone.trim(),
        ...(amountNum && amountNum > 0 ? { monthlyAmount: amountNum } : {}),
        ...(dayNum && dayNum >= 1 && dayNum <= 31 ? { paymentDay: dayNum } : {}),
      });
      setCreatedTenantName(tenantName.trim());
      await Promise.all([fetchProperties(), fetchAllTenants()]);
      setStep("tour-pagos");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const stepIdx = STEPS.indexOf(step);

  const content = (
    <div className="fixed inset-0 z-[200] bg-white flex flex-col">
      {/* Barra de progreso */}
      <div className="h-1 bg-slate-100 shrink-0">
        <div
          className="h-full bg-[#2952F3] transition-all duration-500"
          style={{ width: `${((stepIdx + 1) / STEPS.length) * 100}%` }}
        />
      </div>

      {/* Header: dots + botón omitir */}
      <div className="flex items-center justify-between px-5 pt-5 pb-2 shrink-0">
        <ProgressDots current={stepIdx} total={STEPS.length} />
        {step !== "done" && (
          <button
            onClick={() => dismiss(false)}
            className="flex items-center gap-1 text-[12px] text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Omitir todo
          </button>
        )}
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-8 w-full max-w-lg mx-auto flex flex-col">
        {step === "welcome" && (
          <WelcomeStep onNext={() => setStep("setup")} />
        )}
        {step === "setup" && (
          <SetupStep
            propName={propName} setPropName={setPropName}
            tenantName={tenantName} setTenantName={setTenantName}
            tenantPhone={tenantPhone} setTenantPhone={setTenantPhone}
            amount={amount} setAmount={setAmount}
            day={day} setDay={setDay}
            onNext={handleSetup}
            onSkip={() => setStep("tour-pagos")}
            loading={loading}
            error={error}
          />
        )}
        {step === "tour-pagos" && (
          <TourPagosStep onNext={() => setStep("tour-reminders")} onPrev={() => setStep("setup")} />
        )}
        {step === "tour-reminders" && (
          <TourRemindersStep onNext={() => setStep("tour-more")} onPrev={() => setStep("tour-pagos")} />
        )}
        {step === "tour-more" && (
          <TourMoreStep onNext={() => setStep("done")} onPrev={() => setStep("tour-reminders")} />
        )}
        {step === "done" && (
          <DoneStep
            propertyName={createdPropertyName}
            tenantName={createdTenantName}
            onFinish={() => dismiss(true)}
          />
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}

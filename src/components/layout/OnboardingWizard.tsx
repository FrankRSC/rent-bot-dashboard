"use client";

import { useState, useSyncExternalStore, useEffect, useReducer } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Building2, Users, CheckCircle2, ChevronRight, ChevronLeft, X, Loader2,
  Bell, BarChart2, MessageCircle, ShieldCheck, Map, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore } from "@/store/useStore";
import * as api from "@/lib/api";
import { apiError } from "@/lib/api-error";
import { cn } from "@/lib/utils";

const STORAGE_KEY_PREFIX = "rc_onboarding_v1";

type WizardStep = "welcome" | "setup" | "done";
const STEPS: WizardStep[] = ["welcome", "setup", "done"];

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
        Bienvenido a<br />Rentals
      </h1>
      <p className="text-[15px] text-slate-500 leading-relaxed mb-8">
        Todo lo que necesitas para cobrar rentas y dar seguimiento a tus inquilinos, desde WhatsApp hasta reportes.
      </p>

      <div className="space-y-3 mb-8">
        {[
          { icon: MessageCircle, color: "bg-blue-50 text-blue-600",       title: "Pagos por WhatsApp",          desc: "Tus inquilinos envían su comprobante y queda registrado automáticamente" },
          { icon: ShieldCheck,   color: "bg-emerald-50 text-emerald-600", title: "Verificación de pagos",       desc: "Confirma si un pago llegó a tu cuenta sin tener que revisar el banco" },
          { icon: Bell,          color: "bg-amber-50 text-amber-600",   title: "Recordatorios automáticos",   desc: "Notifica a tus inquilinos antes y después de su fecha de pago sin intervención manual" },
          { icon: BarChart2,     color: "bg-purple-50 text-purple-600", title: "Resumen mensual",             desc: "Consulta el estado de cobro de todas tus propiedades en un solo lugar" },
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
          Lo hago después
        </button>
      </div>
    </div>
  );
}

// ── Paso final: ¡Listo! ────────────────────────────────────────────────────────

function DoneStep({
  propertyName, tenantName, onFinish, onStartTour,
}: {
  propertyName: string; tenantName: string;
  onFinish: () => void; onStartTour: () => void;
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

      <div className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-6 text-left">
        <p className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide mb-3">Tus próximos pasos</p>
        <div className="space-y-2.5">
          {[
            "Comparte el número de WhatsApp del bot con tus inquilinos",
            "Agrega más propiedades e inquilinos desde Propiedades",
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
        className="w-full bg-[#2952F3] hover:bg-[#1e3fd4] h-12 text-[15px] font-semibold mb-3"
        onClick={onStartTour}
      >
        <Map className="w-4 h-4 mr-2" /> Ver tour del sistema
      </Button>
      <button
        onClick={onFinish}
        className="text-[13px] text-slate-400 hover:text-slate-600 transition-colors py-1"
      >
        Ir al dashboard sin tour
      </button>
    </div>
  );
}

// ── Tour interactivo del sidebar ───────────────────────────────────────────────

const PAYMENT_STATUSES = [
  { label: "Verificado", color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  { label: "Pendiente",  color: "text-amber-700 bg-amber-50 border-amber-200" },
  { label: "Revisión",   color: "text-purple-700 bg-purple-50 border-purple-200" },
] as const;

const TOUR_STEPS = [
  {
    selector: '[data-tour="nav-dashboard"]',
    href: "/dashboard",
    title: "Dashboard",
    subtitle: "Resumen mensual",
    desc: "Vista general del mes en curso: tasa de cobro, estado de pago por inquilino y últimos comprobantes registrados.",
    bullets: [
      "Tasa de cobro del mes en porcentaje",
      "Estado de pago por inquilino",
      "Últimos comprobantes registrados",
    ],
    showStatuses: false,
  },
  {
    selector: '[data-tour="nav-propiedades"]',
    href: "/propiedades",
    title: "Propiedades",
    subtitle: "Inmuebles e inquilinos",
    desc: "Alta, edición y eliminación de propiedades e inquilinos. Consulta el estado de pago por propiedad.",
    bullets: [
      "Alta de propiedades e inquilinos",
      "Estado de pago por propiedad",
      "Edición de datos: renta, día de pago y teléfono",
    ],
    showStatuses: false,
  },
  {
    selector: '[data-tour="nav-pagos"]',
    href: "/pagos",
    title: "Pagos",
    subtitle: "Comprobantes de pago",
    desc: "Cada comprobante enviado por WhatsApp aparece aquí. El bot verifica el pago de forma automática.",
    bullets: [
      "El inquilino envía su comprobante al bot de WhatsApp",
      "El bot lee el monto, banco y referencia del comprobante",
      "La verificación es automática y en tiempo real",
      "Registro manual disponible para efectivo o depósito",
    ],
    showStatuses: true,
  },
  {
    selector: '[data-tour="nav-reportes"]',
    href: "/reportes",
    title: "Reportes",
    subtitle: "Análisis de cobros",
    desc: "Análisis mensual de cobros por propiedad e inquilino. Consulta y compara periodos anteriores.",
    bullets: [
      "Cobros del mes por propiedad e inquilino",
      "Navegación entre periodos anteriores",
      "Estado de pago por inquilino en el periodo seleccionado",
    ],
    showStatuses: false,
  },
  {
    selector: '[data-tour="nav-recordatorios"]',
    href: "/recordatorios",
    title: "Recordatorios",
    subtitle: "Avisos de pago",
    desc: "El sistema notifica a los inquilinos antes y después de la fecha de pago. Los avisos manuales también están disponibles.",
    bullets: [
      "Notificación automática antes del vencimiento",
      "Aviso el día de vencimiento si el pago no está registrado",
      "Envío manual a cualquier inquilino",
    ],
    showStatuses: false,
  },
  {
    selector: '[data-tour="nav-configuracion"]',
    href: "/configuracion",
    title: "Configuración",
    subtitle: "Cuenta y preferencias",
    desc: "Datos bancarios, información de cuenta y preferencias de notificación.",
    bullets: [
      "Datos bancarios: CLABE, tarjeta o cuenta",
      "Perfil de cuenta: nombre, teléfono y correo",
      "Activación y configuración de recordatorios automáticos",
    ],
    showStatuses: false,
  },
];

export function TourOverlay({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const router = useRouter();

  // Navega a la sección del paso actual para mostrar la página real debajo del overlay
  useEffect(() => {
    router.push(TOUR_STEPS[step].href);
  }, [step, router]);

  useEffect(() => {
    const onResize = () => rerender();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Calcula el rect del elemento destacado durante el render (componente solo cliente)
  const el = typeof document !== "undefined"
    ? document.querySelector(TOUR_STEPS[step].selector)
    : null;
  const rect = el ? el.getBoundingClientRect() : null;

  const current = TOUR_STEPS[step];
  const total = TOUR_STEPS.length;
  const sidebarVisible = !!rect && rect.width > 0 && rect.left >= 0;

  // Posiciona el tooltip a la derecha del sidebar; centrado en pantalla si no hay sidebar
  const tooltipTop = sidebarVisible
    ? Math.max(Math.min(rect!.top + rect!.height / 2 - 130, window.innerHeight - 320), 12)
    : undefined;
  const tooltipStyle: React.CSSProperties = sidebarVisible
    ? { left: rect!.right + 18, top: tooltipTop }
    : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

  return createPortal(
    <>
      {/* Overlay oscuro con hueco sobre el elemento activo del sidebar */}
      <svg
        className="fixed inset-0 z-[200] pointer-events-none"
        style={{ width: "100vw", height: "100vh" }}
        aria-hidden
      >
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {sidebarVisible && (
              <rect
                x={rect!.left - 6} y={rect!.top - 6}
                width={rect!.width + 12} height={rect!.height + 12}
                rx="10" fill="black"
              />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.62)" mask="url(#tour-mask)" />
        {sidebarVisible && (
          <rect
            x={rect!.left - 6} y={rect!.top - 6}
            width={rect!.width + 12} height={rect!.height + 12}
            rx="10" fill="none" stroke="#2952F3" strokeWidth="2.5"
          />
        )}
      </svg>

      {/* Tarjeta de descripción */}
      <div
        className="fixed z-[201] w-80 bg-white rounded-2xl overflow-hidden"
        style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.22)", ...tooltipStyle }}
      >
        {/* Flecha hacia el sidebar */}
        {sidebarVisible && (
          <div className="absolute top-[50%] -translate-y-1/2 -left-3 w-0 h-0 border-y-[10px] border-y-transparent border-r-[12px] border-r-white" />
        )}

        {/* Header azul */}
        <div className="bg-[#2952F3] px-5 pt-4 pb-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex gap-1">
              {Array.from({ length: total }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-full transition-all duration-300",
                    i === step ? "w-5 h-1.5 bg-white" : i < step ? "w-1.5 h-1.5 bg-white/40" : "w-1.5 h-1.5 bg-white/20"
                  )}
                />
              ))}
            </div>
            <button
              onClick={onDone}
              className="text-white/50 hover:text-white transition-colors"
              aria-label="Cerrar tour"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] font-semibold text-white/60 uppercase tracking-wider mb-0.5">{current.subtitle}</p>
          <p className="text-[20px] font-bold text-white leading-tight">{current.title}</p>
        </div>

        {/* Cuerpo */}
        <div className="px-5 py-4">
          <p className="text-[13px] text-slate-500 leading-relaxed mb-4">{current.desc}</p>

          <div className="space-y-2 mb-4">
            {current.bullets.map((b, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="w-4 h-4 rounded-full bg-[#eef1fd] flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-2.5 h-2.5 text-[#2952F3]" />
                </div>
                <p className="text-[13px] text-slate-600 leading-snug">{b}</p>
              </div>
            ))}
          </div>

          {current.showStatuses && (
            <div className="border-t border-slate-100 pt-3 mb-4">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Estados de un pago</p>
              <div className="flex flex-wrap gap-1.5">
                {PAYMENT_STATUSES.map(({ label, color }) => (
                  <span key={label} className={cn("text-[11px] font-semibold rounded-full px-2.5 py-0.5 border", color)}>{label}</span>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {step > 0 && (
              <Button
                variant="outline" size="sm"
                className="flex-1 h-9 text-[13px]"
                onClick={() => setStep(s => s - 1)}
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Anterior
              </Button>
            )}
            {step < total - 1 ? (
              <Button
                size="sm"
                className="flex-1 h-9 text-[13px] bg-[#2952F3] hover:bg-[#1e3fd4]"
                onClick={() => setStep(s => s + 1)}
              >
                Siguiente <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            ) : (
              <Button
                size="sm"
                className="flex-1 h-9 text-[13px] bg-emerald-600 hover:bg-emerald-700"
                onClick={onDone}
              >
                Finalizar tour
              </Button>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

// ── Componente principal ───────────────────────────────────────────────────────

export function OnboardingWizard() {
  const {
    properties, propertiesState, landlordId, isAdmin, impersonatedBy,
    fetchProperties, fetchAllTenants, setTourActive,
  } = useStore();

  // La marca de "ya visto" es por arrendador: sin esto, un dispositivo que
  // probó el onboarding con una cuenta lo oculta para siempre a cualquier
  // otra cuenta que inicie sesión en el mismo navegador.
  const storageKey = `${STORAGE_KEY_PREFIX}_${landlordId}`;

  // useSyncExternalStore garantiza que servidor y cliente arranquen con el mismo
  // valor (true = dismissed), evitando el hydration mismatch de typeof window.
  const storeDismissed = useSyncExternalStore(
    () => () => {},
    () => !!localStorage.getItem(storageKey),
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

  if (typeof document === "undefined") return null;
  if (!shouldShow) return null;

  const dismiss = (completed = false) => {
    localStorage.setItem(storageKey, completed ? "completed" : "skipped");
    setLocalDismissed(true);
  };

  const startTour = () => {
    dismiss(true);
    setTourActive(true);
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
      setStep("done");
    } catch (e) {
      // apiError y no `e.message`: con el tope de plan (§2.10) esto puede ser un
      // 409 cuyo texto el arrendador debe leer, no el JSON crudo del backend.
      setError(apiError(e, "No se pudo completar la configuración. Inténtalo de nuevo."));
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
            onSkip={() => setStep("done")}
            loading={loading}
            error={error}
          />
        )}
        {step === "done" && (
          <DoneStep
            propertyName={createdPropertyName}
            tenantName={createdTenantName}
            onFinish={() => dismiss(true)}
            onStartTour={startTour}
          />
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import {
  Building2, Users, CheckCircle2, ChevronRight, X, Loader2,
  Bell, BarChart2, MessageCircle, Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore } from "@/store/useStore";
import * as api from "@/lib/api";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "rc_onboarding_v1";

type WizardStep = "welcome" | "property" | "tenant" | "done";
const STEPS: WizardStep[] = ["welcome", "property", "tenant", "done"];

// ── Pasos individuales ─────────────────────────────────────────────────────────

function StepIcon({ icon: Icon, color }: { icon: React.ElementType; color: string }) {
  return (
    <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mb-6", color)}>
      <Icon className="w-8 h-8" />
    </div>
  );
}

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col flex-1">
      <StepIcon icon={Building2} color="bg-[#eef1fd] text-[#2952F3]" />
      <h1 className="text-[26px] font-bold text-[#0B1426] leading-tight mb-3">
        Bienvenido a<br />Rent Collector
      </h1>
      <p className="text-[15px] text-slate-500 leading-relaxed mb-8">
        Gestiona el cobro de rentas y el seguimiento de pagos de tus inquilinos, todo desde WhatsApp.
      </p>

      <div className="space-y-4 mb-10">
        {[
          { icon: MessageCircle, title: "Comprobantes por WhatsApp", desc: "Tus inquilinos envían su pago y lo ves aquí al instante" },
          { icon: BarChart2, title: "Seguimiento automático", desc: "Pagados, pendientes y vencidos organizados para ti" },
          { icon: Bell, title: "Recordatorios", desc: "El bot avisa a quien no ha pagado, sin que hagas nada" },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="flex items-start gap-4 bg-slate-50 rounded-2xl p-4">
            <div className="w-9 h-9 rounded-xl bg-[#eef1fd] flex items-center justify-center shrink-0">
              <Icon className="w-4.5 h-4.5 text-[#2952F3]" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-[#0B1426]">{title}</p>
              <p className="text-[13px] text-slate-400 mt-0.5">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <Button
        className="w-full bg-[#2952F3] hover:bg-[#1e3fd4] h-12 text-[15px] font-semibold"
        onClick={onNext}
      >
        Empezar configuración <ChevronRight className="w-4 h-4 ml-1" />
      </Button>
    </div>
  );
}

function PropertyStep({
  value, onChange, onNext, onSkip, loading, error,
}: {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
  onSkip: () => void;
  loading: boolean;
  error: string | null;
}) {
  return (
    <div className="flex flex-col flex-1">
      <StepIcon icon={Building2} color="bg-slate-100 text-slate-500" />
      <h2 className="text-[22px] font-bold text-[#0B1426] leading-tight mb-2">
        Agrega tu primera propiedad
      </h2>
      <p className="text-[14px] text-slate-400 leading-relaxed mb-8">
        Puede ser la dirección, el nombre del edificio o como prefieras identificarla.
      </p>

      <div className="space-y-2 mb-6">
        <label className="text-[14px] font-semibold text-[#0B1426]">Nombre de la propiedad</label>
        <Input
          placeholder="Ej. Roma 304, Depto 2B, Casa Tlalpan…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && value.trim() && !loading && onNext()}
          autoFocus
          className="h-11 text-[15px]"
        />
        {error && (
          <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}
      </div>

      <div className="mt-auto flex flex-col gap-3">
        <Button
          className="w-full bg-[#2952F3] hover:bg-[#1e3fd4] h-12 text-[15px] font-semibold"
          onClick={onNext}
          disabled={!value.trim() || loading}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Agregar propiedad <ChevronRight className="w-4 h-4 ml-1" /></>}
        </Button>
        <button
          onClick={onSkip}
          className="text-[13px] text-slate-400 hover:text-slate-600 transition-colors text-center py-1"
        >
          Omitir por ahora
        </button>
      </div>
    </div>
  );
}

function TenantStep({
  propertyName, name, setName, phone, setPhone, amount, setAmount, day, setDay,
  onNext, onSkip, loading, error,
}: {
  propertyName: string;
  name: string; setName: (v: string) => void;
  phone: string; setPhone: (v: string) => void;
  amount: string; setAmount: (v: string) => void;
  day: string; setDay: (v: string) => void;
  onNext: () => void;
  onSkip: () => void;
  loading: boolean;
  error: string | null;
}) {
  return (
    <div className="flex flex-col flex-1">
      <StepIcon icon={Users} color="bg-[#eef1fd] text-[#2952F3]" />
      <h2 className="text-[22px] font-bold text-[#0B1426] leading-tight mb-2">
        Agrega tu primer inquilino
      </h2>
      <p className="text-[14px] text-slate-400 leading-relaxed mb-6">
        {propertyName ? (
          <>Datos del inquilino de <span className="font-semibold text-[#0B1426]">{propertyName}</span>.</>
        ) : (
          "Ingresa los datos del inquilino."
        )}
      </p>

      <div className="space-y-4 mb-6">
        <div className="space-y-1.5">
          <label className="text-[14px] font-semibold text-[#0B1426]">Nombre completo <span className="text-red-500">*</span></label>
          <Input
            placeholder="Ej. María García López"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-11 text-[15px]"
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[14px] font-semibold text-[#0B1426]">
            Teléfono WhatsApp <span className="text-red-500">*</span>
          </label>
          <Input
            placeholder="521XXXXXXXXXX (con código de país)"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
            inputMode="tel"
            className="h-11 text-[15px] font-mono"
          />
          <p className="text-[12px] text-slate-400">
            México: 521 + 10 dígitos · Ej. 5215512345678
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[13px] font-semibold text-[#0B1426]">Renta mensual <span className="text-slate-400 font-normal">(opcional)</span></label>
            <Input
              type="number"
              min="0"
              step="100"
              placeholder="$0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-11"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-semibold text-[#0B1426]">Día de pago <span className="text-slate-400 font-normal">(opcional)</span></label>
            <Input
              type="number"
              min="1"
              max="31"
              placeholder="1–31"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="h-11"
              inputMode="numeric"
            />
          </div>
        </div>
        {error && (
          <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}
      </div>

      <div className="mt-auto flex flex-col gap-3">
        <Button
          className="w-full bg-[#2952F3] hover:bg-[#1e3fd4] h-12 text-[15px] font-semibold"
          onClick={onNext}
          disabled={!name.trim() || !phone.trim() || loading}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Agregar inquilino <ChevronRight className="w-4 h-4 ml-1" /></>}
        </Button>
        <button
          onClick={onSkip}
          className="text-[13px] text-slate-400 hover:text-slate-600 transition-colors text-center py-1"
        >
          Omitir por ahora
        </button>
      </div>
    </div>
  );
}

function DoneStep({
  propertyName, tenantName, onFinish,
}: {
  propertyName: string;
  tenantName: string;
  onFinish: () => void;
}) {
  return (
    <div className="flex flex-col flex-1 items-center text-center">
      <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mb-6">
        <CheckCircle2 className="w-10 h-10 text-emerald-500" />
      </div>
      <h2 className="text-[26px] font-bold text-[#0B1426] leading-tight mb-3">
        ¡Todo listo!
      </h2>
      <p className="text-[15px] text-slate-500 leading-relaxed mb-6">
        Ya tienes tu cuenta configurada.
        {propertyName && (
          <> Creaste la propiedad <span className="font-semibold text-[#0B1426]">{propertyName}</span>
          {tenantName && <> e inscribiste a <span className="font-semibold text-[#0B1426]">{tenantName}</span></>}.</>
        )}
      </p>

      <div className="w-full space-y-3 mb-10 text-left">
        {[
          { icon: BarChart2, text: "Revisa el Dashboard para ver el estado de cobro" },
          { icon: Plus, text: "Agrega más propiedades e inquilinos en cualquier momento" },
          { icon: MessageCircle, text: "Cuando el bot esté activo, los comprobantes de WhatsApp aparecerán automáticamente" },
        ].map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-[#eef1fd] flex items-center justify-center shrink-0 mt-0.5">
              <Icon className="w-3.5 h-3.5 text-[#2952F3]" />
            </div>
            <p className="text-[14px] text-slate-600 leading-snug">{text}</p>
          </div>
        ))}
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

  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return !!localStorage.getItem(STORAGE_KEY);
  });
  const [step, setStep] = useState<WizardStep>("welcome");
  const [createdPropertyId, setCreatedPropertyId] = useState<number | null>(null);
  const [createdPropertyName, setCreatedPropertyName] = useState("");
  const [createdTenantName, setCreatedTenantName] = useState("");

  const [propName, setPropName] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [paymentDay, setPaymentDay] = useState("");
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
    setDismissed(true);
  };

  const handleCreateProperty = async () => {
    if (!propName.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const prop = await api.createProperty(landlordId, { name: propName.trim() });
      setCreatedPropertyId(prop.id);
      setCreatedPropertyName(prop.name);
      await fetchProperties();
      setStep("tenant");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTenant = async () => {
    if (!tenantName.trim() || !tenantPhone.trim() || loading || !createdPropertyId) return;
    setLoading(true);
    setError(null);
    try {
      const amountNum = monthlyAmount ? parseFloat(monthlyAmount) : undefined;
      const dayNum = paymentDay ? parseInt(paymentDay, 10) : undefined;
      await api.createTenant(createdPropertyId, {
        name: tenantName.trim(),
        phone: tenantPhone.trim(),
        ...(amountNum && amountNum > 0 ? { monthlyAmount: amountNum } : {}),
        ...(dayNum && dayNum >= 1 && dayNum <= 31 ? { paymentDay: dayNum } : {}),
      });
      setCreatedTenantName(tenantName.trim());
      await fetchAllTenants();
      setStep("done");
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

      {/* Header con dots + botón omitir */}
      <div className="flex items-center justify-between px-5 pt-5 pb-2 shrink-0">
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={cn(
                "rounded-full transition-all duration-300",
                i <= stepIdx
                  ? "w-6 h-2 bg-[#2952F3]"
                  : "w-2 h-2 bg-slate-200"
              )}
            />
          ))}
        </div>
        {step !== "done" && (
          <button
            onClick={() => dismiss(false)}
            className="flex items-center gap-1 text-[12px] text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Omitir todo
          </button>
        )}
      </div>

      {/* Contenido del paso */}
      <div className="flex-1 overflow-y-auto px-5 pt-6 pb-8 w-full max-w-lg mx-auto flex flex-col">
        {step === "welcome" && (
          <WelcomeStep onNext={() => setStep("property")} />
        )}
        {step === "property" && (
          <PropertyStep
            value={propName}
            onChange={setPropName}
            onNext={handleCreateProperty}
            onSkip={() => dismiss(false)}
            loading={loading}
            error={error}
          />
        )}
        {step === "tenant" && (
          <TenantStep
            propertyName={createdPropertyName}
            name={tenantName} setName={setTenantName}
            phone={tenantPhone} setPhone={setTenantPhone}
            amount={monthlyAmount} setAmount={setMonthlyAmount}
            day={paymentDay} setDay={setPaymentDay}
            onNext={handleCreateTenant}
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
          />
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}

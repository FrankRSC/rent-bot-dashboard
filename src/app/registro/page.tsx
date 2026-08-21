"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthCard } from "@/components/layout/AuthCard";
import * as api from "@/lib/api";

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const score =
    password.length < 8 ? 1
    : password.length >= 12 && /[A-Z]/.test(password) && /[0-9!@#$%^&*]/.test(password) ? 3
    : 2;
  const bar = ["", "bg-red-400", "bg-amber-400", "bg-emerald-500"] as const;
  const label = ["", "Débil", "Aceptable", "Segura"] as const;
  const text = ["", "text-red-500", "text-amber-500", "text-emerald-600"] as const;
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="flex gap-1 flex-1">
        {[1, 2, 3].map((l) => (
          <div key={l} className={`h-1 flex-1 rounded-full transition-colors ${l <= score ? bar[score] : "bg-slate-200"}`} />
        ))}
      </div>
      <span className={`text-[11px] font-medium ${text[score]}`}>{label[score]}</span>
    </div>
  );
}

function RegisterContent() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const confirmMismatch = confirm.length > 0 && confirm.length >= password.length && password !== confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.registerLandlord({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
      });
      router.push("/login?registered=1");
    } catch (err) {
      const msg = (err as Error).message;
      setError(
        msg.startsWith("409")
          ? "Ya existe una cuenta con ese correo."
          : msg.startsWith("400")
          ? "Revisa los datos ingresados e intenta de nuevo."
          : "No se pudo crear la cuenta. Revisa tu conexión e intenta de nuevo."
      );
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = name && email && phone && password && confirm && !confirmMismatch;

  return (
    <>
      <div className="mb-7">
        <h1 className="text-[22px] font-bold text-[#0B1426] tracking-tight">Crear cuenta</h1>
        <p className="text-[13px] text-slate-400 mt-1">Panel de cobranza de rentas</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="reg-name" className="text-[13px] font-medium text-[#0B1426]">Nombre completo</label>
          <Input
            id="reg-name"
            type="text"
            autoComplete="name"
            placeholder="Juan Pérez"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-10"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="reg-email" className="text-[13px] font-medium text-[#0B1426]">Correo</label>
          <Input
            id="reg-email"
            type="email"
            autoComplete="email"
            placeholder="tucorreo@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="reg-phone" className="text-[13px] font-medium text-[#0B1426]">Teléfono</label>
          <Input
            id="reg-phone"
            type="tel"
            autoComplete="tel"
            placeholder="52XXXXXXXXXX"
            inputMode="tel"
            maxLength={13}
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 13))}
            className="h-10"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="reg-password" className="text-[13px] font-medium text-[#0B1426]">Contraseña</label>
          <div className="relative">
            <Input
              id="reg-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              tabIndex={-1}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <PasswordStrength password={password} />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="reg-confirm" className="text-[13px] font-medium text-[#0B1426]">Confirmar contraseña</label>
          <Input
            id="reg-confirm"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Repite tu contraseña"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={confirmMismatch}
            className="h-10"
            required
          />
          {confirmMismatch && (
            <p role="alert" className="text-[12px] text-red-500">
              Las contraseñas no coinciden.
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={loading || !canSubmit}
          className="w-full h-10 bg-[#2952F3] hover:bg-[#1e3fd4] mt-1"
        >
          {loading ? "Creando cuenta..." : "Registrarme"}
        </Button>
      </form>

      <div className="mt-6 pt-5 border-t border-slate-100 text-center">
        <p className="text-[13px] text-slate-400">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-[#2952F3] hover:underline font-medium">
            Inicia sesión
          </Link>
        </p>
      </div>
    </>
  );
}

export default function RegisterPage() {
  return (
    <AuthCard>
      <Suspense fallback={null}>
        <RegisterContent />
      </Suspense>
    </AuthCard>
  );
}

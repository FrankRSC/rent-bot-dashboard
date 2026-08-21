"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";
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

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <div className="text-center space-y-5 py-4">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6 text-red-500" />
        </div>
        <div>
          <p className="text-[20px] font-semibold text-[#0B1426] mb-2">Enlace inválido</p>
          <p className="text-[13px] text-slate-500 leading-relaxed">
            Este enlace no es válido o ya expiró. Los enlaces de recuperación son de un solo uso y duran 24&nbsp;horas.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/recuperar-contrasena"
            className="inline-flex items-center gap-1.5 text-[13px] text-[#2952F3] hover:underline font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Solicitar un nuevo enlace
          </Link>
        </div>
      </div>
    );
  }

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
      await api.resetPassword(token, password);
      setDone(true);
      setTimeout(() => router.replace("/login?reset=1"), 2500);
    } catch (err) {
      const msg = (err as Error).message;
      setError(
        msg.startsWith("400") || msg.startsWith("404")
          ? "El enlace no es válido o ya expiró. Solicita uno nuevo."
          : "No se pudo restablecer la contraseña. Intenta de nuevo."
      );
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="text-center py-4">
        <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="w-7 h-7 text-emerald-500" />
        </div>
        <p className="text-[20px] font-semibold text-[#0B1426] mb-2">Contraseña actualizada</p>
        <p className="text-[13px] text-slate-500">Redirigiendo al inicio de sesión…</p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-7">
        <h1 className="text-[22px] font-bold text-[#0B1426] tracking-tight">Nueva contraseña</h1>
        <p className="text-[13px] text-slate-400 mt-1">Elige una contraseña segura</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="reset-password" className="text-[13px] font-medium text-[#0B1426]">Nueva contraseña</label>
        <div className="relative">
          <Input
            id="reset-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-10 pr-10"
            autoFocus
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
        <label htmlFor="reset-confirm" className="text-[13px] font-medium text-[#0B1426]">Confirmar contraseña</label>
        <Input
          id="reset-confirm"
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
        disabled={loading || !password || !confirm || confirmMismatch}
        className="w-full h-10 bg-[#2952F3] hover:bg-[#1e3fd4] mt-1"
      >
        {loading ? "Guardando..." : "Establecer nueva contraseña"}
      </Button>
    </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthCard>
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </AuthCard>
  );
}

"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as api from "@/lib/api";

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
      <div className="text-center">
        <p className="text-[14px] text-slate-500 mb-4">
          El enlace no es válido o ya expiró.
        </p>
        <Link href="/recuperar-contrasena" className="text-[#2952F3] hover:underline text-[13px] font-medium">
          Solicitar un nuevo enlace
        </Link>
      </div>
    );
  }

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
      <div className="text-center">
        <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-7 h-7 text-emerald-500" />
        </div>
        <p className="text-[15px] font-semibold text-[#0B1426] mb-2">
          Contraseña actualizada
        </p>
        <p className="text-[13px] text-slate-500">
          Redirigiendo al inicio de sesión…
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-[#0B1426]">Nueva contraseña</label>
        <div className="relative">
          <Input
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pr-9"
            autoFocus
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            tabIndex={-1}
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-[#0B1426]">Confirmar contraseña</label>
        <Input
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Repite tu contraseña"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </div>

      {error && (
        <p className="text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={loading || !password || !confirm}
        className="w-full bg-[#2952F3] hover:bg-[#1e3fd4]"
      >
        {loading ? "Guardando..." : "Establecer nueva contraseña"}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F5F7] px-4">
      <div
        className="w-full max-w-sm bg-white rounded-2xl border border-slate-200/80 p-8"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
      >
        <div className="flex flex-col items-center gap-3 mb-7">
          <div className="w-11 h-11 rounded-2xl bg-[#eef1fd] flex items-center justify-center">
            <Building2 className="w-5 h-5 text-[#2952F3]" />
          </div>
          <div className="text-center">
            <h1 className="text-[20px] font-bold text-[#0B1426] tracking-tight">
              Nueva contraseña
            </h1>
            <p className="text-[13px] text-slate-400 mt-0.5">
              Panel de cobranza de rentas
            </p>
          </div>
        </div>

        <Suspense fallback={null}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}

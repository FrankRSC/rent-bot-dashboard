"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { useStore } from "@/store/useStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthCard } from "@/components/layout/AuthCard";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered") === "1";
  const reset = searchParams.get("reset") === "1";
  const login = useStore((s) => s.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      router.replace("/dashboard");
    } catch (err) {
      const msg = (err as Error).message;
      setError(
        msg.startsWith("401")
          ? "Correo o contraseña incorrectos."
          : "No se pudo iniciar sesión. Revisa tu conexión e intenta de nuevo."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="mb-7">
        <h1 className="text-[22px] font-bold text-[#0B1426] tracking-tight">Iniciar sesión</h1>
        <p className="text-[13px] text-slate-400 mt-1">Bienvenido de vuelta</p>
      </div>

      {registered && (
        <p role="status" className="mb-5 text-[13px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
          Cuenta creada exitosamente. Ya puedes iniciar sesión.
        </p>
      )}
      {reset && (
        <p role="status" className="mb-5 text-[13px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
          Contraseña actualizada. Inicia sesión con tu nueva contraseña.
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="login-email" className="text-[13px] font-medium text-[#0B1426]">
            Correo
          </label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="tucorreo@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!error}
            className="h-10"
            required
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="login-password" className="text-[13px] font-medium text-[#0B1426]">
              Contraseña
            </label>
            <Link
              href="/recuperar-contrasena"
              className="text-[12px] text-[#2952F3] hover:underline"
              tabIndex={-1}
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 pr-10"
              aria-invalid={!!error}
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
        </div>

        {error && (
          <p role="alert" className="text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={loading || !email || !password}
          className="w-full h-10 bg-[#2952F3] hover:bg-[#1e3fd4] mt-1"
        >
          {loading ? "Entrando..." : "Entrar"}
        </Button>
      </form>

      <div className="mt-6 pt-5 border-t border-slate-100 text-center">
        <p className="text-[13px] text-slate-400">
          ¿No tienes cuenta?{" "}
          <Link href="/registro" className="text-[#2952F3] hover:underline font-medium">
            Regístrate
          </Link>
        </p>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <AuthCard>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}

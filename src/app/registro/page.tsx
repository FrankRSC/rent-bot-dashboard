"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as api from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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

  const canSubmit = name && email && phone && password && confirm;

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
            <h1 className="text-[20px] font-bold text-[#0B1426] tracking-tight">Crear cuenta</h1>
            <p className="text-[13px] text-slate-400 mt-0.5">Panel de cobranza de rentas</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#0B1426]">Nombre completo</label>
            <Input
              type="text"
              autoComplete="name"
              placeholder="Juan Pérez"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#0B1426]">Correo</label>
            <Input
              type="email"
              autoComplete="email"
              placeholder="tucorreo@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#0B1426]">Teléfono</label>
            <Input
              type="tel"
              autoComplete="tel"
              placeholder="55 1234 5678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#0B1426]">Contraseña</label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-9"
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
            disabled={loading || !canSubmit}
            className="w-full bg-[#2952F3] hover:bg-[#1e3fd4]"
          >
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </Button>
        </form>

        <p className="mt-5 text-center text-[13px] text-slate-400">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-[#2952F3] hover:underline font-medium">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}

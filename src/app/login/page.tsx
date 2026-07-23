"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { useStore } from "@/store/useStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const login = useStore((s) => s.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
            <h1 className="text-[20px] font-bold text-[#0B1426] tracking-tight">Iniciar sesión</h1>
            <p className="text-[13px] text-slate-400 mt-0.5">Panel de cobranza de rentas</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
            <label className="text-sm font-medium text-[#0B1426]">Contraseña</label>
            <Input
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            disabled={loading || !email || !password}
            className="w-full bg-[#2952F3] hover:bg-[#1e3fd4]"
          >
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}

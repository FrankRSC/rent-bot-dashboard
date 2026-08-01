"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, ArrowLeft, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as api from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.forgotPassword(email.trim());
    } catch {
      // Silenciamos errores del backend para no revelar si el correo existe.
      // Solo mostramos error ante fallo de red (no hay respuesta alguna).
    } finally {
      setLoading(false);
      setSent(true);
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
            <h1 className="text-[20px] font-bold text-[#0B1426] tracking-tight">
              Recuperar contraseña
            </h1>
            <p className="text-[13px] text-slate-400 mt-0.5">
              Panel de cobranza de rentas
            </p>
          </div>
        </div>

        {sent ? (
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <Mail className="w-7 h-7 text-emerald-500" />
            </div>
            <p className="text-[15px] font-semibold text-[#0B1426] mb-2">
              Revisa tu correo
            </p>
            <p className="text-[13px] text-slate-500 leading-relaxed mb-6">
              Si existe una cuenta con{" "}
              <span className="font-medium text-[#0B1426]">{email}</span>, recibirás
              un enlace para restablecer tu contraseña en los próximos minutos.
            </p>
            <p className="text-[12px] text-slate-400 mb-6">
              No olvides revisar la carpeta de spam.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-[13px] text-[#2952F3] hover:underline font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Volver al inicio de sesión
            </Link>
          </div>
        ) : (
          <>
            <p className="text-[13px] text-slate-500 mb-5 leading-relaxed">
              Ingresa el correo de tu cuenta y te enviaremos un enlace para
              restablecer tu contraseña.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#0B1426]">
                  Correo electrónico
                </label>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="tucorreo@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
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
                disabled={loading || !email}
                className="w-full bg-[#2952F3] hover:bg-[#1e3fd4]"
              >
                {loading ? "Enviando..." : "Enviar enlace"}
              </Button>
            </form>

            <p className="mt-5 text-center text-[13px] text-slate-400">
              <Link
                href="/login"
                className="inline-flex items-center gap-1 text-[#2952F3] hover:underline font-medium"
              >
                <ArrowLeft className="w-3 h-3" /> Volver al inicio de sesión
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthCard } from "@/components/layout/AuthCard";
import * as api from "@/lib/api";

function ForgotPasswordContent() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Leer del DOM para capturar autocomplete que no disparó onChange.
    const formEmail = (new FormData(e.currentTarget).get("email") as string | null)?.trim() ?? email.trim();
    if (!formEmail) return;
    setLoading(true);
    setError(null);
    try {
      await api.forgotPassword(formEmail);
    } catch {
      // Silenciamos errores del backend para no revelar si el correo existe.
    } finally {
      setLoading(false);
      setSent(true);
    }
  };

  if (sent) {
    return (
      <div className="text-center py-4">
        <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-5">
          <Mail className="w-7 h-7 text-emerald-500" />
        </div>
        <p className="text-[20px] font-semibold text-[#0B1426] mb-2">Revisa tu correo</p>
        <p className="text-[13px] text-slate-500 leading-relaxed mb-1.5">
          Si existe una cuenta con{" "}
          <span className="font-medium text-[#0B1426]">{email}</span>, recibirás un enlace
          para restablecer tu contraseña en los próximos minutos.
        </p>
        <p className="text-[12px] text-slate-400 mb-8">No olvides revisar la carpeta de spam.</p>
        <div className="flex flex-col items-center gap-3">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-[13px] text-[#2952F3] hover:underline font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Volver al inicio de sesión
          </Link>
          <button
            type="button"
            onClick={() => { setSent(false); setEmail(""); }}
            className="text-[12px] text-slate-400 hover:text-slate-600 hover:underline"
          >
            Intentar con otro correo
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-7">
        <h1 className="text-[22px] font-bold text-[#0B1426] tracking-tight">
          Recuperar contraseña
        </h1>
        <p className="text-[13px] text-slate-400 mt-1">Ingresa el correo de tu cuenta</p>
      </div>

      <p className="text-[13px] text-slate-500 mb-6 leading-relaxed">
        Te enviaremos un enlace para restablecer tu contraseña.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="forgot-email" className="text-[13px] font-medium text-[#0B1426]">
            Correo electrónico
          </label>
          <Input
            id="forgot-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="tucorreo@ejemplo.co"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10"
            autoFocus
            required
          />
        </div>

        {error && (
          <p role="alert" className="text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={loading || !email}
          className="w-full h-10 bg-[#2952F3] hover:bg-[#1e3fd4] mt-1"
        >
          {loading ? "Enviando..." : "Enviar enlace"}
        </Button>
      </form>

      <div className="mt-6 pt-5 border-t border-slate-100 text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-[13px] text-[#2952F3] hover:underline font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Volver al inicio de sesión
        </Link>
      </div>
    </>
  );
}

export default function ForgotPasswordPage() {
  return (
    <AuthCard>
      <Suspense fallback={null}>
        <ForgotPasswordContent />
      </Suspense>
    </AuthCard>
  );
}

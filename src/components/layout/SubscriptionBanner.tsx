"use client";

import { AlertOctagon } from "lucide-react";
import { useStore } from "@/store/useStore";

/**
 * Banner de plan vencido (§2.10 CONTRATOS_API.md).
 *
 * El bloqueo del backend es **suave**: el bot deja de validar comprobantes (los
 * recibe igual y quedan en REVIEW), no salen recordatorios y no se timbran
 * facturas — pero la lectura del dashboard queda intacta. Por eso esto es un
 * banner y no un gate: no bloquea navegación ni login.
 *
 * Sin esto el arrendador solo vería que "el sistema dejó de funcionar" sin
 * explicación, que es exactamente lo que el bloqueo suave busca evitar.
 */
export function SubscriptionBanner() {
  const subscription = useStore((s) => s.subscription);

  // `isOperational` es la ÚNICA fuente: `status` puede decir "ACTIVA" con la
  // vigencia ya vencida hasta que corra el cron del backend (1:00 UTC), así que
  // derivarlo de ahí dejaría al arrendador sin aviso durante horas.
  if (!subscription || subscription.isOperational) return null;

  return (
    <div
      role="status"
      className="flex items-start sm:items-center gap-2.5 px-4 sm:px-6 py-2.5 bg-red-50 border-b border-red-200"
    >
      <AlertOctagon className="w-4 h-4 text-red-600 shrink-0 mt-0.5 sm:mt-0" />
      <p className="text-[12px] sm:text-[13px] text-red-800 flex-1 min-w-0">
        {/* Texto redactado por el backend; no lo reescribimos aquí para que
            arrendador y bot digan exactamente lo mismo. */}
        {subscription.blockedReason ?? "Tu plan no está activo."}
      </p>
    </div>
  );
}

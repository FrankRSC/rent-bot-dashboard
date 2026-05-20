"use client";

import { AlertTriangle } from "lucide-react";
import { useStore } from "@/store/useStore";

export function ConnectionBanner() {
  const { propertiesState, paymentsState } = useStore();

  const hasError = !!(propertiesState.error || paymentsState.error);
  const isLoading = propertiesState.loading || paymentsState.loading;

  if (!hasError || isLoading) return null;

  return (
    <div className="flex items-center gap-2.5 px-4 sm:px-6 py-2.5 bg-amber-50 border-b border-amber-200">
      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
      <p className="text-[13px] font-medium text-amber-700">
        Algo salió mal al cargar los datos — intenta recargar la página
      </p>
    </div>
  );
}

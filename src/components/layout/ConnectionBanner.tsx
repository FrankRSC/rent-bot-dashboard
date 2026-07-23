"use client";

import { AlertTriangle, RotateCw } from "lucide-react";
import { useStore } from "@/store/useStore";

export function ConnectionBanner() {
  const {
    propertiesState,
    tenantsState,
    paymentsState,
    facturasState,
    fetchProperties,
    fetchAllTenants,
    fetchPayments,
    fetchFacturas,
  } = useStore();

  const hasError = !!(
    propertiesState.error ||
    tenantsState.error ||
    paymentsState.error ||
    facturasState.error
  );
  const isLoading =
    propertiesState.loading ||
    tenantsState.loading ||
    paymentsState.loading ||
    facturasState.loading;

  if (!hasError || isLoading) return null;

  const handleRetry = () => {
    if (propertiesState.error) fetchProperties();
    if (tenantsState.error) fetchAllTenants();
    if (paymentsState.error) fetchPayments();
    if (facturasState.error) fetchFacturas();
  };

  return (
    <div className="flex items-center gap-2.5 px-4 sm:px-6 py-2.5 bg-amber-50 border-b border-amber-200">
      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
      <p className="text-[13px] font-medium text-amber-700">
        Algo salió mal al cargar los datos
      </p>
      <button
        onClick={handleRetry}
        className="inline-flex items-center gap-1 text-[12px] font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-full px-2.5 py-0.5 transition-colors ml-1 shrink-0"
      >
        <RotateCw className="w-3 h-3" />
        Reintentar
      </button>
    </div>
  );
}

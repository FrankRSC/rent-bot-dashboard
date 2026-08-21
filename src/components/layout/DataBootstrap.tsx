"use client";

import { useEffect } from "react";
import { useStore } from "@/store/useStore";

const HEALTH_CHECK_INTERVAL_MS = 30_000;

export function DataBootstrap() {
  const authReady = useStore((s) => s.authReady);
  const {
    fetchProperties, fetchAllTenants, fetchPayments,
    fetchLandlordSettings, fetchSubscription, checkHealth,
  } = useStore();

  useEffect(() => {
    // Carga inicial en paralelo (sin waterfall, docs/MEJORAS.md D6) tras resolver la
    // sesión: en el camino feliz `hydrateAuth` ya fijó `landlordId`; si el backend
    // está caído entra optimista (landlordId 0) y estos fetch fallan → el banner de
    // error aparece, que es justo lo que queremos mostrar.
    if (authReady) {
      fetchProperties();
      fetchAllTenants();
      fetchPayments();
      fetchLandlordSettings();
      fetchSubscription();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady]);

  useEffect(() => {
    // Health real del backend cada 30 s (docs/MEJORAS.md D3).
    checkHealth();
    const healthInterval = setInterval(checkHealth, HEALTH_CHECK_INTERVAL_MS);
    return () => clearInterval(healthInterval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

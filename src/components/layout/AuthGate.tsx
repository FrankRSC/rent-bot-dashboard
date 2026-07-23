"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/store/useStore";

/**
 * Sincroniza la sesión del cliente (Fase 4c). El **guard real** vive ahora en el
 * middleware del servidor (`src/middleware.ts`), que redirige a /login si falta la
 * cookie. Este componente **no bloquea el render** (así el contenido SSR se ve sin
 * spinner): solo hidrata `landlordId` desde `GET /me` y, si la cookie resultó
 * inválida/expirada (401), redirige a /login como respaldo.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const authReady = useStore((s) => s.authReady);
  const authenticated = useStore((s) => s.authenticated);
  const hydrateAuth = useStore((s) => s.hydrateAuth);

  useEffect(() => {
    hydrateAuth();
  }, [hydrateAuth]);

  useEffect(() => {
    if (authReady && !authenticated) router.replace("/login");
  }, [authReady, authenticated, router]);

  return <>{children}</>;
}

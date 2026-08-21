import { cookies } from "next/headers";
import type { Landlord, LandlordReport, Property, Tenant, PaymentAttempt, Factura } from "./types";

/**
 * Capa de datos para **Server Components** (Fase 4b). Lee la cookie httpOnly
 * `rc_token` (la misma que gestiona el BFF, Fase 4a) y llama al backend directo,
 * en el servidor, adjuntando `Authorization: Bearer`. Habilita el fetch inicial en
 * servidor (primer render con datos, sin waterfall del cliente).
 *
 * Nunca lanza: si no hay sesión o el backend falla, devuelve `null` y la vista del
 * cliente hace su fetch normal (fallback). Por eso los e2e —que no tienen la cookie
 * real— caen al camino cliente y siguen usando sus mocks del navegador.
 */
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";
const TOKEN_COOKIE = "rc_token";

async function serverFetch<T>(path: string): Promise<T | null> {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!token) return null;
  try {
    const res = await fetch(`${BACKEND_URL}/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // Sin sesión válida o backend caído/lento: el cliente hará el fetch.
    return null;
  }
}

export const getServerMe = () => serverFetch<Landlord>("me");

export const getServerReport = (landlordId: string, month?: string) =>
  serverFetch<LandlordReport>(
    `landlords/${landlordId}/report${month ? `?month=${month}` : ""}`
  );

export const getServerProperties = (landlordId: string) =>
  serverFetch<Property[]>(`landlords/${landlordId}/properties`);

export const getServerTenants = (landlordId: string) =>
  serverFetch<Tenant[]>(`landlords/${landlordId}/tenants`);

export const getServerPayments = () =>
  serverFetch<PaymentAttempt[]>(`payments?limit=50`);

export const getServerFacturas = (landlordId: string, period?: string) =>
  serverFetch<Factura[]>(
    `landlords/${landlordId}/facturas${period ? `?period=${period}` : ""}`
  );

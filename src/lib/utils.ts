import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { PaymentStatus } from "@/lib/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * `true` si el inquilino debe dinero y ya se le pasó el plazo (incluidos los días
 * de gracia). Es la condición de "alerta" en tarjetas y listados.
 *
 * Existe como helper para que las alertas no se queden a medias: hasta el
 * 2026-08-16 bastaba con comparar contra `"Vencido"`, y ese valor se partió en
 * dos — `"Atrasado"` mientras el mes corre y `"Vencido"` cuando ya cerró. Las
 * comparaciones sueltas seguían compilando y dejaban de detectar la mitad.
 */
export function isDelinquent(status: PaymentStatus): boolean {
  return status === "Atrasado" || status === "Vencido";
}

export function formatMXN(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(amount) + " MXN";
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatPhone(phone: string): string {
  // format: 52XXXXXXXXXX -> +52 (XXX) XXX-XXXX
  if (phone.length === 13 && phone.startsWith("521")) {
    const num = phone.slice(3);
    return `+52 1 (${num.slice(0, 3)}) ${num.slice(3, 6)}-${num.slice(6)}`;
  }
  if (phone.length === 13 && phone.startsWith("52")) {
    const num = phone.slice(2);
    return `+52 (${num.slice(0, 3)}) ${num.slice(3, 6)}-${num.slice(6)}`;
  }
  return phone;
}

export function formatAccount(account: string, type: string): string {
  if (type === "CLABE" && account.length === 18) {
    return account.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
  }
  if (type === "CARD" && account.length === 16) {
    return account.replace(/(\d{4})/g, "$1 ").trim();
  }
  return account;
}
